import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { builtinEffects, clipSeconds, CHANNELS, compileRig, emptyPose, isIdentity, lintClip, Mascot, resolvePose, solve, type Clip, type RigWarning } from '@openmascot/core';
import { riff, riffExpressions } from '../src/riff';
import { riffClips } from '../src/riff/clips';
import { library } from '../src/library';
import { echoExpressions } from '../src/echo';
import art from '../src/riff/art.generated';

const warnings: RigWarning[] = [];
const rig = compileRig(riff.svg, { warnings });
const bones = new Set(Object.keys(rig.bonesByName));
const params = new Set(Object.keys(riff.params ?? {}));
const anchors = new Set(Object.keys(riff.anchors ?? {}));
const all: Record<string, Clip> = new Mascot(riff, { alive: false }).clips;

describe('Riff: art', () => {
  it('the embedded art is up to date with riff.svg (run `pnpm embed`)', () => {
    const svg = readFileSync(new URL('../src/riff/riff.svg', import.meta.url), 'utf8').trim();
    expect(art).toBe(svg);
    expect(riff.svg).toBe(svg);
  });

  it('compiles with zero warnings', () => {
    expect(warnings.map((w) => w.message)).toEqual([]);
    expect(rig.id).toBe('riff');
  });

  it('has the standard bones and slots, plus the frog parts', () => {
    for (const b of ['shadow', 'root', 'body', 'head', 'eye-l', 'eye-r', 'pupil-l', 'pupil-r', 'mouth', 'nose', 'belly', 'foot-l', 'foot-r',
      'arm-l', 'arm-r', 'leg-l', 'leg-r', 'shin-l', 'shin-r', 'hindfoot-l', 'hindfoot-r', 'dome-l', 'dome-r', 'throat', 'tongue', 'fly', 'lilypad']) {
      expect(rig.bonesByName[b], b).toBeDefined();
    }
    for (const s of ['eye-l', 'eye-r', 'mouth', 'blush', 'throat', 'tongue', 'fly', 'lilypad']) expect(rig.slotsByName[s], s).toBeDefined();
    expect(rig.bonesByName.shadow[0].shadow).toBe(true);
  });

  it('eye domes and eyes bob together: same pivot, tip and spring', () => {
    for (const side of ['l', 'r']) {
      const dome = rig.bonesByName[`dome-${side}`][0];
      const eye = rig.bonesByName[`eye-${side}`][0];
      expect(dome.spring).toBeDefined();
      expect(eye.spring).toEqual(dome.spring);
      expect(eye.pivot).toEqual(dome.pivot);
      expect(eye.surface).toBe('face');
    }
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
    const p = resolvePose(riff, rig, emptyPose());
    const f = solve(rig, { channels: p.channels, slots: p.slots });
    for (const b of rig.bones) if (b.surface !== 'back') expect(isIdentity(f.bones[b.bi].local, 1e-9), b.name).toBe(true);
  });

  it('props are hidden at rest (throat pouch, tongue, fly, lily pad)', () => {
    const p = resolvePose(riff, rig, emptyPose());
    for (const s of ['throat', 'tongue', 'fly', 'lilypad', 'blush']) expect(p.slots[s], s).toBe('off');
  });

  it('palette colours occur in the art', () => {
    for (const [k, hex] of Object.entries(riff.palette ?? {})) expect(riff.svg.toLowerCase(), k).toContain(hex.toLowerCase());
  });
});

