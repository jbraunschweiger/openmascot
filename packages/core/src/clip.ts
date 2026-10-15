/**
 * Keyframe clip sampling.
 */
import { resolveEase } from './ease';
import type { Channel, Clip, ClipContext, Keyframe, Pose } from './types';
import { emptyPose } from './pose';

/** Seconds per clip time unit. */
export function secondsPerUnit(clip: Clip, bpmOverride?: number): number {
  if (clip.units === 'beats') return 60 / (bpmOverride ?? clip.bpm ?? 120);
  return 1;
}

/** Clip duration in seconds. */
export function clipSeconds(clip: Clip, bpmOverride?: number): number {
  return clip.duration * secondsPerUnit(clip, bpmOverride);
}

const warned = new Set<string>();
function safeEase(e: Keyframe[2]): (t: number) => number {
  try {
    return resolveEase(e);
  } catch (err) {
    const key = String(e);
    if (!warned.has(key)) {
      warned.add(key);
      console.warn(`[openmascot] ${(err as Error).message}; using linear`);
    }
    return (t) => t;
  }
}

/** Sample a keyframe track at time `t` (same units as the keys). */
export function sampleTrack(keys: Keyframe[], t: number): number {
  const n = keys.length;
  if (n === 0) return 0;
  if (t <= keys[0][0]) return keys[0][1];
  if (t >= keys[n - 1][0]) return keys[n - 1][1];
  // Binary search for the segment.
  let lo = 0;
  let hi = n - 1;
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1;
    if (keys[mid][0] <= t) lo = mid;
    else hi = mid;
  }
  const k0 = keys[lo];
  const k1 = keys[hi];
  const span = k1[0] - k0[0];
  if (span <= 0) return k1[1];
  const u = safeEase(k0[2])((t - k0[0]) / span);
  return k0[1] + (k1[1] - k0[1]) * u;
}

function sampleStep<T>(keys: [number, T][], t: number): T | undefined {
  let v: T | undefined;
  for (const [kt, kv] of keys) {
    if (kt <= t + 1e-9) v = kv;
    else break;
  }
  return v;
}

/**
 * Sample a clip at local time `t` (clip units, already wrapped/clamped by the
 * caller) into a pose. Procedural `fn` runs after keyframes.
 */
export function sampleClip(clip: Clip, t: number, ctx: ClipContext, out: Pose = emptyPose()): Pose {
  if (clip.bones) {
    for (const bone in clip.bones) {
      const tracks = clip.bones[bone]!;
      const o = (out.bones[bone] ??= {});
      for (const ch in tracks) {
        const keys = tracks[ch as Channel]!;
        if (keys.length) o[ch as Channel] = sampleTrack(keys, t);
      }
    }
  }
  if (clip.params) {
    for (const p in clip.params) out.params[p] = sampleTrack(clip.params[p], t);
  }
  if (clip.expression) {
    const e = sampleStep(clip.expression, t);
    if (e) out.expression = e;
  }
  if (clip.slots) {
    for (const s in clip.slots) {
      // An empty string means "no override" (fall back to expression/default).
      const v = sampleStep(clip.slots[s], t);
      if (v) out.slots[s] = v;
      else if (v === '') delete out.slots[s];
    }
  }
  clip.fn?.(t, out, ctx);
  return out;
}

/** Validate a clip and return a list of human readable problems (empty = OK). */
export function lintClip(clip: Clip, knownBones?: Set<string>, knownParams?: Set<string>): string[] {
  const problems: string[] = [];
  if (!(clip.duration > 0)) problems.push('duration must be > 0');
  const checkKeys = (where: string, keys: Keyframe[]) => {
    for (let i = 0; i < keys.length; i++) {
      const k = keys[i];
      if (!Array.isArray(k) || k.length < 2 || !Number.isFinite(k[0]) || !Number.isFinite(k[1])) {
        problems.push(`${where}: key ${i} is malformed`);
        continue;
      }
      if (i && k[0] < keys[i - 1][0]) problems.push(`${where}: keys not sorted by time at ${i}`);
      if (k[0] < 0 || k[0] > clip.duration + 1e-9) problems.push(`${where}: key time ${k[0]} outside [0, ${clip.duration}]`);
      if (k[2] !== undefined) {
        try {
          resolveEase(k[2]);
        } catch (e) {
          problems.push(`${where}: ${(e as Error).message}`);
        }
      }
    }
  };
  for (const bone in clip.bones ?? {}) {
    if (knownBones && !knownBones.has(bone)) problems.push(`unknown bone "${bone}"`);
    for (const ch in clip.bones![bone]) checkKeys(`${bone}.${ch}`, clip.bones![bone]![ch as Channel]!);
  }
  for (const p in clip.params ?? {}) {
    if (knownParams && !knownParams.has(p)) problems.push(`unknown param "${p}"`);
    checkKeys(`param ${p}`, clip.params![p]);
  }
  return problems;
}
