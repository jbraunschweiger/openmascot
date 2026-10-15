import { describe, expect, it } from 'vitest';
import { angleOf, apply, boneMatrix, IDENTITY, invert, isIdentity, matToString, mul, scaleOf } from '../src/mat';
import type { Mat } from '../src/types';

describe('mat', () => {
  const m: Mat = [2, 0.5, -0.3, 1.5, 10, -4];

  it('identity is neutral for mul', () => {
    expect(mul(IDENTITY, m)).toEqual(m);
    expect(mul(m, IDENTITY)).toEqual(m);
  });

  it('mul applies the right operand first', () => {
    const t: Mat = [1, 0, 0, 1, 5, 0];
    const s: Mat = [2, 0, 0, 2, 0, 0];
    expect(apply(mul(t, s), 1, 1)).toEqual([7, 2]); // scale then translate
    expect(apply(mul(s, t), 1, 1)).toEqual([12, 2]); // translate then scale
  });

  it('invert undoes a matrix', () => {
    const inv = invert(m);
    const p = apply(m, 3, -7);
    const back = apply(inv, p[0], p[1]);
    expect(back[0]).toBeCloseTo(3, 9);
    expect(back[1]).toBeCloseTo(-7, 9);
    expect(isIdentity(mul(m, inv))).toBe(true);
  });

  it('invert does not blow up on singular matrices', () => {
    const inv = invert([0, 0, 0, 0, 1, 1]);
    expect(inv.every(Number.isFinite)).toBe(true);
  });

  it('boneMatrix rotates and scales about the pivot', () => {
    const b = boneMatrix(0, 0, 10, 20, 90, 1, 1);
    const p = apply(b, 10, 20);
    expect(p[0]).toBeCloseTo(10);
    expect(p[1]).toBeCloseTo(20);
    // A point to the right of the pivot rotates clockwise (down in SVG).
    const q = apply(b, 11, 20);
    expect(q[0]).toBeCloseTo(10);
    expect(q[1]).toBeCloseTo(21);
    const s = boneMatrix(3, 4, 10, 20, 0, 2, 3);
    expect(apply(s, 10, 20)).toEqual([13, 24]);
    expect(apply(s, 11, 21)).toEqual([15, 27]);
  });

  it('boneMatrix at rest is the identity', () => {
    expect(isIdentity(boneMatrix(0, 0, 123, -45, 0, 1, 1))).toBe(true);
  });

  it('angleOf and scaleOf', () => {
    expect(angleOf(boneMatrix(0, 0, 0, 0, 30, 1, 1))).toBeCloseTo(30);
    expect(angleOf(boneMatrix(0, 0, 0, 0, -120, 1, 1))).toBeCloseTo(-120);
    expect(scaleOf(boneMatrix(0, 0, 0, 0, 45, 2, 2))).toBeCloseTo(2);
    expect(scaleOf([-1, 0, 0, 1, 0, 0])).toBeCloseTo(1);
  });

  it('isIdentity honours epsilon', () => {
    expect(isIdentity([1, 0, 0, 1, 0, 0])).toBe(true);
    expect(isIdentity([1, 0, 0, 1, 1e-3, 0])).toBe(false);
    expect(isIdentity([1, 0, 0, 1, 1e-3, 0], 1e-2)).toBe(true);
  });

  it('matToString rounds to 4 decimals and normalises -0', () => {
    expect(matToString([1, -0, 0, 1, 1.234567, -0.00001])).toBe('matrix(1 0 0 1 1.2346 0)');
  });

});
