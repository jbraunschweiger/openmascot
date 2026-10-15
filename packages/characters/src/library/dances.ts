/**
 * Dance moves — beat-synced, seamlessly looping clips (see docs/animation.md).
 *
 * Every dance is authored in beats (`units: 'beats'`), so
 * `mascot.play('dance-bop', { bpm: songBpm })` locks it to any song.
 * Conventions used throughout:
 *
 *  - Downbeats land on whole beats: the body *dips* (squash) on the beat and
 *    rises on the "and".
 *  - Offset timing: the body leads, the head lags ~0.1–0.2 beat, wings lag a
 *    little more (ears and tuft are springs and lag on their own).
 *  - Every track starts and ends on the same value (`cycle` / `rep`) so loops
 *    are seamless; full spins go 0 → 360°, which is the same pose as 0.
 *
 *  - Wings: every dance sets `wingFold` (0 = spread wide, 0.5 = relaxed,
 *    1 = tucked). Wings open for the big expressive beats and tuck in
 *    (≈0.75) through spins so a turning wing never sweeps across the body.
 *
 * Only standard bones (root, body, head, wing-*, foot-*) and params
 * (squash, flap, wingFold, raiseL/raiseR, lean, lookX, lookY) are used, so
 * these work on any character that follows the standard rig conventions.
 */
import { defineClips, mirrorClip, sampleTrack, sequence } from '@openmascot/core';
import type { Clip, Ease, Keyframe } from '@openmascot/core';

/* ------------------------------------------------------------------ */
/* Authoring helpers                                                   */
/* ------------------------------------------------------------------ */

type Pt = [number, number] | [number, number, Ease];

/**
 * Shift a looping track later in time by `phase` (wrapping around `total`).
 * Used for offset timing: `lag(bodyKeys, 0.15, 8)` = the same motion, 0.15 beat late.
 */
function lag(track: Keyframe[], phase: number, total: number): Keyframe[] {
  const p = ((phase % total) + total) % total;
  if (!p) return track;
  const body = track.filter((k) => k[0] < total - 1e-9);
  const shifted: Keyframe[] = body.map((k) => [(k[0] + p) % total, k[1], k[2] ?? 'sineInOut'] as Keyframe);
  shifted.sort((a, b) => a[0] - b[0]);
  const v0 = sampleTrack(track, total - p);
  // ease of the segment that straddles the wrap point
  let wrapEase: Ease = 'sineInOut';
  for (const k of track) if (k[0] <= total - p) wrapEase = k[2] ?? 'sineInOut';
  const out: Keyframe[] = [];
  if (shifted[0]![0] > 1e-9) out.push([0, v0, wrapEase]);
  out.push(...shifted);
  out.push([total, out[0]![1], out[0]![2] ?? 'sineInOut']);
  return out;
}

/**
 * Repeat a one-period pattern across `total` beats and close the loop.
 * `pts` are `[timeInPeriod, value, ease?]` and must start at time 0.
 * `phase` delays the whole track (offset timing).
 */
function rep(total: number, period: number, pts: Pt[], ease: Ease = 'sineInOut', phase = 0): Keyframe[] {
  const out: Keyframe[] = [];
  const n = Math.round(total / period);
  for (let i = 0; i < n; i++) for (const p of pts) out.push([i * period + p[0], p[1], p[2] ?? ease]);
  out.push([total, pts[0]![1], pts[0]![2] ?? ease]);
  return lag(out, phase, total);
}

/** Keys from pairs, with the default ease; loops are closed by the caller. */
function k(ease: Ease, ...pairs: Pt[]): Keyframe[] {
  return pairs.map((p) => [p[0], p[1], p[2] ?? ease] as Keyframe);
}

/**
 * Staccato "pops" (robot style): hold each value, then snap to the next one in
 * `snap` beats with a tiny mechanical overshoot. `poses` = `[time, value]`;
 * the loop closes back on the first value.
 */
function pops(total: number, poses: [number, number][], snap = 0.1, ease: Ease = 'backOut'): Keyframe[] {
  const out: Keyframe[] = [];
  let prev = poses[poses.length - 1]![1];
  if (poses[0]![0] > 0) out.push([0, prev, 'linear']);
  for (const [t, v] of poses) {
    out.push([t, prev, ease]);
    out.push([Math.min(t + snap, total), v, 'linear']);
    prev = v;
  }
  if (out[out.length - 1]![0] < total) out.push([total, prev, 'linear']);
  return out;
}

const DANCE = { category: 'dance', units: 'beats', loop: true, suppress: { look: true, fidget: true }, fadeIn: 0.2 } as const;

/* ------------------------------------------------------------------ */
/* Moves                                                               */
/* ------------------------------------------------------------------ */

const bop: Clip = {
  ...DANCE,
  description: 'The default groove: knees dip on every beat, head nods a hair late, feet tap, wings bounce along.',
  bpm: 112,
  duration: 8,
  bones: {
    root: {
      y: rep(8, 1, [[0, 0, 'quadOut'], [0.5, -13, 'quadIn']]),
      x: rep(8, 2, [[0, -10], [1, 10]]),
    },
    head: {
      pitch: rep(8, 1, [[0, 13, 'quadOut'], [0.5, -6]], 'sineInOut', 0.12),
      rot: rep(8, 2, [[0, -9], [1, 9]], 'sineInOut', 0.25),
    },
    'foot-l': { y: rep(8, 2, [[0, 0], [0.5, -7], [1, 0], [2 - 0.01, 0]]) },
    'foot-r': { y: rep(8, 2, [[0, 0], [1, 0], [1.5, -7], [2 - 0.01, 0]]) },
  },
  params: {
    squash: rep(8, 1, [[0, 0.4, 'quadOut'], [0.5, -0.16]]),
    lean: rep(8, 2, [[0, -0.3], [1, 0.3]], 'sineInOut', 0.1),
    flap: rep(8, 1, [[0, -0.18], [0.5, 0.38]], 'sineInOut', 0.18),
    wingFold: rep(8, 1, [[0, 0.35], [0.5, 0.15]], 'sineInOut', 0.2),
  },
  expression: [[0, 'happy'], [2, 'singing'], [4, 'joyful'], [6, 'singing']],
  events: [
    { t: 2.5, effect: 'notes', at: 'head', params: { side: 1 } },
    { t: 6.5, effect: 'notes', at: 'head', params: { side: -1 } },
  ],
};

