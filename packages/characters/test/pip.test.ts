/**
 * Pip the bird: rig, character definition, and every clip Pip can play
 * (shared library + Pip-only clips) linted against Pip's rig and played to
 * the end. Library clips may address bones Pip doesn't have (ears); Pip's own
 * clips may not.
 */
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  builtinEffects,
  clipSeconds,
  compileRig,
  emptyPose,
  isIdentity,
  lintClip,
  Mascot,
  resolvePose,
  solve,
  CHANNELS,
  type Clip,
  type RigWarning,
} from '@openmascot/core';
import { echoExpressions, library } from '@openmascot/characters';
import { pip, pipExpressions } from '../src/pip';
import { pipClips } from '../src/pip/clips';
import art from '../src/pip/art.generated';

const warnings: RigWarning[] = [];
const rig = compileRig(pip.svg, { warnings });
const bones = new Set(Object.keys(rig.bonesByName));
const params = new Set(Object.keys(pip.params ?? {}));
const anchors = new Set(Object.keys(pip.anchors ?? {}));
const all: Record<string, Clip> = new Mascot(pip, { alive: false }).clips;
const CATEGORIES = ['idle', 'fidget', 'emotion', 'gesture', 'pose', 'dance', 'locomotion'];

/** Solve one frame of Pip with the given bone channels / params held. */
function frameWith(clip: Partial<Clip>) {
  const m = new Mascot(pip, { alive: false, initial: '__none__' });
  m.play({ duration: 1, ...clip, name: 'probe' }, { fade: 0, then: null });
  m.update(0);
  return m;
}
const worldPivot = (m: Mascot, name: string) => {
  const b = rig.bonesByName[name][0];
  const w = m.current.frame.bones[b.bi].world;
  return [w[0] * b.pivot[0] + w[2] * b.pivot[1] + w[4], w[1] * b.pivot[0] + w[3] * b.pivot[1] + w[5]];
};

describe('Pip: art', () => {
  it('the embedded art is up to date with pip.svg (run `pnpm embed`)', () => {
    const svg = readFileSync(new URL('../src/pip/pip.svg', import.meta.url), 'utf8').trim();
    expect(art).toBe(svg);
    expect(pip.svg).toBe(svg);
  });

  it('compiles with zero warnings', () => {
    expect(warnings.map((w) => w.message)).toEqual([]);
    expect(rig.id).toBe('pip');
  });

  it('has the standard bones and slots', () => {
    for (const b of ['shadow', 'root', 'body', 'head', 'eye-l', 'eye-r', 'pupil-l', 'pupil-r', 'wing-l', 'wing-r', 'foot-l', 'foot-r', 'tuft', 'nose', 'mouth', 'belly']) {
      expect(rig.bonesByName[b], b).toBeDefined();
    }
    for (const s of ['eye-l', 'eye-r', 'mouth', 'blush', 'wing-l', 'wing-r']) expect(rig.slotsByName[s], s).toBeDefined();
    expect(rig.bonesByName.shadow[0].shadow).toBe(true);
    expect(rig.slotsByName['wing-l'].variants.map((v) => v.name)).toEqual(['spread', 'folded', 'fan']);
  });

  it('the beak is a protruding feature and the mouth slot lives inside it', () => {
    expect(rig.bonesByName.nose[0].surface).toBe('feature');
    expect(rig.bonesByName.nose[0].children.some((c) => c.kind === 'bone' && c.name === 'mouth')).toBe(true);
  });

  it('is left/right symmetric (-l/-r bones mirror each other)', () => {
    for (const name of Object.keys(rig.bonesByName).filter((n) => n.endsWith('-l'))) {
      const other = name.slice(0, -2) + '-r';
      const l = rig.bonesByName[name];
      const r = rig.bonesByName[other];
      expect(r, other).toBeDefined();
      expect(r.length, other).toBe(l.length);
      l.forEach((b, i) => {
        expect(r[i].pivot[0], `${other} pivot x`).toBeCloseTo(-b.pivot[0], 6);
        expect(r[i].pivot[1], `${other} pivot y`).toBeCloseTo(b.pivot[1], 6);
        expect(r[i].z, `${other} z`).toBe(b.z);
        expect(r[i].surface, `${other} surface`).toBe(b.surface);
        expect(r[i].normal[0], `${other} normal`).toBeCloseTo(-b.normal[0], 6);
      });
    }
    for (const name of Object.keys(rig.slotsByName).filter((n) => n.endsWith('-l'))) {
      const r = rig.slotsByName[name.slice(0, -2) + '-r'];
      expect(r.variants.map((v) => v.name)).toEqual(rig.slotsByName[name].variants.map((v) => v.name));
    }
  });

  it('renders the rest pose exactly as drawn', () => {
    const p = resolvePose(pip, rig, emptyPose());
    const f = solve(rig, { channels: p.channels, slots: p.slots });
    for (const b of rig.bones) if (b.surface !== 'back') expect(isIdentity(f.bones[b.bi].local, 1e-9), b.name).toBe(true);
  });

  it('palette colours occur in the art', () => {
    for (const [k, hex] of Object.entries(pip.palette ?? {})) expect(pip.svg.toLowerCase(), k).toContain(hex.toLowerCase());
  });
});

