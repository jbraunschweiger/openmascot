/**
 * Small helpers for authoring clips by hand (or by AI) with less boilerplate.
 */
import type { BoneTracks, Channel, Clip, Ease, Keyframe } from './types';
import { REST } from './types';

/** Identity helper that gives you type checking for a clip literal. */
export function defineClip(clip: Clip): Clip {
  return clip;
}

/** Identity helper for a clip library. */
export function defineClips<T extends Record<string, Clip>>(clips: T): T {
  for (const k in clips) clips[k].name ??= k;
  return clips;
}

/**
 * Evenly spaced looping keys: `cycle(2, [0, 10, 0, -10])` →
 * keys at 0, .5, 1, 1.5 and a closing key back to the first value at 2.
 */
export function cycle(duration: number, values: number[], ease: Ease = 'sineInOut', start = 0): Keyframe[] {
  const n = values.length;
  const keys: Keyframe[] = values.map((v, i) => [start + (i * duration) / n, v, ease]);
  keys.push([start + duration, values[0], ease]);
  return keys;
}

/**
 * Keys from `[time, value]` pairs sharing one ease:
 * `keys('backOut', [0, 0], [0.3, 20], [1, 0, 'linear'])` (a third element overrides the ease).
 */
export function keys(ease: Ease, ...pairs: ([number, number] | [number, number, Ease])[]): Keyframe[] {
  return pairs.map((p) => [p[0], p[1], p.length > 2 ? p[2]! : ease]);
}

/** Sample a sine wave into keyframes (for exporting procedural motion as data). */
export function wave(
  duration: number,
  amplitude: number,
  opts: { cycles?: number; phase?: number; offset?: number; steps?: number } = {},
): Keyframe[] {
  const cycles = opts.cycles ?? 1;
  const steps = opts.steps ?? Math.max(4, Math.round(cycles * 8));
  const out: Keyframe[] = [];
  for (let i = 0; i <= steps; i++) {
    const t = (i / steps) * duration;
    out.push([t, (opts.offset ?? 0) + amplitude * Math.sin(((t / duration) * cycles + (opts.phase ?? 0)) * Math.PI * 2), 'linear']);
  }
  return out;
}

const MIRROR_NEGATE: ReadonlySet<Channel> = new Set<Channel>(['x', 'rot', 'yaw']);

function swapSide(name: string): string {
  if (name.endsWith('-l')) return name.slice(0, -2) + '-r';
  if (name.endsWith('-r')) return name.slice(0, -2) + '-l';
  return name;
}

/**
 * Mirror a clip left↔right: swaps `-l`/`-r` bones & slots and negates
 * x / rot / yaw. Great for making the other-side version of a dance move.
 * Params whose names end in `X` (e.g. `lookX`) are negated too. Procedural
 * `fn` hooks cannot be mirrored and are dropped.
 */
export function mirrorClip(clip: Clip, name?: string): Clip {
  const bones: BoneTracks = {};
  for (const b in clip.bones ?? {}) {
    const src = clip.bones![b]!;
    const dst: BoneTracks[string] = {};
    for (const ch in src) {
      const k = src[ch as Channel]!;
      dst[ch as Channel] = MIRROR_NEGATE.has(ch as Channel) ? k.map((x) => [x[0], -x[1], ...(x.length > 2 ? [x[2]] : [])] as Keyframe) : k;
    }
    bones[swapSide(b)] = dst;
  }
  const params: Record<string, Keyframe[]> = {};
  for (const p in clip.params ?? {}) {
    const k = clip.params![p];
    params[p] = /X$/.test(p) || p === 'lean' ? k.map((x) => [x[0], -x[1], ...(x.length > 2 ? [x[2]] : [])] as Keyframe) : k;
  }
  const slots: Record<string, [number, string][]> = {};
  for (const s in clip.slots ?? {}) slots[swapSide(s)] = clip.slots![s];
  return {
    ...clip,
    name: name ?? (clip.name ? `${clip.name}-mirror` : undefined),
    bones,
    params,
    slots,
    fn: undefined,
    events: clip.events?.map((e) => ({
      ...e,
      at: Array.isArray(e.at) ? [-e.at[0], e.at[1]] : e.at ? swapSide(e.at) : e.at,
      params: e.params && typeof e.params.side === 'number' ? { ...e.params, side: -(e.params.side as number) } : e.params,
    })),
  };
}