/* Spin: 8 beats — groove, crouch, 360° spin with a spotting head whip, land, ta-da. */
const SPIN_START = 3; // beat the spin launches
const SPIN_END = 4.5; // beat the spin lands
const spin: Clip = {
  ...DANCE,
  description: 'Two bops, anticipation crouch with a counter-wind, full 360° pseudo-3D spin (head spots then whips round), squash landing, sparkle ta-da.',
  bpm: 112,
  duration: 8,
  bones: {
    root: {
      yaw: k('sineInOut', [0, 0], [2.2, 0], [2.9, -28, [0.35, 0, 0.25, 1]], [SPIN_END, 360], [8, 360]),
      y: k('sineInOut',
        [0, 0, 'quadOut'], [0.5, -9, 'quadIn'], [1, 0, 'quadOut'], [1.5, -9, 'quadIn'], [2, 0],
        [2.9, 4, 'quadOut'], [3.45, -24, 'quadIn'], [SPIN_END, 0, 'quadOut'], [5.6, -6], [6, 0, 'quadOut'], [6.5, -8, 'quadIn'], [7, 0, 'quadOut'], [7.5, -8, 'quadIn'], [8, 0]),
      x: k('sineInOut', [0, 0], [2.2, 0], [2.9, -6], [SPIN_END, 0], [8, 0]),
    },
    head: {
      // spotting: the head holds front while the body starts turning, then whips round ahead of it
      yaw: k('sineInOut', [0, 0], [2.4, 0], [2.9, 18], [3.35, -55, 'cubicIn'], [3.8, 70, 'cubicOut'], [4.25, 22], [4.75, -10], [5.3, 0], [8, 0]),
      rot: k('sineInOut', [0, 0], [2.4, 0], [2.9, -6], [SPIN_END, 0], [5, 8], [5.6, 0], [8, 0]),
      pitch: k('sineInOut', [0, 4], [0.5, -3], [1, 4], [1.5, -3], [2, 4], [2.9, 8], [3.4, -8], [SPIN_END, 0], [4.7, 10, 'backOut'], [5.3, -4], [6, 4], [6.5, -3], [7, 4], [7.5, -3], [8, 4]),
    },
  },
  params: {
    squash: k('sineInOut',
      [0, 0.28, 'quadOut'], [0.5, -0.1], [1, 0.28, 'quadOut'], [1.5, -0.1], [2, 0.2],
      [2.9, 0.65, 'quadOut'], [3.3, -0.55], [4.2, -0.3, 'quadIn'], [4.65, 0.6, 'quadOut'], [5.3, -0.12, 'sineInOut'], [5.8, 0],
      [6, 0.25, 'quadOut'], [6.5, -0.08], [7, 0.25, 'quadOut'], [7.5, -0.08], [8, 0.28]),
    flap: k('sineInOut',
      [0, -0.1], [0.5, 0.25], [1, -0.1], [1.5, 0.25], [2, -0.1],
      [2.9, -0.7, 'backOut'], [3.35, 0.95], [4.3, 0.6], [4.75, -0.35, 'backOut'], [5.2, 1.1, 'backOut'], [6.2, 0.9],
      [6.6, 0.25], [7, -0.1], [7.5, 0.25], [8, -0.1]),
    lean: k('sineInOut', [0, 0], [2.2, 0], [2.9, -0.25], [3.4, 0.15], [SPIN_END, 0], [5, 0], [8, 0]),
    // tuck through the spin, fling open for the ta-da
    wingFold: k('sineInOut', [0, 0.3], [2.2, 0.3], [2.9, 0.55], [3.3, 0.8], [4.2, 0.8], [4.75, 0.05, 'backOut'], [6.2, 0.1], [7, 0.3], [8, 0.3]),
  },
  expression: [[0, 'happy'], [2.4, 'determined'], [3.1, 'excited'], [4.6, 'proud'], [6.5, 'joyful']],
  events: [
    { t: 4.6, effect: 'sparkles', at: 'head', params: { count: 5 } },
    { t: 6.4, effect: 'notes', at: 'head', params: { side: 1 } },
  ],
};

const sway: Clip = {
  ...DANCE,
  description: 'Slow concert sway: body swings side to side on an arc, wings raised overhead waving behind the lean.',
  bpm: 100,
  duration: 8,
  bones: {
    root: {
      x: rep(8, 2, [[0, -15], [1, 15]]),
      y: rep(8, 1, [[0, -4, 'sineOut'], [0.5, 2, 'sineIn']]),
    },
    head: {
      rot: rep(8, 2, [[0, -9], [1, 9]], 'sineInOut', 0.3),
      pitch: rep(8, 1, [[0, -3], [0.5, 4]], 'sineInOut', 0.2),
    },
    'wing-l': { rot: rep(8, 2, [[0, -16], [1, 16]], 'sineInOut', 0.4) },
    'wing-r': { rot: rep(8, 2, [[0, -16], [1, 16]], 'sineInOut', 0.55) },
  },
  params: {
    lean: rep(8, 2, [[0, -0.5], [1, 0.5]], 'sineInOut', 0.12),
    flap: rep(8, 1, [[0, 0.95], [0.5, 0.8]], 'sineInOut', 0.3),
    wingFold: rep(8, 1, [[0, 0.05], [0.5, 0.15]], 'sineInOut', 0.3),
    lookX: rep(8, 2, [[0, -0.3], [1, 0.3]], 'sineInOut', 0.35),
    squash: rep(8, 1, [[0, 0.12], [0.5, -0.06]]),
  },
  expression: [[0, 'happy'], [3, 'singing'], [4, 'love'], [7, 'singing']],
  events: [
    { t: 3, effect: 'notes', at: 'head', params: { side: 1 } },
    { t: 7, effect: 'notes', at: 'head', params: { side: -1 } },
  ],
};

