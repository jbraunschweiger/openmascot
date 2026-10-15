/**
 * Riff-only clips, plus Riff versions of library clips.
 *
 * Riff's forelimbs are front legs (`arm-l`/`arm-r`, hanging down from the
 * shoulder, with the hand as `foot-l`/`foot-r`), not wings. Most library
 * clips move forelimbs through the `flap` param and work as they are; the
 * ones that key `wing-*` bones directly (waves, points, disco…) are
 * re-targeted onto the arms by {@link armsFromWings} and merged over the
 * library under the same names.
 */
import { cycle, defineClips, keys, mirrorClip } from '@openmascot/core';
import type { Channel, Clip, Keyframe } from '@openmascot/core';

/** Channel tracks of one bone. */
type Tracks = Partial<Record<Channel, Keyframe[]>>;
import { library } from '../library';

/* ------------------------------------------------------------------ */
/* Wing → arm re-targeting                                              */
/* ------------------------------------------------------------------ */

/**
 * Most library clips now drive forelimbs through portable params (`flap`,
 * `wingFold`, `raiseL`/`raiseR`, mapped in ./index.ts); this handles the
 * remaining direct `wing-*` keys.
 *
 * Echo-style wings rest spread sideways and rise with |rot| ≈ 50–80°; Riff's
 * arms hang straight down, so raising them needs about twice the angle (and a
 * little stretch to clear the head). Lowering / folding a wing (toward the
 * body) maps to tucking the arm in, more gently. Sign conventions match: for
 * the screen-right limb negative rot raises it, for the left one positive.
 */
function armRot(wingRot: number, side: 'l' | 'r'): number {
  const raise = side === 'r' ? -wingRot : wingRot;
  const out = raise > 0 ? Math.min(raise * 2, 128) : raise * 0.55;
  return side === 'r' ? -out : out;
}
const armStretch = (armRotDeg: number) => 1 + 0.32 * Math.min(1, Math.abs(Math.max(0, armRotDeg)) / 110);

function retargetLimb(tracks: Tracks, side: 'l' | 'r', flourish: boolean): { arm: Tracks; hand: Tracks } {
  const arm: Tracks = {};
  const hand: Tracks = {};
  if (tracks.rot && flourish) {
    // the limb is already raised by raiseL/raiseR: the wing key is a small accent
    arm.rot = tracks.rot.map(([t, v, e]) => [t, v * 0.6, e ?? 'sineInOut'] as Keyframe);
  } else if (tracks.rot) {
    arm.rot = tracks.rot.map(([t, v, e]) => [t, armRot(v, side), e ?? 'sineInOut'] as Keyframe);
    // stretch with the raise (signed so it's always "how far up")
    arm.sy = tracks.rot.map(([t, v, e]) => [t, armStretch(side === 'r' ? -armRot(v, side) : armRot(v, side)), e ?? 'sineInOut'] as Keyframe);
  }
  // a 3D wrist turn on a wing becomes a hand wiggle
  if (tracks.yaw) hand.rot = tracks.yaw.map(([t, v, e]) => [t, (side === 'r' ? 1 : -1) * v * 0.9, e ?? 'sineInOut'] as Keyframe);
  for (const ch of ['y', 'dz', 'opacity'] as Channel[]) if (tracks[ch]) arm[ch] = tracks[ch];
  // sideways wing shifts (hugs) would slide the arms across the belly
  if (tracks.x) arm.x = tracks.x.map(([t, v, e]) => [t, v * 0.3, e ?? 'sineInOut'] as Keyframe);
  return { arm, hand };
}

/**
 * Re-target a library clip onto Riff: wings → arms (wing slots dropped, Riff
 * has none), ears → eye domes at a third of the angle (droopy or perked
 * eyes), tuft dropped.
 */
