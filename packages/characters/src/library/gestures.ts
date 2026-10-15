/**
 * Gestures — short communicative moves (wave, nod, point…) used by apps to
 * react to the user. One-shots return to idle; `listen` and `think` loop
 * while the app waits. See docs/animation.md.
 *
 * Wing conventions (Echo-style rigs): `wing-r` is the screen-right wing;
 * its `rot` goes negative to raise it. `wing-l` mirrors that (positive = up).
 */
import { defineClip, defineClips, keys, mirrorClip } from '@openmascot/core';
import type { Keyframe } from '@openmascot/core';

/** Waving keys for a raised wing: `n` swings between `lo` and `hi` starting at `t0`. */
function waveKeys(t0: number, n: number, period: number, lo: number, hi: number): Keyframe[] {
  const out: Keyframe[] = [];
  for (let i = 0; i < n; i++) {
    out.push([t0 + i * period, hi, 'sineInOut'], [t0 + i * period + period / 2, lo, 'sineInOut']);
  }
  return out;
}

const pointRight = defineClip({
  description: 'Points to screen-right with the right wing, leaning and looking that way (draw attention to UI on the right).',
  category: 'gesture',
  duration: 1.7,
  fadeIn: 0.12,
  suppress: { look: true },
  expression: [[0.1, 'excited'], [1.45, 'neutral']],
  params: {
    lean: keys('sineInOut', [0, 0], [0.14, -0.12], [0.34, 0.3, 'backOut'], [1.3, 0.24], [1.7, 0]),
    lookX: keys('sineInOut', [0, 0], [0.12, -0.1], [0.32, 0.85, 'backOut'], [1.3, 0.8], [1.7, 0]),
    lookY: keys('sineInOut', [0, 0], [0.32, 0.05], [1.7, 0]),
    squash: keys('sineInOut', [0, 0], [0.14, 0.18], [0.32, -0.1], [0.5, 0], [1.7, 0]),
  },
  bones: {
    'wing-r': {
      rot: keys('sineInOut', [0, 0], [0.14, -12], [0.32, 26, 'backOut'], [0.62, 22], [0.78, 28], [1.3, 24], [1.7, 0]),
      x: keys('sineInOut', [0, 0], [0.14, -4], [0.32, 12, 'backOut'], [0.62, 9], [0.78, 13], [1.3, 12], [1.7, 0]),
      sx: keys('sineInOut', [0, 1], [0.32, 1.1, 'backOut'], [1.3, 1.08], [1.7, 1]),
    },
    'wing-l': { rot: keys('sineInOut', [0, 0], [0.32, -16], [1.3, -14], [1.7, 0]) },
    root: { yaw: keys('sineInOut', [0, 0], [0.32, 8], [1.3, 8], [1.7, 0]) },
  },
});

const lookRight = defineClip({
  description: 'Turns to look toward screen-right, holds with a curious tilt, then back.',
  category: 'gesture',
  duration: 1.8,
  fadeIn: 0.15,
  suppress: { look: true },
  params: {
    lookX: keys('cubicInOut', [0, 0], [0.35, 1.05], [1.35, 1.0], [1.75, 0]),
    lookY: keys('sineInOut', [0, 0], [0.35, -0.1], [1.35, -0.05], [1.75, 0]),
    lean: keys('sineInOut', [0, 0], [0.4, 0.1], [1.35, 0.1], [1.8, 0]),
  },
  bones: {
    root: { yaw: keys('cubicInOut', [0, 0], [0.4, 12], [1.35, 12], [1.8, 0]) },
    head: { rot: keys('sineInOut', [0, 0], [0.5, 6], [1.3, 4], [1.75, 0]) },
  },
});