/* Chicken dance, bat style: peck ×4, flap ×4, wiggle down, two claps. */
const flapDance: Clip = {
  ...DANCE,
  description: 'Chicken-dance riff: four head pecks, four big flaps, a tail-wiggle down, then two wing claps.',
  bpm: 120,
  duration: 8,
  bones: {
    head: {
      pitch: k('quadOut', [0, 0], [0.25, 26], [0.5, -6], [0.75, 26], [1, -6], [1.25, 26], [1.5, -6], [1.75, 26], [2, 0], [8, 0]),
      y: k('quadOut', [0, 0], [0.25, 10], [0.5, -2], [0.75, 10], [1, -2], [1.25, 10], [1.5, -2], [1.75, 10], [2, 0], [8, 0]),
      dz: k('quadOut', [0, 0], [0.25, 24], [0.5, 0], [0.75, 24], [1, 0], [1.25, 24], [1.5, 0], [1.75, 24], [2, 0], [8, 0]),
      rot: k('sineInOut', [0, 0], [2, 0], [4, 0], [4.25, -8], [4.75, 8], [5.25, -8], [5.75, 8], [6, 0], [8, 0]),
    },
    root: {
      x: k('sineInOut', [0, 0], [4, 0], [4.25, -8], [4.5, 8], [4.75, -8], [5, 8], [5.25, -8], [5.5, 8], [5.75, -8], [6, 0], [8, 0]),
      y: k('quadOut', [0, 0], [6, 0], [6.25, -16, 'quadIn'], [6.5, 0], [7, 0], [7.25, -16, 'quadIn'], [7.5, 0], [8, 0]),
    },
  },
  params: {
    flap: k('sineInOut',
      [0, -0.2], [2, -0.2],
      [2.12, 1.1, 'quadIn'], [2.25, -0.5, 'quadOut'], [2.5, -0.5], [2.62, 1.1, 'quadIn'], [2.75, -0.5, 'quadOut'], [3, -0.5],
      [3.12, 1.1, 'quadIn'], [3.25, -0.5, 'quadOut'], [3.5, -0.5], [3.62, 1.1, 'quadIn'], [3.75, -0.5, 'quadOut'], [4, 0.2],
      [6, 0.6], [6.22, -1.1, 'quadOut'], [6.5, 0.6], [7, 0.6], [7.22, -1.1, 'quadOut'], [7.5, 0.6], [8, -0.2]),
    squash: k('sineInOut', [0, 0], [0.25, 0.1], [2, 0], [4, 0.1], [5, 0.6], [6, 0.1, 'quadOut'], [6.25, -0.25], [6.5, 0.3], [7, 0.1], [7.25, -0.25], [7.5, 0.3], [8, 0]),
    lean: k('sineInOut', [0, 0], [4, 0], [4.25, 0.3], [4.5, -0.3], [4.75, 0.3], [5, -0.3], [5.25, 0.3], [5.5, -0.3], [5.75, 0.3], [6, 0], [8, 0]),
    wingFold: k('sineInOut', [0, 0.45], [1.9, 0.45], [2.12, 0], [3.9, 0], [4.3, 0.55], [5.7, 0.55], [6, 0.05], [7.6, 0.05], [8, 0.45]),
  },
  expression: [[0, 'excited'], [2, 'joyful'], [4, 'playful'], [6, 'joyful']],
  events: [
    { t: 6.25, effect: 'burst', at: 'body', params: { count: 6 } },
    { t: 7.25, effect: 'burst', at: 'body', params: { count: 6 } },
    { t: 2.5, effect: 'notes', at: 'head', params: { side: 1 } },
  ],
};

/* Hops: big hop, then five zig-zag hops landing on the beat, puff on every landing. */
function hopY(): Keyframe[] {
  const out: Keyframe[] = [[0, 0, 'quadOut'], [0.65, 0, 'quadOut'], [1.3, -56, 'quadIn'], [2, 0, 'linear']];
  for (let b = 2; b < 7; b++) out.push([b + 0.22, 0, 'quadOut'], [b + 0.62, -26, 'quadIn'], [b + 1, 0, 'linear']);
  out.push([8, 0]);
  return out;
}
function hopSquash(): Keyframe[] {
  const out: Keyframe[] = [[0, 0.3], [0.6, 0.65, 'quadOut'], [0.85, -0.5], [1.6, -0.2, 'quadIn'], [2, 0.1, 'quadOut']];
  for (let b = 2; b < 7; b++) out.push([b + 0.07, 0.5, 'quadOut'], [b + 0.3, -0.35], [b + 0.8, -0.1, 'quadIn'], [b + 1, 0.1, 'quadOut']);
  out.push([7.1, 0.5], [7.6, 0.25], [8, 0.3]);
  return out;
}
const hop: Clip = {
  ...DANCE,
  description: 'Bouncy pogo: one big crouch-and-hop, then five zig-zag hops that land on the beat with a dust puff each time.',
  bpm: 116,
  duration: 8,
  bones: {
    root: {
      y: hopY(),
      x: k('sineInOut', [0, 0], [2, 0], [2.25, 0], [3, -18], [3.25, -18], [4, 18], [4.25, 18], [5, -18], [5.25, -18], [6, 18], [6.25, 18], [7, 0], [8, 0]),
      yaw: k('sineInOut', [0, 0], [2, 0], [2.6, -18], [3.2, -12], [3.6, 18], [4.2, 12], [4.6, -18], [5.2, -12], [5.6, 18], [6.2, 12], [6.6, 0], [8, 0]),
    },
    head: {
      pitch: k('sineInOut', [0, 4], [0.65, 10], [1.2, -10], [2.12, 12, 'quadOut'], [2.5, -4], [3.12, 10, 'quadOut'], [3.5, -4], [4.12, 10, 'quadOut'], [4.5, -4], [5.12, 10, 'quadOut'], [5.5, -4], [6.12, 10, 'quadOut'], [6.5, -4], [7.12, 10, 'quadOut'], [8, 4]),
      rot: k('sineInOut', [0, 0], [2.3, 0], [3.2, 7], [4.2, -7], [5.2, 7], [6.2, -7], [7.2, 0], [8, 0]),
    },
  },
  params: {
    squash: hopSquash(),
    flap: k('sineInOut', [0, -0.3], [0.65, -0.7], [1.05, 1.2, 'backOut'], [1.7, 0.6], [2.12, -0.5, 'quadOut'],
      [2.6, 0.7], [3.12, -0.4, 'quadOut'], [3.6, 0.7], [4.12, -0.4, 'quadOut'], [4.6, 0.7], [5.12, -0.4, 'quadOut'], [5.6, 0.7], [6.12, -0.4, 'quadOut'], [6.6, 0.7], [7.15, -0.4], [8, -0.3]),
    lean: k('sineInOut', [0, 0], [2.3, 0], [2.7, -0.2], [3.3, 0.1], [3.7, 0.2], [4.3, -0.1], [4.7, -0.2], [5.3, 0.1], [5.7, 0.2], [6.3, -0.1], [7, 0], [8, 0]),
    wingFold: k('sineInOut', [0, 0.35], [0.65, 0.55], [1.05, 0, 'backOut'], [1.7, 0.1], [2.1, 0.3], [7, 0.3], [8, 0.35]),
  },
  expression: [[0, 'determined'], [0.8, 'excited'], [2, 'joyful'], [5, 'excited'], [7, 'joyful']],
  events: [
    ...[2, 3, 4, 5, 6, 7].map((t) => ({ t, effect: 'puff', at: 'feet', params: { count: t === 2 ? 6 : 3 } })),
    { t: 1.3, effect: 'sparkles', at: 'head', params: { count: 3 } },
  ],
};

