/**
 * Emotion reactions — one-shot clips (≈1–2.5 s) that return to idle on their
 * own. Each combines body motion, an expression and effects fired on the
 * accent frame. See docs/animation.md.
 *
 * Conventions used below:
 * - Folded-wing emotes sweep the wings down (flap < 0) right before swapping
 *   the slot to `folded`, and sweep them open again before the end, so the
 *   art swap hides inside a fast motion.
 * - Every bone channel returns to rest on the last key for a seamless
 *   crossfade back to idle.
 */
import { defineClips, keys, wave } from '@openmascot/core';
import type { Keyframe } from '@openmascot/core';

/** Fold both wings at `t0`, unfold at `t1`. */
const foldWings = (t0: number, t1: number): Record<string, [number, string][]> => ({
  'wing-l': [[t0, 'folded'], [t1, 'spread']],
  'wing-r': [[t0, 'folded'], [t1, 'spread']],
});

/** Damped oscillation sampled into keys (chuckles, shivers, wobbles). */
function shake(t0: number, t1: number, amp: number, cycles: number, offset = 0): Keyframe[] {
  const steps = Math.max(4, Math.round(cycles * 4));
  const out: Keyframe[] = [];
  for (let i = 0; i <= steps; i++) {
    const u = i / steps;
    const t = t0 + (t1 - t0) * u;
    out.push([t, offset + amp * (1 - u) * Math.sin(u * cycles * Math.PI * 2), 'sineInOut']);
  }
  return out;
}

