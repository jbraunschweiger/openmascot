/**
 * Echo the bat — OpenMascot's first character.
 *
 * Art: ./echo.svg (rig-annotated, see docs/rig-format.md).
 * Animations come from the shared library (../library) plus Echo-only clips.
 */
import type { Channel, CharacterDef, ParamDriver } from '@openmascot/core';
import svg from './art.generated';
import { library } from '../library';
import { echoClips } from './clips';

export const echoExpressions: CharacterDef['expressions'] = {
  neutral: { 'eye-l': 'open', 'eye-r': 'open', mouth: 'default', blush: 'off' },
  happy: { 'eye-l': 'happy', 'eye-r': 'happy', mouth: 'smile' },
  joyful: { 'eye-l': 'happy', 'eye-r': 'happy', mouth: 'open' },
  excited: { 'eye-l': 'open', 'eye-r': 'open', mouth: 'open' },
  love: { 'eye-l': 'happy', 'eye-r': 'happy', mouth: 'smile', blush: 'on' },
  inlove: { 'eye-l': 'heart', 'eye-r': 'heart', mouth: 'open', blush: 'on' },
  unimpressed: { 'eye-l': 'half', 'eye-r': 'half', mouth: 'default' },
  playful: { 'eye-l': 'open', 'eye-r': 'happy', mouth: 'tongue' },
  wink: { 'eye-l': 'open', 'eye-r': 'happy', mouth: 'smile' },
  determined: { 'eye-l': 'angry', 'eye-r': 'angry', mouth: 'default' },
  sad: { 'eye-l': 'sad', 'eye-r': 'sad', mouth: 'frown' },
  surprised: { 'eye-l': 'surprised', 'eye-r': 'surprised', mouth: 'o' },
  singing: { 'eye-l': 'open', 'eye-r': 'open', mouth: 'o' },
  dizzy: { 'eye-l': 'dizzy', 'eye-r': 'dizzy', mouth: 'grin' },
  sleepy: { 'eye-l': 'closed', 'eye-r': 'closed', mouth: 'default' },
  proud: { 'eye-l': 'happy', 'eye-r': 'happy', mouth: 'grin' },
};

/** Fold keys per wing bone: [fold, value] (left wing; the right wing mirrors rot/yaw/x). */
const FOLD: Record<string, Partial<Record<'rot' | 'yaw' | 'sx' | 'sy' | 'x' | 'y' | 'dz', [number, number][]>>> = {
  'wing-l': {
    rot: [[0, 0], [0.5, -10], [1, -2]],
    yaw: [[0, 0], [0.5, -14], [1, -40]],
    sx: [[0, 0], [0.5, -0.14], [1, -0.67]],
    sy: [[0, 0], [0.5, -0.14], [1, -0.67]],
  },
  'wing-hand-l': {
    rot: [[0, 0], [0.5, 2], [1, 2]],
    sx: [[0, 0], [0.5, 0.02], [1, 0.75]],
    sy: [[0, 0], [0.5, 0.12], [1, 1.4]],
  },
  'wing-tip-l': {
    rot: [[0, 0], [0.5, -24], [1, -15]],
  },
};

function wingFoldDrives(): ParamDriver[] {
  const out: ParamDriver[] = [];
  for (const [bone, chans] of Object.entries(FOLD)) {
    for (const [channel, curve] of Object.entries(chans) as [Channel, [number, number][]][]) {
      out.push({ bone, channel, curve });
      const flip = channel === 'rot' || channel === 'yaw' || channel === 'x';
      out.push({ bone: bone.replace(/-l$/, '-r'), channel, curve: flip ? curve.map(([a, b]) => [a, -b] as [number, number]) : curve });
    }
  }
  return out;
}