/* Twist: hips twist on every beat, head stays facing the audience; dips down over 4 beats then back up. */
const twist: Clip = {
  ...DANCE,
  description: 'The Twist: body yaws hard left/right on every beat while the head counter-turns to keep facing front; dips low and rises back up.',
  bpm: 120,
  duration: 8,
  bones: {
    body: { yaw: rep(8, 2, [[0, -40, 'quadInOut'], [1, 40, 'quadInOut']]) },
    head: {
      yaw: rep(8, 2, [[0, 32], [1, -32]], 'quadInOut', 0.1),
      rot: rep(8, 2, [[0, 5], [1, -5]], 'sineInOut', 0.2),
    },
    root: { y: rep(8, 1, [[0, 0, 'quadOut'], [0.5, -5, 'quadIn']]) },
    'wing-l': { rot: rep(8, 2, [[0, 18], [1, -14]], 'sineInOut', 0.15) },
    'wing-r': { rot: rep(8, 2, [[0, 14], [1, -18]], 'sineInOut', 0.15) },
  },
  params: {
    squash: k('sineInOut', [0, 0.05], [2, 0.35], [4, 0.6], [6, 0.35], [8, 0.05]),
    lean: rep(8, 2, [[0, 0.12], [1, -0.12]], 'sineInOut', 0.05),
    flap: rep(8, 1, [[0, -0.2], [0.5, 0.1]], 'sineInOut', 0.2),
    // half-tucked: the body twists ±40°, open wings would sweep across it
    wingFold: [[0, 0.55]],
  },
  expression: [[0, 'joyful'], [3, 'playful'], [5, 'joyful'], [7, 'singing']],
  events: [{ t: 7, effect: 'notes', at: 'head', params: { side: 1 } }, { t: 3, effect: 'notes', at: 'head', params: { side: -1 } }],
};

/* Moonwalk: turned 3/4, glides backwards while the feet step, quick pivot, glides back. */
const GLIDE = 62;
const moonwalk: Clip = {
  ...DANCE,
  description: 'Moonwalk: turned three-quarters, glides backwards with alternating heel-toe steps, snaps round and glides back the other way. Wings folded, cool face.',
  bpm: 110,
  duration: 8,
  bones: {
    root: {
      yaw: k('sineInOut', [0, 58], [3.55, 58, 'cubicInOut'], [4, -58], [7.55, -58, 'cubicInOut'], [8, 58]),
      x: k('linear', [0, GLIDE], [3.5, -GLIDE, 'sineInOut'], [4, -GLIDE], [7.5, GLIDE, 'sineInOut'], [8, GLIDE]),
      y: rep(8, 1, [[0, 0, 'quadOut'], [0.5, -4, 'quadIn']]),
    },
    head: {
      // keep the face toward the audience a bit, and bob on the beat
      yaw: k('sineInOut', [0, -24], [3.5, -24], [3.75, 30], [4, 24], [7.5, 24], [7.75, -30], [8, -24]),
      pitch: rep(8, 1, [[0, 7, 'quadOut'], [0.5, -3]], 'sineInOut', 0.12),
    },
    'foot-l': {
      y: rep(8, 1, [[0, 0], [0.25, -8], [0.5, 0], [0.75, 0]]),
      x: rep(8, 1, [[0, 5], [0.5, -5]]),
    },
    'foot-r': {
      y: rep(8, 1, [[0, 0], [0.5, 0], [0.75, -8]]),
      x: rep(8, 1, [[0, -5], [0.5, 5]]),
    },
  },
  params: {
    lean: k('sineInOut', [0, 0.18], [3.5, 0.18], [4, -0.18], [7.5, -0.18], [8, 0.18]),
    squash: rep(8, 1, [[0, 0.15], [0.5, -0.05]]),
    flap: rep(8, 1, [[0, -0.25], [0.5, -0.15]]),
    wingFold: [[0, 1]],
  },
  expression: [[0, 'proud'], [3.6, 'wink'], [4.4, 'proud'], [7.6, 'wink']],
  events: [
    { t: 3.8, effect: 'sparkles', at: 'head', params: { count: 3 } },
    { t: 7.8, effect: 'sparkles', at: 'head', params: { count: 3 } },
    { t: 1.5, effect: 'notes', at: 'head', params: { side: 1 } },
    { t: 5.5, effect: 'notes', at: 'head', params: { side: -1 } },
  ],
};

