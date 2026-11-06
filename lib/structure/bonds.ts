import { BODR_COVALENT_RADII } from "./bodr-radii.generated";
import { isElementSymbol, pairKey } from "./elements";
import { cartToFrac, fracToCart, minimumImageDelta } from "./math";
import type { BondInferenceResult, InferredBond, PairOverride, SharePayloadV1, Vec3 } from "./types";

export interface BondOptions {
  factor: number;
  minDistance: number;
  pairOverrides: Record<string, PairOverride>;
  maxBonds?: number;
}

type GridNode = { atom: number; position: Vec3 };

function positionAt(structure: SharePayloadV1["structure"], atom: number): Vec3 {
  return [
    structure.positions[atom * 3],
    structure.positions[atom * 3 + 1],
    structure.positions[atom * 3 + 2],
  ];
}

function wrapPosition(position: Vec3, structure: SharePayloadV1["structure"]): Vec3 {
  const relative: Vec3 = [
    position[0] - structure.origin[0],
    position[1] - structure.origin[1],
    position[2] - structure.origin[2],
  ];
  const fractional = cartToFrac(relative, structure.cell);
  const wrapped: Vec3 = fractional.map((value, axis) => structure.pbc[axis] ? value - Math.floor(value) : value) as Vec3;
  const cartesian = fracToCart(wrapped, structure.cell);
  return [
    cartesian[0] + structure.origin[0],
    cartesian[1] + structure.origin[1],
    cartesian[2] + structure.origin[2],
  ];
}

function gridKey(position: Vec3, size: number): string {
  return `${Math.floor(position[0] / size)},${Math.floor(position[1] / size)},${Math.floor(position[2] / size)}`;
}

function candidatePairs(
  structure: SharePayloadV1["structure"],
  validAtoms: number[],
  maxCutoff: number,
): Array<[number, number]> {
  if (!(maxCutoff > 0)) return [];
  const grid = new Map<string, GridNode[]>();
  const wrapped = new Map<number, Vec3>();
  const shiftsX = structure.pbc[0] ? [-1, 0, 1] : [0];
  const shiftsY = structure.pbc[1] ? [-1, 0, 1] : [0];
  const shiftsZ = structure.pbc[2] ? [-1, 0, 1] : [0];

  for (const atom of validAtoms) {
    const base = wrapPosition(positionAt(structure, atom), structure);
    wrapped.set(atom, base);
    for (const sx of shiftsX) for (const sy of shiftsY) for (const sz of shiftsZ) {
      const image: Vec3 = [
        base[0] + sx * structure.cell[0] + sy * structure.cell[3] + sz * structure.cell[6],
        base[1] + sx * structure.cell[1] + sy * structure.cell[4] + sz * structure.cell[7],
        base[2] + sx * structure.cell[2] + sy * structure.cell[5] + sz * structure.cell[8],
      ];
      const key = gridKey(image, maxCutoff);
      const bucket = grid.get(key) ?? [];
      bucket.push({ atom, position: image });
      grid.set(key, bucket);
    }
  }

  const pairs = new Set<string>();
  const cutoffSq = maxCutoff * maxCutoff;
  for (const atomA of validAtoms) {
    const point = wrapped.get(atomA)!;
    const gx = Math.floor(point[0] / maxCutoff);
    const gy = Math.floor(point[1] / maxCutoff);
    const gz = Math.floor(point[2] / maxCutoff);
    for (let dx = -1; dx <= 1; dx += 1) for (let dy = -1; dy <= 1; dy += 1) for (let dz = -1; dz <= 1; dz += 1) {
      for (const node of grid.get(`${gx + dx},${gy + dy},${gz + dz}`) ?? []) {
        if (node.atom <= atomA) continue;
        const x = node.position[0] - point[0];
        const y = node.position[1] - point[1];
        const z = node.position[2] - point[2];
        if (x * x + y * y + z * z < cutoffSq) pairs.add(`${atomA}:${node.atom}`);
      }
    }
  }
  return [...pairs].map((value) => value.split(":").map(Number) as [number, number]);
}

export function inferBonds(
  structure: SharePayloadV1["structure"],
  options: BondOptions,
): BondInferenceResult {
  const atomCount = structure.elements.length;
  if (structure.positions.length !== atomCount * 3) {
    throw new Error("positions 长度必须等于 elements.length × 3");
  }
  const maxBonds = options.maxBonds ?? Math.min(200_000, Math.max(atomCount * 20, 2_000));
  const validAtoms = structure.elements.flatMap((element, atom) => {
    const radius = BODR_COVALENT_RADII[element];
    return isElementSymbol(element) && radius ? [atom] : [];
  });
  const validCount = validAtoms.length;
  const skippedPairs = atomCount * (atomCount - 1) / 2 - validCount * (validCount - 1) / 2;
  const uniqueElements = [...new Set(validAtoms.map((atom) => structure.elements[atom]))];
  let maxCutoff = 0;
  for (let idxA = 0; idxA < uniqueElements.length; idxA += 1) for (let idxB = idxA; idxB < uniqueElements.length; idxB += 1) {
    const elementA = uniqueElements[idxA], elementB = uniqueElements[idxB];
    const override = options.pairOverrides[pairKey(elementA, elementB)];
    if (override && !override.enabled) continue;
    const upper = override ? override.max : options.factor * (BODR_COVALENT_RADII[elementA] + BODR_COVALENT_RADII[elementB]);
    if (Number.isFinite(upper)) maxCutoff = Math.max(maxCutoff, upper);
  }

  const bonds: InferredBond[] = [];
  for (const [atomA, atomB] of candidatePairs(structure, validAtoms, maxCutoff)) {
    const elementA = structure.elements[atomA], elementB = structure.elements[atomB];
    const override = options.pairOverrides[pairKey(elementA, elementB)];
    if (override && !override.enabled) continue;
    const lower = override ? override.min : options.minDistance;
    const upper = override ? override.max : options.factor * (BODR_COVALENT_RADII[elementA] + BODR_COVALENT_RADII[elementB]);
    if (!(upper > lower) || lower < 0) continue;
    const mic = minimumImageDelta(positionAt(structure, atomA), positionAt(structure, atomB), structure.cell, structure.pbc);
    if (mic.distance >= lower && mic.distance < upper) {
      bonds.push({ atomA, atomB, distance: mic.distance, imageShift: mic.shift });
      if (bonds.length > maxBonds) {
        return {
          bonds: [],
          skippedPairs,
          warning: `推断键超过浏览器安全上限 ${maxBonds.toLocaleString()}，已默认隐藏；请降低灵敏度或设置元素对阈值。`,
        };
      }
    }
  }
  bonds.sort((a, b) => a.atomA - b.atomA || a.atomB - b.atomB);
  return { bonds, skippedPairs };
}
