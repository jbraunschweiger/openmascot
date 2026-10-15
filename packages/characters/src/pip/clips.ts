/**
 * Pip-only clips: bird behaviour (hop, peck, chirp, fly, fluff, perch-nap…)
 * plus a few Pip versions of library clips whose wing/eye poses assume Echo's
 * anatomy. Merged over the shared library, so same-named clips win.
 *
 * Pip's wings hang folded at the sides: `wing-l.rot` > 0 / `wing-r.rot` < 0
 * swings them up and out (90° = straight out sideways, ~170° = overhead).
 */
import { cycle, defineClip, defineClips, keys, mirrorClip } from '@openmascot/core';
import type { Clip, Keyframe } from '@openmascot/core';
import { library } from '../library';

/** Fanned flight feathers on both wings from `t`. */
const fan = (t = 0): Record<string, [number, string][]> => ({ 'wing-l': [[t, 'fan']], 'wing-r': [[t, 'fan']] });

/** Repeat a keyframe pattern (times within [0, period)) `n` times from `t0`. */
function rep(t0: number, period: number, n: number, pattern: Keyframe[], end?: Keyframe): Keyframe[] {
  const out: Keyframe[] = [];
  for (let i = 0; i < n; i++) for (const k of pattern) out.push([t0 + i * period + k[0], k[1], ...(k.length > 2 ? [k[2]] : [])] as Keyframe);
  if (end) out.push(end);
  return out;
}

/* ---------------------------------------------------------------- */
/* Pip versions of library clips                                     */
/* ---------------------------------------------------------------- */

const pointRight = defineClip({
  ...library['point-right'],
  description: 'Points to screen-right with the right wing held straight out, leaning and looking that way (draw attention to UI on the right).',
  bones: {
    ...library['point-right'].bones,
    // The library's raiseR (0.55) already lifts Pip's hanging wing level; its
    // wing-r rot (+50, which lowers Echo's raised wing) would undo that, so
    // Pip only adds a little pointing jab.
    'wing-r': {
      rot: keys('sineInOut', [0, 0], [0.32, -6, 'backOut'], [0.62, 0], [0.78, -8], [1.3, -3], [1.7, 0]),
      x: keys('sineInOut', [0, 0], [0.32, 4], [1.3, 4], [1.7, 0]),
    },
    'wing-l': { rot: keys('sineInOut', [0, 0], [0.32, -6], [1.3, -5], [1.7, 0]) },
  },
});

const pipOverrides = {
  'point-right': pointRight,
  'point-left': mirrorClip(pointRight, 'point-left'),

  'emote-confused': defineClip({
    ...library['emote-confused'],
    bones: {
      ...library['emote-confused'].bones,
      // the library's raiseR lifts the wing beside the head; bring it in front
      // of the ball and inward so the tip actually scratches the head
      'wing-r': {
        x: keys('sineInOut', [0, 0], [0.9, 0], [1.15, -16], [1.78, -16], [2.1, 0]),
        dz: keys('sineInOut', [0, 0], [0.95, 0], [1.05, 60], [1.85, 60], [1.95, 0]),
      },
    },
  }),

  think: defineClip({
    ...library.think,
    description: 'Thinking (loops): looks up and aside with a tilted head and pursed beak, right wing tucked under the beak tapping its "chin", foot tapping.',
    bones: {
      ...library.think.bones,
      // Pip's hanging wing swings inward (+rot) across the tummy so its tip rests under the beak
      'wing-r': {
        rot: keys('sineInOut', [0, 80], [0.5, 80], [0.62, 70], [0.74, 80], [0.86, 70], [1.0, 80], [3.2, 80]),
        dz: [[0, 70]],
        x: [[0, -6]],
        y: [[0, -6]],
      },
    },
  }),

  'fidget-ear-twitch': defineClip({
    description: 'No ears on Pip: the crest flicks one way, then the other, with a tiny head bob.',
    category: 'fidget',
    duration: 1.1,
    bones: {
      tuft: { rot: keys('out', [0, 0], [0.08, -16], [0.22, 0], [0.45, 0], [0.53, 14], [0.68, 0]) },
      head: { rot: keys('sineInOut', [0, 0], [0.1, -2], [0.5, 2], [1.1, 0]), y: keys('sineInOut', [0, 0], [0.1, -2], [0.3, 0]) },
    },
  }),
};