export function armsFromWings(clip: Clip): Clip {
  const bones: Record<string, Tracks> = { ...(clip.bones ?? {}) };
  for (const side of ['l', 'r'] as const) {
    const ear = bones[`ear-${side}`];
    delete bones[`ear-${side}`];
    if (ear?.rot && !bones[`dome-${side}`]) {
      const rot = ear.rot.map(([t, v, e]) => [t, v * 0.33, e ?? 'sineInOut'] as Keyframe);
      bones[`dome-${side}`] = { rot };
      bones[`eye-${side}`] = { rot };
    }
  }
  delete bones.tuft;
  for (const side of ['l', 'r'] as const) {
    const wing = bones[`wing-${side}`];
    if (!wing) continue;
    delete bones[`wing-${side}`];
    const raised = !!clip.params?.[side === 'l' ? 'raiseL' : 'raiseR'];
    const { arm, hand } = retargetLimb(wing, side, raised);
    bones[`arm-${side}`] = { ...arm, ...bones[`arm-${side}`] };
    if (Object.keys(hand).length) bones[`foot-${side}`] = { ...hand, ...bones[`foot-${side}`] };
  }
  const slots = clip.slots ? { ...clip.slots } : undefined;
  if (slots) {
    delete slots['wing-l'];
    delete slots['wing-r'];
  }
  return { ...clip, bones, ...(slots ? { slots } : {}) };
}

const BAT_ONLY = /^(wing-|ear-|tuft$)/;
const usesWings = (c: Clip) => Object.keys(c.bones ?? {}).some((b) => BAT_ONLY.test(b)) || Object.keys(c.slots ?? {}).some((s) => s.startsWith('wing-'));

/** Every library clip that addresses wings/ears, re-targeted onto arms/domes. */
const retargeted: Record<string, Clip> = Object.fromEntries(
  Object.entries(library)
    .filter(([, c]) => usesWings(c))
    .map(([name, c]) => [name, armsFromWings(c)]),
);

/* ------------------------------------------------------------------ */
/* Poses                                                               */
/* ------------------------------------------------------------------ */

/** Hind legs fully unfolded (mid-leap): thigh swings down, shin straightens, toes trail. */
const LEG_OUT = { leg: -45, shin: 95, foot: -100 };
/** Hind legs pulled in tight (crouch before a jump). */
const LEG_TUCK = { leg: 8, shin: -6, foot: 6 };

type K = [number, number] | [number, number, Keyframe[2]];
/** Same keys for a -l/-r pair, mirrored (rot/x negate on the right). */
function pair(bone: string, ch: Channel, ks: K[], mirror = true): Record<string, Tracks> {
  const r = ks.map(([t, v, e]) => [t, mirror ? -v : v, e ?? 'sineInOut'] as Keyframe);
  const l = ks.map(([t, v, e]) => [t, v, e ?? 'sineInOut'] as Keyframe);
  return { [`${bone}-l`]: { [ch]: l }, [`${bone}-r`]: { [ch]: r } };
}

/** Merge per-bone track maps. */
function merge(...parts: Record<string, Tracks>[]): Record<string, Tracks> {
  const out: Record<string, Tracks> = {};
  for (const p of parts) for (const b in p) out[b] = { ...out[b], ...p[b] };
  return out;
}

/** Hind-leg keys: `f` = fraction of the full leap extension (negative = tuck). */
function legKeys(ks: [number, number, Keyframe[2]?][]): Record<string, Tracks> {
  const pose = (f: number) => (f >= 0 ? { leg: LEG_OUT.leg * f, shin: LEG_OUT.shin * f, foot: LEG_OUT.foot * f } : { leg: LEG_TUCK.leg * -f, shin: LEG_TUCK.shin * -f, foot: LEG_TUCK.foot * -f });
  const at = (k: 'leg' | 'shin' | 'foot') => ks.map(([t, f, e]) => [t, pose(f)[k], e] as K);
  return merge(pair('leg', 'rot', at('leg')), pair('shin', 'rot', at('shin')), pair('hindfoot', 'rot', at('foot')));
}