/* Robot: staccato pops on every half beat, holds in between. */
const robot: Clip = {
  ...DANCE,
  description: 'Robot: stiff staccato pops on every half beat — head ticks, body turns, wings lock into angles — with a mechanical bounce.',
  bpm: 110,
  duration: 8,
  bones: {
    head: {
      yaw: pops(8, [[0, 0], [0.5, 30], [1.5, 0], [2, -30], [3, 0], [4.5, 30], [5, 0], [6, -30], [7, 0]]),
      rot: pops(8, [[0, 0], [1, 10], [2, 0], [3.5, -10], [4, 0], [5.5, 10], [6.5, 0], [7.5, -8]]),
    },
    body: { yaw: pops(8, [[0, 0], [1, 25], [2, 0], [3, -25], [4, 0], [5, 25], [6, -25], [7, 0]]) },
    'wing-l': { rot: pops(8, [[0, 0], [0.5, 40], [1.5, 40], [2, -25], [3, 0], [4, 40], [4.5, 0], [5.5, 40], [6, -25], [7, 0]]) },
    'wing-r': { rot: pops(8, [[0, 0], [1, 25], [2, -40], [2.5, -40], [3, 0], [4, -40], [4.5, 0], [5, 25], [6.5, -40], [7, 0]]) },
    root: { y: pops(8, [[0, 0], [0.5, 4], [1, 0], [1.5, 4], [2, 0], [2.5, 4], [3, 0], [3.5, 4], [4, 0], [4.5, 4], [5, 0], [5.5, 4], [6, 0], [6.5, 4], [7, 0], [7.5, 4]], 0.06, 'quadOut') },
  },
  params: {
    squash: pops(8, [[0, 0.2], [0.5, 0], [1, 0.2], [1.5, 0], [2, 0.2], [2.5, 0], [3, 0.2], [3.5, 0], [4, 0.2], [4.5, 0], [5, 0.2], [5.5, 0], [6, 0.2], [6.5, 0], [7, 0.2], [7.5, 0]], 0.06, 'quadOut'),
    wingFold: pops(8, [[0, 0.3], [2, 0.15], [4, 0.3], [6, 0.15]], 0.08, 'quadOut'),
  },
  expression: [[0, 'unimpressed'], [4, 'determined'], [7, 'excited']],
  suppress: { look: true, fidget: true, breathe: true },
  events: [{ t: 7, effect: 'sparkles', at: 'head', params: { count: 2 } }],
};

/* Disco: point up-right / down-left with one wing (Saturday-night style), hips sway; other wing for the second half. */
function discoHalf(start: number, wingRot: [number, number]): Keyframe[] {
  // wingRot = [pointUp, pointDown] for the pointing wing
  const out: Keyframe[] = [];
  for (let b = 0; b < 4; b += 2) {
    out.push([start + b, wingRot[0], 'backOut'], [start + b + 0.7, wingRot[0], 'quadInOut'], [start + b + 1, wingRot[1], 'backOut'], [start + b + 1.7, wingRot[1], 'quadInOut']);
  }
  return out;
}
const disco: Clip = {
  ...DANCE,
  description: 'Disco point: one wing stabs up to the sky then down across the body on alternating beats while the hips sway; switches wings halfway.',
  bpm: 118,
  duration: 8,
  bones: {
    'wing-r': {
      rot: [
        ...discoHalf(0, [-78, 46]),
        [3.7, 46, 'quadInOut'], [4, 12], [8, 12, 'quadInOut'],
      ] as Keyframe[],
    },
    'wing-l': {
      rot: [
        [0, -12, 'quadInOut'], [3.7, -12, 'quadInOut'],
        ...discoHalf(4, [78, -46]),
        [7.7, -46, 'quadInOut'], [8, -12],
      ] as Keyframe[],
    },
    root: {
      x: rep(8, 1, [[0, 10, 'sineInOut'], [0.5, -10]], 'sineInOut', 0),
      y: rep(8, 1, [[0, 0, 'quadOut'], [0.5, -6, 'quadIn']]),
    },
    head: {
      rot: rep(8, 2, [[0, 8], [1, -8]], 'sineInOut', 0.12),
    },
  },
  params: {
    lookX: k('sineInOut', [0, 0.55], [0.9, 0.55], [1, -0.45], [1.9, -0.45], [2, 0.55], [2.9, 0.55], [3, -0.45], [3.9, -0.45],
      [4, -0.55], [4.9, -0.55], [5, 0.45], [5.9, 0.45], [6, -0.55], [6.9, -0.55], [7, 0.45], [7.9, 0.45], [8, 0.55]),
    lookY: rep(8, 2, [[0, -0.6], [0.9, -0.6], [1, 0.5], [1.9, 0.5]]),
    lean: k('sineInOut', [0, 0.28], [0.5, -0.12], [1, -0.28], [1.5, 0.12], [2, 0.28], [2.5, -0.12], [3, -0.28], [3.5, 0.12],
      [4, -0.28], [4.5, 0.12], [5, 0.28], [5.5, -0.12], [6, -0.28], [6.5, 0.12], [7, 0.28], [7.5, -0.12], [8, 0.28]),
    squash: rep(8, 1, [[0, 0.25, 'quadOut'], [0.5, -0.08]]),
    wingFold: [[0, 0.15]],
  },
  expression: [[0, 'proud'], [2, 'excited'], [4, 'proud'], [6, 'excited']],
  events: [
    { t: 0.05, effect: 'sparkles', at: [150, -215], params: { count: 2, spread: 40 } },
    { t: 2.05, effect: 'sparkles', at: [150, -215], params: { count: 2, spread: 40 } },
    { t: 4.05, effect: 'sparkles', at: [-150, -215], params: { count: 2, spread: 40 } },
    { t: 6.05, effect: 'sparkles', at: [-150, -215], params: { count: 2, spread: 40 } },
    { t: 3, effect: 'notes', at: 'head', params: { side: -1 } },
  ],
};

