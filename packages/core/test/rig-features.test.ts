/**
 * Engine features added for multi-bone wings and sorting fixes:
 * data-om-sort-z, data-om-pin (skins), data-om-flat-min, data-om-feature-min,
 * data-om-spring-limit, normal-aware child sorting, parallax under flat
 * parents, and CharacterDef.effectParams.
 */
import { describe, expect, it } from 'vitest';
import { angleOf, apply, isIdentity } from '../src/mat';
import { Mascot } from '../src/mascot';
import { emptyPose, resolvePose } from '../src/pose';
import { compileRig, RigError, type RigWarning } from '../src/rig';
import { solve } from '../src/solve';
import type { BoneChannels, CharacterDef, Frame, Rig } from '../src/types';
import { REST } from '../src/types';

const svg = (inner: string) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="-200 -200 400 220">${inner}</svg>`;

function compile(src: string) {
  const warnings: RigWarning[] = [];
  return { rig: compileRig(src, { warnings }), warnings: warnings.map((w) => w.message) };
}

function frame(rig: Rig, bones: Record<string, Partial<BoneChannels>> = {}, focal = 0): Frame {
  const channels = new Map<string, BoneChannels>();
  for (const [k, v] of Object.entries(bones)) channels.set(k, { ...REST, ...v });
  return solve(rig, { channels, slots: {} }, { focal });
}
const bi = (rig: Rig, name: string) => rig.bonesByName[name][0].bi;
const world = (rig: Rig, f: Frame, name: string, x: number, y: number) => apply(f.bones[bi(rig, name)].world, x, y);
const order = (rig: Rig, f: Frame, container: string) => {
  const c = rig.bonesByName[container][0];
  const o = f.order.get(c.index) ?? c.children.map((_, i) => i);
  return o.map((i) => {
    const n = c.children[i];
    return n.kind === 'bone' ? n.name : n.kind;
  });
};

describe('data-om-sort-z', () => {
  // A big head on a body: its pivot is barely in front of the body, but its
  // chin overlaps the chest. sort-z sorts by that surface instead.
  const SRC = (sortZ: string) =>
    svg(`<g data-om-bone="root"><g data-om-bone="body" data-om-pivot="0 -60">
      <circle cy="-60" r="50"/>
      <g data-om-bone="chest" data-om-pivot="0 -40" data-om-z="40" data-om-surface="face" ${sortZ ? 'data-om-sort-z="10"' : ''}><circle cy="-40" r="10"/></g>
      <g data-om-bone="head" data-om-pivot="0 -130" data-om-z="4" ${sortZ}><circle cy="-130" r="60"/></g>
    </g></g>`);

  it('is parsed and validated against document order', () => {
    const { rig, warnings } = compile(SRC('data-om-sort-z="60"'));
    expect(rig.bonesByName.head[0].sortZ).toBe(60);
    expect(warnings).toEqual([]);
    // document order disagreeing with sort-z is reported
    const bad = compile(svg(`<g data-om-bone="root"><g data-om-bone="a" data-om-sort-z="5"/><g data-om-bone="b" data-om-z="1"/></g>`));
    expect(bad.warnings.some((w) => /z-order differs/.test(w))).toBe(true);
    expect(() => compile(svg('<g data-om-bone="root" data-om-sort-z="x"/>'))).toThrow(RigError);
  });

  it('keeps the head above the chest when the body pitches back (pivot sorting flips it)', () => {
    const plain = compile(SRC('')).rig;
    const fixed = compile(SRC('data-om-sort-z="60"')).rig;
    const pose = { body: { pitch: -12 } };
    const p = order(plain, frame(plain, pose), 'body');
    expect(p.indexOf('head')).toBeLessThan(p.indexOf('art')); // the glitch: chest/body over the chin
    const q = order(fixed, frame(fixed, pose), 'body');
    expect(q.indexOf('head')).toBeGreaterThan(q.indexOf('art'));
    expect(q.indexOf('head')).toBeGreaterThan(q.indexOf('chest'));
  });

  it('does not change parallax (the pivot still moves by z)', () => {
    const plain = compile(SRC('')).rig;
    const fixed = compile(SRC('data-om-sort-z="60"')).rig;
    const a = world(plain, frame(plain, { body: { yaw: 30 } }), 'head', 0, -130);
    const b = world(fixed, frame(fixed, { body: { yaw: 30 } }), 'head', 0, -130);
    expect(b[0]).toBeCloseTo(a[0], 9);
    expect(b[1]).toBeCloseTo(a[1], 9);
  });

  it('still sends the head behind the body from the back', () => {
    const fixed = compile(SRC('data-om-sort-z="60"')).rig;
    const q = order(fixed, frame(fixed, { root: { yaw: 180 } }), 'body');
    expect(q.indexOf('head')).toBeLessThan(q.indexOf('art'));
  });
});

describe('data-om-pin (skins)', () => {
  // arm rotates about the shoulder (-50,-80); hand at the wrist (-120,-120);
  // the skin triangle (body anchor B, shoulder S, hand point P) stays glued.
  const SRC = svg(`<g data-om-bone="root"><g data-om-bone="body" data-om-pivot="0 -60">
    <g data-om-bone="anchor" data-om-pivot="-40 -20"/>
    <g data-om-bone="arm" data-om-pivot="-50 -80" data-om-surface="flat">
      <g data-om-bone="skin" data-om-pivot="-40 -20" data-om-pin="anchor -40 -20 arm -50 -80 hand -110 -30"><path d="M-40 -20L-50 -80L-110 -30Z"/></g>
      <g data-om-bone="web" data-om-pivot="-50 -80" data-om-pin="arm -120 -120 hand -110 -30"><path d="M-50 -80L-120 -120L-110 -30Z"/></g>
      <g data-om-bone="aim" data-om-pivot="-50 -80" data-om-pin="hand -110 -30"><path d="M-50 -80L-110 -30"/></g>
      <path d="M-50 -80L-120 -120"/>
      <g data-om-bone="hand" data-om-pivot="-120 -120" data-om-surface="flat"><path d="M-120 -120L-110 -30"/></g>
    </g>
  </g></g>`);
  const { rig, warnings } = compile(SRC);

  it('parses 1–3 pins and validates targets', () => {
    expect(warnings).toEqual([]);
    expect(rig.bonesByName.skin[0].pin).toEqual([
      { bone: 'anchor', at: [-40, -20] },
      { bone: 'arm', at: [-50, -80] },
      { bone: 'hand', at: [-110, -30] },
    ]);
    expect(() => compile(svg('<g data-om-bone="root" data-om-pin="a 1"/>'))).toThrow(RigError);
    expect(() => compile(svg('<g data-om-bone="root" data-om-pin="1 2 3"/>'))).toThrow(RigError);
    expect(compile(svg('<g data-om-bone="root"><g data-om-bone="s" data-om-pin="nope 0 0"/></g>')).warnings.join()).toMatch(/unknown bone "nope"/);
    expect(compile(svg('<g data-om-bone="root"><g data-om-bone="s" data-om-pin="t 0 0"><g data-om-bone="t"/></g></g>')).warnings.join()).toMatch(/own descendant/);
  });

  it('is the identity at rest', () => {
    const f = frame(rig);
    for (const n of ['skin', 'web', 'aim']) expect(isIdentity(f.bones[bi(rig, n)].local, 1e-9), n).toBe(true);
  });

  const poses: Record<string, Partial<BoneChannels>>[] = [
    { arm: { rot: 35 }, hand: { rot: -20, sx: 1.4 } },
    { arm: { rot: -40, sx: 0.5, sy: 0.5, yaw: -50 }, hand: { rot: 15, sy: 2 } },
    { root: { yaw: 150 }, arm: { rot: 20 } },
    { body: { sx: 1.2, rot: 10 }, arm: { x: 8, rot: 25 } },
  ];

  it.each(poses.map((p, i) => [i, p] as const))('3 pins: every pinned point lands on its target (pose %i)', (_, pose) => {
    const f = frame(rig, pose);
    const at = (n: string, x: number, y: number) => world(rig, f, n, x, y);
    for (const [target, x, y] of [['anchor', -40, -20], ['arm', -50, -80], ['hand', -110, -30]] as const) {
      const got = at('skin', x, y);
      const want = at(target, x, y);
      expect(got[0]).toBeCloseTo(want[0], 6);
      expect(got[1]).toBeCloseTo(want[1], 6);
    }
  });

  it.each(poses.map((p, i) => [i, p] as const))('2 pins: pivot follows the parent, both pins land (pose %i)', (_, pose) => {
    const f = frame(rig, pose);
    for (const [target, x, y] of [['arm', -120, -120], ['hand', -110, -30], ['arm', -50, -80]] as const) {
      const got = world(rig, f, 'web', x, y);
      const want = world(rig, f, target, x, y);
      expect(got[0]).toBeCloseTo(want[0], 6);
      expect(got[1]).toBeCloseTo(want[1], 6);
    }
  });

  it('1 pin: rotates and stretches toward the target', () => {
    const f = frame(rig, { hand: { rot: -30 } });
    const got = world(rig, f, 'aim', -110, -30);
    const want = world(rig, f, 'hand', -110, -30);
    expect(got[0]).toBeCloseTo(want[0], 6);
    expect(got[1]).toBeCloseTo(want[1], 6);
    const p = world(rig, f, 'aim', -50, -80);
    expect(p[0]).toBeCloseTo(-50, 6);
    expect(p[1]).toBeCloseTo(-80, 6);
  });
});

describe('parallax under foreshortened parents', () => {
  it('a child of a yawed flat bone is foreshortened once, not twice', () => {
    const { rig } = compile(svg(`<g data-om-bone="root"><g data-om-bone="arm" data-om-pivot="0 -50" data-om-surface="flat">
      <g data-om-bone="hand" data-om-pivot="-100 -50" data-om-surface="flat"/></g></g>`));
    const f = frame(rig, { arm: { yaw: 60 } });
    const [x] = world(rig, f, 'hand', -100, -50);
    expect(x).toBeCloseTo(-100 * Math.cos(Math.PI / 3), 6);
  });
});

describe('normal-aware child sorting', () => {
  it('a pupil stays on its eye while the eye (facing sideways) is still visible', () => {
    const { rig } = compile(svg(`<g data-om-bone="root"><g data-om-bone="head" data-om-pivot="0 -100">
      <circle cy="-100" r="50"/>
      <g data-om-bone="eye" data-om-pivot="-30 -100" data-om-z="40" data-om-surface="face" data-om-normal="-25 0">
        <circle cx="-30" cy="-100" r="10" fill="#fff"/>
        <g data-om-bone="pupil" data-om-pivot="-30 -100" data-om-z="6"><circle cx="-30" cy="-100" r="4"/></g>
      </g></g></g>`));
    const f = frame(rig, { head: { yaw: 100 } }); // eye faces 75°: visible
    expect(f.bones[bi(rig, 'eye')].opacity).toBeGreaterThan(0.5);
    expect(order(rig, f, 'eye')).toEqual(['art', 'pupil']);
  });
});

describe('data-om-flat-min / data-om-feature-min', () => {
  const { rig, warnings } = compile(svg(`<g data-om-bone="root">
    <g data-om-bone="wing" data-om-surface="flat" data-om-flat-min="0.15"/>
    <g data-om-bone="ear" data-om-surface="flat"/>
    <g data-om-bone="beak" data-om-z="30" data-om-surface="feature" data-om-feature-min="0.8"/>
    <g data-om-bone="snout" data-om-z="30" data-om-surface="feature"/>
  </g>`));

  it('parses and validates', () => {
    expect(warnings).toEqual([]);
    expect(rig.bonesByName.wing[0].flatMin).toBe(0.15);
    expect(rig.bonesByName.beak[0].featureMin).toBe(0.8);
    expect(() => compile(svg('<g data-om-bone="root" data-om-surface="flat" data-om-flat-min="2"/>'))).toThrow(RigError);
    expect(compile(svg('<g data-om-bone="root" data-om-flat-min="0.1"/>')).warnings.join()).toMatch(/not a flat surface/);
  });

  it('flat-min keeps a thin opaque sliver edge-on instead of fading', () => {
    const f = frame(rig, { root: { yaw: 90 } });
    expect(f.bones[bi(rig, 'ear')].opacity).toBe(0);
    expect(f.bones[bi(rig, 'wing')].opacity).toBe(1);
    expect(Math.abs(f.bones[bi(rig, 'wing')].local[0])).toBeCloseTo(0.15, 6);
    // away from edge-on it is the plain cosine
    expect(frame(rig, { root: { yaw: 60 } }).bones[bi(rig, 'wing')].local[0]).toBeCloseTo(0.5, 6);
  });

  it('feature-min sets how narrow a feature gets in profile', () => {
    const f = frame(rig, { root: { yaw: 90 } });
    const sx = (n: string) => f.bones[bi(rig, n)].local[0];
    expect(sx('beak')).toBeGreaterThan(sx('snout'));
    expect(sx('snout')).toBeCloseTo(1 + (0.4 - 1) * 0.85, 6);
  });
});

describe('data-om-spring-limit', () => {
  const SRC = (limit: string) =>
    svg(`<g data-om-bone="root"><g data-om-bone="tuft" data-om-pivot="0 -100" data-om-surface="flat" data-om-spring="60 2" ${limit} data-om-tip="0 -140"><path d="M0 -100L0 -140"/></g></g>`);
  const character = (src: string): CharacterDef => ({ id: 't', name: 'T', svg: src, expressions: { neutral: {} } });

  it('parses and validates', () => {
    const { rig, warnings } = compile(SRC('data-om-spring-limit="-10 15"'));
    expect(rig.bonesByName.tuft[0].spring!.limit).toEqual([-10, 15]);
    expect(warnings).toEqual([]);
    expect(() => compile(SRC('data-om-spring-limit="10 -10"'))).toThrow(RigError);
    expect(compile(svg('<g data-om-bone="root" data-om-spring-limit="-1 1"/>')).warnings.join()).toMatch(/no data-om-spring/);
  });

  function peak(src: string) {
    const m = new Mascot(character(src), { alive: false, initial: 'none' });
    for (let i = 0; i < 30; i++) m.update(1 / 60);
    // whip the root sideways: a soft, under-damped spring swings far
    m.play({ name: 'whip', duration: 0.6, bones: { root: { x: [[0, 0, 'linear'], [0.08, 120, 'linear'], [0.16, -120, 'linear'], [0.6, 0]] } } }, { fade: 0, then: null });
    let lo = 0;
    let hi = 0;
    for (let i = 0; i < 90; i++) {
      m.update(1 / 60);
      const a = angleOf(m.current.frame.bones[m.rig.bonesByName.tuft[0].bi].local);
      lo = Math.min(lo, a);
      hi = Math.max(hi, a);
    }
    return { lo, hi, m };
  }

  it('keeps the spring angle inside the limits (default ±55°)', () => {
    const free = peak(SRC(''));
    expect(Math.max(-free.lo, free.hi)).toBeGreaterThan(20);
    expect(Math.max(-free.lo, free.hi)).toBeLessThanOrEqual(55 + 1e-6);
    const lim = peak(SRC('data-om-spring-limit="-10 15"'));
    expect(lim.lo).toBeGreaterThanOrEqual(-10 - 1e-6);
    expect(lim.hi).toBeLessThanOrEqual(15 + 1e-6);
    // and it still settles back to rest
    for (let i = 0; i < 600; i++) lim.m.update(1 / 60);
    expect(Math.abs(angleOf(lim.m.current.frame.bones[lim.m.rig.bonesByName.tuft[0].bi].local))).toBeLessThan(0.1);
  });
});

describe('CharacterDef.effectParams', () => {
  it('are merged under emission params', () => {
    const seen: Record<string, unknown>[] = [];
    const c: CharacterDef = {
      id: 't',
      name: 'T',
      svg: svg('<g data-om-bone="root"/>'),
      expressions: { neutral: {} },
      effectParams: { probe: { eyeX: 40, size: 1 } },
    };
    const m = new Mascot(c, {
      alive: false,
      effects: { probe: { name: 'probe', spawn: (ctx) => (seen.push(ctx.params), []) } },
    });
    m.emit('probe', { params: { size: 2 } });
    expect(seen[0]).toEqual({ eyeX: 40, size: 2 });
    // rest pose unaffected by any of this
    const p = resolvePose(c, m.rig, emptyPose());
    expect(p.slots).toEqual({});
  });
});

describe('data-om-bleed', () => {
  const art = (rig: Rig, bone: string) =>
    rig.bonesByName[bone][0].children
      .filter((c) => c.kind === 'art')
      .map((c) => (c as { markup: string }).markup)
      .join('');

  it('adds a same-colour stroke to filled shapes in the bone and its subtree', () => {
    const { rig, warnings } = compile(
      svg(`<g data-om-bone="root"><g data-om-bone="wing" data-om-bleed="1.2">
        <path d="M0 0L10 0L0 10Z" fill="#513f75"/>
        <path d="M0 0L5 5" fill="none" stroke="#000"/>
        <circle r="3" fill="#fff" stroke="#000"/>
        <ellipse rx="2" ry="1" fill="#abc" fill-opacity=".5"/>
        <g data-om-bone="hand"><rect width="4" height="4" fill="#6a529c"/></g>
        <g data-om-bone="nail" data-om-bleed="0"><rect width="1" height="1" fill="#fff"/></g>
      </g></g>`),
    );
    expect(warnings).toEqual([]);
    const w = art(rig, 'wing');
    expect(w).toContain('fill="#513f75" stroke="#513f75" stroke-width="1.2" stroke-linejoin="round"');
    // shapes with their own stroke, no fill or translucent fill are untouched
    expect(w).toContain('<path d="M0 0L5 5" fill="none" stroke="#000"/>');
    expect(w).toContain('<circle r="3" fill="#fff" stroke="#000"/>');
    expect(w).not.toContain('fill="#abc" fill-opacity=".5" stroke');
    // inherited by child bones; 0 switches it off
    expect(art(rig, 'hand')).toContain('stroke="#6a529c"');
    expect(art(rig, 'nail')).not.toContain('stroke');
  });

  it('follows recolouring and rejects bad widths', () => {
    const src = svg('<g data-om-bone="root" data-om-bleed="1"><path d="M0 0H1V1Z" fill="#513f75"/></g>');
    const rig = compileRig(src, { recolor: { '#513f75': '#ff0000' } });
    expect(art(rig, 'root')).toContain('stroke="#ff0000"');
    expect(() => compile(svg('<g data-om-bone="root" data-om-bleed="-1"/>'))).toThrow(RigError);
  });
});
