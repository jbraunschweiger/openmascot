/** Idle loops and the small "fidgets" the runtime sprinkles into idle time. */
import { cycle, defineClips, keys } from '@openmascot/core';

export const idleClips = defineClips({
  idle: {
    description: 'Calm standing loop: wings relaxed against the flanks (wingFold 0.5) with a soft sway and weight shift. Breathing, blinking and glances are layered on by the runtime.',
    category: 'idle',
    duration: 4,
    loop: true,
    params: {
      wingFold: cycle(4, [0.5, 0.46, 0.5, 0.54]),
      flap: cycle(4, [0.02, 0.08, 0.02, -0.04]),
      lean: cycle(4, [0, 0.05, 0, -0.05]),
    },
    bones: {
      root: { y: cycle(4, [0, -1.5, 0, -1.5]) },
      head: { rot: cycle(4, [0, -1.2, 0, 1.2]) },
    },
  },

  'fidget-ear-twitch': {
    description: 'One ear flicks, then the other.',
    category: 'fidget',
    duration: 1.1,
    bones: {
      'ear-l': { rot: keys('out', [0, 0], [0.08, -14], [0.22, 0]) },
      'ear-r': { rot: keys('out', [0, 0], [0.45, 0], [0.53, 14], [0.68, 0]) },
      head: { rot: keys('sineInOut', [0, 0], [0.1, -2], [0.5, 2], [1.1, 0]) },
    },
  },

  'fidget-look-around': {
    description: 'Curious glance left, then right, then back.',
    category: 'fidget',
    duration: 2.6,
    suppress: { look: true },
    params: {
      lookX: keys('cubicInOut', [0, 0], [0.35, -0.9], [1.1, -0.9], [1.5, 0.9], [2.2, 0.9], [2.6, 0]),
      lookY: keys('sineInOut', [0, 0], [0.35, -0.2], [1.1, -0.1], [1.5, -0.25], [2.6, 0]),
    },
  },

  'fidget-wing-stretch': {
    description: 'Big satisfied wing stretch: the wings unfold all the way, hold, and settle back.',
    category: 'fidget',
    duration: 1.8,
    params: {
      wingFold: keys('sineInOut', [0, 0.5], [0.5, 0], [1.1, 0], [1.6, 0.5]),
      flap: keys('sineInOut', [0, 0], [0.5, 0.75], [1.1, 0.75], [1.8, 0]),
      squash: keys('sineInOut', [0, 0], [0.5, -0.25], [1.1, -0.25], [1.4, 0.1], [1.8, 0]),
    },
    expression: [[0.3, 'happy'], [1.5, 'neutral']],
  },

  'fidget-hop': {
    description: 'A tiny happy hop in place.',
    category: 'fidget',
    duration: 0.9,
    params: {
      squash: keys('sineInOut', [0, 0], [0.12, 0.45], [0.22, -0.3], [0.45, -0.1], [0.62, 0.35], [0.9, 0]),
      flap: keys('sineInOut', [0, 0], [0.2, 0.6], [0.4, -0.5], [0.62, 0.2], [0.9, 0]),
      wingFold: keys('sineInOut', [0, 0.5], [0.2, 0.25], [0.62, 0.35], [0.9, 0.5]),
    },
    bones: {
      root: { y: keys('quadOut', [0, 0], [0.14, 0], [0.38, -22], [0.6, 0, 'quadIn']) },
    },
  },
});