describe('Riff: character definition', () => {
  it('has the same expression names as Echo', () => {
    expect(riff.expressions).toBe(riffExpressions);
    expect(Object.keys(riffExpressions).sort()).toEqual(Object.keys(echoExpressions).sort());
  });

  it('has a neutral expression that sets every face slot', () => {
    for (const s of ['eye-l', 'eye-r', 'mouth', 'blush']) expect(riff.expressions.neutral[s], s).toBeDefined();
  });

  it('every expression references existing slots and variants', () => {
    for (const [name, map] of Object.entries(riff.expressions)) {
      for (const [slot, variant] of Object.entries(map)) {
        const s = rig.slotsByName[slot];
        expect(s, `expression ${name}: slot ${slot}`).toBeDefined();
        expect(s.variants.map((v) => v.name), `expression ${name}: ${slot}=${variant}`).toContain(variant);
      }
    }
  });

  it('has the standard eye and mouth variants', () => {
    for (const v of ['open', 'happy', 'closed', 'heart', 'half', 'angry', 'sad', 'surprised', 'dizzy']) {
      expect(rig.slotsByName['eye-l'].variants.map((x) => x.name), v).toContain(v);
    }
    for (const v of ['default', 'smile', 'open', 'tongue', 'o', 'frown', 'grin']) expect(rig.slotsByName.mouth.variants.map((x) => x.name), v).toContain(v);
  });

  it('every param drives existing bones and channels, with sane ranges and curves', () => {
    for (const [name, def] of Object.entries(riff.params ?? {})) {
      expect(def.drives.length, name).toBeGreaterThan(0);
      if (def.min !== undefined && def.max !== undefined) expect(def.min, name).toBeLessThan(def.max);
      for (const d of def.drives) {
        expect(rig.bonesByName[d.bone], `param ${name} → ${d.bone}`).toBeDefined();
        expect(CHANNELS, `param ${name} → ${d.bone}.${d.channel}`).toContain(d.channel);
        if (d.curve) for (let i = 1; i < d.curve.length; i++) expect(d.curve[i][0], `param ${name} curve sorted`).toBeGreaterThan(d.curve[i - 1][0]);
      }
    }
  });

  it('implements the standard portable params (flap moves the front legs)', () => {
    for (const p of ['lookX', 'lookY', 'blink', 'breathe', 'squash', 'flap', 'lean']) expect(riff.params?.[p], p).toBeDefined();
    const arms = riff.params!.flap.drives.map((d) => d.bone);
    expect(arms).toContain('arm-l');
    expect(arms).toContain('arm-r');
  });

  it('flap raises the arms clear of the head (screen-left arm rotates +, right arm −)', () => {
    const p = resolvePose(riff, rig, { ...emptyPose(), params: { flap: 1.5 } });
    expect(p.channels.get('arm-l')!.rot).toBeGreaterThan(90);
    expect(p.channels.get('arm-r')!.rot).toBeLessThan(-90);
  });

  it('anchors point at existing bones', () => {
    for (const [name, a] of Object.entries(riff.anchors ?? {})) expect(rig.bonesByName[a.bone], `anchor ${name}`).toBeDefined();
    for (const a of ['head', 'mouth', 'feet']) expect(riff.anchors?.[a], a).toBeDefined();
  });

  it('idle clip and fidgets exist', () => {
    expect(all[riff.idle?.clip ?? 'idle']).toBeDefined();
    expect(all[riff.idle?.clip ?? 'idle'].loop).toBe(true);
    for (const f of riff.idle?.fidgets ?? []) expect(all[f], f).toBeDefined();
  });

  it('every expression renders after a blink-masked swap', () => {
    const m = new Mascot(riff, { alive: false });
    for (const [name, map] of Object.entries(riff.expressions)) {
      m.setExpression(name);
      for (let i = 0; i < 30; i++) m.update(1 / 60);
      const want = { ...riff.expressions.neutral, ...map };
      for (const [slot, v] of Object.entries(want)) expect(m.current.frame.slots[slot], `${name}: ${slot}`).toBe(v);
    }
  });
});