/* Headbang: hard nods on every beat, then a head-circle windmill. Ears fly on their springs. */
const headbang: Clip = {
  ...DANCE,
  description: 'Rock out: hard pitch nods slam down on every beat with wings pumping, then four beats of head-circling — ears whip around on their springs.',
  bpm: 124,
  duration: 8,
  bones: {
    head: {
      pitch: [
        ...rep(4, 1, [[0, 30, 'quadOut'], [0.55, -18, 'quadIn']]).slice(0, -1),
        [4, 30, 'sineInOut'], [4.5, 0], [5, -14], [5.5, 0], [6, 20], [6.5, 0], [7, -14], [7.5, 0], [8, 30],
      ] as Keyframe[],
      y: [
        ...rep(4, 1, [[0, 8, 'quadOut'], [0.55, -4, 'quadIn']]).slice(0, -1),
        [4, 8, 'sineInOut'], [4.5, 0], [5, -4], [5.5, 0], [6, 8], [6.5, 0], [7, -4], [7.5, 0], [8, 8],
      ] as Keyframe[],
      rot: k('sineInOut', [0, 0], [3.5, 0], [4, 0], [4.5, 22], [5, 0], [5.5, -22], [6, 0], [6.5, 22], [7, 0], [7.5, -22], [7.8, 0], [8, 0]),
    },
    body: {
      pitch: rep(8, 1, [[0, 10, 'quadOut'], [0.55, -4, 'quadIn']], 'quadIn', 0.05),
    },
    root: { y: rep(8, 1, [[0, 0, 'quadOut'], [0.5, -6, 'quadIn']]) },
  },
  params: {
    squash: rep(8, 1, [[0, 0.42, 'quadOut'], [0.5, -0.12, 'quadIn']]),
    flap: rep(8, 1, [[0, -0.55, 'quadOut'], [0.55, 0.55, 'quadIn']], 'quadIn', 0.1),
    wingFold: rep(8, 1, [[0, 0.4, 'quadOut'], [0.55, 0.1, 'quadIn']], 'quadIn', 0.1),
    lean: k('sineInOut', [0, 0], [4, 0], [4.5, 0.25], [5.5, -0.25], [6.5, 0.25], [7.5, -0.25], [8, 0]),
  },
  expression: [[0, 'determined'], [2, 'excited'], [4, 'determined'], [6, 'excited']],
  events: [
    { t: 0.05, effect: 'burst', at: 'head', params: { count: 5 } },
    { t: 4.5, effect: 'sweat', at: 'head', params: { side: 1 } },
    { t: 5.5, effect: 'sweat', at: 'head', params: { side: -1 } },
  ],
};

/* Wave: a ripple from the left wing tip through shoulders and head to the right wing tip, and back. */
function bumps(total: number, peaks: [number, number][], width: number, ease: Ease = 'sineInOut'): Keyframe[] {
  const out: Keyframe[] = [[0, 0, ease]];
  for (const [t, v] of peaks) out.push([Math.max(t - width, 1e-3), 0, ease], [t, v, ease], [Math.min(t + width, total - 1e-3), 0, ease]);
  out.push([total, 0, ease]);
  return out.sort((a, b) => a[0] - b[0]);
}
const W = 0.45;
const waveDance: Clip = {
  ...DANCE,
  description: 'The wave: a ripple travels from the left wing tip, through the shoulders and head, out the right wing tip — then back again.',
  bpm: 104,
  duration: 8,
  bones: {
    body: { rot: bumps(8, [[0.7, 11], [1.3, -11], [2.7, -11], [3.3, 11], [4.7, 11], [5.3, -11], [6.7, -11], [7.3, 11]], 0.3) },
    head: {
      y: bumps(8, [[1, -18], [3, -18], [5, -18], [7, -18]], 0.35),
      rot: bumps(8, [[0.8, -10], [1.25, 10], [2.75, 10], [3.2, -10], [4.8, -10], [5.25, 10], [6.75, 10], [7.2, -10]], 0.22),
    },
    root: { y: rep(8, 1, [[0, 0, 'quadOut'], [0.5, -5, 'quadIn']]) },
  },
  params: {
    lookX: rep(8, 4, [[0, -0.6], [0.4, -0.6], [1.9, 0.6], [2.4, 0.6], [3.9, -0.6]]),
    squash: rep(8, 1, [[0, 0.18, 'quadOut'], [0.5, -0.06]]),
    // the ripple enters and leaves through the wing tips: each wing rises and opens in turn
    raiseL: bumps(8, [[0.45, 0.95], [3.55, 0.95], [4.45, 0.95], [7.55, 0.95]], W),
    raiseR: bumps(8, [[1.55, 0.95], [2.45, 0.95], [5.55, 0.95], [6.45, 0.95]], W),
    wingFold: [[0, 0.4]],
  },
  expression: [[0, 'happy'], [2, 'joyful'], [4, 'happy'], [6, 'joyful']],
  events: [
    { t: 1.9, effect: 'sparkles', at: [195, -150], params: { count: 2, spread: 40 } },
    { t: 3.9, effect: 'sparkles', at: [-195, -150], params: { count: 2, spread: 40 } },
    { t: 5.9, effect: 'sparkles', at: [195, -150], params: { count: 2, spread: 40 } },
    { t: 7.9, effect: 'sparkles', at: [-195, -150], params: { count: 2, spread: 40 } },
    { t: 4, effect: 'notes', at: 'head', params: { side: 1 } },
  ],
};

