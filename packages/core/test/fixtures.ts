/** Small hand-written rigs shared by the core tests. */
import type { CharacterDef } from '../src/types';

/**
 * A minimal but complete character: shadow, root, body with a flat spring
 * arm, a static layer, a head with a face eye (slot with a pupil bone in two
 * variants), a mouth slot with an explicit default, and a back-facing patch.
 */
export const TEST_SVG = `<?xml version="1.0"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="-100 -200 200 220" data-om-character="blob" class="mascot" width="200" height="220">
  <title>Blob</title>
  <defs><linearGradient id="grad"><stop offset="0" stop-color="#fff"/></linearGradient></defs>
  <!-- the ground shadow -->
  <g data-om-bone="shadow" data-om-shadow=""><ellipse rx="50" ry="5" fill="#000"/></g>
  <g data-om-bone="root" data-om-pivot="0 0">
    <g data-om-bone="body" data-om-pivot="0 -60">
      <g data-om-bone="back-patch" data-om-z="-30" data-om-surface="back"><circle cy="-60" r="10" fill="#222"/></g>
      <g data-om-bone="arm-l" data-om-pivot="-40 -80" data-om-z="-10" data-om-surface="flat" data-om-spring="100 10" data-om-tip="-80 -80" id="arm">
        <rect x="-80" y="-85" width="40" height="10" fill="#634C91"/>
      </g>
      <g data-om-bone="arm-r" data-om-pivot="40 -80" data-om-z="-10" data-om-surface="flat">
        <rect x="40" y="-85" width="40" height="10" fill="#634c91"/>
      </g>
      <circle cy="-60" r="50" fill="#634C91"/>
      <path d="M0 0L1 1"/>
      <g data-om-layer="" data-om-z="2" class="belly"><circle cy="-50" r="20" fill="url(#grad)"/></g>
      <g data-om-bone="head" data-om-pivot="0 -130" data-om-z="4">
        <circle cy="-130" r="40" fill="#634c91"/>
        <g data-om-bone="eye-l" data-om-pivot="-20 -130" data-om-z="30" data-om-surface="face" data-om-normal="-20 0">
          <g data-om-slot="eye-l">
            <g data-om-variant="open"><circle cx="-20" cy="-130" r="8" fill="#fff"/><g data-om-bone="pupil-l" data-om-pivot="-20 -130"><circle cx="-20" cy="-130" r="3"/></g></g>
            <g data-om-variant="happy" display="none"><path d="M-25 -130 Q-20 -136 -15 -130"/></g>
            <g data-om-variant="wide" display="none"><circle cx="-20" cy="-130" r="10" fill="#fff"/><g data-om-bone="pupil-l"><circle cx="-20" cy="-130" r="4"/></g></g>
          </g>
        </g>
        <g data-om-slot="mouth" data-om-z="35">
          <g data-om-variant="flat"><path d="M-5 -110H5"/></g>
          <g data-om-variant="smile" data-om-default="" display="none"><path d="M-5 -110Q0 -105 5 -110"/></g>
        </g>
        <g data-om-bone="nose" data-om-pivot="0 -120" data-om-z="50" data-om-surface="feature"><circle cy="-120" r="4"/></g>
      </g>
    </g>
  </g>
</svg>`;

export const testCharacter: CharacterDef = {
  id: 'blob',
  name: 'Blob',
  svg: TEST_SVG,
  expressions: {
    neutral: { 'eye-l': 'open', mouth: 'flat' },
    happy: { 'eye-l': 'happy', mouth: 'smile' },
    shocked: { 'eye-l': 'wide' },
    smirk: { mouth: 'smile' },
  },
  params: {
    lookX: {
      min: -1,
      max: 1,
      drives: [
        { bone: 'head', channel: 'yaw', k: 20 },
        { bone: 'pupil-l', channel: 'x', k: 3 },
      ],
    },
    blink: { min: 0, max: 1, drives: [{ bone: 'eye-l', channel: 'sy', k: -0.9 }] },
    breathe: { drives: [{ bone: 'body', channel: 'sy', k: 0.01 }] },
    squash: {
      min: -1,
      max: 1,
      default: 0,
      drives: [{ bone: 'root', channel: 'sy', curve: [[-1, 0.2], [0, 0], [1, -0.2]] }],
    },
  },
  anchors: { top: { bone: 'head', offset: [0, -40] } },
  idle: { clip: 'idle', fidgetEvery: 0 },
  clips: {
    idle: { duration: 2, loop: true, bones: { head: { rot: [[0, 0], [1, 5], [2, 0]] } } },
    wave: {
      duration: 1,
      bones: { 'arm-r': { rot: [[0, 0], [0.5, -60], [1, 0]] } },
      events: [{ t: 0, effect: 'sparkles' }, { t: 0.5, effect: 'hearts', at: 'top' }],
    },
    spin: { duration: 1, loop: true, bones: { root: { yaw: [[0, 0, 'linear'], [1, 360]] } } },
  },
};
