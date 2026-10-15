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
    fadeIn: 0.35,
    slots: folded(),
    bones: {
      root: { rot: cycle(3.2, [180, 184, 180, 176]), y: [[0, -233]] },
      head: { rot: cycle(3.2, [0, -3, 0, 3]) },
      'wing-l': { rot: [[0, -25]], dz: [[0, 45]], x: [[0, 12]] },
      'wing-r': { rot: [[0, 25]], dz: [[0, 44]], x: [[0, -12]] },
    },
    params: { lookY: cycle(3.2, [-0.1, 0, -0.1, 0]) },
  },
});
