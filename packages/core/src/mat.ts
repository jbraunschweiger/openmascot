/** Minimal 2D affine helpers. Matrices are `[a, b, c, d, e, f]` (SVG order). */
import type { Mat } from './types';

export const IDENTITY: Readonly<Mat> = Object.freeze([1, 0, 0, 1, 0, 0]) as Readonly<Mat>;

/** `m · n` — apply `n` first, then `m`. */
export function mul(m: Readonly<Mat>, n: Readonly<Mat>): Mat {
  return [
    m[0] * n[0] + m[2] * n[1],
    m[1] * n[0] + m[3] * n[1],
    m[0] * n[2] + m[2] * n[3],
    m[1] * n[2] + m[3] * n[3],
    m[0] * n[4] + m[2] * n[5] + m[4],
    m[1] * n[4] + m[3] * n[5] + m[5],
  ];
}

export function apply(m: Readonly<Mat>, x: number, y: number): [number, number] {
  return [m[0] * x + m[2] * y + m[4], m[1] * x + m[3] * y + m[5]];
}

export function invert(m: Readonly<Mat>): Mat {
  const det = m[0] * m[3] - m[1] * m[2] || 1e-12;
  const a = m[3] / det;
  const b = -m[1] / det;
  const c = -m[2] / det;
  const d = m[0] / det;
  return [a, b, c, d, -(a * m[4] + c * m[5]), -(b * m[4] + d * m[5])];
}

/** World rotation angle (degrees) of a matrix. */
export function angleOf(m: Readonly<Mat>): number {
  return (Math.atan2(m[1], m[0]) * 180) / Math.PI;
}

/** Mean world scale of a matrix. */
export function scaleOf(m: Readonly<Mat>): number {
  return Math.sqrt(Math.abs(m[0] * m[3] - m[1] * m[2]));
}

/**
 * Local bone transform: translate(tx,ty) · T(p) · R(rot) · S(sx,sy) · T(−p).
 */
export function boneMatrix(tx: number, ty: number, px: number, py: number, rotDeg: number, sx: number, sy: number): Mat {
  const r = (rotDeg * Math.PI) / 180;
  const cos = Math.cos(r);
  const sin = Math.sin(r);
  const a = cos * sx;
  const b = sin * sx;
  const c = -sin * sy;
  const d = cos * sy;
  return [a, b, c, d, px + tx - (a * px + c * py), py + ty - (b * px + d * py)];
}

const r4 = (v: number) => {
  const s = Math.round(v * 10000) / 10000;
  return Object.is(s, -0) ? 0 : s;
};

export function isIdentity(m: Readonly<Mat>, eps = 1e-6): boolean {
  return (
    Math.abs(m[0] - 1) < eps && Math.abs(m[1]) < eps && Math.abs(m[2]) < eps &&
    Math.abs(m[3] - 1) < eps && Math.abs(m[4]) < eps && Math.abs(m[5]) < eps
  );
}

/** Format for an SVG `transform` attribute. */
export function matToString(m: Readonly<Mat>): string {
  return `matrix(${r4(m[0])} ${r4(m[1])} ${r4(m[2])} ${r4(m[3])} ${r4(m[4])} ${r4(m[5])})`;
}
