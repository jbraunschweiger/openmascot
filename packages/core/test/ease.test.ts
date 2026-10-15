import { describe, expect, it } from 'vitest';
import { clamp, cubicBezier, EASES, lerp, resolveEase, smoothstep } from '../src/ease';

describe('EASES', () => {
  for (const [name, f] of Object.entries(EASES)) {
    it(`${name} maps 0→0 and 1→1`, () => {
      expect(f(0)).toBeCloseTo(0, 9);
      expect(f(1)).toBeCloseTo(1, 9);
    });
  }

  it('non-overshooting eases stay inside [0,1] (and all but bounce are monotone)', () => {
    const mono = Object.keys(EASES).filter((n) => !/back|elastic/.test(n));
    for (const n of mono) {
      let prev = -Infinity;
      for (let i = 0; i <= 100; i++) {
        const v = EASES[n as keyof typeof EASES](i / 100);
        expect(v, `${n}(${i / 100})`).toBeGreaterThanOrEqual(-1e-9);
        expect(v, `${n}(${i / 100})`).toBeLessThanOrEqual(1 + 1e-9);
        if (n !== 'bounceOut') expect(v, `${n} monotone at ${i / 100}`).toBeGreaterThanOrEqual(prev - 1e-9);
        prev = v;
      }
    }
  });

  it('back/elastic overshoot', () => {
    expect(EASES.backIn(0.3)).toBeLessThan(0);
    expect(EASES.backOut(0.7)).toBeGreaterThan(1);
    expect(Math.max(...Array.from({ length: 50 }, (_, i) => EASES.elasticOut(i / 50)))).toBeGreaterThan(1);
  });

  it('step holds until the end of the segment', () => {
    expect(EASES.step(0.999)).toBe(0);
    expect(EASES.step(1)).toBe(1);
  });

  it('symmetric in-out eases pass through 0.5', () => {
    for (const n of ['inOut', 'sineInOut', 'quadInOut', 'cubicInOut', 'backInOut'] as const) {
      expect(EASES[n](0.5)).toBeCloseTo(0.5, 9);
    }
  });
});

describe('cubicBezier', () => {
  it('(0,0,1,1) is linear', () => {
    const f = cubicBezier(0, 0, 1, 1);
    for (const x of [0, 0.1, 0.33, 0.5, 0.9, 1]) expect(f(x)).toBeCloseTo(x, 5);
  });

  it('CSS ease-in-out is symmetric and hits the endpoints', () => {
    const f = cubicBezier(0.42, 0, 0.58, 1);
    expect(f(0)).toBeCloseTo(0, 6);
    expect(f(1)).toBeCloseTo(1, 6);
    expect(f(0.5)).toBeCloseTo(0.5, 5);
    expect(f(0.25) + f(0.75)).toBeCloseTo(1, 4);
    expect(f(0.25)).toBeLessThan(0.25);
  });

  it('CSS ease matches known values', () => {
    // CSS `ease` = cubic-bezier(.25,.1,.25,1); at x=.5 y≈.8024
    expect(cubicBezier(0.25, 0.1, 0.25, 1)(0.5)).toBeCloseTo(0.8024, 3);
  });

  it('supports overshooting control points', () => {
    const f = cubicBezier(0.3, 1.6, 0.6, 1);
    expect(Math.max(...Array.from({ length: 20 }, (_, i) => f(i / 20)))).toBeGreaterThan(1);
  });
});

describe('resolveEase', () => {
  it('defaults to sineInOut', () => {
    expect(resolveEase(undefined)).toBe(EASES.sineInOut);
  });
  it('resolves names and caches beziers', () => {
    expect(resolveEase('quadIn')).toBe(EASES.quadIn);
    expect(resolveEase([0.1, 0.2, 0.3, 0.4])).toBe(resolveEase([0.1, 0.2, 0.3, 0.4]));
  });
  it('throws on unknown names', () => {
    expect(() => resolveEase('wobble' as never)).toThrow(/Unknown ease "wobble"/);
  });
});

describe('scalar helpers', () => {
  it('clamp/lerp/smoothstep', () => {
    expect(clamp(5, 0, 1)).toBe(1);
    expect(clamp(-5, 0, 1)).toBe(0);
    expect(clamp(0.5, 0, 1)).toBe(0.5);
    expect(lerp(10, 20, 0.25)).toBe(12.5);
    expect(smoothstep(0, 1, -1)).toBe(0);
    expect(smoothstep(0, 1, 2)).toBe(1);
    expect(smoothstep(0, 1, 0.5)).toBe(0.5);
  });
});