/** Eye dome + eye move together (they share a pivot and spring). */
function eyeBob(side: 'l' | 'r', ch: Channel, ks: Keyframe[]): Record<string, Tracks> {
  return { [`dome-${side}`]: { [ch]: ks }, [`eye-${side}`]: { [ch]: ks } };
}

/** Throat pouch: slot on at `t0`, scale keys, slot off at `t1`. */
function pouch(t0: number, t1: number, scale: Keyframe[]): { slots: Clip['slots']; bones: Record<string, Tracks> } {
  return {
    slots: { throat: [[t0, 'on'], [t1, 'off']] },
    bones: { throat: { sx: scale, sy: scale.map(([t, v, e]) => [t, 0.15 + v * 0.85, e ?? 'sineInOut'] as Keyframe) } },
  };
}

/* ------------------------------------------------------------------ */
/* Riff-only clips                                                     */
/* ------------------------------------------------------------------ */

const croakPouch = pouch(0.3, 1.86, keys('sineInOut', [0, 0.2], [0.3, 0.2, 'backOut'], [0.58, 1.05], [0.78, 0.6, 'backOut'], [1.02, 1.15], [1.22, 0.62, 'backOut'], [1.5, 1.28], [1.8, 0.2]));
// "rib-" with the mouth open, "-bit" with it shut and the pouch puffed
const ribbit1 = pouch(0.32, 0.7, keys('sineInOut', [0, 0.2], [0.32, 0.2, 'backOut'], [0.44, 0.95], [0.68, 0.2]));
const ribbit2 = pouch(0.98, 1.4, keys('sineInOut', [0, 0.2], [0.98, 0.2, 'backOut'], [1.1, 1.08], [1.38, 0.2]));
const gulpPouch = pouch(0.3, 0.92, keys('sineInOut', [0, 0.2], [0.3, 0.2, 'backOut'], [0.5, 0.62], [0.66, 0.38], [0.9, 0.2]));

/**
 * Fly path, as offsets from the fly's rest point (172, -100) — which is where
 * the tongue tip lands at full stretch (the last key corrects for the head's
 * pose at the zap). It buzzes in high from the left, loops over the head and
 * dips to the right of the mouth.
 */
const FLY_X = keys('sineInOut', [0, -380], [0.3, -300], [0.55, -215], [0.8, -150], [1.0, -80], [1.15, -10], [1.3, 16], [1.42, 3], [1.5, 4.9]);
const FLY_Y = keys('sineInOut', [0, -140], [0.15, -170], [0.3, -150], [0.45, -178], [0.6, -160], [0.8, -150], [1.0, -110], [1.15, -66], [1.3, -30], [1.42, -10], [1.5, -0.5]);
const ZAP = 1.5; // tongue reaches the fly
/** Shift keys later in time. */
const later = (ks: Keyframe[], dt: number): Keyframe[] => ks.map(([t, v, e]) => [t + dt, v, e ?? 'sineInOut'] as Keyframe);
/** Buzzing wobble keys (±amp every `step` s) up to `until`. */
function buzz(until: number, step: number, amp: number): Keyframe[] {
  const out: Keyframe[] = [];
  for (let i = 0; i * step <= until; i++) out.push([i * step, i % 2 ? amp : -amp, 'sineInOut']);
  return out;
}
const TONGUE_ROT = 7; // tongue drawn pointing screen-right; this aims it at the fly's rest point, under the right eye