export const echo: CharacterDef = {
  id: 'echo',
  name: 'Echo',
  svg,
  expressions: echoExpressions,
  params: {
    /** Look left/right (-1..1): head turns in pseudo-3D, pupils lead. */
    lookX: {
      min: -1.5,
      max: 1.5,
      drives: [
        { bone: 'head', channel: 'yaw', k: 24 },
        { bone: 'head', channel: 'x', k: 3 },
        { bone: 'body', channel: 'yaw', k: 6 },
        { bone: 'pupil-l', channel: 'x', k: 4.5 },
        { bone: 'pupil-r', channel: 'x', k: 4.5 },
      ],
    },
    /** Look up/down (-1..1, + = down). */
    lookY: {
      min: -1.5,
      max: 1.5,
      drives: [
        { bone: 'head', channel: 'pitch', k: 14 },
        { bone: 'head', channel: 'y', k: 2 },
        { bone: 'pupil-l', channel: 'y', k: 4 },
        { bone: 'pupil-r', channel: 'y', k: 4 },
      ],
    },
    /** Eyelid close 0..1. */
    blink: {
      min: 0,
      max: 1,
      drives: [
        { bone: 'eye-l', channel: 'sy', k: -0.9 },
        { bone: 'eye-r', channel: 'sy', k: -0.9 },
      ],
    },
    /** Breathing cycle -1..1. */
    breathe: {
      drives: [
        { bone: 'body', channel: 'sy', k: 0.012 },
        { bone: 'body', channel: 'sx', k: -0.006 },
        { bone: 'head', channel: 'y', k: -1.6 },
        { bone: 'wing-l', channel: 'rot', k: 1.6 },
        { bone: 'wing-r', channel: 'rot', k: -1.6 },
      ],
    },
    /** Squash (+) / stretch (−) from the ground, volume-preserving-ish. */
    squash: {
      min: -1,
      max: 1,
      drives: [
        { bone: 'root', channel: 'sy', k: -0.2 },
        { bone: 'root', channel: 'sx', k: 0.16 },
      ],
    },
    /** Wing flap: +1 = both wings up, −1 = down/forward. */
    flap: {
      min: -1.5,
      max: 1.5,
      drives: [
        // Linear to ±1, then wings sweep much higher for "wings overhead" poses.
        { bone: 'wing-l', channel: 'rot', curve: [[-1.5, -48], [0, 0], [1, 34], [1.5, 68]] },
        { bone: 'wing-r', channel: 'rot', curve: [[-1.5, 48], [0, 0], [1, -34], [1.5, -68]] },
        { bone: 'wing-l', channel: 'sx', curve: [[-1, -0.28], [0, 0], [1, -0.08]] },
        { bone: 'wing-r', channel: 'sx', curve: [[-1, -0.28], [0, 0], [1, -0.08]] },
      ],
    },
    /**
     * Wing fold: 0 = fully spread (as drawn), ~0.45 = relaxed (resting, wings
     * half-tucked against the flanks), 1 = folded tight like a cloak. Driven
     * entirely by the wing bone chain (arm → hand → tip) — no art swap.
     */
    wingFold: {
      min: 0,
      max: 1,
      drives: wingFoldDrives(),
    },
    /** Lean the whole body (-1..1 → ±12°). */
    lean: {
      min: -1.5,
      max: 1.5,
      drives: [{ bone: 'body', channel: 'rot', k: 12 }],
    },
  },
  clips: { ...library, ...echoClips },
  anchors: {
    head: { bone: 'head', offset: [0, -10] },
    mouth: { bone: 'mouth' },
    feet: { bone: 'root' },
  },
  idle: {
    clip: 'idle',
    blinkEvery: 3.2,
    fidgetEvery: 7,
    fidgets: ['fidget-ear-twitch', 'fidget-look-around', 'fidget-wing-stretch', 'fidget-hop'],
  },
  palette: {
    body: '#634c91',
    bodyLow: '#675196',
    belly: '#7e62ae',
    snout: '#e386ba',
    wingRim: '#6a529c',
    wingDark: '#513f75',
  },
  meta: {
    description: 'A cheerful purple bat who loves music. Pig snout, tiny fangs, huge wings.',
    license: 'MIT',
  },
};

export default echo;
export { library };
