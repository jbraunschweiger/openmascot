/** Echo-only clips (poses that rely on bat anatomy: hanging, wing cloak…). */
import { cycle, defineClips, keys } from '@openmascot/core';
import type { Clip } from '@openmascot/core';

const folded = (t = 0): Record<string, [number, string][]> => ({ 'wing-l': [[t, 'folded']], 'wing-r': [[t, 'folded']] });

export const echoClips: Record<string, Clip> = defineClips({
  hang: {
    description: 'Hangs upside down from its feet, wrapped in its wings, swaying gently like a pendulum.',
    category: 'pose',
    duration: 3.2,
    loop: true,
    shadow: 0,
    fadeIn: 0.35,
    slots: folded(),
    bones: {
      root: { rot: cycle(3.2, [180, 184, 180, 176]), y: [[0, -233]] },
      head: { rot: cycle(3.2, [0, -3, 0, 3]) },
      'foot-l': { y: [[0, 14]], x: [[0, 8]], dz: [[0, 90]] },
      'foot-r': { y: [[0, 14]], x: [[0, -8]], dz: [[0, 90]] },
      'wing-l': { rot: [[0, -18]], dz: [[0, 70]], x: [[0, 20]], y: [[0, 22]] },
      'wing-r': { rot: [[0, 18]], dz: [[0, 68]], x: [[0, -20]], y: [[0, 22]] },
    },
    params: { lookY: cycle(3.2, [-0.1, 0, -0.1, 0]) },
  },

  fly: {
    description: 'Hovering flight loop: strong wing beats, body bobs up on each down-stroke, feet dangle.',
    category: 'locomotion',
    duration: 0.56,
    loop: true,
    fadeIn: 0.3,
    params: {
      flap: keys('sineInOut', [0, 1.15], [0.24, -1.05, 'sineInOut'], [0.56, 1.15]),
      squash: keys('sineInOut', [0, 0.08], [0.2, -0.18], [0.42, 0.1], [0.56, 0.08]),
    },
    bones: {
      root: { y: keys('sineInOut', [0, -38], [0.06, -36], [0.3, -50], [0.56, -38]) },
      head: { y: keys('sineInOut', [0, -1], [0.12, 1.5], [0.36, -2.5], [0.56, -1]) },
      'foot-l': { rot: keys('sineInOut', [0, 6], [0.3, -4], [0.56, 6]), y: [[0, -4]] },
      'foot-r': { rot: keys('sineInOut', [0, -4], [0.3, 6], [0.56, -4]), y: [[0, -4]] },
    },
  },

  'fly-side': {
    description: 'Flying in 3/4 view toward screen-right: body tipped forward, far wing high, near wing low, beating.',
    category: 'locomotion',
    duration: 0.6,
    loop: true,
    fadeIn: 0.35,
    params: {
      flap: keys('sineInOut', [0, 0.8], [0.26, -0.75], [0.6, 0.8]),
      lookY: [[0, 0.1]],
    },
    bones: {
      root: {
        yaw: [[0, 32]],
        rot: keys('sineInOut', [0, 14], [0.3, 11], [0.6, 14]),
        y: keys('sineInOut', [0, -40], [0.32, -52], [0.6, -40]),
        x: [[0, -10]],
      },
      head: { rot: keys('sineInOut', [0, -10], [0.3, -7], [0.6, -10]), y: keys('sineInOut', [0, 0], [0.38, -3], [0.6, 0]) },
      'wing-l': { rot: [[0, 26]] },
      'wing-r': { rot: [[0, 38]], dz: [[0, 45]], sx: [[0, 0.9]] },
      'foot-l': { rot: [[0, 35]], x: [[0, -4]] },
      'foot-r': { rot: [[0, 30]], x: [[0, -4]] },
    },
  },

  cloak: {
    description: 'Sits snugly wrapped in its folded wings, content and cosy, swaying softly.',
    category: 'pose',
    duration: 3.4,
    loop: true,
    fadeIn: 0.35,
    slots: folded(),
    expression: [[0, 'happy']],
    params: {
      squash: cycle(3.4, [0.18, 0.24]),
      lean: cycle(3.4, [0, 0.12, 0, -0.12]),
    },
    bones: {
      root: { y: [[0, 0]] },
      head: { rot: cycle(3.4, [0, -3, 0, 3]), y: [[0, 4]] },
      'wing-l': { rot: [[0, -9]], x: [[0, 14]], dz: [[0, 52]] },
      'wing-r': { rot: [[0, 9]], x: [[0, -14]], dz: [[0, 52]] },
      'foot-l': { dz: [[0, 80]], x: [[0, 4]] },
      'foot-r': { dz: [[0, 80]], x: [[0, -4]] },
    },
  },

  wink: {
    description: 'Cheeky wink: quick dip, head tilts toward the winking eye with a little sparkle, wings perk up.',
    category: 'pose',
    duration: 1.7,
    fadeIn: 0.15,
    expression: [[0.18, 'wink'], [1.45, 'neutral']],
    params: {
      squash: keys('sineInOut', [0, 0], [0.12, 0.22], [0.3, -0.12, 'backOut'], [0.5, 0], [1.4, 0], [1.7, 0]),
      flap: keys('backOut', [0, 0], [0.12, -0.15], [0.32, 0.45], [1.35, 0.4, 'sineInOut'], [1.7, 0]),
      lean: keys('backOut', [0, 0], [0.3, 0.18], [1.35, 0.15, 'sineInOut'], [1.7, 0]),
      lookX: keys('backOut', [0, 0], [0.3, 0.25], [1.35, 0.2, 'sineInOut'], [1.7, 0]),
    },
    bones: {
      head: { rot: keys('backOut', [0, 0], [0.12, -2], [0.34, 11], [1.35, 9, 'sineInOut'], [1.7, 0]) },
    },
    events: [{ t: 0.34, effect: 'sparkles', at: 'eye-r', params: { count: 2, spread: 50, size: 0.7 } }],
    suppress: { look: true },
  },

  peek: {
    description: 'Peeks up from below a ledge (only the head shows above y=0; apps clip below), glancing around curiously.',
    category: 'pose',
    duration: 4,
    loop: true,
    shadow: 0,
    fadeIn: 0.4,
    slots: folded(),
    params: {
      lookX: keys('cubicInOut', [0, 0], [0.6, 0], [0.9, -0.6], [1.6, -0.6], [2.0, 0.55], [2.8, 0.55], [3.2, 0], [4, 0]),
      lookY: keys('sineInOut', [0, -0.1], [2, -0.2], [4, -0.1]),
    },
    bones: {
      root: { y: keys('sineInOut', [0, 94], [3.1, 94], [3.35, 86], [3.6, 94], [4, 94]) },
      head: { rot: keys('sineInOut', [0, 0], [0.9, -4], [1.6, -4], [2.0, 4], [2.8, 4], [3.2, 0], [4, 0]) },
      // feet become little paws gripping the ledge; wings tucked out of sight below it
      'foot-l': { x: [[0, -54]], y: keys('sineInOut', [0, -71], [3.1, -71], [3.35, -65], [3.6, -71], [4, -71]), dz: [[0, 90]], sy: [[0, -0.85]], sx: [[0, 1.1]] },
      'foot-r': { x: [[0, 54]], y: keys('sineInOut', [0, -71], [3.1, -71], [3.35, -65], [3.6, -71], [4, -71]), dz: [[0, 90]], sy: [[0, -0.85]], sx: [[0, 1.1]] },
      'wing-l': { y: [[0, 40]], x: [[0, 20]] },
      'wing-r': { y: [[0, 40]], x: [[0, -20]] },
    },
  },

  land: {
    description: 'Flutters down from above the frame, brakes with the wings, lands with a squash and a dust puff, then settles.',
    category: 'locomotion',
    duration: 1.4,
    fadeIn: 0.05,
    expression: [[0, 'excited'], [0.75, 'happy'], [1.3, 'neutral']],
    params: {
      flap: keys('sineInOut', [0, 1], [0.1, -1], [0.2, 1.1], [0.31, -0.9], [0.43, 1.0], [0.56, -0.6], [0.66, 0.7, 'backOut'], [0.9, -0.1], [1.15, 0]),
      squash: keys('sineInOut', [0, -0.35], [0.5, -0.25], [0.6, -0.4, 'quadOut'], [0.66, 0.6, 'quadOut'], [0.82, -0.2], [0.98, 0.12], [1.15, 0]),
    },
    bones: {
      root: { y: keys('quadOut', [0, -330], [0.5, -60, 'quadIn'], [0.62, 0, 'linear'], [1.4, 0]) },
      head: { y: keys('sineInOut', [0, -4], [0.6, -4], [0.7, 6, 'quadOut'], [0.86, -3], [1.05, 0]) },
      'foot-l': { y: keys('sineInOut', [0, -6], [0.55, -2], [0.62, 0]) },
      'foot-r': { y: keys('sineInOut', [0, -6], [0.55, -2], [0.62, 0]) },
    },
    events: [{ t: 0.63, effect: 'puff', at: [0, 0], params: { count: 6 } }],
  },

  takeoff: {
    description: 'Crouches, springs into the air with a puff and powerful wing beats, ending in a hover (chain into "fly").',
    category: 'locomotion',
    duration: 1.12,
    fadeIn: 0.15,
    then: 'fly',
    expression: [[0.05, 'excited']],
    params: {
      squash: keys('sineInOut', [0, 0], [0.22, 0.55, 'quadOut'], [0.36, -0.55], [0.6, -0.15], [0.9, -0.1], [1.12, 0.08]),
      flap: keys('sineInOut', [0, 0], [0.22, -0.45], [0.34, 1.3], [0.46, -1.05], [0.58, 1.15], [0.7, -1.05], [0.84, 1.15], [0.98, -1.05], [1.12, 1.15]),
    },
    bones: {
      root: { y: keys('quadOut', [0, 0], [0.24, 0], [0.5, -58], [0.7, -44], [0.86, -52], [1.12, -38]) },
      head: { y: keys('sineInOut', [0, 0], [0.24, 5], [0.42, -4], [0.6, 0]) },
      'foot-l': { y: keys('sineInOut', [0, 0], [0.4, -4]) },
      'foot-r': { y: keys('sineInOut', [0, 0], [0.4, -4]) },
    },
    events: [{ t: 0.3, effect: 'puff', at: [0, 0], params: { count: 6 } }],
  },
});