export const emotionsClips = defineClips({
  /* ------------------------------------------------------------------ */
  'emote-excited': {
    description: 'Excited: crouch, big hop with wings flung wide and yellow burst lines, a second little hop, settle.',
    category: 'emotion',
    duration: 1.7,
    fadeIn: 0.12,
    suppress: { look: true },
    expression: [[0, 'excited'], [1.5, 'happy']],
    params: {
      squash: keys('sineInOut', [0, 0], [0.14, 0.5, 'quadOut'], [0.28, -0.5], [0.46, -0.1], [0.62, 0.45, 'quadOut'], [0.76, -0.25], [0.9, -0.05], [1.02, 0.3], [1.16, -0.08], [1.32, 0]),
      flap: keys('sineInOut', [0, 0], [0.14, -0.6], [0.3, 1.25, 'backOut'], [0.5, 0.85], [0.62, -0.25], [0.78, 0.75], [0.92, 1.0], [1.04, 0.35], [1.3, 0.5], [1.7, 0]),
      lookY: keys('sineInOut', [0, 0], [0.14, 0.15], [0.4, -0.25], [0.7, 0], [1.7, 0]),
    },
    bones: {
      root: { y: keys('quadOut', [0, 0], [0.16, 0], [0.42, -46, 'quadIn'], [0.62, 0, 'quadOut'], [0.78, 0], [0.9, -16, 'quadIn'], [1.02, 0], [1.7, 0]) },
      head: {
        rot: keys('sineInOut', [0, 0], [0.3, -4], [0.62, 3], [0.9, -3], [1.2, 2], [1.7, 0]),
        y: keys('sineInOut', [0, 0], [0.16, 4], [0.34, -5], [0.64, 6], [0.82, -2], [1.05, 3], [1.3, 0]),
      },
    },
    events: [
      { t: 0.36, effect: 'burst', at: 'head' },
      { t: 0.9, effect: 'burst', at: 'head', params: { size: 0.8 } },
    ],
  },

  /* ------------------------------------------------------------------ */
  'emote-happy': {
    description: 'Happy: bouncy side-to-side sway with closed happy eyes, wings fluttering, a couple of hearts.',
    category: 'emotion',
    duration: 2,
    fadeIn: 0.15,
    expression: [[0, 'joyful'], [1.2, 'happy']],
    params: {
      squash: keys('sineInOut', [0, 0], [0.12, 0.3], [0.26, -0.2], [0.44, 0.25], [0.6, -0.15], [0.84, 0.2], [1.0, -0.1], [1.25, 0.08], [1.6, 0]),
      lean: keys('sineInOut', [0, 0], [0.3, 0.3], [0.7, -0.3], [1.1, 0.22], [1.5, -0.08], [2, 0]),
      flap: keys('sineInOut', [0, 0], [0.18, 0.45], [0.36, 0.1], [0.56, 0.5], [0.76, 0.1], [0.98, 0.45], [1.3, 0.15], [2, 0]),
    },
    bones: {
      root: { y: keys('quadOut', [0, 0], [0.12, 0], [0.26, -14, 'quadIn'], [0.44, 0, 'quadOut'], [0.6, -10, 'quadIn'], [0.84, 0], [2, 0]) },
      head: { rot: keys('sineInOut', [0, 0], [0.36, -9], [0.78, 9], [1.18, -6], [1.6, 2], [2, 0]) },
    },
    events: [{ t: 0.3, effect: 'hearts', at: 'head', params: { count: 2, size: 0.8 } }],
  },

  /* ------------------------------------------------------------------ */
  'emote-love': {
    description: 'Loving: hugs itself in its folded wings, blushes with happy eyes, sways dreamily as hearts float up.',
    category: 'emotion',
    duration: 2.3,
    fadeIn: 0.15,
    expression: [[0, 'love']],
    slots: foldWings(0.12, 1.98),
    params: {
      flap: keys('sineInOut', [0, 0], [0.12, -0.7, 'quadOut'], [0.3, 0], [1.88, 0], [1.98, -0.55, 'backOut'], [2.3, 0]),
      squash: keys('sineInOut', [0, 0], [0.14, 0.25], [0.32, -0.12], [0.5, 0.12], [1.9, 0.12], [2.1, -0.05], [2.3, 0]),
      lean: keys('sineInOut', [0, 0], [0.5, 0.25], [1.05, -0.2], [1.6, 0.22], [2.3, 0]),
    },
    bones: {
      root: { y: keys('sineInOut', [0, 0], [0.5, -4], [1.6, -4], [2.1, 0]) },
      head: {
        rot: keys('sineInOut', [0, 0], [0.4, 12], [1.0, 6], [1.5, 13], [2.0, 3], [2.3, 0]),
        dz: keys('sineInOut', [0, 0], [0.4, 8], [1.9, 8], [2.3, 0]),
      },
      'wing-l': {
        x: keys('backOut', [0, 0], [0.12, 0], [0.38, 16], [1.0, 13, 'sineInOut'], [1.45, 17, 'sineInOut'], [1.95, 0]),
        rot: keys('backOut', [0, 0], [0.12, 0], [0.38, -12], [1.95, -12, 'step'], [1.98, 0]),
        dz: keys('step', [0, 0], [0.12, 58], [1.98, 0]),
      },
      'wing-r': {
        x: keys('backOut', [0, 0], [0.12, 0], [0.38, -16], [1.0, -13, 'sineInOut'], [1.45, -17, 'sineInOut'], [1.95, 0]),
        rot: keys('backOut', [0, 0], [0.12, 0], [0.38, 12], [1.95, 12, 'step'], [1.98, 0]),
        dz: keys('step', [0, 0], [0.12, 58], [1.98, 0]),
      },
    },
    events: [
      { t: 0.42, effect: 'hearts', at: 'head', params: { count: 3 } },
      { t: 1.3, effect: 'hearts', at: 'head', params: { count: 2, size: 0.8 } },
    ],
  },

  /* ------------------------------------------------------------------ */
  'emote-inlove': {
    description: 'In love: double-take with heart eyes, then melts forward and leans in, wings fluttering, hearts streaming up.',
    category: 'emotion',
    duration: 2.5,
    fadeIn: 0.12,
    suppress: { look: true },
    expression: [[0, 'inlove']],
    params: {
      squash: keys('sineInOut', [0, 0], [0.1, 0.25], [0.24, -0.45, 'backOut'], [0.5, -0.1], [0.8, 0.45], [1.9, 0.4], [2.2, -0.05], [2.5, 0]),
      flap: [
        ...keys('sineInOut', [0, 0], [0.1, -0.3], [0.26, 1.1, 'backOut'], [0.55, 0.3]),
        ...wave(1.4, 0.18, { cycles: 7, offset: 0.25 }).map(([t, v]) => [0.6 + t, v, 'sineInOut'] as Keyframe),
        [2.2, 0.2, 'sineInOut'],
        [2.5, 0],
      ],
      lean: keys('sineInOut', [0, 0], [0.8, 0], [1.2, 0.2], [1.6, -0.18], [2.0, 0.12], [2.5, 0]),
      lookY: keys('sineInOut', [0, 0], [0.25, -0.3], [0.8, 0.15], [2.1, 0.15], [2.5, 0]),
    },
    bones: {
      root: { y: keys('quadOut', [0, 0], [0.1, 0], [0.28, -22, 'quadIn'], [0.48, 0], [2.5, 0]) },
      head: {
        dz: keys('sineInOut', [0, 0], [0.5, 0], [0.9, 22, 'backOut'], [2.0, 20], [2.4, 0]),
        y: keys('sineInOut', [0, 0], [0.5, 0], [0.9, 8], [2.0, 8], [2.4, 0]),
        rot: keys('sineInOut', [0, 0], [0.9, 0], [1.25, 8], [1.65, -7], [2.05, 5], [2.5, 0]),
      },
    },
    events: [
      { t: 0.26, effect: 'hearts', at: 'head', params: { count: 3, size: 1.1 } },
      { t: 1.0, effect: 'hearts', at: 'head', params: { count: 2 } },
      { t: 1.6, effect: 'hearts', at: 'head', params: { count: 3, size: 0.85 } },
    ],
  },

  /* ------------------------------------------------------------------ */
  'emote-unimpressed': {
    description: 'Unimpressed: folds its wings, half-lidded stare, slow side-eye and a deflating sigh.',
    category: 'emotion',
    duration: 2.4,
    fadeIn: 0.2,
    suppress: { look: true },
    expression: [[0, 'unimpressed']],
    slots: foldWings(0.12, 2.1),
    params: {
      flap: keys('sineInOut', [0, 0], [0.12, -0.6, 'quadOut'], [0.35, 0], [2.0, 0], [2.1, -0.5, 'backOut'], [2.4, 0]),
      squash: keys('sineInOut', [0, 0], [0.9, 0], [1.2, -0.12], [1.6, 0.16], [2.1, 0.1], [2.4, 0]),
      lookX: keys('cubicInOut', [0, 0], [0.5, 0], [0.75, 0.55], [1.25, 0.55], [1.5, 0], [2.4, 0]),
    },
    bones: {
      head: {
        rot: keys('sineInOut', [0, 0], [0.45, -5], [1.3, -4], [1.7, -7], [2.4, 0]),
        y: keys('sineInOut', [0, 0], [1.2, -2], [1.6, 3], [2.1, 2], [2.4, 0]),
      },
      'ear-l': { rot: keys('sineInOut', [0, 0], [1.2, 0], [1.65, -10], [2.1, -8], [2.4, 0]) },
      'ear-r': { rot: keys('sineInOut', [0, 0], [1.2, 0], [1.65, 10], [2.1, 8], [2.4, 0]) },
    },
  },

  /* ------------------------------------------------------------------ */
  'emote-playful': {
    description: 'Playful: hops into a tilted 3/4 hover with a cheeky wink and tongue out, wiggles, sweat drops fly.',
    category: 'emotion',
    duration: 2.1,
    fadeIn: 0.12,
    suppress: { look: true },
    expression: [[0.1, 'playful'], [1.9, 'happy']],
    params: {
      squash: keys('sineInOut', [0, 0], [0.12, 0.35], [0.28, -0.3], [0.5, 0], [1.55, 0], [1.72, 0.3, 'quadOut'], [1.88, -0.08], [2.1, 0]),
      flap: [
        ...keys('sineInOut', [0, 0], [0.12, -0.4], [0.28, 0.9]),
        ...wave(1.2, 0.35, { cycles: 5, offset: 0.35 }).map(([t, v]) => [0.36 + t, v, 'sineInOut'] as Keyframe),
        [1.7, -0.2, 'sineInOut'],
        [2.1, 0],
      ],
    },
    bones: {
      root: {
        y: keys('quadOut', [0, 0], [0.12, 0], [0.4, -34, 'sineInOut'], [0.9, -26], [1.3, -34], [1.55, -28, 'quadIn'], [1.72, 0], [2.1, 0]),
        rot: keys('backOut', [0, 0], [0.12, 0], [0.42, 15, 'sineInOut'], [0.9, 10], [1.3, 16], [1.6, 0, 'backOut'], [2.1, 0]),
        yaw: keys('backOut', [0, 0], [0.12, 0], [0.42, 24, 'sineInOut'], [1.5, 22], [1.75, 0], [2.1, 0]),
      },
      head: { rot: keys('sineInOut', [0, 0], [0.42, -6], [0.7, 4], [0.95, -6], [1.2, 4], [1.5, -2], [2.1, 0]) },
      'wing-l': { rot: keys('sineInOut', [0, 0], [0.42, 16], [1.5, 16], [1.75, 0]) },
      'wing-r': { rot: keys('sineInOut', [0, 0], [0.42, 24], [1.5, 24], [1.75, 0]) },
      'foot-l': { rot: keys('sineInOut', [0, 0], [0.42, 25], [1.5, 25], [1.7, 0]) },
      'foot-r': { rot: keys('sineInOut', [0, 0], [0.42, 18], [1.5, 18], [1.7, 0]) },
    },
    events: [{ t: 0.55, effect: 'sweat', at: 'head', params: { side: 1 } }],
  },

  /* ------------------------------------------------------------------ */
  'emote-sing': {
    description: 'Singing: sways head in 3/4 turns to the beat with an "o" mouth, wings swinging, music notes rising.',
    category: 'emotion',
    duration: 2.4,
    fadeIn: 0.15,
    suppress: { look: true },
    expression: [[0, 'singing']],
    params: {
      lookX: keys('sineInOut', [0, 0], [0.4, 0.45], [1.0, -0.45], [1.6, 0.45], [2.1, 0], [2.4, 0]),
      lookY: keys('sineInOut', [0, 0], [0.4, -0.25], [2.1, -0.2], [2.4, 0]),
      squash: keys('sineInOut', [0, 0], [0.15, 0.2], [0.3, -0.15], [0.45, 0.15], [0.6, -0.1], [0.75, 0.15], [0.9, -0.1], [1.05, 0.15], [1.2, -0.1], [1.35, 0.15], [1.5, -0.1], [1.65, 0.15], [1.8, -0.1], [2.1, 0]),
      flap: keys('sineInOut', [0, 0], [0.4, 0.6], [1.0, 0.25], [1.6, 0.6], [2.4, 0]),
      lean: keys('sineInOut', [0, 0], [0.4, -0.2], [1.0, 0.2], [1.6, -0.2], [2.1, 0]),
    },
    bones: {
      root: { y: keys('sineInOut', [0, 0], [0.3, -8], [0.45, 0], [0.6, -6], [0.75, 0], [0.9, -8], [1.05, 0], [1.2, -6], [1.35, 0], [1.5, -8], [1.65, 0], [2.4, 0]) },
      head: { rot: keys('sineInOut', [0, 0], [0.45, 10], [1.05, -10], [1.65, 10], [2.15, 0], [2.4, 0]) },
      'wing-l': { rot: keys('sineInOut', [0, 0], [0.4, -10], [1.0, 12], [1.6, -10], [2.2, 0]) },
      'wing-r': { rot: keys('sineInOut', [0, 0], [0.4, -12], [1.0, 10], [1.6, -12], [2.2, 0]) },
    },
    events: [
      { t: 0.25, effect: 'notes', at: 'head', params: { side: 1, count: 2 } },
      { t: 0.95, effect: 'notes', at: 'head', params: { side: -1, count: 2 } },
      { t: 1.55, effect: 'notes', at: 'head', params: { side: 1, count: 2 } },
    ],
  },

  /* ------------------------------------------------------------------ */
  'emote-proud': {
    description: 'Determined → proud: plants its feet, spreads wings low and wide with a fierce look, chest out, sparkles, then a satisfied grin and nod.',
    category: 'emotion',
    duration: 2.2,
    fadeIn: 0.15,
    suppress: { look: true },
    expression: [[0, 'determined'], [1.2, 'proud']],
    params: {
      squash: keys('sineInOut', [0, 0], [0.16, 0.35, 'quadOut'], [0.36, -0.28, 'backOut'], [1.1, -0.22], [1.3, 0.12], [1.5, -0.05], [2.2, 0]),
      flap: keys('sineInOut', [0, 0], [0.16, 0.35], [0.38, -0.45, 'backOut'], [1.1, -0.4], [1.35, 0.25, 'backOut'], [1.8, 0.1], [2.2, 0]),
      lookY: keys('sineInOut', [0, 0], [0.16, 0.25], [0.4, -0.1], [1.15, -0.1], [1.32, 0.35], [1.55, -0.15], [2.2, 0]),
    },
    bones: {
      root: { y: keys('sineInOut', [0, 0], [1.2, 0], [1.32, 3], [1.5, 0]) },
      head: {
        y: keys('sineInOut', [0, 0], [0.16, 5], [0.4, -3], [1.15, -3], [1.35, 3], [1.6, 0]),
        rot: keys('sineInOut', [0, 0], [1.25, 0], [1.6, -5], [2.2, 0]),
      },
      'foot-l': { x: keys('backOut', [0, 0], [0.16, 0], [0.36, -7], [1.8, -7], [2.2, 0]) },
      'foot-r': { x: keys('backOut', [0, 0], [0.16, 0], [0.36, 7], [1.8, 7], [2.2, 0]) },
    },
    events: [
      { t: 0.42, effect: 'sparkles', at: 'head', params: { count: 3 } },
      { t: 1.35, effect: 'sparkles', at: 'head', params: { count: 4 } },
    ],
  },

  /* ------------------------------------------------------------------ */
  'emote-sad': {
    description: 'Sad: wings fold around it, slumps down with droopy ears, eyes well up and tears roll; a little sniffle.',
    category: 'emotion',
    duration: 2.6,
    fadeIn: 0.25,
    suppress: { look: true },
    expression: [[0, 'sad']],
    slots: foldWings(0.14, 2.3),
    params: {
      flap: keys('sineInOut', [0, 0], [0.14, -0.6, 'quadOut'], [0.4, 0], [2.2, 0], [2.3, -0.5, 'backOut'], [2.6, 0]),
      squash: keys('sineInOut', [0, 0], [0.3, -0.08], [0.8, 0.3], [1.35, 0.26], [1.45, 0.34], [1.55, 0.26], [2.2, 0.28], [2.6, 0]),
      lookY: keys('sineInOut', [0, 0], [0.8, 0.35], [2.1, 0.3], [2.6, 0]),
    },
    bones: {
      head: {
        y: keys('sineInOut', [0, 0], [0.8, 6], [1.35, 6], [1.45, 3], [1.55, 6], [2.2, 6], [2.6, 0]),
        rot: keys('sineInOut', [0, 0], [0.8, -4], [2.0, 3], [2.6, 0]),
      },
      'ear-l': { rot: keys('sineInOut', [0, 0], [0.2, 0], [0.9, -38], [2.2, -34], [2.6, 0]) },
      'ear-r': { rot: keys('sineInOut', [0, 0], [0.2, 0], [0.9, 38], [2.2, 34], [2.6, 0]) },
      tuft: { rot: keys('sineInOut', [0, 0], [0.9, -14], [2.2, -12], [2.6, 0]) },
    },
    events: [{ t: 0.7, effect: 'tears', at: 'head' }],
  },

  /* ------------------------------------------------------------------ */
  'emote-surprised': {
    description: 'Surprised: startled jolt straight up, wings flare, ears stiff, "!" pops, then a wary settle.',
    category: 'emotion',
    duration: 1.5,
    fadeIn: 0.06,
    suppress: { look: true },
    expression: [[0, 'surprised']],
    params: {
      squash: keys('quadOut', [0, 0], [0.06, 0.25], [0.16, -0.6], [0.4, -0.3, 'sineInOut'], [0.56, 0.3, 'quadOut'], [0.72, -0.1, 'sineInOut'], [0.95, 0]),
      flap: keys('quadOut', [0, 0], [0.06, -0.2], [0.18, 1.35], [0.5, 1.0, 'sineInOut'], [0.62, -0.2, 'sineInOut'], [0.9, 0.15], [1.5, 0]),
      lookY: keys('quadOut', [0, 0], [0.18, -0.35], [0.6, -0.2, 'sineInOut'], [1.5, 0]),
    },
    bones: {
      root: { y: keys('quadOut', [0, 0], [0.06, 0], [0.24, -30, 'sineInOut'], [0.4, -28, 'quadIn'], [0.56, 0], [1.5, 0]) },
      head: {
        y: keys('quadOut', [0, 0], [0.18, -6], [0.6, 2, 'sineInOut'], [0.85, 0]),
        sx: keys('quadOut', [0, 1], [0.18, 1.05], [0.5, 1.02, 'sineInOut'], [0.8, 1]),
        sy: keys('quadOut', [0, 1], [0.18, 1.05], [0.5, 1.02, 'sineInOut'], [0.8, 1]),
      },
      'ear-l': { rot: keys('quadOut', [0, 0], [0.16, 10], [0.6, 6, 'sineInOut'], [1.0, 0]) },
      'ear-r': { rot: keys('quadOut', [0, 0], [0.16, -10], [0.6, -6, 'sineInOut'], [1.0, 0]) },
    },
    events: [{ t: 0.14, effect: 'exclaim', at: 'head', params: { side: 1 } }],
  },

  /* ------------------------------------------------------------------ */
  'emote-dizzy': {
    description: 'Dizzy: swirly eyes, head and body wobble in loose circles under orbiting stars, then shakes it off.',
    category: 'emotion',
    duration: 2.6,
    fadeIn: 0.15,
    suppress: { look: true },
    expression: [[0, 'dizzy'], [2.1, 'neutral']],
    params: {
      lean: [...wave(1.9, 0.35, { cycles: 2, phase: 0.25 }).map(([t, v]) => [t, t < 0.2 ? v * (t / 0.2) : v, 'linear'] as Keyframe), [2.6, 0, 'sineInOut']],
      flap: keys('sineInOut', [0, 0], [0.3, -0.4], [0.8, -0.1], [1.3, -0.45], [1.8, -0.15], [2.3, 0.2], [2.6, 0]),
      squash: keys('sineInOut', [0, 0], [0.4, 0.15], [0.9, -0.05], [1.4, 0.18], [1.9, 0], [2.6, 0]),
    },
    bones: {
      root: { x: [...wave(1.9, 7, { cycles: 2 }), [2.6, 0, 'sineInOut']] },
      head: {
        x: [...wave(1.9, 8, { cycles: 3 }), [2.6, 0, 'sineInOut']],
        y: [...wave(1.9, 5, { cycles: 3, phase: 0.25 }).map(([t, v]) => [t, v - 5 * Math.min(1, t / 0.2), 'linear'] as Keyframe), [2.6, 0, 'sineInOut']],
        rot: [...wave(1.9, 9, { cycles: 3, phase: 0.1 }), [2.6, 0, 'sineInOut']],
        yaw: keys('sineInOut', [0, 0], [1.95, 0], [2.08, 18], [2.2, -18], [2.32, 10], [2.45, 0]),
      },
    },
    events: [{ t: 0.15, effect: 'dizzy', at: 'head', params: { duration: 1.9 } }],
  },

  /* ------------------------------------------------------------------ */
  'emote-laugh': {
    description: 'Laughing: throws its head back and bounces with rapid chuckles, wings clapping, then a happy sigh.',
    category: 'emotion',
    duration: 1.9,
    fadeIn: 0.12,
    suppress: { look: true },
    expression: [[0, 'joyful'], [1.5, 'happy']],
    params: {
      squash: [[0, 0, 'sineInOut'], ...shake(0.15, 1.35, 0.36, 6, 0.05), [1.6, -0.08, 'sineInOut'], [1.9, 0]],
      flap: [[0, 0, 'sineInOut'], ...shake(0.2, 1.35, 0.45, 6, 0.2), [1.9, 0]],
      lookY: keys('sineInOut', [0, 0], [0.22, -0.7], [1.2, -0.55], [1.6, 0.1], [1.9, 0]),
      lean: keys('sineInOut', [0, 0], [0.3, -0.2], [0.8, 0.15], [1.3, -0.12], [1.9, 0]),
    },
    bones: {
      root: { y: [[0, 0, 'sineInOut'], ...shake(0.15, 1.35, 5, 6).map(([t, v]) => [t, -Math.abs(v), 'sineInOut'] as Keyframe), [1.9, 0]] },
      head: {
        y: keys('sineInOut', [0, 0], [0.22, -7], [1.2, -5], [1.6, 2], [1.9, 0]),
        rot: [[0, 0, 'sineInOut'], ...shake(0.25, 1.4, 9, 3), [1.9, 0]],
      },
    },
    events: [{ t: 0.22, effect: 'burst', at: 'head', params: { size: 0.8 } }],
  },

  /* ------------------------------------------------------------------ */
  'emote-sleepy': {
    description: 'Sleepy (loops): wrapped in wings, eyes shut, head slowly droops then startles back up; Zzz drift away.',
    category: 'emotion',
    duration: 4,
    loop: true,
    fadeIn: 0.4,
    suppress: { look: true, blink: true },
    expression: [[0, 'sleepy']],
    slots: { 'wing-l': [[0, 'folded']], 'wing-r': [[0, 'folded']] },
    params: {
      squash: keys('sineInOut', [0, 0.12], [1.4, 0.24], [2.8, 0.14], [3.3, 0.26], [3.5, 0.06, 'backOut'], [4, 0.12]),
      lookY: keys('sineInOut', [0, 0.1], [3.2, 0.55, 'quadIn'], [3.38, -0.05, 'backOut'], [4, 0.1]),
    },
    bones: {
      head: {
        rot: keys('sineInOut', [0, 0], [3.2, 9, 'quadIn'], [3.38, -2, 'backOut'], [4, 0]),
        y: keys('sineInOut', [0, 2], [3.2, 8, 'quadIn'], [3.38, -1, 'backOut'], [4, 2]),
      },
      'ear-l': { rot: keys('sineInOut', [0, -14], [3.2, -24], [3.38, -4], [4, -14]) },
      'ear-r': { rot: keys('sineInOut', [0, 14], [3.2, 24], [3.38, 4], [4, 14]) },
    },
    events: [{ t: 0.4, effect: 'zzz', at: 'head', params: { side: 1 } }],
  },

  /* ------------------------------------------------------------------ */
  'emote-shy': {
    description: 'Shy: blushes, folds its wings in, looks away and down with a bashful twist and toe-scuff, peeks back once.',
    category: 'emotion',
    duration: 2.4,
    fadeIn: 0.2,
    suppress: { look: true },
    expression: [[0, 'neutral'], [1.05, 'love'], [1.5, 'neutral']],
    slots: {
      ...foldWings(0.12, 2.1),
      blush: [[0.1, 'on'], [2.2, 'off']],
      mouth: [[0, 'smile']],
    },
    params: {
      flap: keys('sineInOut', [0, 0], [0.12, -0.6, 'quadOut'], [0.35, 0], [2.0, 0], [2.1, -0.5, 'backOut'], [2.4, 0]),
      lookX: keys('cubicInOut', [0, 0], [0.35, -0.65], [0.95, -0.55], [1.15, 0.05], [1.45, 0.05], [1.7, -0.6], [2.1, -0.5], [2.4, 0]),
      lookY: keys('sineInOut', [0, 0], [0.35, 0.4], [0.95, 0.35], [1.15, 0.05], [1.45, 0.05], [1.7, 0.4], [2.4, 0]),
      squash: keys('sineInOut', [0, 0], [0.35, 0.15], [2.1, 0.12], [2.4, 0]),
    },
    bones: {
      root: { yaw: keys('sineInOut', [0, 0], [0.4, -10], [0.8, -4], [1.2, -10], [1.7, -6], [2.1, -10], [2.4, 0]) },
      head: { rot: keys('sineInOut', [0, 0], [0.4, -8], [1.0, -6], [1.2, 3], [1.45, 3], [1.75, -9], [2.4, 0]) },
      'foot-r': {
        rot: keys('sineInOut', [0, 0], [0.5, 0], [0.7, -14], [0.9, 6], [1.1, -10], [1.3, 0]),
        y: keys('sineInOut', [0, 0], [0.5, 0], [0.7, -5], [0.9, -2], [1.1, -4], [1.3, 0]),
      },
      'wing-l': { x: keys('sineInOut', [0, 0], [0.12, 0], [0.4, 8], [2.05, 8], [2.1, 0]) },
      'wing-r': { x: keys('sineInOut', [0, 0], [0.12, 0], [0.4, -8], [2.05, -8], [2.1, 0]) },
    },
    events: [{ t: 1.1, effect: 'hearts', at: 'head', params: { count: 1, size: 0.6 } }],
  },

  /* ------------------------------------------------------------------ */
  'emote-confused': {
    description: 'Confused: tilts its head one way then the other with a squint, scratches its head with a wing; a "?" pops up.',
    category: 'emotion',
    duration: 2.3,
    fadeIn: 0.15,
    suppress: { look: true },
    slots: { 'eye-r': [[0.1, 'half']], mouth: [[0.1, 'frown']] },
    params: {
      lookX: keys('cubicInOut', [0, 0], [0.3, 0.3], [0.9, 0.3], [1.15, -0.3], [1.9, -0.3], [2.3, 0]),
      lookY: keys('sineInOut', [0, 0], [0.3, -0.25], [1.9, -0.2], [2.3, 0]),
      squash: keys('sineInOut', [0, 0], [0.15, 0.12], [0.35, -0.05], [1.1, 0.05], [1.3, -0.04], [2.3, 0]),
    },
    bones: {
      head: {
        rot: keys('backOut', [0, 0], [0.32, 15], [0.92, 13, 'sineInOut'], [1.2, -12, 'backOut'], [1.9, -10, 'sineInOut'], [2.3, 0]),
        x: keys('sineInOut', [0, 0], [0.32, 3], [0.92, 3], [1.2, -3], [1.9, -3], [2.3, 0]),
      },
      // wing-r reaches up to scratch the head
      'wing-r': { rot: keys('sineInOut', [0, 0], [0.9, 0], [1.15, -38], [1.3, -30], [1.42, -40], [1.54, -30], [1.66, -40], [1.78, -32], [2.1, 0]) },
    },
    events: [{ t: 0.3, effect: 'question', at: 'head', params: { side: 1 } }],
  },

  /* ------------------------------------------------------------------ */
  'emote-celebrate': {
    description: 'Celebrate: deep crouch, huge spinning leap with wings up and a confetti burst, landing, then a double wing-pump.',
    category: 'emotion',
    duration: 2.6,
    fadeIn: 0.12,
    suppress: { look: true },
    expression: [[0, 'excited'], [0.3, 'joyful']],
    params: {
      squash: keys('sineInOut', [0, 0], [0.2, 0.6, 'quadOut'], [0.36, -0.55], [0.7, -0.2], [0.9, 0.55, 'quadOut'], [1.05, -0.2], [1.2, 0.05], [1.4, -0.15], [1.6, 0.1], [1.8, -0.12], [2.05, 0.05], [2.4, 0]),
      flap: keys('sineInOut', [0, 0], [0.2, -0.6], [0.38, 1.35, 'backOut'], [0.7, 1.1], [0.88, -0.4], [1.05, 0.3], [1.3, 1.3, 'backOut'], [1.45, 0.4], [1.65, 1.3, 'backOut'], [1.85, 0.4], [2.2, 0.15], [2.6, 0]),
      lookY: keys('sineInOut', [0, 0], [0.2, 0.15], [0.5, -0.3], [0.9, 0.05], [1.3, -0.25], [2.2, 0]),
    },
    bones: {
      root: {
        y: keys('quadOut', [0, 0], [0.22, 0], [0.58, -62, 'quadIn'], [0.9, 0, 'quadOut'], [1.22, 0], [1.38, -14, 'quadIn'], [1.52, 0], [1.58, 0], [1.73, -14, 'quadIn'], [1.88, 0], [2.6, 0]),
        yaw: keys('cubicInOut', [0, 0], [0.26, 0], [0.86, 360, 'step'], [0.87, 0]),
      },
      head: { rot: keys('sineInOut', [0, 0], [1.3, -6], [1.65, 6], [2.0, -3], [2.4, 0]) },
    },
    events: [
      { t: 0.52, effect: 'confetti', at: 'head' },
      { t: 1.4, effect: 'stars', at: 'head', params: { count: 5 } },
    ],
  },
});
