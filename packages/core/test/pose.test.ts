import { describe, expect, it } from 'vitest';
import { addChannel, addParam, blendPoses, clonePose, emptyPose, layerPose, piecewise, resolvePose, setChannel } from '../src/pose';
import { compileRig } from '../src/rig';
import type { Pose } from '../src/types';
import { REST } from '../src/types';
import { testCharacter } from './fixtures';

const pose = (p: Partial<Pose>): Pose => ({ ...emptyPose(), ...p });

describe('pose basics', () => {
  it('emptyPose / clonePose produce independent copies', () => {
    const a = pose({ bones: { head: { rot: 5 } }, params: { lookX: 1 }, slots: { mouth: 'o' }, expression: 'happy' });
    const b = clonePose(a);
    expect(b).toEqual(a);
    b.bones.head.rot = 9;
    b.params.lookX = 0;
    b.slots.mouth = 'x';
    expect(a.bones.head.rot).toBe(5);
    expect(a.params.lookX).toBe(1);
    expect(a.slots.mouth).toBe('o');
  });

  it('setChannel / addChannel / addParam', () => {
    const p = emptyPose();
    setChannel(p, 'head', 'rot', 3);
    addChannel(p, 'head', 'rot', 2);
    addChannel(p, 'head', 'sx', 2);
    addChannel(p, 'head', 'sx', 1.5);
    addChannel(p, 'body', 'opacity', 0.5);
    addParam(p, 'lookX', 0.25);
    addParam(p, 'lookX', 0.25);
    expect(p.bones.head).toEqual({ rot: 5, sx: 3 });
    expect(p.bones.body.opacity).toBe(0.5);
    expect(p.params.lookX).toBe(0.5);
  });
});

describe('blendPoses', () => {
  const a = pose({ bones: { head: { rot: 10 } }, params: { lookX: 1 }, slots: { mouth: 'a', eye: 'a' }, expression: 'happy' });
  const b = pose({ bones: { head: { sx: 2 }, body: { y: -10 } }, params: { flap: 1 }, slots: { mouth: 'b' }, expression: 'sad' });

  it('w ≤ 0 and w ≥ 1 return copies of the endpoints', () => {
    expect(blendPoses(a, b, 0)).toEqual(a);
    expect(blendPoses(a, b, -1)).not.toBe(a);
    expect(blendPoses(a, b, 1)).toEqual(b);
  });

  it('missing channels blend from/to rest', () => {
    const m = blendPoses(a, b, 0.5);
    expect(m.bones.head.rot).toBe(5); // 10 → rest 0
    expect(m.bones.head.sx).toBe(1.5); // rest 1 → 2
    expect(m.bones.body.y).toBe(-5);
    expect(m.params).toEqual({ lookX: 0.5, flap: 0.5 });
  });

  it('switches discrete state at w = 0.5', () => {
    const lo = blendPoses(a, b, 0.49);
    expect(lo.expression).toBe('happy');
    expect(lo.slots).toEqual({ mouth: 'a', eye: 'a' });
    const hi = blendPoses(a, b, 0.5);
    expect(hi.expression).toBe('sad');
    expect(hi.slots).toEqual({ mouth: 'b', eye: 'a' });
  });

  it('keeps the other expression when the dominant pose has none', () => {
    expect(blendPoses(a, pose({}), 0.9).expression).toBe('happy');
  });
});

describe('layerPose', () => {
  it('adds offsets, multiplies scales, adds params, weights everything', () => {
    const base = pose({ bones: { head: { rot: 10, sx: 2 } }, params: { lookX: 1 } });
    const add = pose({ bones: { head: { rot: 4, sx: 1.5, opacity: 0.5 } }, params: { lookX: 1, flap: 2 } });
    layerPose(base, add, 0.5);
    expect(base.bones.head.rot).toBe(12);
    expect(base.bones.head.sx).toBe(2 * 1.25);
    expect(base.bones.head.opacity).toBe(0.75);
    expect(base.params).toEqual({ lookX: 1.5, flap: 1 });
  });

  it('only overrides slots/expression at weight ≥ 0.5', () => {
    const add = pose({ slots: { mouth: 'o' }, expression: 'sad' });
    expect(layerPose(pose({}), add, 0.4).slots).toEqual({});
    const full = layerPose(pose({ expression: 'happy' }), add);
    expect(full.slots).toEqual({ mouth: 'o' });
    expect(full.expression).toBe('sad');
  });
});