describe('Riff: clips', () => {
  it('ships the frog clips', () => {
    for (const c of ['croak', 'leap', 'tongue-catch', 'lily-sit', 'ribbit', 'fidget-eye-bob', 'fidget-gulp']) expect(riffClips[c], c).toBeDefined();
  });

  it('no clip available to Riff addresses wings (param-driven or re-targeted onto the arms)', () => {
    for (const [name, c] of Object.entries(all)) {
      expect(Object.keys(c.bones ?? {}).filter((b) => b.startsWith('wing-')), name).toEqual([]);
      expect(Object.keys(c.slots ?? {}).filter((s) => s.startsWith('wing-')), name).toEqual([]);
    }
    expect(all.wave.params?.raiseR).toBeDefined();
  });

  it('raiseL/raiseR lift one arm each; wingFold 0.5 is the drawn pose (and the clip rest value)', () => {
    const at = (params: Record<string, number>) => resolvePose(riff, rig, { ...emptyPose(), params }).channels;
    expect(at({ raiseR: 1 }).get('arm-r')!.rot).toBeLessThan(-80);
    expect(at({ raiseR: 1 }).get('arm-l')?.rot ?? 0).toBe(0);
    expect(at({ raiseL: 1 }).get('arm-l')!.rot).toBeGreaterThan(80);
    expect(at({ wingFold: 0.5 }).get('arm-l')?.rot ?? 0).toBeCloseTo(0, 9);
    expect(at({ wingFold: 0 }).get('arm-l')!.rot).toBeGreaterThan(20);
    expect(riff.restParams?.wingFold).toBe(0.5);
  });

  it('shared effects are tuned to Riff (tears land on its eyes)', () => {
    expect(riff.effectParams?.tears).toMatchObject({ eyeX: 68 });
  });

  it('tongue-catch: the tongue tip reaches the fly at the zap', async () => {
    const { bonePosition } = await import('@openmascot/core');
    const m = new Mascot(riff, { alive: false, initial: '__none__' });
    m.play('tongue-catch', { fade: 0, then: null });
    for (let i = 0; i < 90; i++) m.update(1 / 60); // t = 1.5 s
    const f = m.update(0).frame;
    expect(f.slots.tongue).not.toBe('off');
    const tip = bonePosition(m.rig, f, 'tongue', [170, 0])!;
    const fly = bonePosition(m.rig, f, 'fly')!;
    expect(Math.hypot(tip[0] - fly[0], tip[1] - fly[1])).toBeLessThan(6);
  });
});

describe.each(Object.keys(all))('Riff clip %s', (name) => {
  const clip = all[name];
  const own = name in riffClips;

  it(own ? 'lints cleanly against Riff' : 'lints against Riff (library: only missing bones tolerated)', () => {
    const problems = lintClip(clip, bones, params);
    expect(own ? problems : problems.filter((p) => !/^unknown bone "/.test(p))).toEqual([]);
  });

  it('has a description and a known category', () => {
    expect(clip.description).toBeTruthy();
    expect(['idle', 'fidget', 'emotion', 'gesture', 'pose', 'dance', 'locomotion']).toContain(clip.category);
  });

  it('references existing effects, anchors, expressions and slot variants', () => {
    for (const e of clip.events ?? []) {
      expect(builtinEffects[e.effect], `effect "${e.effect}"`).toBeDefined();
      if (typeof e.at === 'string') expect(anchors.has(e.at) || bones.has(e.at), `anchor "${e.at}"`).toBe(true);
    }
    for (const [t, e] of clip.expression ?? []) expect(riff.expressions[e], `expression "${e}" at ${t}`).toBeDefined();
    for (const [slot, ks] of Object.entries(clip.slots ?? {})) {
      const s = rig.slotsByName[slot];
      expect(s, `slot "${slot}"`).toBeDefined();
      for (const [, v] of ks) if (v !== '') expect(s.variants.map((x) => x.name), `${slot}=${v}`).toContain(v);
    }
  });

  it('plays to the end producing finite frames', () => {
    const m = new Mascot(riff, { alive: false, library, seed: 1 });
    const warn = console.warn;
    const seen: unknown[] = [];
    console.warn = (...a: unknown[]) => seen.push(a);
    try {
      m.play(name, { fade: 0, then: null });
      const secs = Math.min(clipSeconds(clip), 30);
      for (let t = 0; t <= secs + 0.1; t += 1 / 20) {
        const f = m.update(1 / 20);
        for (const b of f.frame.bones) {
          expect(b.local.every(Number.isFinite)).toBe(true);
          expect(Number.isFinite(b.opacity)).toBe(true);
        }
      }
    } finally {
      console.warn = warn;
    }
    expect(seen).toEqual([]);
  });
});