export const gesturesClips = defineClips({
  /* ------------------------------------------------------------------ */
  wave: {
    description: 'Friendly wave: raises the right wing and waves it (with a 3D wrist turn), head tilted, happy face.',
    category: 'gesture',
    duration: 1.9,
    fadeIn: 0.12,
    expression: [[0, 'happy']],
    params: {
      lean: keys('sineInOut', [0, 0], [0.25, -0.15], [1.5, -0.12], [1.9, 0]),
      squash: keys('sineInOut', [0, 0], [0.1, 0.15], [0.28, -0.1], [0.5, 0], [1.9, 0]),
    },
    bones: {
      'wing-r': {
        rot: [[0, 0, 'backOut'], [0.28, -50, 'sineInOut'], ...waveKeys(0.36, 4, 0.28, -24, -58), [1.5, -46, 'sineInOut'], [1.9, 0]],
        yaw: [[0, 0, 'sineInOut'], [0.28, 0, 'sineInOut'], ...waveKeys(0.36, 4, 0.28, -25, 10), [1.5, 0, 'sineInOut']],
        x: keys('sineInOut', [0, 0], [0.28, 10], [1.5, 10], [1.9, 0]),
      },
      'wing-l': { rot: keys('sineInOut', [0, 0], [0.3, -8], [1.5, -8], [1.9, 0]) },
      head: { rot: keys('sineInOut', [0, 0], [0.3, 8], [0.8, 5], [1.2, 9], [1.9, 0]) },
    },
  },

  /* ------------------------------------------------------------------ */
  'nod-yes': {
    description: 'Two clear nods "yes", smiling.',
    category: 'gesture',
    duration: 1.1,
    fadeIn: 0.1,
    suppress: { look: true },
    expression: [[0, 'happy']],
    params: {
      squash: keys('sineInOut', [0, 0], [0.3, 0.1], [0.48, 0], [0.64, 0.08], [0.85, 0]),
    },
    bones: {
      head: {
        pitch: keys('sineInOut', [0, 0], [0.14, -8], [0.3, 24], [0.47, -5], [0.64, 19], [0.85, -2], [1.05, 0]),
        y: keys('sineInOut', [0, 0], [0.14, -2], [0.3, 5], [0.47, -1], [0.64, 4], [0.85, 0]),
      },
    },
  },

  /* ------------------------------------------------------------------ */
  'shake-no': {
    description: 'Shakes its head "no" with decaying swings; the body counter-turns slightly.',
    category: 'gesture',
    duration: 1.2,
    fadeIn: 0.1,
    suppress: { look: true },
    params: { squash: keys('sineInOut', [0, 0], [0.12, 0.08], [0.9, 0.04], [1.2, 0]) },
    bones: {
      head: {
        yaw: keys('sineInOut', [0, 0], [0.14, -26], [0.34, 24], [0.54, -18], [0.72, 11], [0.9, -3], [1.05, 0]),
        rot: keys('sineInOut', [0, 0], [0.14, -3], [0.34, 3], [0.54, -2], [0.72, 1], [1.0, 0]),
      },
      body: { yaw: keys('sineInOut', [0, 0], [0.16, 5], [0.36, -5], [0.56, 3], [0.74, -2], [1.0, 0]) },
    },
  },

  /* ------------------------------------------------------------------ */
  'point-right': pointRight,
  'point-left': mirrorClip(pointRight, 'point-left'),

  /* ------------------------------------------------------------------ */
  listen: {
    description: 'Listening (loops): leans in toward the viewer with a curious head tilt, one ear perked, giving small attentive nods.',
    category: 'gesture',
    duration: 3,
    loop: true,
    fadeIn: 0.35,
    suppress: { look: true },
    slots: { mouth: [[0, 'smile']] },
    params: {
      lookX: [[0, 0.18]],
      lookY: keys('sineInOut', [0, -0.05], [0.9, 0.08], [1.3, -0.05], [2.2, 0.06], [2.6, -0.05], [3, -0.05]),
      lean: [[0, 0.1]],
      flap: keys('sineInOut', [0, -0.15], [1.5, -0.08], [3, -0.15]),
    },
    bones: {
      root: { dz: [[0, 14]] },
      head: {
        rot: keys('sineInOut', [0, 11], [1.5, 13], [3, 11]),
        dz: [[0, 10]],
      },
      'ear-r': { rot: keys('sineInOut', [0, -14], [0.7, -14], [0.82, -22], [0.95, -14], [3, -14]) },
      'ear-l': { rot: [[0, 4]] },
    },
  },

  /* ------------------------------------------------------------------ */
  think: {
    description: 'Thinking (loops): looks up and aside with a tilted head and pursed mouth, wing tapping its chin, foot tapping.',
    category: 'gesture',
    duration: 3.2,
    loop: true,
    fadeIn: 0.3,
    suppress: { look: true },
    slots: { mouth: [[0, 'o']] },
    events: [{ t: 0.4, effect: 'bubble', at: 'head', params: { side: 1, duration: 2.6 } }],
    params: {
      lookX: keys('sineInOut', [0, -0.45], [1.6, -0.35], [3.2, -0.45]),
      lookY: keys('sineInOut', [0, -0.5], [1.6, -0.4], [3.2, -0.5]),
      lean: [[0, -0.06]],
    },
    bones: {
      head: { rot: keys('sineInOut', [0, -9], [1.6, -6], [3.2, -9]) },
      // right wing folds up toward the chin and taps
      'wing-r': {
        rot: keys('sineInOut', [0, 52], [0.5, 52], [0.62, 46], [0.74, 52], [0.86, 46], [1.0, 52], [3.2, 52]),
        x: [[0, -26]],
        y: [[0, -16]],
        dz: [[0, 60]],
        sx: [[0, 0.48]],
        sy: [[0, 0.8]],
      },
      'wing-l': { rot: [[0, -10]] },
      'foot-l': { rot: keys('sineInOut', [0, 0], [1.8, 0], [1.9, 12], [2.0, 0], [2.1, 12], [2.2, 0], [3.2, 0]) },
    },
  },

  /* ------------------------------------------------------------------ */
  encourage: {
    description: 'Encouraging "you got this!": two quick wing pumps with confident nods and a grin, a few sparkles.',
    category: 'gesture',
    duration: 1.6,
    fadeIn: 0.1,
    suppress: { look: true },
    expression: [[0, 'proud']],
    params: {
      squash: keys('sineInOut', [0, 0], [0.12, 0.25], [0.3, -0.2, 'backOut'], [0.46, 0.15], [0.62, -0.2, 'backOut'], [0.85, 0.05], [1.2, 0]),
      lean: keys('sineInOut', [0, 0], [0.3, -0.12], [0.62, -0.15], [1.2, -0.05], [1.6, 0]),
    },
    bones: {
      'wing-r': {
        rot: keys('sineInOut', [0, 0], [0.12, 8], [0.3, -58, 'backOut'], [0.46, -30], [0.62, -62, 'backOut'], [1.1, -50], [1.6, 0]),
        sx: keys('sineInOut', [0, 1], [0.3, 0.85], [0.46, 0.95], [0.62, 0.85], [1.1, 0.9], [1.6, 1]),
      },
      'wing-l': { rot: keys('sineInOut', [0, 0], [0.3, -10], [1.2, -8], [1.6, 0]) },
      head: {
        pitch: keys('sineInOut', [0, 0], [0.18, -6], [0.32, 10], [0.5, -4], [0.64, 10], [0.9, 0]),
        rot: keys('sineInOut', [0, 0], [0.3, 5], [1.2, 4], [1.6, 0]),
      },
      root: { y: keys('quadOut', [0, 0], [0.5, 0], [0.62, -8, 'quadIn'], [0.76, 0]) },
    },
    events: [{ t: 0.64, effect: 'sparkles', at: 'head', params: { count: 3, size: 0.8 } }],
  },

  /* ------------------------------------------------------------------ */
  correct: {
    description: 'Right answer! A quick happy hop with wings flicked up, a nod, and a sparkle pop.',
    category: 'gesture',
    duration: 1.05,
    fadeIn: 0.06,
    suppress: { look: true },
    expression: [[0, 'joyful']],
    params: {
      squash: keys('sineInOut', [0, 0], [0.08, 0.35, 'quadOut'], [0.2, -0.4], [0.36, -0.05], [0.48, 0.3, 'quadOut'], [0.62, -0.08], [0.8, 0]),
      flap: keys('sineInOut', [0, 0], [0.08, -0.4], [0.22, 1.15, 'backOut'], [0.4, 0.6], [0.5, -0.15], [0.7, 0.25], [1.05, 0]),
      lookY: keys('sineInOut', [0, 0], [0.24, -0.2], [0.5, 0.15], [0.7, 0], [1.05, 0]),
    },
    bones: {
      root: { y: keys('quadOut', [0, 0], [0.09, 0], [0.3, -26, 'quadIn'], [0.48, 0], [1.05, 0]) },
      head: { rot: keys('sineInOut', [0, 0], [0.3, -4], [0.6, 3], [1.0, 0]) },
    },
    events: [
      { t: 0.24, effect: 'check', at: 'head', params: { side: 1 } },
      { t: 0.3, effect: 'sparkles', at: 'head', params: { count: 3 } },
    ],
  },

  /* ------------------------------------------------------------------ */
  wrong: {
    description: 'Wrong answer: a gentle wince (eyes squeezed, shrinks back, ears dip), then a small rueful head shake. Not discouraging.',
    category: 'gesture',
    duration: 1.4,
    fadeIn: 0.06,
    suppress: { look: true },
    expression: [[0, 'sleepy'], [0.5, 'neutral']],
    slots: { mouth: [[0, 'frown'], [1.2, 'default']] },
    params: {
      squash: keys('quadOut', [0, 0], [0.12, 0.35], [0.45, 0.25, 'sineInOut'], [0.7, 0.1], [1.2, 0]),
      flap: keys('quadOut', [0, 0], [0.12, -0.45], [0.5, -0.3, 'sineInOut'], [1.2, 0]),
      lookY: keys('quadOut', [0, 0], [0.12, 0.2], [0.5, 0.15, 'sineInOut'], [1.2, 0]),
    },
    bones: {
      head: {
        y: keys('quadOut', [0, 0], [0.12, 5], [0.5, 4, 'sineInOut'], [1.2, 0]),
        yaw: keys('sineInOut', [0, 0], [0.5, 0], [0.66, -12], [0.82, 10], [0.98, -5], [1.15, 0]),
      },
      'ear-l': { rot: keys('quadOut', [0, 0], [0.14, -20], [0.6, -14, 'sineInOut'], [1.2, 0]) },
      'ear-r': { rot: keys('quadOut', [0, 0], [0.14, 20], [0.6, 14, 'sineInOut'], [1.2, 0]) },
    },
    events: [{ t: 0.14, effect: 'sweat', at: 'head', params: { side: 1, count: 1 } }],
  },

  /* ------------------------------------------------------------------ */
  'look-left': mirrorClip(lookRight, 'look-left'),
  'look-right': lookRight,

  /* ------------------------------------------------------------------ */
  bow: {
    description: 'Polite bow: wings sweep forward, body and head tip toward the viewer, short hold with eyes closed, back up.',
    category: 'gesture',
    duration: 1.9,
    fadeIn: 0.15,
    suppress: { look: true },
    expression: [[0.15, 'happy']],
    params: {
      flap: keys('sineInOut', [0, 0], [0.15, 0.2], [0.55, -0.85], [1.2, -0.8], [1.55, 0.15], [1.9, 0]),
      squash: keys('sineInOut', [0, 0], [0.55, 0.22], [1.2, 0.2], [1.5, -0.06], [1.9, 0]),
    },
    bones: {
      body: { pitch: keys('sineInOut', [0, 0], [0.15, -3], [0.55, 22], [1.2, 22], [1.6, -2], [1.9, 0]) },
      head: {
        pitch: keys('sineInOut', [0, 0], [0.2, -4], [0.62, 20], [1.25, 20], [1.65, -2], [1.9, 0]),
        y: keys('sineInOut', [0, 0], [0.6, 10], [1.25, 10], [1.65, 0]),
        dz: keys('sineInOut', [0, 0], [0.6, 16], [1.25, 16], [1.65, 0]),
      },
    },
  },

  /* ------------------------------------------------------------------ */
  jump: {
    description: 'A big jump: crouch, stretch up with wings raised, fall, squash on landing with a dust puff, settle.',
    category: 'gesture',
    duration: 1.15,
    fadeIn: 0.1,
    expression: [[0, 'excited']],
    params: {
      squash: keys('sineInOut', [0, 0], [0.16, 0.55, 'quadOut'], [0.3, -0.5], [0.5, -0.15], [0.72, 0.5, 'quadOut'], [0.86, -0.15], [1.0, 0.05], [1.15, 0]),
      flap: keys('sineInOut', [0, 0], [0.16, -0.5], [0.32, 1.2, 'backOut'], [0.56, 0.5], [0.7, -0.4], [0.86, 0.35], [1.15, 0]),
      lookY: keys('sineInOut', [0, 0], [0.16, 0.15], [0.45, -0.2], [0.72, 0.1], [1.0, 0]),
    },
    bones: {
      root: { y: keys('quadOut', [0, 0], [0.18, 0], [0.48, -64, 'quadIn'], [0.72, 0], [1.15, 0]) },
      head: { y: keys('sineInOut', [0, 0], [0.18, 5], [0.34, -5], [0.56, 0], [0.76, 7], [0.92, -2], [1.1, 0]) },
      'foot-l': { y: keys('sineInOut', [0, 0], [0.3, 0], [0.45, -6], [0.68, 0]) },
      'foot-r': { y: keys('sineInOut', [0, 0], [0.3, 0], [0.45, -6], [0.68, 0]) },
    },
    events: [{ t: 0.72, effect: 'puff', at: 'feet', params: { count: 4, size: 0.8 } }],
  },

  /* ------------------------------------------------------------------ */
  'turn-around': {
    description: 'Turns around to show its back (yaw 0→180), holds a beat, then turns back to face the viewer.',
    category: 'gesture',
    duration: 2.6,
    fadeIn: 0.15,
    suppress: { look: true },
    expression: [[0, 'happy']],
    params: {
      squash: keys('sineInOut', [0, 0], [0.12, 0.15], [0.35, -0.12], [0.7, 0.08], [0.85, 0], [1.6, 0], [1.72, 0.12], [1.95, -0.1], [2.3, 0.06], [2.6, 0]),
      flap: keys('sineInOut', [0, 0], [0.4, 0.3], [0.8, 0], [1.4, 0.15], [1.95, 0.3], [2.4, 0]),
    },
    bones: {
      root: {
        yaw: keys('cubicInOut', [0, 0], [0.12, -10], [0.75, 180, 'sineInOut'], [1.65, 180, 'cubicInOut'], [1.72, 186], [2.35, 0, 'backOut'], [2.6, 0]),
        y: keys('sineInOut', [0, 0], [0.15, 0], [0.4, -10], [0.65, 0], [1.72, 0], [1.97, -10], [2.25, 0]),
      },
      head: { rot: keys('sineInOut', [0, 0], [0.9, 0], [1.2, 6], [1.5, -4], [1.7, 0]) },
    },
  },

  /* ------------------------------------------------------------------ */
  greet: {
    description: 'Onboarding hello: flies in from screen-right in an arc, lands with a puff, then waves with a big smile.',
    category: 'gesture',
    duration: 3.2,
    fadeIn: 0.04,
    suppress: { look: true },
    expression: [[0, 'excited'], [0.95, 'joyful'], [1.6, 'happy']],
    params: {
      flap: keys('sineInOut', [0, 1], [0.1, -1], [0.2, 1], [0.3, -1], [0.4, 1], [0.5, -0.9], [0.6, 0.9], [0.72, -0.5], [0.84, 0.6, 'backOut'], [1.05, 0], [3.2, 0]),
      squash: keys('sineInOut', [0, -0.2], [0.72, -0.3], [0.82, 0.5, 'quadOut'], [0.98, -0.15], [1.12, 0.06], [1.3, 0], [3.2, 0]),
      lean: keys('sineInOut', [0, -0.3], [0.7, -0.15], [0.84, 0.15], [1.1, 0], [1.3, -0.12], [2.8, -0.1], [3.2, 0]),
      lookX: keys('sineInOut', [0, -0.5], [0.6, -0.3], [0.9, 0], [3.2, 0]),
    },
    bones: {
      root: {
        x: keys('cubicOut', [0, 340], [0.8, 0], [3.2, 0]),
        y: keys('sineInOut', [0, -110], [0.4, -90], [0.66, -40, 'quadIn'], [0.8, 0], [3.2, 0]),
        yaw: keys('sineInOut', [0, -35], [0.55, -25], [0.85, 0, 'backOut'], [3.2, 0]),
      },
      'wing-r': {
        rot: [[0, 0, 'sineInOut'], [1.15, 0, 'backOut'], [1.4, -48, 'sineInOut'], ...waveKeys(1.5, 4, 0.3, -28, -52), [2.7, -44, 'sineInOut'], [3.15, 0]],
        yaw: [[0, 0, 'sineInOut'], [1.4, 0, 'sineInOut'], ...waveKeys(1.5, 4, 0.3, -30, 18), [2.7, 0, 'sineInOut']],
      },
      head: { rot: keys('sineInOut', [0, 0], [1.1, 0], [1.45, 8], [2.0, 5], [2.5, 9], [3.2, 0]) },
      'foot-l': { y: keys('sineInOut', [0, -5], [0.7, -3], [0.8, 0]) },
      'foot-r': { y: keys('sineInOut', [0, -5], [0.7, -3], [0.8, 0]) },
    },
    events: [
      { t: 0.8, effect: 'puff', at: 'feet', params: { count: 5 } },
      { t: 1.45, effect: 'sparkles', at: 'head', params: { count: 3, size: 0.8 } },
    ],
  },
});