const ownClips = defineClips({
  'fidget-eye-bob': {
    description: 'The eye domes bob one after the other, springing back with a wobble.',
    category: 'fidget',
    duration: 1.2,
    bones: {
      ...eyeBob('l', 'y', keys('quadOut', [0, 0], [0.1, -12], [0.32, 0, 'backOut'])),
      ...eyeBob('r', 'y', keys('quadOut', [0, 0], [0.35, 0], [0.45, -12], [0.67, 0, 'backOut'])),
      head: { rot: keys('sineInOut', [0, 0], [0.12, -1.5], [0.45, 1.5], [1.2, 0]) },
    },
  },

  'fidget-ear-twitch': {
    description: 'Riff has no ears: the eye domes twitch instead, one then the other.',
    category: 'fidget',
    duration: 1.1,
    bones: {
      ...eyeBob('l', 'rot', keys('out', [0, 0], [0.08, -13], [0.24, 0])),
      ...eyeBob('r', 'rot', keys('out', [0, 0], [0.45, 0], [0.53, 13], [0.7, 0])),
      head: { rot: keys('sineInOut', [0, 0], [0.1, -2], [0.5, 2], [1.1, 0]) },
    },
  },

  'fidget-gulp': {
    description: 'A small gulp: chin lifts, the throat pouch puffs once and the eyes squeeze shut.',
    category: 'fidget',
    duration: 1.2,
    ...gulpPouch,
    params: {
      lookY: keys('sineInOut', [0, 0], [0.3, -0.25], [0.8, -0.2], [1.2, 0]),
      blink: keys('sineInOut', [0, 0], [0.42, 0], [0.52, 1], [0.66, 1], [0.78, 0]),
      squash: keys('sineInOut', [0, 0], [0.5, 0.08], [0.8, 0], [1.2, 0]),
    },
  },

  croak: {
    description: 'Croaks: lifts its chin and the throat pouch balloons out three times, each bigger, with a little body pulse.',
    category: 'gesture',
    duration: 2.2,
    fadeIn: 0.15,
    suppress: { look: true },
    expression: [[0, 'neutral'], [0.25, 'happy'], [1.95, 'neutral']],
    slots: { ...croakPouch.slots, mouth: [[0, 'default']] },
    params: {
      lookY: keys('sineInOut', [0, 0], [0.28, -0.4], [1.75, -0.35], [2.2, 0]),
      squash: keys('sineInOut', [0, 0], [0.28, -0.14], [0.58, 0.14], [0.78, -0.04], [1.02, 0.16], [1.22, -0.04], [1.5, 0.2], [1.85, -0.05], [2.2, 0]),
      flap: keys('sineInOut', [0, 0], [0.3, -0.2], [1.8, -0.2], [2.2, 0]),
    },
    bones: {
      ...croakPouch.bones,
      head: { y: keys('sineInOut', [0, 0], [0.28, -3], [1.75, -3], [2.2, 0]) },
    },
    events: [{ t: 1.38, effect: 'burst', at: 'head', params: { size: 0.8 } }],
  },

  ribbit: {
    description: '"Ribbit!": two quick hops, each with an open-mouthed croak and a throat puff, music notes popping out.',
    category: 'gesture',
    duration: 1.7,
    fadeIn: 0.1,
    suppress: { look: true },
    expression: [[0, 'excited'], [1.45, 'happy']],
    slots: {
      throat: [...ribbit1.slots!.throat, ...ribbit2.slots!.throat],
      mouth: [[0, 'default'], [0.14, 'o'], [0.32, 'default'], [0.78, 'open'], [0.98, 'default'], [1.4, '']],
    },
    params: {
      squash: keys('sineInOut', [0, 0], [0.1, 0.32, 'quadOut'], [0.22, -0.3], [0.4, 0.25, 'quadOut'], [0.56, 0], [0.74, 0.32, 'quadOut'], [0.88, -0.32], [1.06, 0.28, 'quadOut'], [1.25, 0], [1.7, 0]),
      lookY: keys('sineInOut', [0, 0], [0.2, -0.3], [0.5, 0], [0.86, -0.35], [1.2, 0]),
      flap: keys('sineInOut', [0, 0], [0.22, 0.35], [0.45, 0], [0.88, 0.45], [1.15, 0]),
    },
    bones: {
      throat: {
        sx: [...ribbit1.bones.throat.sx!, ...ribbit2.bones.throat.sx!.slice(1)],
        sy: [...ribbit1.bones.throat.sy!, ...ribbit2.bones.throat.sy!.slice(1)],
      },
      root: { y: keys('quadOut', [0, 0], [0.12, 0], [0.26, -16, 'quadIn'], [0.4, 0], [0.76, 0], [0.92, -20, 'quadIn'], [1.06, 0], [1.7, 0]) },
      head: { rot: keys('sineInOut', [0, 0], [0.26, -6], [0.6, 0], [0.92, 7], [1.3, 0]) },
    },
    events: [
      { t: 0.24, effect: 'notes', at: 'head', params: { side: -1, count: 2 } },
      { t: 0.9, effect: 'notes', at: 'head', params: { side: 1, count: 3 } },
    ],
  },

  leap: {
    description: 'A big frog leap: deep crouch, the hind legs kick out straight as it launches, arms reach up, legs fold back in mid-air, squashy landing with dust.',
    category: 'locomotion',
    duration: 1.7,
    fadeIn: 0.12,
    suppress: { look: true },
    expression: [[0, 'determined'], [0.24, 'excited'], [1.0, 'joyful'], [1.55, 'neutral']],
    params: {
      squash: keys('sineInOut', [0, 0], [0.28, 0.55, 'quadOut'], [0.4, -0.55], [0.62, -0.2], [0.86, -0.25], [1.02, 0.6, 'quadOut'], [1.18, -0.15], [1.34, 0.08], [1.5, 0]),
      flap: keys('sineInOut', [0, 0], [0.28, -0.6], [0.42, 1.3, 'backOut'], [0.72, 1.0], [0.92, 0.2], [1.02, -0.4], [1.2, 0.2], [1.5, 0]),
      lookY: keys('sineInOut', [0, 0], [0.28, 0.25], [0.5, -0.35], [0.8, 0.1], [1.0, 0.2], [1.3, 0]),
    },
    bones: {
      root: { y: keys('quadOut', [0, 0], [0.3, 0], [0.7, -128, 'quadIn'], [1.02, 0], [1.7, 0]) },
      head: { y: keys('sineInOut', [0, 0], [0.28, 6], [0.44, -6], [0.8, 0], [1.04, 8], [1.2, -2], [1.4, 0]) },
      ...eyeBob('l', 'y', keys('sineInOut', [0, 0], [0.3, 4], [0.45, -6], [0.75, 0], [1.03, 6], [1.25, 0])),
      ...eyeBob('r', 'y', keys('sineInOut', [0, 0], [0.3, 4], [0.45, -6], [0.75, 0], [1.03, 6], [1.25, 0])),
      ...legKeys([[0, 0], [0.28, -1, 'quadOut'], [0.36, 0.55, 'quadOut'], [0.5, 1], [0.72, 0.85], [0.96, 0, 'quadOut'], [1.06, -0.6], [1.3, 0]]),
    },
    events: [
      { t: 0.34, effect: 'puff', at: 'feet', params: { count: 5 } },
      { t: 1.02, effect: 'puff', at: 'feet', params: { count: 6 } },
    ],
  },

  'tongue-catch': {
    description: 'A fly buzzes in; Riff tracks it with its eyes, crouches, zaps it with its long tongue, gulps it down and grins.',
    category: 'gesture',
    duration: 3.1,
    fadeIn: 0.15,
    suppress: { look: true },
    // eyes stay `determined` through the zap: an eye-variant change would blink
    expression: [[0, 'neutral'], [0.95, 'determined'], [1.95, 'happy'], [2.3, 'proud'], [3.0, 'neutral']],
    slots: {
      fly: [[0, 'on'], [ZAP + 0.02, 'off']],
      tongue: [[0, 'off'], [ZAP - 0.08, 'out'], [ZAP + 0.02, 'caught'], [ZAP + 0.24, 'off']],
      mouth: [[ZAP - 0.08, 'open'], [ZAP + 0.24, '']],
      throat: gulpPouch.slots!.throat.map(([t, v]) => [t + 1.55, v] as [number, string]),
    },
    params: {
      lookX: keys('sineInOut', [0, -1.0], [0.3, -0.8], [0.55, -0.45], [0.8, -0.15], [1.0, 0.2], [1.2, 0.45], [1.35, 0.4], [ZAP, 0.38], [2.0, 0.2], [2.4, 0], [3.1, 0]),
      lookY: keys('sineInOut', [0, -0.55], [0.3, -0.7], [0.55, -0.8], [0.8, -0.7], [1.0, -0.45], [1.2, -0.15], [1.35, 0], [ZAP, 0], [2.2, 0], [3.1, 0]),
      squash: keys('sineInOut', [0, 0], [1.15, 0], [ZAP - 0.1, 0.28, 'quadOut'], [ZAP + 0.02, -0.18], [ZAP + 0.25, 0.05], [1.9, 0.18], [2.1, -0.06], [2.35, 0], [3.1, 0]),
      flap: keys('sineInOut', [0, 0], [2.25, 0], [2.5, 0.5, 'backOut'], [2.85, 0.4], [3.1, 0]),
      blink: keys('sineInOut', [0, 0], [1.9, 0], [1.98, 1], [2.08, 1], [2.16, 0]),
    },
    bones: {
      fly: { x: FLY_X, y: FLY_Y, rot: buzz(ZAP, 0.09, 9) },
      tongue: {
        rot: [[0, TONGUE_ROT]],
        sx: keys('sineInOut', [0, 0.05], [ZAP - 0.08, 0.05, 'quadOut'], [ZAP, 1, 'quadIn'], [ZAP + 0.22, 0.05]),
      },
      head: { rot: keys('sineInOut', [0, 0], [1.9, 0], [2.1, -4], [2.5, 4], [3.1, 0]) },
      throat: { sx: later(gulpPouch.bones.throat.sx!, 1.55), sy: later(gulpPouch.bones.throat.sy!, 1.55) },
    },
    events: [{ t: 2.3, effect: 'sparkles', at: 'head', params: { count: 3, size: 0.8 } }],
  },

  'lily-sit': {
    description: 'Idle variant: sits on a lily pad floating on calm water, bobbing gently, content little smile, the odd throat puff.',
    category: 'idle',
    duration: 6,
    loop: true,
    fadeIn: 0.4,
    shadow: 0,
    slots: { lilypad: [[0, 'on']], mouth: [[0, 'smile']], throat: [[0, 'off'], [3.9, 'on'], [4.7, 'off']] },
    params: {
      lean: cycle(6, [0, 0.06, 0, -0.06]),
      squash: cycle(6, [0.04, 0.08]),
      flap: cycle(6, [-0.05, 0.02]),
    },
    bones: {
      root: { y: cycle(6, [1, -1.5, 1, -0.5]), rot: cycle(6, [0, 1.2, 0, -1.2]) },
      lilypad: { sx: cycle(3, [1, 1.01]), y: cycle(6, [0, 0.5, 0, 0.3]) },
      head: { rot: cycle(6, [0, -1.5, 0, 1.5]) },
      throat: {
        sx: keys('sineInOut', [0, 0.2], [3.9, 0.2], [4.2, 0.55], [4.45, 0.4], [4.7, 0.2]),
        sy: keys('sineInOut', [0, 0.32], [3.9, 0.32], [4.2, 0.62], [4.45, 0.49], [4.7, 0.32]),
      },
    },
  },
});

