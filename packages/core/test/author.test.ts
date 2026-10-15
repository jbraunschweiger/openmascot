import { describe, expect, it } from 'vitest';
import { cycle, defineClip, defineClips, keys, mirrorClip, sequence, wave } from '../src/author';
import { lintClip, sampleClip, sampleTrack } from '../src/clip';
import { emptyPose } from '../src/pose';
import { rng } from '../src/effects';
import type { Clip } from '../src/types';

const ctx = { duration: 1, secondsPerUnit: 1, random: rng(1) };

describe('defineClip / defineClips', () => {
  it('are identity helpers; defineClips fills in names', () => {
    const c: Clip = { duration: 1 };
    expect(defineClip(c)).toBe(c);
    const lib = defineClips({ a: { duration: 1 }, b: { name: 'custom', duration: 2 } });
    expect(lib.a.name).toBe('a');
    expect(lib.b.name).toBe('custom');
  });
});

describe('cycle', () => {
  it('spaces keys evenly and closes the loop on the first value', () => {
    expect(cycle(2, [0, 10, 0, -10])).toEqual([
      [0, 0, 'sineInOut'],
      [0.5, 10, 'sineInOut'],
      [1, 0, 'sineInOut'],
      [1.5, -10, 'sineInOut'],
      [2, 0, 'sineInOut'],
    ]);
  });
  it('supports an ease and a start offset', () => {
    const k = cycle(1, [1, 2], 'linear', 3);
    expect(k).toEqual([[3, 1, 'linear'], [3.5, 2, 'linear'], [4, 1, 'linear']]);
  });
  it('loops seamlessly', () => {
    const k = cycle(4, [0, 5, -3]);
    expect(sampleTrack(k, 0)).toBe(sampleTrack(k, 4));
  });
});

describe('keys', () => {
  it('applies a shared ease with per-key overrides', () => {
    expect(keys('backOut', [0, 0], [0.3, 20], [1, 0, 'linear'])).toEqual([
      [0, 0, 'backOut'],
      [0.3, 20, 'backOut'],
      [1, 0, 'linear'],
    ]);
  });
});

describe('wave', () => {
  it('samples a sine into linear keys', () => {
    const k = wave(2, 10, { cycles: 1, steps: 4 });
    expect(k).toHaveLength(5);
    [0, 10, 0, -10, 0].forEach((v, i) => expect(k[i][1]).toBeCloseTo(v, 9));
    expect(k.every((x) => x[2] === 'linear')).toBe(true);
    expect(wave(1, 1, { offset: 5 })[0][1]).toBe(5);
  });
});

describe('mirrorClip', () => {
  const clip: Clip = {
    name: 'wave-l',
    duration: 1,
    bones: {
      'wing-l': { rot: [[0, 0], [0.5, 30, 'backOut']], y: [[0, -5]] },
      head: { yaw: [[0, 20]], x: [[0, 4]], sx: [[0, 1.2]] },
    },
    params: { lookX: [[0, 0.5]], lean: [[0, 1]], flap: [[0, 1]] },
    slots: { 'eye-l': [[0, 'happy']] },
    events: [
      { t: 0.5, effect: 'sparkles', at: 'wing-l', params: { side: -1 } },
      { t: 0.6, effect: 'puff', at: [10, 20] },
      { t: 0.7, effect: 'hearts' },
    ],
    fn: () => {},
  };
  const m = mirrorClip(clip);

  it('swaps -l/-r bones and slots', () => {
    expect(Object.keys(m.bones!)).toEqual(['wing-r', 'head']);
    expect(Object.keys(m.slots!)).toEqual(['eye-r']);
  });
  it('negates x/rot/yaw (keeping eases) and leaves other channels', () => {
    expect(m.bones!['wing-r'].rot).toEqual([[0, -0], [0.5, -30, 'backOut']]);
    expect(m.bones!['wing-r'].y).toEqual([[0, -5]]);
    expect(m.bones!.head.yaw).toEqual([[0, -20]]);
    expect(m.bones!.head.x).toEqual([[0, -4]]);
    expect(m.bones!.head.sx).toEqual([[0, 1.2]]);
  });
  it('negates *X params and lean only', () => {
    expect(m.params!.lookX).toEqual([[0, -0.5]]);
    expect(m.params!.lean).toEqual([[0, -1]]);
    expect(m.params!.flap).toEqual([[0, 1]]);
  });
  it('mirrors events, drops fn, names the result', () => {
    expect(m.events).toEqual([
      { t: 0.5, effect: 'sparkles', at: 'wing-r', params: { side: 1 } },
      { t: 0.6, effect: 'puff', at: [-10, 20] },
      { t: 0.7, effect: 'hearts', at: undefined },
    ]);
    expect(m.fn).toBeUndefined();
    expect(m.name).toBe('wave-l-mirror');
    expect(mirrorClip(clip, 'wave-r').name).toBe('wave-r');
  });
  it('mirroring twice restores the original data', () => {
    const mm = mirrorClip(m, clip.name);
    expect(mm.bones).toEqual(clip.bones);
    expect(mm.params).toEqual(clip.params);
    expect(mm.slots).toEqual(clip.slots);
  });
});

