import { describe, expect, it } from 'vitest';
import { clipSeconds, lintClip, sampleClip, sampleTrack, secondsPerUnit } from '../src/clip';
import { EASES } from '../src/ease';
import { emptyPose } from '../src/pose';
import { rng } from '../src/effects';
import type { Clip, ClipContext, Keyframe } from '../src/types';

const ctx = (clip: Clip): ClipContext => ({ duration: clip.duration, secondsPerUnit: secondsPerUnit(clip), random: rng(1) });

describe('sampleTrack', () => {
  const k: Keyframe[] = [[1, 10, 'linear'], [2, 20, 'linear'], [4, 0]];

  it('returns 0 for an empty track', () => {
    expect(sampleTrack([], 3)).toBe(0);
  });
  it('holds the first value before the first key and the last after the last key', () => {
    expect(sampleTrack(k, 0)).toBe(10);
    expect(sampleTrack(k, -5)).toBe(10);
    expect(sampleTrack(k, 4)).toBe(0);
    expect(sampleTrack(k, 99)).toBe(0);
  });
  it('hits keys exactly and interpolates linearly', () => {
    expect(sampleTrack(k, 1)).toBe(10);
    expect(sampleTrack(k, 2)).toBe(20);
    expect(sampleTrack(k, 1.5)).toBe(15);
    expect(sampleTrack(k, 1.25)).toBe(12.5);
  });
  it('uses the ease of the key that starts the segment (default sineInOut)', () => {
    expect(sampleTrack(k, 3)).toBeCloseTo(20 - 20 * EASES.sineInOut(0.5));
    const q: Keyframe[] = [[0, 0, 'quadIn'], [1, 100]];
    expect(sampleTrack(q, 0.5)).toBeCloseTo(25);
    const b: Keyframe[] = [[0, 0, [0, 0, 1, 1]], [1, 100]];
    expect(sampleTrack(b, 0.3)).toBeCloseTo(30, 3);
  });
  it('step ease holds the value until the next key', () => {
    const s: Keyframe[] = [[0, 1, 'step'], [1, 5, 'step'], [2, 9]];
    expect(sampleTrack(s, 0.99)).toBe(1);
    expect(sampleTrack(s, 1)).toBe(5);
    expect(sampleTrack(s, 1.5)).toBe(5);
    expect(sampleTrack(s, 2)).toBe(9);
  });
  it('works with many keys (binary search)', () => {
    const many: Keyframe[] = Array.from({ length: 100 }, (_, i) => [i, i * 2, 'linear']);
    expect(sampleTrack(many, 37.5)).toBe(75);
    expect(sampleTrack(many, 98.25)).toBe(196.5);
  });
  it('single-key tracks hold that value', () => {
    expect(sampleTrack([[0.5, 7]], 0)).toBe(7);
    expect(sampleTrack([[0.5, 7]], 9)).toBe(7);
  });
});

describe('units', () => {
  it('seconds clips use 1 s per unit', () => {
    const c: Clip = { duration: 3 };
    expect(secondsPerUnit(c)).toBe(1);
    expect(clipSeconds(c)).toBe(3);
  });
  it('beat clips use bpm (default 120) and accept an override', () => {
    const c: Clip = { duration: 8, units: 'beats' };
    expect(secondsPerUnit(c)).toBe(0.5);
    expect(clipSeconds(c)).toBe(4);
    expect(clipSeconds({ ...c, bpm: 60 })).toBe(8);
    expect(clipSeconds({ ...c, bpm: 60 }, 240)).toBe(2);
  });
});