/* Jump spin: groove, deep crouch, launch, full spin in the air, landing puff + sparkles. */
const AIR_UP = 3.1;
const AIR_LAND = 4.6;
const jumpSpin: Clip = {
  ...DANCE,
  description: 'Two bops, deep crouch, launch into a full 360° spin at the top of a big jump (wings tuck up), squash landing with puff and sparkles, proud ta-da.',
  bpm: 116,
  duration: 8,
  bones: {
    root: {
      y: k('sineInOut',
        [0, 0, 'quadOut'], [0.5, -9, 'quadIn'], [1, 0, 'quadOut'], [1.5, -9, 'quadIn'], [2, 0],
        [AIR_UP, 0, 'quadOut'], [3.85, -78, 'quadIn'], [AIR_LAND, 0, 'quadOut'], [5.1, -5, 'quadIn'], [5.4, 0],
        [6, 0, 'quadOut'], [6.5, -8, 'quadIn'], [7, 0, 'quadOut'], [7.5, -8, 'quadIn'], [8, 0]),
      yaw: k('sineInOut', [0, 0], [2.1, 0], [3, -24, [0.3, 0.1, 0.3, 1]], [AIR_LAND - 0.1, 360], [8, 360]),
    },
    head: {
      yaw: k('sineInOut', [0, 0], [2.4, 0], [3, 16], [3.45, -45, 'cubicIn'], [3.9, 60, 'cubicOut'], [4.4, 14], [4.85, -6], [5.4, 0], [8, 0]),
      pitch: k('sineInOut', [0, 4], [0.5, -3], [1, 4], [1.5, -3], [2, 4], [3, 12], [3.5, -12], [4.3, -4], [AIR_LAND + 0.1, 14, 'backOut'], [5.3, -2], [6, 4], [6.5, -3], [7, 4], [7.5, -3], [8, 4]),
    },
  },
  params: {
    squash: k('sineInOut',
      [0, 0.28, 'quadOut'], [0.5, -0.1], [1, 0.28, 'quadOut'], [1.5, -0.1], [2, 0.25],
      [3, 0.8, 'quadOut'], [3.3, -0.7], [3.85, -0.15], [4.45, -0.4, 'quadIn'], [AIR_LAND + 0.08, 0.75, 'quadOut'], [5.2, -0.15], [5.6, 0],
      [6, 0.25, 'quadOut'], [6.5, -0.08], [7, 0.25, 'quadOut'], [7.5, -0.08], [8, 0.28]),
    flap: k('sineInOut',
      [0, -0.1], [0.5, 0.25], [1, -0.1], [1.5, 0.25], [2, -0.1],
      [3, -0.9, 'backOut'], [3.35, 1.3], [4.2, 1.0], [AIR_LAND, -0.6, 'backOut'], [5.1, 1.15, 'backOut'], [6.1, 0.9],
      [6.6, 0.25], [7, -0.1], [7.5, 0.25], [8, -0.1]),
    // wings tuck up for the airborne spin, open wide on the landing
    wingFold: k('sineInOut', [0, 0.3], [2.1, 0.3], [3, 0.6], [3.35, 0.8], [4.3, 0.8], [AIR_LAND, 0.3], [5.1, 0, 'backOut'], [6.1, 0.1], [7, 0.3], [8, 0.3]),
  },
  expression: [[0, 'happy'], [2.2, 'determined'], [3.1, 'excited'], [AIR_LAND, 'proud'], [6.3, 'joyful']],
  events: [
    { t: AIR_LAND, effect: 'puff', at: 'feet', params: { count: 7 } },
    { t: AIR_LAND + 0.1, effect: 'sparkles', at: 'head', params: { count: 6 } },
  ],
};

/* Shimmy: rapid little shoulder shakes while sinking down and drifting side to side. */
function shake(total: number, step: number, amp: number, phase = 0): Keyframe[] {
  const out: Keyframe[] = [];
  const n = Math.round(total / step);
  for (let i = 0; i < n; i++) out.push([i * step, i % 2 ? -amp : amp, 'sineInOut']);
  out.push([total, amp, 'sineInOut']);
  return lag(out, phase, total);
}
const shimmy: Clip = {
  ...DANCE,
  description: 'Shimmy: fast sixteenth-note shoulder and wing shakes while sinking down, drifting side to side and popping back up.',
  bpm: 112,
  duration: 8,
  bones: {
    body: { rot: shake(8, 0.25, 4.5) },
    head: { rot: shake(8, 0.25, -2.5, 0.06), pitch: rep(8, 1, [[0, 6], [0.5, -2]], 'sineInOut', 0.1) },
    'wing-l': { rot: shake(8, 0.25, 9, 0.08) },
    'wing-r': { rot: shake(8, 0.25, 9, 0.1) },
    root: {
      x: rep(8, 4, [[0, -16], [2, 16]]),
      y: rep(8, 1, [[0, 0, 'quadOut'], [0.5, -4, 'quadIn']]),
    },
  },
  params: {
    squash: rep(8, 2, [[0, -0.12], [1.4, 0.55, 'quadOut'], [1.8, 0.5, 'backIn']]),
    lean: rep(8, 4, [[0, 0.22], [2, -0.22]], 'sineInOut', 0.15),
    flap: rep(8, 2, [[0, 0.35], [1.4, -0.25]], 'sineInOut', 0.2),
    wingFold: rep(8, 2, [[0, 0.25], [1.4, 0.45]], 'sineInOut', 0.2),
  },
  expression: [[0, 'playful'], [4, 'joyful']],
  events: [
    { t: 1.5, effect: 'notes', at: 'head', params: { side: 1 } },
    { t: 5.5, effect: 'notes', at: 'head', params: { side: -1 } },
  ],
};