describe('Pip: pseudo-3D', () => {
  it('the beak sticks out past the body in profile', () => {
    const m = frameWith({ bones: { root: { yaw: [[0, 90]] } } });
    const [x] = worldPivot(m, 'nose');
    expect(x).toBeGreaterThan(100); // body egg is 110 wide; the beak art reaches beyond it
  });

  it('the face culls from behind and the back cap shows', () => {
    const m = frameWith({ bones: { root: { yaw: [[0, 180]] } } });
    const op = (n: string) => m.current.frame.bones[rig.bonesByName[n][0].bi].opacity;
    for (const n of ['eye-l', 'eye-r', 'belly', 'cheeks']) expect(op(n), n).toBeLessThan(0.01);
    expect(op('body-back')).toBeGreaterThan(0.99);
  });

  it('a nodding head stays in front of the belly', () => {
    const m = frameWith({ bones: { head: { pitch: [[0, 30]] } } });
    const body = rig.bonesByName.body[0];
    const order = m.current.frame.order.get(body.index) ?? body.children.map((_, i) => i);
    const idx = (n: string) => order.indexOf(body.children.findIndex((c) => c.kind === 'bone' && c.name === n));
    expect(idx('head')).toBeGreaterThan(idx('belly'));
  });
});

describe('Pip: character definition', () => {
  it('uses the same expression names as Echo', () => {
    expect(pip.expressions).toBe(pipExpressions);
    expect(Object.keys(pip.expressions).sort()).toEqual(Object.keys(echoExpressions).sort());
  });

  it('has a neutral expression that sets every face slot', () => {
    for (const s of ['eye-l', 'eye-r', 'mouth', 'blush']) expect(pip.expressions.neutral[s], s).toBeDefined();
  });

  it('every expression references existing slots and variants', () => {
    for (const [name, map] of Object.entries(pip.expressions)) {
      for (const [slot, variant] of Object.entries(map)) {
        const s = rig.slotsByName[slot];
        expect(s, `expression ${name}: slot ${slot}`).toBeDefined();
        expect(s.variants.map((v) => v.name), `expression ${name}: ${slot}=${variant}`).toContain(variant);
      }
    }
  });

  it('every param drives existing bones and channels, with sane ranges and curves', () => {
    for (const [name, def] of Object.entries(pip.params ?? {})) {
      expect(def.drives.length, name).toBeGreaterThan(0);
      if (def.min !== undefined && def.max !== undefined) expect(def.min, name).toBeLessThan(def.max);
      for (const d of def.drives) {
        expect(rig.bonesByName[d.bone], `param ${name} → ${d.bone}`).toBeDefined();
        expect(CHANNELS, `param ${name} → ${d.bone}.${d.channel}`).toContain(d.channel);
        if (d.curve) for (let i = 1; i < d.curve.length; i++) expect(d.curve[i][0], `param ${name} curve sorted`).toBeGreaterThan(d.curve[i - 1][0]);
      }
    }
  });

  it('implements the standard portable params (and wingFold)', () => {
    for (const p of ['lookX', 'lookY', 'blink', 'breathe', 'squash', 'flap', 'lean', 'wingFold', 'raiseL', 'raiseR']) expect(pip.params?.[p], p).toBeDefined();
  });

  it('rests at wingFold 0.5 (relaxed = as drawn) and lands shared tears on its own eyes', () => {
    expect(pip.params?.wingFold.default).toBe(0.5);
    expect(pip.restParams).toEqual({ wingFold: 0.5 });
    expect(pip.effectParams?.tears).toMatchObject({ eyeX: 52, eyeY: 54 });
  });

  it('flap +1 raises both wings out to the sides; wingFold tucks them in', () => {
    const up = frameWith({ params: { flap: [[0, 1]] } });
    const tip = (m: Mascot, side: 'l' | 'r') => {
      const b = rig.bonesByName[`wing-${side}`][0];
      const w = m.current.frame.bones[b.bi].world;
      const [x, y] = b.spring!.tip;
      return [w[0] * x + w[2] * y + w[4], w[1] * x + w[3] * y + w[5]];
    };
    const rest = frameWith({});
    expect(tip(up, 'l')[0]).toBeLessThan(tip(rest, 'l')[0] - 40);
    expect(tip(up, 'r')[0]).toBeGreaterThan(tip(rest, 'r')[0] + 40);
    const folded = frameWith({ params: { wingFold: [[0, 1]] } });
    expect(tip(folded, 'l')[0]).toBeGreaterThan(tip(rest, 'l')[0]);
    expect(tip(folded, 'r')[0]).toBeLessThan(tip(rest, 'r')[0]);
    const spread = frameWith({ params: { wingFold: [[0, 0]] } });
    expect(tip(spread, 'l')[0]).toBeLessThan(tip(rest, 'l')[0] - 10);
    expect(tip(spread, 'r')[0]).toBeGreaterThan(tip(rest, 'r')[0] + 10);
  });

  it('raiseL / raiseR lift one wing: 1 ≈ beside the head, the other wing stays put', () => {
    const tipY = (m: Mascot, side: 'l' | 'r') => {
      const b = rig.bonesByName[`wing-${side}`][0];
      const w = m.current.frame.bones[b.bi].world;
      const [x, y] = b.spring!.tip;
      return w[1] * x + w[3] * y + w[5];
    };
    const rest = frameWith({});
    for (const [p, side, other] of [['raiseL', 'l', 'r'], ['raiseR', 'r', 'l']] as const) {
      const up = frameWith({ params: { [p]: [[0, 1]] } });
      expect(tipY(up, side), p).toBeLessThan(-150); // wing tip up at head height
      expect(tipY(up, other), p).toBeCloseTo(tipY(rest, other), 3);
    }
  });

  it('anchors point at existing bones', () => {
    for (const a of ['head', 'mouth', 'feet']) expect(pip.anchors?.[a], a).toBeDefined();
    for (const [name, a] of Object.entries(pip.anchors ?? {})) expect(rig.bonesByName[a.bone], `anchor ${name}`).toBeDefined();
  });

  it('idle clip and fidgets exist', () => {
    expect(all[pip.idle?.clip ?? 'idle']?.loop).toBe(true);
    for (const f of pip.idle?.fidgets ?? []) expect(all[f], f).toBeDefined();
  });

  it('every expression renders after a blink-masked swap', () => {
    const m = new Mascot(pip, { alive: false });
    for (const [name, map] of Object.entries(pip.expressions)) {
      m.setExpression(name);
      for (let i = 0; i < 30; i++) m.update(1 / 60);
      const want = { ...pip.expressions.neutral, ...map };
      for (const [slot, v] of Object.entries(want)) expect(m.current.frame.slots[slot], `${name}: ${slot}`).toBe(v);
    }
  });

  it('includes the whole shared library plus Pip-only clips', () => {
    for (const n of Object.keys(library)) expect(all[n], n).toBeDefined();
    for (const n of ['hop', 'peck', 'chirp', 'fly', 'fluff', 'takeoff', 'land', 'nap', 'head-tilt']) expect(pipClips[n], n).toBeDefined();
  });
});

