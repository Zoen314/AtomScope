import type { Vec3 } from "./types";

export function determinant3(m: number[]): number {
  return (
    m[0] * (m[4] * m[8] - m[5] * m[7]) -
    m[1] * (m[3] * m[8] - m[5] * m[6]) +
    m[2] * (m[3] * m[7] - m[4] * m[6])
  );
}

export function inverse3(m: number[]): number[] {
  const det = determinant3(m);
  if (!Number.isFinite(det) || Math.abs(det) < 1e-12) {
    throw new Error("晶胞矩阵奇异，无法计算周期最小镜像");
  }
  const invDet = 1 / det;
  return [
    (m[4] * m[8] - m[5] * m[7]) * invDet,
    (m[2] * m[7] - m[1] * m[8]) * invDet,
    (m[1] * m[5] - m[2] * m[4]) * invDet,
    (m[5] * m[6] - m[3] * m[8]) * invDet,
    (m[0] * m[8] - m[2] * m[6]) * invDet,
    (m[2] * m[3] - m[0] * m[5]) * invDet,
    (m[3] * m[7] - m[4] * m[6]) * invDet,
    (m[1] * m[6] - m[0] * m[7]) * invDet,
    (m[0] * m[4] - m[1] * m[3]) * invDet,
  ];
}

export function cartToFrac(cart: Vec3, cell: number[]): Vec3 {
  // Cell vectors are rows. Solve cart = frac[0] A + frac[1] B + frac[2] C.
  const inv = inverse3(cell);
  return [
    cart[0] * inv[0] + cart[1] * inv[3] + cart[2] * inv[6],
    cart[0] * inv[1] + cart[1] * inv[4] + cart[2] * inv[7],
    cart[0] * inv[2] + cart[1] * inv[5] + cart[2] * inv[8],
  ];
}

export function fracToCart(frac: Vec3, cell: number[]): Vec3 {
  return [
    frac[0] * cell[0] + frac[1] * cell[3] + frac[2] * cell[6],
    frac[0] * cell[1] + frac[1] * cell[4] + frac[2] * cell[7],
    frac[0] * cell[2] + frac[1] * cell[5] + frac[2] * cell[8],
  ];
}

export function addCellShift(delta: Vec3, shift: Vec3, cell: number[]): Vec3 {
  return [
    delta[0] + shift[0] * cell[0] + shift[1] * cell[3] + shift[2] * cell[6],
    delta[1] + shift[0] * cell[1] + shift[1] * cell[4] + shift[2] * cell[7],
    delta[2] + shift[0] * cell[2] + shift[1] * cell[5] + shift[2] * cell[8],
  ];
}

export function norm3(v: Vec3): number {
  return Math.hypot(v[0], v[1], v[2]);
}

export function minimumImageDelta(
  from: Vec3,
  to: Vec3,
  cell: number[],
  pbc: [boolean, boolean, boolean],
): { delta: Vec3; shift: Vec3; distance: number } {
  const raw: Vec3 = [to[0] - from[0], to[1] - from[1], to[2] - from[2]];
  const frac = cartToFrac(raw, cell);
  const base: Vec3 = [
    pbc[0] ? -Math.round(frac[0]) : 0,
    pbc[1] ? -Math.round(frac[1]) : 0,
    pbc[2] ? -Math.round(frac[2]) : 0,
  ];
  let bestDelta = raw;
  let bestShift: Vec3 = [0, 0, 0];
  let bestDistance = norm3(raw);
  const sx = pbc[0] ? [-1, 0, 1] : [0];
  const sy = pbc[1] ? [-1, 0, 1] : [0];
  const sz = pbc[2] ? [-1, 0, 1] : [0];
  for (const dx of sx) for (const dy of sy) for (const dz of sz) {
    const shift: Vec3 = [base[0] + dx, base[1] + dy, base[2] + dz];
    const delta = addCellShift(raw, shift, cell);
    const distance = norm3(delta);
    if (distance < bestDistance - 1e-12) {
      bestDistance = distance;
      bestDelta = delta;
      bestShift = shift;
    }
  }
  return { delta: bestDelta, shift: bestShift, distance: bestDistance };
}