/* ------------------------------------------------------------------ */
/* Riff versions of library clips                                      */
/* ------------------------------------------------------------------ */

/** Without the given bones' tracks. */
function without(clip: Clip, ...names: string[]): Clip {
  const bones = { ...(clip.bones ?? {}) };
  for (const n of names) delete bones[n];
  return { ...clip, bones };
}

/** `clip` without the `raiseL`/`raiseR` params (for Riff versions that key the arms directly). */
function withoutRaise(clip: Clip): Record<string, Keyframe[]> {
  return Object.fromEntries(Object.entries(clip.params ?? {}).filter(([k]) => !k.startsWith('raise')));
}

/** A frog's arm is far too short to reach its head: point straight out instead of a wing's angled point. */
const pointRight: Clip = {
  ...without(retargeted['point-right'], 'arm-r', 'arm-l'),
  // arms keyed directly below; the shared raise would stack on top
  params: withoutRaise(library['point-right']),
  description: 'Points to screen-right with the right front leg held straight out, leaning and looking that way (draw attention to UI on the right).',
  bones: {
    ...without(retargeted['point-right'], 'arm-r', 'arm-l').bones,
    'arm-r': {
      rot: keys('sineInOut', [0, 0], [0.14, 10], [0.32, -90, 'backOut'], [0.62, -84], [0.78, -92], [1.3, -88], [1.7, 0]),
      sy: keys('sineInOut', [0, 1], [0.32, 1.26, 'backOut'], [1.3, 1.24], [1.7, 1]),
    },
    'foot-r': { rot: keys('sineInOut', [0, 0], [0.32, -12, 'backOut'], [1.3, -10], [1.7, 0]) },
    'arm-l': { rot: keys('sineInOut', [0, 0], [0.32, -8], [1.3, -7], [1.7, 0]) },
  },
};

