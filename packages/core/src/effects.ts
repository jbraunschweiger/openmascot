/**
 * Effect system: short-lived decorative particles (hearts, sparkles, notes,
 * sweat drops…) drawn in character space around the mascot.
 *
 * Particles are *analytic*: each one is a pure function of its age, so effects
 * are deterministic (great for frame sheets, tests and video export) and cost
 * nothing to simulate.
 */

/** Instantaneous particle transform, relative to its anchor point. */
export interface ParticleState {
  x: number;
  y: number;
  rot?: number;
  /** Uniform scale or per-axis. */
  scale?: number;
  sx?: number;
  sy?: number;
  opacity?: number;
}

export interface ParticleSpec {
  /** SVG markup drawn centred on (0, 0). */
  markup: string;
  /** Seconds after emission before the particle appears. */
  delay?: number;
  /** Lifetime in seconds. */
  life: number;
  /** State at normalised age `u` ∈ [0,1] (and absolute age in seconds). */
  at: (u: number, age: number) => ParticleState;
  /** Draw behind the character instead of in front. */
  behind?: boolean;
}

export interface EffectContext {
  /** Deterministic RNG in [0,1). */
  random: () => number;
  /** Effect parameters supplied by the emitter. */
  params: Record<string, unknown>;
  /** Overall size multiplier (character scale), default 1. */
  scale: number;
  /** World rotation (deg) of the anchor bone at emission; useful for directional effects. */
  angle: number;
}

export interface EffectDef {
  name: string;
  description?: string;
  /** Keep particles attached to the anchor bone as it moves (tears, sweat, motion lines). */
  follow?: boolean;
  /** Default anchor when the emitter doesn't specify one. */
  defaultAnchor?: string | [number, number];
  spawn: (ctx: EffectContext) => ParticleSpec[];
}

export type EffectRegistry = Record<string, EffectDef>;

/** A live particle instance. */
export interface Particle {
  id: number;
  spec: ParticleSpec;
  /** Absolute emission time (runtime seconds). */
  born: number;
  /** Anchor origin at emission. */
  origin: [number, number];
  /** Bone to follow, if the effect follows. */
  follow?: { bone: string; offset: [number, number] };
}

/** Particle as handed to renderers. */
export interface ParticleFrame {
  id: number;
  markup: string;
  /** `matrix(...)` world transform, in character space. */
  transform: [number, number, number, number, number, number];
  opacity: number;
  behind: boolean;
}

/** mulberry32 — small, fast, deterministic PRNG. */
export function rng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function particleFrame(p: Particle, now: number, origin: [number, number]): ParticleFrame | null {
  const age = now - p.born - (p.spec.delay ?? 0);
  if (age < 0 || age > p.spec.life) return null;
  const u = age / p.spec.life;
  const s = p.spec.at(u, age);
  const sc = s.scale ?? 1;
  const sx = (s.sx ?? 1) * sc;
  const sy = (s.sy ?? 1) * sc;
  const r = ((s.rot ?? 0) * Math.PI) / 180;
  const cos = Math.cos(r);
  const sin = Math.sin(r);
  return {
    id: p.id,
    markup: p.spec.markup,
    transform: [cos * sx, sin * sx, -sin * sy, cos * sy, origin[0] + s.x, origin[1] + s.y],
    opacity: Math.max(0, Math.min(1, s.opacity ?? 1)),
    behind: !!p.spec.behind,
  };
}

/** Is the particle finished at time `now`? */
export function particleDone(p: Particle, now: number): boolean {
  return now - p.born > (p.spec.delay ?? 0) + p.spec.life;
}

/* ---------- helpers for writing effects ---------- */

/** Pop-in / fade-out envelope: scale overshoots in, holds, then shrinks out. */
export function popEnvelope(u: number, inFrac = 0.18, outFrac = 0.3): number {
  if (u < inFrac) {
    const t = u / inFrac;
    // backOut-ish
    const c1 = 2.2;
    const c3 = c1 + 1;
    return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
  }
  if (u > 1 - outFrac) {
    const t = (u - (1 - outFrac)) / outFrac;
    return 1 - t * t;
  }
  return 1;
}

/** Opacity envelope with linear fade in/out. */
export function fadeEnvelope(u: number, inFrac = 0.1, outFrac = 0.35): number {
  if (u < inFrac) return u / inFrac;
  if (u > 1 - outFrac) return (1 - u) / outFrac;
  return 1;
}

export const num = (v: unknown, d: number): number => (typeof v === 'number' && Number.isFinite(v) ? v : d);
export const str = (v: unknown, d: string): string => (typeof v === 'string' ? v : d);