describe('sampleClip', () => {
  const clip: Clip = {
    duration: 2,
    bones: { head: { rot: [[0, 0, 'linear'], [2, 20]], x: [] }, body: { sx: [[0, 1.5]] } },
    params: { lookX: [[0, -1, 'linear'], [2, 1]] },
    expression: [[0, 'happy'], [1, 'sad']],
    slots: { mouth: [[0.5, 'open'], [1.5, 'closed']] },
  };

  it('samples bones, params, expressions and slots', () => {
    const p = sampleClip(clip, 1, ctx(clip));
    expect(p.bones.head.rot).toBe(10);
    expect('x' in p.bones.head).toBe(false); // empty tracks are skipped
    expect(p.bones.body.sx).toBe(1.5);
    expect(p.params.lookX).toBe(0);
    expect(p.expression).toBe('sad'); // step: changes exactly at its key
    expect(p.slots.mouth).toBe('open');
  });

  it('expression and slot tracks are steps that hold', () => {
    expect(sampleClip(clip, 0, ctx(clip)).expression).toBe('happy');
    expect(sampleClip(clip, 0.999, ctx(clip)).expression).toBe('happy');
    expect(sampleClip(clip, 2, ctx(clip)).expression).toBe('sad');
    // before the first slot key: no override at all
    expect(sampleClip(clip, 0.2, ctx(clip)).slots).toEqual({});
    expect(sampleClip(clip, 1.9, ctx(clip)).slots.mouth).toBe('closed');
  });

  it('runs the procedural fn after keyframes, with the context', () => {
    let seen: ClipContext | undefined;
    const c: Clip = {
      duration: 1,
      bones: { head: { rot: [[0, 5]] } },
      fn: (t, out, cx) => {
        seen = cx;
        out.bones.head.rot! += t * 10;
      },
    };
    const p = sampleClip(c, 0.5, ctx(c));
    expect(p.bones.head.rot).toBe(10);
    expect(seen?.duration).toBe(1);
  });

  it('writes into a provided pose', () => {
    const out = emptyPose();
    out.params.keep = 3;
    const res = sampleClip(clip, 0, ctx(clip), out);
    expect(res).toBe(out);
    expect(out.params.keep).toBe(3);
  });

  it('beat clips are sampled in beats', () => {
    const c: Clip = { duration: 4, units: 'beats', bpm: 100, bones: { root: { y: [[0, 0, 'linear'], [4, -40]] } } };
    expect(sampleClip(c, 2, ctx(c)).bones.root.y).toBe(-20);
  });
});

describe('lintClip', () => {
  it('accepts a good clip', () => {
    const c: Clip = { duration: 1, bones: { head: { rot: [[0, 0], [1, 5, 'backOut']] } }, params: { lookX: [[0, 1, [0.1, 0.2, 0.3, 0.4]]] } };
    expect(lintClip(c, new Set(['head']), new Set(['lookX']))).toEqual([]);
  });

  it('reports every class of problem', () => {
    const c = {
      duration: 1,
      bones: {
        head: { rot: [[0.5, 0], [0.2, 1]] },
        tail: { x: [[0, 0], [2, 1]] },
        body: { y: [[0, 'x'], [0.1]] },
        ear: { rot: [[0, 0, 'wobble']] },
      },
      params: { lookZ: [[-1, 0]] },
    } as unknown as Clip;
    const p = lintClip(c, new Set(['head', 'body', 'ear']), new Set(['lookX']));
    expect(p).toContain('head.rot: keys not sorted by time at 1');
    expect(p).toContain('unknown bone "tail"');
    expect(p).toContain('tail.x: key time 2 outside [0, 1]');
    expect(p).toContain('body.y: key 0 is malformed');
    expect(p).toContain('body.y: key 1 is malformed');
    expect(p).toContain('ear.rot: Unknown ease "wobble"');
    expect(p).toContain('unknown param "lookZ"');
    expect(p).toContain('param lookZ: key time -1 outside [0, 1]');
  });

  it('requires a positive duration', () => {
    expect(lintClip({ duration: 0 })).toContain('duration must be > 0');
    expect(lintClip({ duration: NaN })).toContain('duration must be > 0');
  });

  it('skips name checks when no sets are given', () => {
    expect(lintClip({ duration: 1, bones: { anything: { x: [[0, 1]] } }, params: { p: [[0, 1]] } })).toEqual([]);
  });
});
