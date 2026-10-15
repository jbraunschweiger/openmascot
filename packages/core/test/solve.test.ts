import { describe, expect, it } from 'vitest';
import { echo } from '@openmascot/characters';
import { apply, isIdentity, scaleOf } from '../src/mat';
import { emptyPose, resolvePose } from '../src/pose';
import { compileRig } from '../src/rig';
import { bonePosition, solve, type SolveOptions } from '../src/solve';
import type { BoneNode, Frame, Pose, Rig } from '../src/types';

const rig = compileRig(echo.svg);

function frameFor(bones: Pose['bones'] = {}, opts?: SolveOptions, params: Record<string, number> = {}): Frame {
  const r = resolvePose(echo, rig, { ...emptyPose(), bones, params });
  return solve(rig, { channels: r.channels, slots: r.slots }, opts);
}
const B = (name: string): BoneNode => rig.bonesByName[name][0];
const solved = (f: Frame, name: string) => f.bones[B(name).bi];
const pos = (f: Frame, name: string) => bonePosition(rig, f, name)!;
const det = (m: number[]) => m[0] * m[3] - m[1] * m[2];

describe('solve: rest pose', () => {
  const f = frameFor();

  it('solves every bone instance (including those in hidden variants)', () => {
    expect(f.bones).toHaveLength(rig.bones.length);
    for (let i = 0; i < rig.bones.length; i++) expect(f.bones[i], rig.bones[i].name).toBeDefined();
  });

  it('every visible Echo bone has an identity local matrix at rest (rest = the drawing)', () => {
    for (const b of rig.bones) {
      const s = f.bones[b.bi];
      if (b.surface === 'back') continue; // culled at rest, see below
      expect(isIdentity(s.local, 1e-9), `${b.name} local ${s.local.join(' ')}`).toBe(true);
      expect(isIdentity(s.world, 1e-9), `${b.name} world`).toBe(true);
      expect(s.opacity, b.name).toBe(1);
    }
  });

  it('back surfaces are hidden at rest', () => {
    for (const b of rig.bones.filter((x) => x.surface === 'back')) expect(f.bones[b.bi].opacity, b.name).toBe(0);
    expect(rig.bones.some((b) => b.surface === 'back')).toBe(true);
  });

  it('keeps document order at rest (no reordering)', () => {
    expect(f.order.size).toBe(0);
  });

  it('bonePosition returns the rest pivot (plus offset)', () => {
    expect(pos(f, 'head')).toEqual(B('head').pivot);
    expect(bonePosition(rig, f, 'head', [0, -10])).toEqual([B('head').pivot[0], B('head').pivot[1] - 10]);
    expect(bonePosition(rig, f, 'nope')).toBeUndefined();
  });

  it('reuses the bones array of a previous frame', () => {
    const g = solve(rig, { channels: new Map(), slots: {} }, {}, f);
    expect(g.bones).toBe(f.bones);
  });
});

describe('solve: 2D channels', () => {
  it('translates, rotates and scales about the pivot', () => {
    const f = frameFor({ head: { rot: 90, x: 5 } });
    const head = B('head');
    expect(pos(f, 'head')[0]).toBeCloseTo(head.pivot[0] + 5);
    expect(pos(f, 'head')[1]).toBeCloseTo(head.pivot[1]);
    // children inherit: the nose pivot (below the head pivot) swings to the left
    expect(pos(f, 'nose')[0]).toBeLessThan(head.pivot[0]);
    const g = frameFor({ root: { sx: 2, sy: 2 } }, { focal: 0 });
    expect(scaleOf(solved(g, 'head').world)).toBeCloseTo(2);
  });

  it('opacity is per bone (renderers multiply it down the tree)', () => {
    const f = frameFor({ head: { opacity: 0.5 } });
    expect(solved(f, 'head').opacity).toBe(0.5);
    expect(solved(f, 'nose').opacity).toBe(1);
  });

  it('extraRot (springs) adds rotation and records the rigid transform', () => {
    const r = resolvePose(echo, rig, emptyPose());
    const f = solve(rig, { channels: r.channels, slots: r.slots, extraRot: { 'wing-l': 20 } });
    const w = solved(f, 'wing-l');
    expect(isIdentity(w.local)).toBe(false);
    expect(w.rigid).toBeDefined();
    expect(isIdentity(w.rigid!)).toBe(true);
  });
});