/**
 * Concatenate clips in time (all must share units). Useful to build a dance
 * routine out of individual moves.
 */
export function sequence(name: string, parts: Clip[], opts: Partial<Clip> = {}): Clip {
  const out: Clip = { name, duration: 0, units: parts[0]?.units, bpm: parts[0]?.bpm, bones: {}, params: {}, slots: {}, expression: [], events: [], ...opts };
  // Every channel animated anywhere gets rest keys in parts that don't animate it,
  // so values never "leak" from one move into the next.
  const used = new Set<string>();
  for (const p of parts) for (const b in p.bones ?? {}) for (const ch in p.bones![b]) used.add(`${b}\u0000${ch}`);
  const usedParams = new Set<string>();
  for (const p of parts) for (const pr in p.params ?? {}) usedParams.add(pr);
  const usedSlots = new Set<string>();
  for (const p of parts) for (const sl in p.slots ?? {}) usedSlots.add(sl);
  const usesExpr = parts.some((p) => p.expression?.length);
  const bpms = new Set(parts.filter((p) => p.units === 'beats').map((p) => p.bpm ?? 120));
  if (bpms.size > 1 && opts.bpm === undefined) {
    console.warn(`[openmascot] sequence("${name}"): parts have different bpm (${[...bpms].join(', ')}); using ${parts[0]?.bpm}. Pass { bpm } to choose.`);
  }
  let offset = 0;
  const fns: { fn: NonNullable<Clip['fn']>; start: number; end: number }[] = [];
  for (const p of parts) {
    for (const key of used) {
      const [b, ch] = key.split('\u0000') as [string, Channel];
      if (p.bones?.[b]?.[ch]) continue;
      const arr = ((out.bones![b] ??= {})[ch] ??= []);
      arr.push([offset, REST[ch], 'linear'], [offset + p.duration, REST[ch], 'linear']);
    }
    for (const pr of usedParams) {
      if (p.params?.[pr]) continue;
      (out.params![pr] ??= []).push([offset, 0, 'linear'], [offset + p.duration, 0, 'linear']);
    }
    for (const b in p.bones ?? {}) {
      const dst = (out.bones![b] ??= {});
      for (const ch in p.bones![b]) {
        const arr = (dst[ch as Channel] ??= []);
        for (const k of p.bones![b]![ch as Channel]!) arr.push([k[0] + offset, k[1], ...(k.length > 2 ? [k[2]] : [])] as Keyframe);
      }
    }
    for (const pr in p.params ?? {}) {
      const arr = (out.params![pr] ??= []);
      for (const k of p.params![pr]) arr.push([k[0] + offset, k[1], ...(k.length > 2 ? [k[2]] : [])] as Keyframe);
    }
    // Reset discrete state at part boundaries so e.g. folded wings don't leak.
    for (const s of usedSlots) if (!p.slots?.[s]?.some(([t]) => t <= 0)) (out.slots![s] ??= []).push([offset, '']);
    if (usesExpr && !p.expression?.some(([t]) => t <= 0)) out.expression!.push([offset, 'neutral']);
    for (const s in p.slots ?? {}) {
      const arr = (out.slots![s] ??= []);
      for (const [t, v] of p.slots![s]) arr.push([t + offset, v]);
    }
    for (const [t, e] of p.expression ?? []) out.expression!.push([t + offset, e]);
    for (const e of p.events ?? []) out.events!.push({ ...e, t: e.t + offset });
    if (p.fn) fns.push({ fn: p.fn, start: offset, end: offset + p.duration });
    offset += p.duration;
  }
  out.duration = opts.duration ?? offset;
  if (fns.length) {
    out.fn = (t, pose, ctx) => {
      for (const f of fns) if (t >= f.start && t < f.end) f.fn(t - f.start, pose, { ...ctx, duration: f.end - f.start });
    };
  }
  return out;
}
