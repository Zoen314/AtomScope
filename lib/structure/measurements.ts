import { cartToFrac, fracToCart, minimumImageDelta, norm3 } from "./math";
import type { NormalizedStructure, Vec3 } from "./types";

export type MeasurementMode = "distance" | "angle";
export type MeasurementInputs = [string, string, string];
type Displacement = ReturnType<typeof minimumImageDelta>;
export type AtomMeasurement =
  | { kind: "distance"; indices: [number, number]; distance: number; arm: Displacement }
  | { kind: "angle"; indices: [number, number, number]; angle: number; arms: [Displacement, Displacement] };
export interface MeasurementOverlay {
  segments: [Vec3, Vec3][];
  labelPosition: Vec3;
  label: string;
}

export const measurementCount = (mode: MeasurementMode) => mode === "distance" ? 2 : 3;

/** UI uses source-file, one-based atom IDs; never silently clamp invalid IDs. */
export function parseMeasurementInputs(mode: MeasurementMode, inputs: MeasurementInputs, count: number) {
  const indices: number[] = [];
  for (const text of inputs.slice(0, measurementCount(mode))) {
    if (!text.trim()) return { indices, complete: false, error: null };
    const id = Number(text);
    if (!Number.isInteger(id) || id < 1 || id > count) {
      return { indices, complete: false, error: `原子编号须为 1–${count} 的整数` };
    }
    if (indices.includes(id - 1)) return { indices, complete: false, error: "请选择不同的原子" };
    indices.push(id - 1);
  }
  return { indices, complete: true, error: null };
}

/** A completed pick followed by a new atom starts the next measurement. */
export function limitMeasurementPicks(indices: number[], mode: MeasurementMode, count: number) {
  const valid = [...new Set(indices.filter(id => Number.isInteger(id) && id >= 0 && id < count))];
  return valid.length > measurementCount(mode) ? valid.slice(-1) : valid;
}

const positionAt = (s: NormalizedStructure, index: number): Vec3 => s.positions.slice(index * 3, index * 3 + 3) as Vec3;
const add = (a: Vec3, b: Vec3): Vec3 => a.map((v, i) => v + b[i]) as Vec3;
const scale = (a: Vec3, k: number): Vec3 => a.map(v => v * k) as Vec3;

export function measureAtoms(structure: NormalizedStructure, mode: MeasurementMode, indices: number[]): AtomMeasurement {
  if (indices.length !== measurementCount(mode) || new Set(indices).size !== indices.length ||
      indices.some(id => !Number.isInteger(id) || id < 0 || id >= structure.elements.length)) {
    throw new Error(`请选择 ${measurementCount(mode)} 个不同且有效的原子`);
  }
  const displacement = (from: number, to: number) => minimumImageDelta(
    positionAt(structure, from), positionAt(structure, to), structure.cell, structure.pbc,
  );
  if (mode === "distance") {
    const arm = displacement(indices[0], indices[1]);
    return { kind: mode, indices: indices as [number, number], distance: arm.distance, arm };
  }
  // Both arms start at B. Independent A->B / A->C images would define a different angle.
  const arms: [Displacement, Displacement] = [displacement(indices[1], indices[0]), displacement(indices[1], indices[2])];
  if (arms.some(arm => arm.distance < 1e-12)) throw new Error("原子在周期最小镜像下重合，夹角未定义");
  const [a, b] = arms.map(arm => scale(arm.delta, 1 / arm.distance));
  const dot = a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
  const cross: Vec3 = [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
  const angle = Math.atan2(norm3(cross), dot) * 180 / Math.PI;
  return { kind: mode, indices: indices as [number, number, number], angle, arms };
}

/** Split only measurement guides at cell faces; does not touch inferred bond geometry. */
export function splitMeasurementSegment(start: Vec3, delta: Vec3, cell: number[], pbc: [boolean, boolean, boolean]): [Vec3, Vec3][] {
  const a = cartToFrac(start, cell), d = cartToFrac(delta, cell);
  const cuts = [0, 1];
  for (let axis = 0; axis < 3; axis++) {
    if (!pbc[axis] || Math.abs(d[axis]) < 1e-12) continue;
    const end = a[axis] + d[axis];
    for (let face = Math.ceil(Math.min(a[axis], end)); face <= Math.floor(Math.max(a[axis], end)); face++) {
      const t = (face - a[axis]) / d[axis];
      if (t > 1e-10 && t < 1 - 1e-10) cuts.push(t);
    }
  }
  const ordered = cuts.sort((x, y) => x - y).filter((v, i, all) => i === 0 || v - all[i - 1] > 1e-10);
  return ordered.slice(0, -1).map((t, i) => {
    const endT = ordered[i + 1], middle = (t + endT) / 2;
    const shift = a.map((v, axis) => pbc[axis] ? Math.floor(v + middle * d[axis]) : 0);
    const point = (at: number): Vec3 => fracToCart(a.map((v, axis) => v + at * d[axis] - shift[axis]) as Vec3, cell);
    return [point(t), point(endT)];
  });
}

export function createMeasurementOverlay(structure: NormalizedStructure, measurement: AtomMeasurement): MeasurementOverlay {
  const centerId = measurement.indices[measurement.kind === "angle" ? 1 : 0];
  const raw = positionAt(structure, centerId).map((v, i) => v - structure.origin[i]) as Vec3;
  // Match the existing renderer's primary-cell coordinate convention, without editing source data.
  const center = fracToCart(cartToFrac(raw, structure.cell).map(v => v - Math.floor(v)) as Vec3, structure.cell);
  const wrapLabel = (point: Vec3) => fracToCart(cartToFrac(point, structure.cell)
    .map((v, i) => structure.pbc[i] ? v - Math.floor(v) : v) as Vec3, structure.cell);
  const split = (from: Vec3, delta: Vec3) => splitMeasurementSegment(from, delta, structure.cell, structure.pbc);
  if (measurement.kind === "distance") {
    return {
      segments: split(center, measurement.arm.delta),
      labelPosition: wrapLabel(add(center, scale(measurement.arm.delta, 0.5))),
      label: `${measurement.distance.toFixed(4)} Å`,
    };
  }
  const [first, second] = measurement.arms;
  const segments = [...split(center, first.delta), ...split(center, second.delta)];
  const u = scale(first.delta, 1 / first.distance), v = scale(second.delta, 1 / second.distance);
  const theta = measurement.angle * Math.PI / 180;
  const radius = Math.min(0.55, first.distance * 0.28, second.distance * 0.28);
  let labelDirection = u;
  // At 0/180 degrees the arc plane is not unique; retain the two guides and numeric result.
  if (Math.abs(Math.sin(theta)) > 1e-8) {
    const perpendicular = scale(add(v, scale(u, -Math.cos(theta))), 1 / Math.sin(theta));
    const direction = (angle: number) => add(scale(u, Math.cos(angle)), scale(perpendicular, Math.sin(angle)));
    let previous = add(center, scale(u, radius));
    for (let i = 1; i <= 24; i++) {
      const next = add(center, scale(direction(theta * i / 24), radius));
      segments.push(...split(previous, add(next, scale(previous, -1))));
      previous = next;
    }
    labelDirection = direction(theta / 2);
  }
  return { segments, labelPosition: wrapLabel(add(center, scale(labelDirection, radius + 0.35))), label: `${measurement.angle.toFixed(3)}°` };
}
