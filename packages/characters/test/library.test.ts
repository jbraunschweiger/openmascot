/**
 * Lints every clip Echo can play (shared library + Echo-only clips) against
 * Echo's rig, params, expressions and the effect registry, then plays each
 * one to make sure it produces finite frames.
 */
import { describe, expect, it } from 'vitest';
import { builtinEffects, clipSeconds, lintClip, Mascot, compileRig, type Clip } from '@openmascot/core';
import { clipCategories, echo, library } from '@openmascot/characters';

const rig = compileRig(echo.svg);
const bones = new Set(Object.keys(rig.bonesByName));
const params = new Set(Object.keys(echo.params ?? {}));
const anchors = new Set(Object.keys(echo.anchors ?? {}));
const all: Record<string, Clip> = new Mascot(echo, { alive: false, library }).clips;
const CATEGORIES = ['idle', 'fidget', 'emotion', 'gesture', 'pose', 'dance', 'locomotion'];

describe('clip library', () => {
  it('is non-empty and includes the idle loop', () => {
    expect(Object.keys(all).length).toBeGreaterThan(5);
    expect(all.idle).toBeDefined();
  });

  it('groups clips by category', () => {
    const cats = clipCategories(library);
    expect(Object.values(cats).flat().sort()).toEqual(Object.keys(library).sort());
  });
});

describe.each(Object.keys(all))('clip %s', (name) => {
  const clip = all[name];

  it('passes lintClip against Echo', () => {
    expect(lintClip(clip, bones, params)).toEqual([]);
  });

  it('has a description and a known category', () => {
    expect(clip.description, 'description').toBeTruthy();
    expect(CATEGORIES, `category of ${name}`).toContain(clip.category);
  });

  it('references existing effects, anchors, expressions and slot variants', () => {
    for (const e of clip.events ?? []) {
      expect(builtinEffects[e.effect], `effect "${e.effect}"`).toBeDefined();
      if (typeof e.at === 'string') expect(anchors.has(e.at) || bones.has(e.at), `anchor "${e.at}"`).toBe(true);
      expect(e.t, 'event time').toBeGreaterThanOrEqual(0);
      expect(e.t, 'event time').toBeLessThanOrEqual(clip.duration);
    }
    for (const [t, e] of clip.expression ?? []) {
      expect(echo.expressions[e], `expression "${e}" at ${t}`).toBeDefined();
    }
    for (const [slot, keys] of Object.entries(clip.slots ?? {})) {
      const s = rig.slotsByName[slot];
      expect(s, `slot "${slot}"`).toBeDefined();
      for (const [, v] of keys) if (v !== '') expect(s.variants.map((x) => x.name), `${slot}=${v}`).toContain(v);
    }
  });

  it('plays to the end producing finite frames', () => {
    const m = new Mascot(echo, { alive: false, library, seed: 1 });
    const warn = console.warn;
    const warnings: unknown[] = [];
    console.warn = (...a: unknown[]) => warnings.push(a);
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
    expect(warnings).toEqual([]);
  });
});