describe('piecewise', () => {
  const c: [number, number][] = [[-1, -10], [0, 0], [2, 4]];
  it('clamps to the end values and interpolates between', () => {
    expect(piecewise(c, -5)).toBe(-10);
    expect(piecewise(c, 9)).toBe(4);
    expect(piecewise(c, -0.5)).toBe(-5);
    expect(piecewise(c, 1)).toBe(2);
    expect(piecewise([], 1)).toBe(0);
  });
});

describe('resolvePose', () => {
  const rig = compileRig(testCharacter.svg);
  const resolve = (p: Partial<Pose>) => resolvePose(testCharacter, rig, pose(p));

  it('produces rest channels and default slots for an empty pose', () => {
    const r = resolve({});
    // neutral overrides the mouth's declared default (smile → flat)
    expect(r.slots).toEqual({ 'eye-l': 'open', mouth: 'flat' });
    expect(r.params).toEqual({ lookX: 0, blink: 0, breathe: 0, squash: 0 });
    for (const [, c] of r.channels) expect(c).toEqual(REST);
  });

  it('copies bone channels and fills the rest', () => {
    const r = resolve({ bones: { head: { rot: 7 } } });
    expect(r.channels.get('head')).toEqual({ ...REST, rot: 7 });
  });

  it('applies linear param drivers on top of bone channels (k defaults to 1)', () => {
    const r = resolve({ bones: { head: { yaw: 5 } }, params: { lookX: 0.5 } });
    expect(r.channels.get('head')!.yaw).toBe(15);
    expect(r.channels.get('pupil-l')!.x).toBe(1.5);
    const r2 = resolvePose({ params: { p: { drives: [{ bone: 'body', channel: 'x' }] } }, expressions: {} }, rig, pose({ params: { p: 3 } }));
    expect(r2.channels.get('body')!.x).toBe(3);
  });

  it('applies curve drivers', () => {
    expect(resolve({ params: { squash: 0.5 } }).channels.get('root')!.sy).toBeCloseTo(0.9);
    expect(resolve({ params: { squash: -1 } }).channels.get('root')!.sy).toBeCloseTo(1.2);
  });

  it('clamps params to min/max', () => {
    const r = resolve({ params: { lookX: 5, blink: -2 } });
    expect(r.params.lookX).toBe(1);
    expect(r.params.blink).toBe(0);
    expect(r.channels.get('head')!.yaw).toBe(20);
  });

  it('passes through unknown params', () => {
    expect(resolve({ params: { custom: 4 } }).params.custom).toBe(4);
  });

  it('resolves expressions to slots, over neutral, under explicit slot overrides', () => {
    expect(resolve({ expression: 'happy' }).slots).toEqual({ 'eye-l': 'happy', mouth: 'smile' });
    // partial expression: unspecified slots come from neutral
    expect(resolve({ expression: 'shocked' }).slots).toEqual({ 'eye-l': 'wide', mouth: 'flat' });
    expect(resolve({ expression: 'happy', slots: { mouth: 'flat' } }).slots).toEqual({ 'eye-l': 'happy', mouth: 'flat' });
  });

  it('ignores unknown expressions and falls back to the default for unknown variants', () => {
    expect(resolve({ expression: 'nope' }).slots).toEqual({ 'eye-l': 'open', mouth: 'flat' });
    expect(resolve({ slots: { 'eye-l': 'typo', mouth: 'also-typo' } }).slots).toEqual({ 'eye-l': 'open', mouth: 'smile' });
  });

  it('works without params or a neutral expression', () => {
    const r = resolvePose({ expressions: {} }, rig, pose({}));
    expect(r.slots).toEqual({ 'eye-l': 'open', mouth: 'smile' });
    expect(r.params).toEqual({});
  });
});