/* ---------------------------------------------------------------- */
/* Bird clips                                                         */
/* ---------------------------------------------------------------- */

const HOP = 0.42;

export const pipClips: Record<string, Clip> = defineClips({
  ...pipOverrides,

  hop: {
    description: 'Bird hops: three springy two-footed hops (the last one bigger), wings flicking on take-off, feet tucked in the air, a soft landing squash each time.',
    category: 'locomotion',
    duration: HOP * 3 + 0.3,
    fadeIn: 0.12,
    expression: [[0.05, 'happy'], [HOP * 3, 'neutral']],
    params: {
      squash: rep(0, HOP, 3, [[0, 0], [0.07, 0.42, 'quadOut'], [0.13, -0.32], [0.3, 0.05, 'quadIn'], [0.34, 0.38, 'quadOut']], [HOP * 3 + 0.3, 0]),
      flap: rep(0, HOP, 3, [[0, 0], [0.08, -0.3], [0.15, 0.85, 'backOut'], [0.3, 0.2]], [HOP * 3 + 0.3, 0]),
      lean: keys('sineInOut', [0, 0], [HOP, 0.12], [HOP * 2, -0.12], [HOP * 3, 0.06], [HOP * 3 + 0.3, 0]),
    },
    bones: {
      root: {
        y: [
          ...rep(0, HOP, 2, [[0, 0, 'linear'], [0.11, 0, 'quadOut'], [0.22, -26, 'quadIn'], [0.33, 0, 'linear']]),
          [HOP * 2, 0, 'linear'], [HOP * 2 + 0.11, 0, 'quadOut'], [HOP * 2 + 0.24, -44, 'quadIn'], [HOP * 2 + 0.37, 0], [HOP * 3 + 0.3, 0],
        ],
        x: keys('sineInOut', [0, 0], [HOP * 0.8, 10], [HOP * 1.8, -8], [HOP * 2.8, 0], [HOP * 3 + 0.3, 0]),
      },
      'foot-l': { y: rep(0, HOP, 3, [[0, 0], [0.12, 0], [0.2, -7], [0.33, 0]]), rot: rep(0, HOP, 3, [[0, 0], [0.12, 0], [0.2, 14], [0.33, 0]]) },
      'foot-r': { y: rep(0, HOP, 3, [[0, 0], [0.12, 0], [0.2, -7], [0.33, 0]]), rot: rep(0, HOP, 3, [[0, 0], [0.12, 0], [0.2, -14], [0.33, 0]]) },
      head: { y: rep(0, HOP, 3, [[0, 0], [0.08, 4], [0.16, -4], [0.34, 5], [0.4, 0]]) },
    },
    events: [{ t: HOP * 2 + 0.37, effect: 'puff', at: [0, 0], params: { count: 4, size: 0.7 } }],
  },

  peck: {
    description: 'Pecks at the ground three times — tips forward, beak snaps down — then pops back up and looks around, pleased.',
    category: 'gesture',
    duration: 2.2,
    fadeIn: 0.15,
    suppress: { look: true },
    expression: [[0, 'neutral'], [1.55, 'happy'], [2.05, 'neutral']],
    slots: { mouth: [[0, 'default'], [0.3, 'o'], [0.36, 'default'], [0.62, 'o'], [0.68, 'default'], [0.94, 'o'], [1.0, 'default']] },
    params: {
      squash: keys('sineInOut', [0, 0], [0.18, 0.18], [1.15, 0.18], [1.35, -0.12], [1.6, 0.05], [2.2, 0]),
      lookY: keys('sineInOut', [0, 0], [0.2, 0.4], [1.15, 0.4], [1.4, -0.2], [2.2, 0]),
      lookX: keys('sineInOut', [0, 0], [1.3, 0], [1.55, 0.35], [1.85, -0.25], [2.2, 0]),
      flap: keys('sineInOut', [0, 0], [0.2, 0.15], [1.15, 0.15], [1.3, 0.45], [1.55, 0], [2.2, 0]),
    },
    bones: {
      // the whole ball tips toward the ground, then the face dives on each peck
      body: { pitch: keys('sineInOut', [0, 0], [0.2, 8], [1.15, 8], [1.35, -3], [1.6, 0], [2.2, 0]) },
      root: { y: rep(0.12, 0.32, 3, [[0, 0, 'quadIn'], [0.18, 3, 'quadOut'], [0.24, 2]], [1.15, 0]).concat([[2.2, 0]] as Keyframe[]) },
      head: {
        pitch: rep(0.12, 0.32, 3, [[0, 4, 'quadIn'], [0.18, 20, 'quadOut'], [0.24, 15]], [1.15, 4]).concat([[1.35, -6], [1.6, 0], [2.2, 0]] as Keyframe[]),
        y: rep(0.12, 0.32, 3, [[0, 2, 'quadIn'], [0.18, 10, 'quadOut'], [0.24, 7]], [1.15, 0]).concat([[2.2, 0]] as Keyframe[]),
        dz: rep(0.12, 0.32, 3, [[0, 0, 'quadIn'], [0.18, 12, 'quadOut'], [0.24, 8]], [1.15, 0]).concat([[2.2, 0]] as Keyframe[]),
      },
      tuft: { rot: keys('sineInOut', [0, 0], [1.3, 0], [1.4, -12], [1.6, 6], [1.8, 0]) },
    },
    events: [
      { t: 0.3, effect: 'puff', at: [16, -2], params: { count: 2, size: 0.45, side: 1 } },
      { t: 0.94, effect: 'puff', at: [16, -2], params: { count: 2, size: 0.45, side: 1 } },
    ],
  },

  chirp: {
    description: 'Chirps a little tune: tips the head back, beak pops open on each note, crest bounces, music notes float up.',
    category: 'emotion',
    duration: 1.8,
    fadeIn: 0.15,
    suppress: { look: true },
    expression: [[0, 'singing'], [1.6, 'happy']],
    slots: { mouth: [[0, 'default'], [0.22, 'open'], [0.36, 'o'], [0.5, 'open'], [0.62, 'default'], [0.82, 'open'], [1.1, 'smile']] },
    params: {
      lookY: keys('sineInOut', [0, 0], [0.2, -0.5], [1.2, -0.45], [1.6, 0]),
      squash: rep(0.2, 0.3, 3, [[0, 0.1], [0.08, -0.12], [0.22, 0.06]], [1.8, 0]),
      flap: keys('sineInOut', [0, 0], [0.22, 0.25], [0.5, 0.1], [0.82, 0.4], [1.2, 0.1], [1.8, 0]),
    },
    bones: {
      head: {
        rot: keys('sineInOut', [0, 0], [0.22, -7], [0.5, 6], [0.82, -8], [1.2, 4], [1.8, 0]),
        y: rep(0.2, 0.3, 3, [[0, 0], [0.08, -5], [0.2, 0]], [1.8, 0]),
      },
      tuft: { rot: rep(0.2, 0.3, 3, [[0, 0], [0.08, -10], [0.18, 6]], [1.8, 0]) },
    },
    events: [
      { t: 0.24, effect: 'notes', at: 'head', params: { count: 1, side: 1 } },
      { t: 0.84, effect: 'notes', at: 'head', params: { count: 2, side: -1 } },
    ],
  },

  fly: {
    description: 'Hovering flight loop: fast fanned wing beats, the round body bobs on each down-stroke, feet dangle.',
    category: 'locomotion',
    duration: 0.4,
    loop: true,
    fadeIn: 0.25,
    slots: fan(),
    params: {
      flap: keys('sineInOut', [0, 1.25], [0.17, -0.38, 'sineInOut'], [0.4, 1.25]),
      squash: keys('sineInOut', [0, -0.06], [0.15, 0.1], [0.3, -0.12], [0.4, -0.06]),
    },
    bones: {
      root: { y: keys('sineInOut', [0, -52], [0.05, -50], [0.22, -60], [0.4, -52]) },
      head: { y: keys('sineInOut', [0, -1], [0.1, 1.5], [0.3, -2], [0.4, -1]) },
      'foot-l': { rot: keys('sineInOut', [0, 10], [0.2, 2], [0.4, 10]), y: [[0, -3]] },
      'foot-r': { rot: keys('sineInOut', [0, -2], [0.2, -10], [0.4, -2]), y: [[0, -3]] },
      tuft: { rot: keys('sineInOut', [0, -4], [0.2, 4], [0.4, -4]) },
    },
  },

  takeoff: {
    description: 'Crouches, springs up with a puff and a flurry of fanned wing beats, ending in a hover (chains into "fly").',
    category: 'locomotion',
    duration: 0.9,
    fadeIn: 0.12,
    then: 'fly',
    expression: [[0.05, 'excited']],
    slots: fan(0.18),
    params: {
      squash: keys('sineInOut', [0, 0], [0.18, 0.5, 'quadOut'], [0.3, -0.4], [0.55, -0.1], [0.9, -0.06]),
      flap: keys('sineInOut', [0, 0], [0.18, -0.35], [0.26, 1.35], [0.37, -0.38], [0.48, 1.25], [0.6, -0.38], [0.72, 1.25], [0.82, -0.2], [0.9, 1.25]),
    },
    bones: {
      root: { y: keys('quadOut', [0, 0], [0.2, 0], [0.42, -66], [0.6, -50], [0.75, -58], [0.9, -52]) },
      head: { y: keys('sineInOut', [0, 0], [0.2, 5], [0.36, -4], [0.55, 0]) },
      'foot-l': { y: keys('sineInOut', [0, 0], [0.35, -3]), rot: keys('sineInOut', [0, 0], [0.4, 10]) },
      'foot-r': { y: keys('sineInOut', [0, 0], [0.35, -3]), rot: keys('sineInOut', [0, 0], [0.4, -2]) },
    },
    events: [{ t: 0.24, effect: 'puff', at: [0, 0], params: { count: 5 } }, { t: 0.3, effect: 'wind', at: 'body', params: { count: 2 } }],
  },

  land: {
    description: 'Flutters down from above the frame on fanned wings, brakes, lands with a squash and a dust puff, tucks the wings and settles.',
    category: 'locomotion',
    duration: 1.3,
    fadeIn: 0.05,
    expression: [[0, 'excited'], [0.7, 'happy'], [1.2, 'neutral']],
    slots: { 'wing-l': [[0, 'fan'], [0.75, 'spread']], 'wing-r': [[0, 'fan'], [0.75, 'spread']] },
    params: {
      flap: keys('sineInOut', [0, 1.2], [0.09, -0.35], [0.18, 1.25], [0.27, -0.35], [0.36, 1.25], [0.46, -0.3], [0.56, 1.1, 'backOut'], [0.74, 0.5], [0.95, -0.1], [1.15, 0]),
      squash: keys('sineInOut', [0, -0.3], [0.5, -0.25], [0.58, -0.4, 'quadOut'], [0.64, 0.6, 'quadOut'], [0.8, -0.18], [0.96, 0.1], [1.15, 0]),
    },
    bones: {
      root: { y: keys('quadOut', [0, -330], [0.48, -56, 'quadIn'], [0.6, 0, 'linear'], [1.3, 0]) },
      head: { y: keys('sineInOut', [0, -3], [0.6, -3], [0.7, 6, 'quadOut'], [0.85, -2], [1.05, 0]) },
      'foot-l': { y: keys('sineInOut', [0, -4], [0.55, -1], [0.6, 0]) },
      'foot-r': { y: keys('sineInOut', [0, -4], [0.55, -1], [0.6, 0]) },
    },
    events: [{ t: 0.61, effect: 'puff', at: [0, 0], params: { count: 6 } }],
  },

  fluff: {
    description: 'Fluffs up: feathers puff out into a round pompom, a quick full-body ruffle shake, crest springing, then smooths back down with a contented blink.',
    category: 'emotion',
    duration: 1.8,
    fadeIn: 0.15,
    suppress: { look: true },
    expression: [[0, 'neutral'], [0.15, 'happy'], [1.2, 'joyful'], [1.6, 'neutral']],
    params: {
      wingFold: keys('sineInOut', [0, 0.5], [0.25, 1], [1.05, 1], [1.3, 0.5]),
      flap: keys('sineInOut', [0, 0], [1.05, 0], [1.2, 0.5], [1.4, 0], [1.8, 0]),
      squash: keys('sineInOut', [0, 0], [0.12, 0.25], [0.3, -0.05], [1.05, 0], [1.25, 0.15], [1.5, 0]),
    },
    bones: {
      body: {
        sx: keys('backOut', [0, 1], [0.3, 1.13], [1.05, 1.12, 'sineInOut'], [1.35, 0.98], [1.6, 1]),
        sy: keys('backOut', [0, 1], [0.3, 1.1], [1.05, 1.09, 'sineInOut'], [1.35, 0.99], [1.6, 1]),
        rot: [[0, 0], [0.42, 0], ...rep(0.42, 0.1, 6, [[0, 0], [0.025, 6], [0.075, -6]]), [1.05, 0]],
      },
      head: { rot: [[0, 0], [0.45, 0], ...rep(0.45, 0.1, 6, [[0, 0], [0.025, -5], [0.075, 5]]), [1.08, 0], [1.8, 0]] },
      tuft: { rot: keys('sineInOut', [0, 0], [0.3, -14], [1.05, -10], [1.3, 8], [1.6, 0]) },
      root: { y: keys('sineInOut', [0, 0], [0.42, 0], [0.5, -6], [1.05, -2], [1.2, 0]) },
    },
    events: [{ t: 0.45, effect: 'sparkles', at: 'head', params: { count: 3, spread: 90, size: 0.7 } }],
  },

  nap: {
    description: 'Perched nap (loops): fluffed up with wings tucked, eyes shut, head slowly nodding off and catching itself; Zzz drift away.',
    category: 'pose',
    duration: 4,
    loop: true,
    fadeIn: 0.45,
    expression: [[0, 'sleepy']],
    slots: { 'wing-l': [[0, 'folded']], 'wing-r': [[0, 'folded']] },
    suppress: { look: true, blink: true },
    params: {
      wingFold: [[0, 1]],
      squash: cycle(4, [0.22, 0.28]),
      lookY: keys('sineInOut', [0, 0.25], [3.1, 0.55, 'quadIn'], [3.3, 0.1, 'backOut'], [4, 0.25]),
    },
    bones: {
      head: { rot: keys('sineInOut', [0, 5], [3.1, 10, 'quadIn'], [3.3, 2, 'backOut'], [4, 5]), y: keys('sineInOut', [0, 3], [3.1, 6], [3.3, 1], [4, 3]) },
      body: { sx: cycle(4, [1.06, 1.08]), sy: cycle(4, [1.04, 1.06]) },
      tuft: { rot: keys('sineInOut', [0, 8], [3.1, 14], [3.3, -4], [3.6, 8], [4, 8]) },
    },
    events: [{ t: 0.4, effect: 'zzz', at: 'head', params: { count: 2 } }, { t: 2.2, effect: 'zzz', at: 'head', params: { count: 1 } }],
  },

  'head-tilt': {
    description: 'Curious bird head tilt: cocks the head sharply one way, then the other, blinking, as if listening to something.',
    category: 'gesture',
    duration: 1.9,
    fadeIn: 0.12,
    suppress: { look: true },
    params: {
      lookX: keys('cubicInOut', [0, 0], [0.12, 0.3], [0.7, 0.3], [0.82, -0.3], [1.5, -0.3], [1.9, 0]),
      lookY: keys('sineInOut', [0, 0], [0.12, -0.15], [1.5, -0.1], [1.9, 0]),
    },
    bones: {
      // birds snap between poses, then hold
      head: { rot: keys('backOut', [0, 0], [0.12, 22], [0.7, 20, 'quadInOut'], [0.84, -24, 'backOut'], [1.5, -22, 'sineInOut'], [1.9, 0]) },
      tuft: { rot: keys('sineInOut', [0, 0], [0.16, 8], [0.88, -8], [1.9, 0]) },
    },
    events: [{ t: 0.3, effect: 'question', at: 'head', params: { side: 1, size: 0.8 } }],
  },
});