describe('sequence', () => {
  const a: Clip = { duration: 1, bones: { head: { rot: [[0, 0], [1, 10]] } }, params: { flap: [[0, 1]] }, expression: [[0, 'happy']], events: [{ t: 0.5, effect: 'hearts' }] };
  const b: Clip = { duration: 2, bones: { root: { y: [[0, 0], [1, -20], [2, 0]] }, head: { sx: [[0, 1.5]] } }, slots: { mouth: [[0.5, 'o']] }, events: [{ t: 1, effect: 'notes' }] };
  const s = sequence('ab', [a, b]);

  it('concatenates durations, keys, discrete tracks and events', () => {
    expect(s.name).toBe('ab');
    expect(s.duration).toBe(3);
    // parts without a key at their start reset discrete state ('' = no slot override)
    expect(s.expression).toEqual([[0, 'happy'], [1, 'neutral']]);
    expect(s.slots).toEqual({ mouth: [[0, ''], [1, ''], [1.5, 'o']] });
    expect(s.events).toEqual([{ t: 0.5, effect: 'hearts' }, { t: 2, effect: 'notes' }]);
    expect(lintClip(s)).toEqual([]);
  });

  it('inserts rest keys so channels do not leak between parts', () => {
    // head.rot ends at 10 in part a, but must be at rest during part b
    expect(sampleTrack(s.bones!.head.rot!, 0.5)).toBeCloseTo(5, 0);
    expect(sampleTrack(s.bones!.head.rot!, 2)).toBe(0);
    // root.y is only animated in b: at rest during a
    expect(s.bones!.root.y!.slice(0, 2)).toEqual([[0, 0, 'linear'], [1, 0, 'linear']]);
    expect(sampleTrack(s.bones!.root.y!, 2)).toBeCloseTo(-20);
    // head.sx is rest (1) during a, 1.5 in b
    expect(sampleTrack(s.bones!.head.sx!, 0.5)).toBe(1);
    expect(sampleTrack(s.bones!.head.sx!, 1.5)).toBe(1.5);
    // params rest at 0
    expect(sampleTrack(s.params!.flap, 2)).toBe(0);
  });

  it('discrete resets sample as "no override"', () => {
    expect(sampleClip(s, 0.5, ctx).slots).toEqual({});
    expect(sampleClip(s, 1.2, ctx).slots).toEqual({});
    expect(sampleClip(s, 2, ctx).slots).toEqual({ mouth: 'o' });
    expect(sampleClip(s, 2, ctx).expression).toBe('neutral');
  });

  it('does not add expression resets when no part uses expressions', () => {
    expect(sequence('x', [{ duration: 1 }, { duration: 1 }]).expression).toEqual([]);
  });

  it('keeps keys sorted', () => {
    for (const bone of Object.values(s.bones!))
      for (const k of Object.values(bone)) for (let i = 1; i < k!.length; i++) expect(k![i][0]).toBeGreaterThanOrEqual(k![i - 1][0]);
  });

  it('runs each part’s fn in its own local time window', () => {
    const calls: [string, number, number][] = [];
    const p1: Clip = { duration: 1, fn: (t, _o, c) => calls.push(['p1', t, c.duration]) };
    const p2: Clip = { duration: 2, fn: (t, _o, c) => calls.push(['p2', t, c.duration]) };
    const q = sequence('q', [p1, p2]);
    sampleClip(q, 0.25, ctx, emptyPose());
    sampleClip(q, 2, ctx);
    expect(calls.slice(-2)).toEqual([['p1', 0.25, 1], ['p2', 1, 2]]);
  });

  it('accepts overrides and inherits units', () => {
    const beats = sequence('b', [{ duration: 4, units: 'beats', bpm: 100 }, { duration: 4, units: 'beats' }], { loop: true, duration: 6 });
    expect(beats.units).toBe('beats');
    expect(beats.bpm).toBe(100);
    expect(beats.loop).toBe(true);
    expect(beats.duration).toBe(6);
  });
});
