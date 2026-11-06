import { bondColorForElements } from "./bond-colors";
import { isElementSymbol } from "./elements";
import { cartToFrac, determinant3, fracToCart } from "./math";
import type { InferredBond, SharePayloadV1, Vec3 } from "./types";

function angle(a: Vec3, b: Vec3) {
  const dot = a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
  return Math.acos(Math.max(-1, Math.min(1, dot / (Math.hypot(...a) * Math.hypot(...b))))) * 180 / Math.PI;
}

function wrapFractionalCoordinate(value: number) {
  const remainder = value - Math.floor(value);
  const wrapped = remainder >= 1 - 1e-10 ? 0 : Number(remainder.toFixed(15));
  return { wrapped, image: Math.round(value - wrapped) };
}

export function toMatterVizStructure(payload: SharePayloadV1, bonds: InferredBond[]) {
  const { structure } = payload;
  const matrix: [Vec3, Vec3, Vec3] = [
    [structure.cell[0], structure.cell[1], structure.cell[2]],
    [structure.cell[3], structure.cell[4], structure.cell[5]],
    [structure.cell[6], structure.cell[7], structure.cell[8]],
  ];
  const [aVec, bVec, cVec] = matrix;
  const normalizedSites = structure.elements.map((element, idx) => {
    const xyz: Vec3 = [
      structure.positions[idx * 3] - structure.origin[0],
      structure.positions[idx * 3 + 1] - structure.origin[1],
      structure.positions[idx * 3 + 2] - structure.origin[2],
    ];
    const originalFractional = cartToFrac(xyz, structure.cell);
    const axes = originalFractional.map(wrapFractionalCoordinate);
    const abc = axes.map(({ wrapped }) => wrapped) as Vec3;
    const image = axes.map(({ image: cellImage }) => cellImage) as Vec3;
    return {
      image,
      site: {
        species: [{ element: isElementSymbol(element) ? element : "C", occu: 1, oxidation_state: 0 }],
        abc,
        xyz: fracToCart(abc, structure.cell),
        label: element,
        properties: { source_element: element },
      },
    };
  });
  const explicitBonds = bonds.map((bond) => {
    const imageA = normalizedSites[bond.atomA].image;
    const imageB = normalizedSites[bond.atomB].image;
    const cellShift = bond.imageShift.map(
      (shift, axis) => shift + imageB[axis] - imageA[axis],
    ) as Vec3;
    return {
      site_idx_1: bond.atomA,
      site_idx_2: bond.atomB,
      order: 1 as const,
      cell_shift: cellShift,
      display_color: bondColorForElements(
        structure.elements[bond.atomA],
        structure.elements[bond.atomB],
      ),
    };
  });

  return {
    sites: normalizedSites.map(({ site }) => site),
    lattice: {
      matrix,
      pbc: structure.pbc,
      a: Math.hypot(...aVec),
      b: Math.hypot(...bVec),
      c: Math.hypot(...cVec),
      alpha: angle(bVec, cVec),
      beta: angle(aVec, cVec),
      gamma: angle(aVec, bVec),
      volume: Math.abs(determinant3(structure.cell)),
    },
    properties: { bonds: explicitBonds },
  };
}
