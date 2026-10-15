import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { compileRig, isIdentity, Mascot, resolvePose, emptyPose, solve, type RigWarning, CHANNELS } from '@openmascot/core';
import { characters, echo, echoExpressions } from '@openmascot/characters';
import art from '../src/echo/art.generated';

const warnings: RigWarning[] = [];
const rig = compileRig(echo.svg, { warnings });

describe('Echo: art', () => {
  it('the embedded art is up to date with echo.svg (run `pnpm embed`)', () => {
    const svg = readFileSync(new URL('../src/echo/echo.svg', import.meta.url), 'utf8').trim();
    expect(art).toBe(svg);
    expect(echo.svg).toBe(svg);
  });

  it('compiles with zero warnings', () => {
    expect(warnings.map((w) => w.message)).toEqual([]);
    expect(rig.id).toBe('echo');
  });

  it('has the standard bones and slots', () => {
    for (const b of ['shadow', 'root', 'body', 'head', 'eye-l', 'eye-r', 'pupil-l', 'pupil-r', 'wing-l', 'wing-r', 'foot-l', 'foot-r', 'ear-l', 'ear-r', 'mouth', 'nose']) {
      expect(rig.bonesByName[b], b).toBeDefined();
    }
    for (const s of ['eye-l', 'eye-r', 'mouth', 'blush', 'wing-l', 'wing-r']) expect(rig.slotsByName[s], s).toBeDefined();
    expect(rig.bonesByName.shadow[0].shadow).toBe(true);
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
      });
    }
    for (const name of Object.keys(rig.slotsByName).filter((n) => n.endsWith('-l'))) {
      const r = rig.slotsByName[name.slice(0, -2) + '-r'];
      expect(r.variants.map((v) => v.name)).toEqual(rig.slotsByName[name].variants.map((v) => v.name));
    }
  });

  it('renders the rest pose exactly as drawn', () => {
    const p = resolvePose(echo, rig, emptyPose());
    const f = solve(rig, { channels: p.channels, slots: p.slots });
    for (const b of rig.bones) if (b.surface !== 'back') expect(isIdentity(f.bones[b.bi].local, 1e-9), b.name).toBe(true);
  });

  it('palette colours occur in the art', () => {
    for (const [k, hex] of Object.entries(echo.palette ?? {})) expect(echo.svg.toLowerCase(), k).toContain(hex.toLowerCase());
  });
});

describe('Echo: character definition', () => {
  it('is registered', () => {
    expect(characters.echo).toBe(echo);
    expect(echo.expressions).toBe(echoExpressions);
  });

  it('has a neutral expression that sets every face slot', () => {
    expect(echo.expressions.neutral).toBeDefined();
    for (const s of ['eye-l', 'eye-r', 'mouth']) expect(echo.expressions.neutral[s], s).toBeDefined();
  });

  it('every expression references existing slots and variants', () => {
    for (const [name, map] of Object.entries(echo.expressions)) {
      for (const [slot, variant] of Object.entries(map)) {
        const s = rig.slotsByName[slot];
        expect(s, `expression ${name}: slot ${slot}`).toBeDefined();
        expect(s.variants.map((v) => v.name), `expression ${name}: ${slot}=${variant}`).toContain(variant);
      }
    }
  });

  it('every param drives existing bones and channels, with sane ranges and curves', () => {
    for (const [name, def] of Object.entries(echo.params ?? {})) {
      expect(def.drives.length, name).toBeGreaterThan(0);
      if (def.min !== undefined && def.max !== undefined) expect(def.min, name).toBeLessThan(def.max);
      for (const d of def.drives) {
        expect(rig.bonesByName[d.bone], `param ${name} → ${d.bone}`).toBeDefined();
        expect(CHANNELS, `param ${name} → ${d.bone}.${d.channel}`).toContain(d.channel);
        if (d.curve) for (let i = 1; i < d.curve.length; i++) expect(d.curve[i][0], `param ${name} curve sorted`).toBeGreaterThan(d.curve[i - 1][0]);
      }
    }
  });

  it('implements the standard portable params', () => {
    for (const p of ['lookX', 'lookY', 'blink', 'breathe', 'squash', 'flap', 'lean']) expect(echo.params?.[p], p).toBeDefined();
  });

  it('anchors point at existing bones', () => {
    for (const [name, a] of Object.entries(echo.anchors ?? {})) expect(rig.bonesByName[a.bone], `anchor ${name}`).toBeDefined();
  });

  it('idle clip and fidgets exist', () => {
    const m = new Mascot(echo, { alive: false });
    expect(m.clips[echo.idle?.clip ?? 'idle']).toBeDefined();
    expect(m.clips[echo.idle?.clip ?? 'idle'].loop).toBe(true);
    for (const f of echo.idle?.fidgets ?? []) expect(m.clips[f], f).toBeDefined();
  });

  it('every expression renders after a blink-masked swap', () => {
    const m = new Mascot(echo, { alive: false });
    for (const [name, map] of Object.entries(echo.expressions)) {
      m.setExpression(name);
      for (let i = 0; i < 30; i++) m.update(1 / 60);
      const want = { ...echo.expressions.neutral, ...map };
      for (const [slot, v] of Object.entries(want)) expect(m.current.frame.slots[slot], `${name}: ${slot}`).toBe(v);
    }
  });
});