describe.each(Object.keys(all))('Pip clip %s', (name) => {
  const clip = all[name];
  const own = name in pipClips;

  it(own ? 'lints cleanly against Pip' : 'lints against Pip (library: only unknown bones tolerated)', () => {
    const problems = lintClip(clip, bones, params);
    expect(own ? problems : problems.filter((p) => !p.startsWith('unknown bone'))).toEqual([]);
  });

  it('has a description and a known category', () => {
    expect(clip.description, 'description').toBeTruthy();
    expect(CATEGORIES, `category of ${name}`).toContain(clip.category);
  });

  it('references existing effects, anchors, expressions and slot variants', () => {
    for (const e of clip.events ?? []) {
      expect(builtinEffects[e.effect], `effect "${e.effect}"`).toBeDefined();
      if (typeof e.at === 'string') expect(anchors.has(e.at) || bones.has(e.at), `anchor "${e.at}"`).toBe(true);
    }
    for (const [t, e] of clip.expression ?? []) expect(pip.expressions[e], `expression "${e}" at ${t}`).toBeDefined();
    for (const [slot, keys] of Object.entries(clip.slots ?? {})) {
      const s = rig.slotsByName[slot];
      expect(s, `slot "${slot}"`).toBeDefined();
      for (const [, v] of keys) if (v !== '') expect(s.variants.map((x) => x.name), `${slot}=${v}`).toContain(v);
    }
  });

  it('plays to the end producing finite frames', () => {
    const m = new Mascot(pip, { alive: false, seed: 1 });
    const warn = console.warn;
    const logged: unknown[] = [];
    console.warn = (...a: unknown[]) => logged.push(a);
    try {
      m.play(name, { fade: 0, then: null });
      const secs = Math.min(clipSeconds(clip), 30);
      for (let t = 0; t <= secs + 0.1; t += 1 / 20) {
        const f = m.update(1 / 20);
        for (const b of f.frame.bones) {
          expect(b.local.every(Number.isFinite)).toBe(true);
          expect(Number.isFinite(b.opacity)).toBe(true);
        }
        for (const p of f.particles) expect(p.transform.every(Number.isFinite)).toBe(true);
      }
    } finally {
      console.warn = warn;
    }
    expect(logged).toEqual([]);
  });
});