describe('solve: pseudo-3D', () => {
  it('yaw creates parallax: near features slide toward the turn, far ones away', () => {
    const rest = frameFor();
    const f = frameFor({ head: { yaw: 30 } });
    const dx = (n: string) => pos(f, n)[0] - pos(rest, n)[0];
    expect(dx('nose')).toBeGreaterThan(20); // z +66: moves right
    expect(dx('eye-l')).toBeGreaterThan(5);
    expect(dx('ear-r')).toBeLessThan(-3); // behind & to the right: moves left
    expect(dx('head')).toBeCloseTo(0); // the turning bone itself stays put
    expect(solved(f, 'nose').yaw).toBe(30);
    expect(solved(f, 'head').yaw).toBe(30);
  });

  it('pitch nods: near features move down when pitching down', () => {
    const rest = frameFor();
    const f = frameFor({ head: { pitch: 20 } });
    expect(pos(f, 'nose')[1]).toBeGreaterThan(pos(rest, 'nose')[1] + 10);
    expect(solved(f, 'eye-l').pitch).toBe(20);
  });

  it('a full 360° turn is the rest pose again', () => {
    const f = frameFor({ root: { yaw: 360 } });
    const rest = frameFor();
    for (const b of rig.bones) {
      const a = f.bones[b.bi];
      const r = rest.bones[b.bi];
      a.local.forEach((v, i) => expect(v, `${b.name}[${i}]`).toBeCloseTo(r.local[i], 6));
      expect(a.opacity).toBeCloseTo(r.opacity, 6);
    }
  });

  it('face surfaces are culled when turned away; back surfaces appear', () => {
    const f = frameFor({ root: { yaw: 180 } });
    for (const n of ['eye-l', 'eye-r', 'mouth', 'belly', 'ear-l-inner']) expect(solved(f, n).opacity, n).toBe(0);
    for (const n of ['body-back', 'head-back']) expect(solved(f, n).opacity, n).toBeGreaterThan(0.9);
    // features (snout) are never culled, only occluded by depth
    expect(solved(f, 'nose').opacity).toBe(1);
  });

  it('face surfaces fade gradually, not abruptly', () => {
    const o = [0, 45, 80, 100, 135].map((y) => solved(frameFor({ root: { yaw: y } }), 'mouth').opacity);
    expect(o[0]).toBe(1);
    for (let i = 1; i < o.length; i++) expect(o[i]).toBeLessThanOrEqual(o[i - 1]);
    expect(o[4]).toBe(0);
  });

  it('flat surfaces foreshorten with cos(yaw) and mirror from behind', () => {
    const at = (y: number) => solved(frameFor({ root: { yaw: y } }, { focal: 0 }), 'wing-l');
    expect(at(60).local[0]).toBeCloseTo(0.5, 6);
    expect(det(at(60).world)).toBeGreaterThan(0);
    const back = at(180);
    expect(back.local[0]).toBeCloseTo(-1, 6);
    expect(det(back.world)).toBeLessThan(0); // mirrored
    expect(back.opacity).toBe(1);
    // Echo's wings set data-om-flat-min="0.1": edge-on they keep a thin,
    // opaque sliver instead of fading out (see 'solve: rig features')
    expect(at(90).opacity).toBe(1);
    expect(Math.abs(at(90).local[0])).toBeCloseTo(0.1, 6);
  });

  it('re-sorts by depth: wings (z −20) draw in front of the body when seen from behind', () => {
    const body = B('body');
    const wingIdx = body.children.findIndex((c) => c.kind === 'bone' && c.name === 'wing-l');
    const artIdx = body.children.findIndex((c) => c.kind === 'art');
    expect(wingIdx).toBeGreaterThanOrEqual(0);
    expect(artIdx).toBeGreaterThan(wingIdx); // document order: wing behind the body art

    const f = frameFor({ root: { yaw: 180 } });
    const order = f.order.get(body.index);
    expect(order).toBeDefined();
    expect(order!.indexOf(wingIdx)).toBeGreaterThan(order!.indexOf(artIdx));
    expect([...order!].sort((a, b) => a - b)).toEqual(body.children.map((_, i) => i)); // a permutation
  });

  it('perspective: moving toward the camera enlarges, away shrinks; focal 0 disables it', () => {
    expect(scaleOf(solved(frameFor({ head: { dz: 100 } }), 'head').local)).toBeGreaterThan(1.05);
    expect(scaleOf(solved(frameFor({ head: { dz: -100 } }), 'head').local)).toBeLessThan(0.95);
    expect(scaleOf(solved(frameFor({ head: { dz: 100 } }, { focal: 0 }), 'head').local)).toBeCloseTo(1, 9);
    // turning around moves the snout away from the camera: it gets smaller
    expect(scaleOf(solved(frameFor({ root: { yaw: 180 } }), 'nose').world)).toBeLessThan(1);
  });

  it('a lookX param drives the head yaw through the character definition', () => {
    const f = frameFor({}, undefined, { lookX: 1 });
    expect(solved(f, 'head').yaw).toBeGreaterThan(20);
    // pupils lead the turn
    const rest = frameFor();
    expect(apply(solved(f, 'pupil-l').world, ...B('pupil-l').pivot)[0]).toBeGreaterThan(pos(rest, 'pupil-l')[0]);
  });
});

describe('solve: small rigs', () => {
  const r: Rig = compileRig(
    `<svg viewBox="0 0 10 10"><g data-om-bone="root"><g data-om-bone="a" data-om-z="-10"/><g data-om-bone="c"/><g data-om-bone="d"/><g data-om-bone="b" data-om-z="10"/></g></svg>`,
  );
  const rootIdx = r.bonesByName.root[0].index;
  const at = (yaw: number) =>
    solve(r, { channels: new Map([['root', { x: 0, y: 0, rot: 0, sx: 1, sy: 1, yaw, pitch: 0, dz: 0, opacity: 1 }]]), slots: {} });

  it('omits the order of containers that are already sorted', () => {
    expect(at(0).order.has(rootIdx)).toBe(false);
  });

  it('records a stable permutation when depth order flips (ties keep document order)', () => {
    expect(at(180).order.get(rootIdx)).toEqual([3, 1, 2, 0]);
  });
});