/* Floss: hips swing one way while both wings swing the other, the front wing alternating. */
const floss: Clip = {
  ...DANCE,
  description: 'Floss: hips swing one way while both wings swing the other way, one passing in front of the body and one behind, alternating every beat.',
  bpm: 112,
  duration: 8,
  bones: {
    root: {
      x: rep(8, 1, [[0, 10, 'quadInOut'], [0.5, -10, 'quadInOut']]),
      y: rep(8, 0.5, [[0, 0, 'quadOut'], [0.25, -3, 'quadIn']]),
    },
    'wing-l': {
      rot: rep(8, 1, [[0, -34, 'quadInOut'], [0.5, 34, 'quadInOut']], 'quadInOut', 0.04),
      dz: rep(8, 2, [[0, 50], [0.9, 50, 'quadInOut'], [1.1, -10], [1.9, -10, 'quadInOut']]),
    },
    'wing-r': {
      rot: rep(8, 1, [[0, -34, 'quadInOut'], [0.5, 34, 'quadInOut']], 'quadInOut', 0.04),
      dz: rep(8, 2, [[0, -10], [0.9, -10, 'quadInOut'], [1.1, 50], [1.9, 50, 'quadInOut']]),
    },
    head: { rot: rep(8, 1, [[0, -5], [0.5, 5]], 'sineInOut', 0.12) },
  },
  params: {
    flap: rep(8, 1, [[0, -0.9], [0.25, -0.75], [0.5, -0.9], [0.75, -0.75]]),
    // compact wings swing like arms in front of / behind the body
    wingFold: [[0, 0.65]],
    lean: rep(8, 1, [[0, -0.25, 'quadInOut'], [0.5, 0.25, 'quadInOut']], 'quadInOut', 0.06),
    squash: rep(8, 0.5, [[0, 0.15, 'quadOut'], [0.25, -0.04]]),
  },
  expression: [[0, 'playful'], [4, 'excited']],
  events: [{ t: 3.5, effect: 'notes', at: 'head', params: { side: 1 } }, { t: 7.5, effect: 'notes', at: 'head', params: { side: -1 } }],
};

/* Groove: a laid-back two-step with shoulder rolls. */
const groove: Clip = {
  ...DANCE,
  description: 'Laid-back two-step: steps side to side on the beat, shoulders roll, head nods behind the beat, wings flick on the off-beat.',
  bpm: 100,
  duration: 8,
  bones: {
    root: {
      x: rep(8, 2, [[0, -12, 'quadOut'], [0.4, -12], [1, 12, 'quadOut'], [1.4, 12]]),
      y: rep(8, 1, [[0, 0, 'quadOut'], [0.35, -7, 'quadIn']]),
      yaw: rep(8, 2, [[0, -14], [1, 14]], 'sineInOut', 0.1),
    },
    body: { rot: rep(8, 2, [[0, -5], [0.5, 4], [1, 5], [1.5, -4]], 'sineInOut', 0.05) },
    head: {
      pitch: rep(8, 1, [[0, -3], [0.25, 10, 'quadOut'], [0.6, -3]], 'sineInOut'),
      yaw: rep(8, 2, [[0, 12], [1, -12]], 'sineInOut', 0.2),
      rot: rep(8, 2, [[0, -7], [1, 7]], 'sineInOut', 0.25),
    },
    'foot-l': { y: rep(8, 2, [[0, 0], [1, 0], [1.15, -9, 'quadIn'], [1.5, 0], [1.9, 0]]) },
    'foot-r': { y: rep(8, 2, [[0, 0], [0.15, -9, 'quadIn'], [0.5, 0], [1, 0]]) },
    'wing-l': { rot: rep(8, 1, [[0, -6], [0.5, 14, 'backOut'], [0.75, 6]], 'sineInOut', 0.05) },
    'wing-r': { rot: rep(8, 1, [[0, 6], [0.5, -14, 'backOut'], [0.75, -6]], 'sineInOut', 0.05) },
  },
  params: {
    squash: rep(8, 1, [[0, 0.3, 'quadOut'], [0.35, -0.1]]),
    lean: rep(8, 2, [[0, -0.18], [1, 0.18]], 'sineInOut', 0.15),
    wingFold: rep(8, 1, [[0, 0.45], [0.5, 0.3, 'backOut'], [0.75, 0.4]], 'sineInOut', 0.05),
  },
  expression: [[0, 'happy'], [2, 'singing'], [4, 'wink'], [5, 'happy'], [6, 'singing']],
  events: [{ t: 2, effect: 'notes', at: 'head', params: { side: 1 } }, { t: 6, effect: 'notes', at: 'head', params: { side: -1 } }],
};

/* ------------------------------------------------------------------ */
/* Variants & routine                                                  */
/* ------------------------------------------------------------------ */

const spinLeft = mirrorClip(spin);
const jumpSpinLeft = mirrorClip(jumpSpin);
const robotLeft = mirrorClip(robot);

/** Re-time a move to a shared tempo (sequence() uses the first part's bpm). */
const at = (c: Clip, bpm: number): Clip => ({ ...c, bpm });
const PARTY_BPM = 116;
const party: Clip = sequence(
  'dance-party',
  [bop, spin, disco, jumpSpin].map((c) => at(c, PARTY_BPM)),
  {
    ...DANCE,
    description: 'A 32-beat routine: bop → spin → disco points → jump-spin finale, with notes throughout and confetti on the big landings.',
    bpm: PARTY_BPM,
    events: [
      { t: 8 + SPIN_END + 0.1, effect: 'confetti', at: 'head', params: { count: 14 } },
      { t: 24 + AIR_LAND + 0.05, effect: 'confetti', at: 'head', params: { count: 30 } },
      { t: 28.5, effect: 'notes', at: 'head', params: { side: -1, count: 3 } },
    ],
  },
);

export const dancesClips = defineClips({
  'dance-bop': bop,
  'dance-spin': spin,
  'dance-spin-left': { ...spinLeft, description: 'Mirror of dance-spin: winds right and spins counter-clockwise.' },
  'dance-sway': sway,
  'dance-flap': flapDance,
  'dance-hop': hop,
  'dance-twist': twist,
  'dance-moonwalk': moonwalk,
  'dance-robot': robot,
  'dance-robot-left': { ...robotLeft, description: 'Mirror of dance-robot: the same pops, starting to the other side.' },
  'dance-disco': disco,
  'dance-headbang': headbang,
  'dance-wave': waveDance,
  'dance-jump-spin': jumpSpin,
  'dance-jump-spin-left': { ...jumpSpinLeft, description: 'Mirror of dance-jump-spin: spins the other way in the air.' },
  'dance-shimmy': shimmy,
  'dance-floss': floss,
  'dance-groove': groove,
  'dance-party': party,
});
