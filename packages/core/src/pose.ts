/**
 * Pose utilities: creation, blending, additive layering, and resolution of
 * params / expressions into concrete bone channels and slot variants.
 */
import type { BoneChannels, Channel, CharacterDef, Pose, Rig } from './types';
import { CHANNELS, REST } from './types';

export function emptyPose(): Pose {
  return { bones: {}, params: {}, slots: {} };
}

export function clonePose(p: Pose): Pose {
  const bones: Pose['bones'] = {};
  for (const k in p.bones) bones[k] = { ...p.bones[k] };
  return { bones, params: { ...p.params }, slots: { ...p.slots }, expression: p.expression };
}

/** Channels that combine multiplicatively when layering (rest = 1). */
export const MULTIPLICATIVE: ReadonlySet<Channel> = new Set<Channel>(['sx', 'sy', 'opacity']);

/** Set a bone channel on a pose. */
export function setChannel(p: Pose, bone: string, ch: Channel, v: number) {
  (p.bones[bone] ??= {})[ch] = v;
}

/**
 * Additively layer a channel value onto a pose: offsets add, scales/opacity multiply.
 * Handy inside procedural `fn` hooks: `add(out, 'head', 'rot', Math.sin(t) * 5)`.
 */
export function addChannel(p: Pose, bone: string, ch: Channel, v: number) {
  const b = (p.bones[bone] ??= {});
  if (MULTIPLICATIVE.has(ch)) b[ch] = (b[ch] ?? 1) * v;
  else b[ch] = (b[ch] ?? 0) + v;
}

export function addParam(p: Pose, name: string, v: number) {
  p.params[name] = (p.params[name] ?? 0) + v;
}

/**
 * Linear blend `a → b` by `w` (0 = a, 1 = b), written into a new pose.
 * Missing channels count as rest. Discrete state (slots, expression) switches at w ≥ 0.5.
 */
export function blendPoses(a: Pose, b: Pose, w: number): Pose {
  if (w <= 0) return clonePose(a);
  if (w >= 1) return clonePose(b);
  const out = emptyPose();
  const names = new Set([...Object.keys(a.bones), ...Object.keys(b.bones)]);
  for (const n of names) {
    const ba = a.bones[n];
    const bb = b.bones[n];
    const o: Partial<BoneChannels> = {};
    for (const ch of CHANNELS) {
      const va = ba?.[ch];
      const vb = bb?.[ch];
      if (va === undefined && vb === undefined) continue;
      const ra = va ?? REST[ch];
      let rb = vb ?? REST[ch];
      // Angles take the shortest way round, so leaving a spin held at 360°
      // doesn't visibly unwind back to 0°.
      if (ch === 'yaw' || ch === 'rot') rb = ra + wrap180(rb - ra);
      o[ch] = ra + (rb - ra) * w;
    }
    out.bones[n] = o;
  }
  const params = new Set([...Object.keys(a.params), ...Object.keys(b.params)]);
  for (const k of params) {
    const va = a.params[k] ?? 0;
    const vb = b.params[k] ?? 0;
    out.params[k] = va + (vb - va) * w;
  }
  const hi = w >= 0.5 ? b : a;
  const lo = w >= 0.5 ? a : b;
  out.slots = { ...lo.slots, ...hi.slots };
  out.expression = hi.expression ?? lo.expression;
  return out;
}

/** Layer `add` on top of `base` (in place): offsets add, scales multiply, params add, slots override. */
export function layerPose(base: Pose, add: Pose, weight = 1): Pose {
  for (const n in add.bones) {
    const src = add.bones[n];
    for (const ch of CHANNELS) {
      const v = src[ch];
      if (v === undefined) continue;
      if (MULTIPLICATIVE.has(ch)) addChannel(base, n, ch, 1 + (v - 1) * weight);
      else addChannel(base, n, ch, v * weight);
    }
  }
  for (const k in add.params) addParam(base, k, add.params[k] * weight);
  if (weight >= 0.5) {
    Object.assign(base.slots, add.slots);
    if (add.expression) base.expression = add.expression;
  }
  return base;
}

export interface ResolvedPose {
  /** Bone name → full channel set. Bones not present are at rest. */
  channels: Map<string, BoneChannels>;
  /** Slot → variant, for every slot of the rig. */
  slots: Record<string, string>;
  /** Final parameter values (after defaults & clamping). */
  params: Record<string, number>;
}

/**
 * Turn a pose into concrete channels: applies character params (drivers),
 * then resolves expression + slot overrides into a complete slot map.
 */
export function resolvePose(character: Pick<CharacterDef, 'params' | 'expressions'>, rig: Rig, pose: Pose): ResolvedPose {
  const channels = new Map<string, BoneChannels>();
  const get = (name: string): BoneChannels => {
    let c = channels.get(name);
    if (!c) channels.set(name, (c = { ...REST }));
    return c;
  };
  for (const n in pose.bones) {
    const c = get(n);
    const src = pose.bones[n];
    for (const ch of CHANNELS) if (src[ch] !== undefined) c[ch] = src[ch]!;
  }

  const params: Record<string, number> = {};
  const defs = character.params ?? {};
  for (const name in defs) {
    const def = defs[name];
    let v = pose.params[name] ?? def.default ?? 0;
    if (def.min !== undefined) v = Math.max(def.min, v);
    if (def.max !== undefined) v = Math.min(def.max, v);
    params[name] = v;
  }
  for (const k in pose.params) if (!(k in params)) params[k] = pose.params[k];
  for (const name in defs) {
    const v = params[name];
    for (const d of defs[name].drives) {
      let x = v;
      if (d.input) {
        x = 0;
        for (const k in d.input) x += (params[k] ?? 0) * d.input[k];
      }
      const delta = d.curve ? piecewise(d.curve, x) : x * (d.k ?? 1);
      if (delta === 0) continue;
      const c = get(d.bone);
      c[d.channel] += delta;
    }
  }

  const slots: Record<string, string> = {};
  for (const s of rig.slots) slots[s.name] = s.defaultVariant;
  const neutral = character.expressions?.neutral;
  if (neutral) Object.assign(slots, neutral);
  const expr = pose.expression ? character.expressions?.[pose.expression] : undefined;
  if (expr) Object.assign(slots, expr);
  Object.assign(slots, pose.slots);
  // Ignore unknown variants (fall back to default) so a typo never blanks a slot.
  for (const s of rig.slots) {
    if (!s.variants.some((v) => v.name === slots[s.name])) slots[s.name] = s.defaultVariant;
  }
  return { channels, slots, params };
}

export function piecewise(curve: [number, number][], x: number): number {
  if (!curve.length) return 0;
  if (x <= curve[0][0]) return curve[0][1];
  for (let i = 1; i < curve.length; i++) {
    const [x1, y1] = curve[i];
    if (x <= x1) {
      const [x0, y0] = curve[i - 1];
      return y0 + ((y1 - y0) * (x - x0)) / (x1 - x0 || 1);
    }
  }
  return curve[curve.length - 1][1];
}

/** Wrap an angle difference into (-180, 180]. */
export function wrap180(d: number): number {
  d = ((d + 180) % 360 + 360) % 360 - 180;
  return d === -180 ? 180 : d;
}