/** Shrug keys for one arm (1.0 → 2.1 s): out and up, palm turned up. */
function shrug(side: 'l' | 'r', s: number): Record<string, Tracks> {
  return {
    [`arm-${side}`]: {
      rot: keys('sineInOut', [0, 0], [1.0, 0], [1.22, 80 * s, 'backOut'], [1.8, 76 * s], [2.1, 0]),
      sy: keys('sineInOut', [0, 1], [1.0, 1], [1.22, 1.15], [1.8, 1.14], [2.1, 1]),
      y: keys('sineInOut', [0, 0], [1.0, 0], [1.22, -6], [1.8, -6], [2.1, 0]),
    },
    [`foot-${side}`]: { rot: keys('sineInOut', [0, 0], [1.0, 0], [1.22, -70 * s], [1.8, -66 * s], [2.1, 0]) },
  };
}

const overrides = defineClips({
  'point-right': pointRight,
  'point-left': { ...mirrorClip(pointRight, 'point-left'), description: 'Mirror of point-right: points to screen-left with the left front leg.' },

  think: {
    ...without(retargeted.think, 'arm-r', 'arm-l', 'foot-l', 'foot-r'),
    description: 'Thinking (loops): looks up and aside with a tilted head and pursed mouth, front legs tucked, one hand tapping the ground.',
    params: { ...retargeted.think.params, flap: [[0, -0.35]] },
    bones: {
      ...without(retargeted.think, 'arm-r', 'arm-l', 'foot-l', 'foot-r').bones,
      'foot-l': { y: keys('sineInOut', [0, 0], [1.8, 0], [1.9, -7], [2.0, 0], [2.1, -7], [2.2, 0], [3.2, 0]) },
    },
  },


  // One arm raised to "scratch" reads as pointing on a frog (it can't reach its head): shrug instead.
  'emote-confused': {
    ...without(retargeted['emote-confused'], 'arm-r', 'arm-l', 'foot-r'),
    description: 'Confused: tilts its head one way then the other with a squint, then a big two-armed shrug; a "?" pops up.',
    params: withoutRaise(library['emote-confused']),
    bones: {
      ...without(retargeted['emote-confused'], 'arm-r', 'arm-l', 'foot-r').bones,
      ...shrug('l', 1),
      ...shrug('r', -1),
    },
  },
});

/** All Riff clips: re-targeted wing clips, Riff versions, and Riff-only clips (in that override order). */
export const riffClips: Record<string, Clip> = { ...retargeted, ...overrides, ...ownClips };

