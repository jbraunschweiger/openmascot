import { describe, expect, it } from 'vitest';
import {
  fadeEnvelope,
  num,
  particleDone,
  particleFrame,
  popEnvelope,
  rng,
  str,
  type EffectContext,
  type Particle,
  type ParticleSpec,
} from '../src/effects';
import { builtinEffects, SHAPES } from '../src/effects-library';
import { parseXml } from '../src/xml';

const ctx = (seed: number, params: Record<string, unknown> = {}, scale = 1): EffectContext => ({ random: rng(seed), params, scale, angle: 0 });

/** Sample a spec at a few ages into plain data for comparisons. */
const trace = (specs: ParticleSpec[]) =>
  specs.map((s) => ({
    markup: s.markup,
    delay: s.delay,
    life: s.life,
    behind: s.behind,
    states: [0, 0.1, 0.5, 0.9, 1].map((u) => s.at(u, u * s.life)),
  }));

describe('rng', () => {
  it('is deterministic per seed and in [0, 1)', () => {
    const a = rng(42);
    const b = rng(42);
    const c = rng(43);
    const xs = Array.from({ length: 1000 }, () => a());
    expect(xs).toEqual(Array.from({ length: 1000 }, () => b()));
    expect(xs.slice(0, 5)).not.toEqual(Array.from({ length: 5 }, () => c()));
    expect(Math.min(...xs)).toBeGreaterThanOrEqual(0);
    expect(Math.max(...xs)).toBeLessThan(1);
    const mean = xs.reduce((s, x) => s + x, 0) / xs.length;
    expect(mean).toBeGreaterThan(0.45);
    expect(mean).toBeLessThan(0.55);
  });
});

describe('envelopes and param helpers', () => {
  it('popEnvelope overshoots in, holds at 1, shrinks to 0', () => {
    expect(popEnvelope(0)).toBeCloseTo(0, 6);
    expect(Math.max(...Array.from({ length: 18 }, (_, i) => popEnvelope(i / 100)))).toBeGreaterThan(1);
    expect(popEnvelope(0.5)).toBe(1);
    expect(popEnvelope(1)).toBeCloseTo(0, 6);
  });
  it('fadeEnvelope ramps in and out linearly', () => {
    expect(fadeEnvelope(0)).toBe(0);
    expect(fadeEnvelope(0.05)).toBeCloseTo(0.5);
    expect(fadeEnvelope(0.5)).toBe(1);
    expect(fadeEnvelope(1)).toBe(0);
  });
  it('num/str fall back on bad input', () => {
    expect(num(3, 1)).toBe(3);
    expect(num('3', 1)).toBe(1);
    expect(num(NaN, 1)).toBe(1);
    expect(str('red', 'blue')).toBe('red');
    expect(str(5, 'blue')).toBe('blue');
  });
});

describe('particles', () => {
  const spec: ParticleSpec = { markup: '<circle r="1"/>', delay: 0.5, life: 2, at: (u) => ({ x: u * 10, y: -u * 20, rot: 90, scale: 2, opacity: 1.5 }) };
  const p: Particle = { id: 7, spec, born: 1, origin: [100, 50] };

  it('is invisible before its delay and after its life', () => {
    expect(particleFrame(p, 1.2, p.origin)).toBeNull();
    expect(particleFrame(p, 3.6, p.origin)).toBeNull();
    expect(particleDone(p, 3.4)).toBe(false);
    expect(particleDone(p, 3.6)).toBe(true);
  });

  it('builds a world transform from the analytic state', () => {
    const f = particleFrame(p, 2.5, [100, 50])!; // age 1 → u .5
    expect(f.id).toBe(7);
    expect(f.markup).toBe(spec.markup);
    expect(f.behind).toBe(false);
    expect(f.opacity).toBe(1); // clamped
    const [a, b, c, d, e, g] = f.transform;
    expect(a).toBeCloseTo(0);
    expect(b).toBeCloseTo(2);
    expect(c).toBeCloseTo(-2);
    expect(d).toBeCloseTo(0);
    expect(e).toBe(105);
    expect(g).toBe(40);
  });
});

describe('built-in effects', () => {
  const names = Object.keys(builtinEffects);

  it('has a healthy catalogue with matching names', () => {
    expect(names.length).toBeGreaterThanOrEqual(10);
    for (const n of ['hearts', 'sparkles', 'notes', 'sweat', 'tears', 'confetti', 'zzz', 'puff']) expect(names).toContain(n);
    for (const [k, def] of Object.entries(builtinEffects)) {
      expect(def.name, k).toBe(k);
      expect(def.description, k).toBeTruthy();
    }
  });

  describe.each(names)('%s', (name) => {
    const def = builtinEffects[name];

    it('spawns valid particles', () => {
      for (const seed of [1, 2, 99]) {
        const specs = def.spawn(ctx(seed));
        expect(specs.length).toBeGreaterThan(0);
        for (const s of specs) {
          expect(s.life).toBeGreaterThan(0);
          expect(s.delay ?? 0).toBeGreaterThanOrEqual(0);
          expect(() => parseXml(`<g>${s.markup}</g>`)).not.toThrow();
          for (let i = 0; i <= 20; i++) {
            const u = i / 20;
            const st = s.at(u, u * s.life);
            for (const k of ['x', 'y', 'rot', 'scale', 'sx', 'sy', 'opacity'] as const) {
              if (st[k] !== undefined) expect(Number.isFinite(st[k]), `${name} ${k} at u=${u}`).toBe(true);
            }
          }
        }
      }
    });

    it('is deterministic for a seed', () => {
      expect(trace(def.spawn(ctx(1234, { count: 4 })))).toEqual(trace(def.spawn(ctx(1234, { count: 4 }))));
    });

    it('accepts common params and scale', () => {
      const specs = def.spawn(ctx(5, { count: 3, color: '#123456', size: 1.5, side: -1, spread: 40 }, 2));
      expect(specs.length).toBeGreaterThan(0);
      for (const s of specs) expect(() => parseXml(`<g>${s.markup}</g>`)).not.toThrow();
    });
  });
});

describe('SHAPES', () => {
  it('produce well-formed markup', () => {
    for (const [k, f] of Object.entries(SHAPES)) {
      const m = (f as (c: string, ...a: unknown[]) => string)('#f00');
      expect(() => parseXml(`<g>${m}</g>`), k).not.toThrow();
    }
  });
});
