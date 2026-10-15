import { afterEach, describe, expect, it, vi } from 'vitest';
import { echo, library } from '@openmascot/characters';
import { angleOf } from '../src/mat';
import { Mascot, type MascotEvent, type MascotOptions } from '../src/mascot';
import { renderSvg } from '../src/render-string';
import { bonePosition } from '../src/solve';
import type { CharacterDef, Clip } from '../src/types';
import { testCharacter } from './fixtures';

const DT = 1 / 64; // exact in binary: no float drift at loop boundaries

function make(opts: MascotOptions = {}, character: CharacterDef = testCharacter) {
  const m = new Mascot(character, { alive: false, ...opts });
  const events: MascotEvent[] = [];
  m.on((e) => events.push(e));
  return { m, events };
}
const run = (m: Mascot, seconds: number, dt = DT) => {
  for (let i = 0, n = Math.round(seconds / dt); i < n; i++) m.update(dt);
  return m.current;
};
const headX = (m: Mascot) => bonePosition(m.rig, m.current.frame, 'head')![0];
const hold = (bone: string, ch: 'x' | 'y' | 'rot', v: number, extra: Partial<Clip> = {}): Clip => ({
  duration: 1,
  loop: true,
  bones: { [bone]: { [ch]: [[0, v]] } },
  ...extra,
});

afterEach(() => vi.restoreAllMocks());

describe('Mascot: setup', () => {
  it('compiles the rig, names clips and starts the idle clip', () => {
    const { m } = make();
    expect(m.warnings).toEqual([]);
    expect(m.playing).toBe('idle');
    expect(m.clips.wave.name).toBe('wave');
    expect(m.current.frame.bones).toHaveLength(m.rig.bones.length);
    expect(m.time).toBe(0);
  });

  it('merges the library under character clips and effects over built-ins', () => {
    const custom = { name: 'mine', spawn: () => [] };
    const m = new Mascot(testCharacter, { library: { extra: { duration: 1 }, idle: { duration: 9 } }, effects: { mine: custom } });
    expect(m.clips.extra).toBeDefined();
    expect(m.clips.idle.duration).toBe(2); // the character's own idle wins
    expect(m.effects.mine).toBe(custom);
    expect(m.effects.hearts).toBeDefined();
  });

  it('honours `initial`', () => {
    expect(make({ initial: 'spin' }).m.playing).toBe('spin');
  });

  it('clamps dt and accumulates time', () => {
    const { m } = make();
    m.update(10);
    expect(m.time).toBe(0.25);
    m.update(-1);
    expect(m.time).toBe(0.25);
  });

  it('warns (and resolves) for unknown clips', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const { m } = make();
    await m.play('does-not-exist');
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('unknown clip "does-not-exist"'));
    expect(m.playing).toBe('idle');
  });
});

describe('Mascot: playback', () => {
  it('crossfades linearly over the fade duration', () => {
    const { m } = make({ initial: 'none' });
    const x0 = headX(m);
    m.play(hold('head', 'x', 0, { name: 'a' }), { fade: 0 });
    m.update(DT);
    m.play(hold('head', 'x', 100, { name: 'b' }), { fade: 1 });
    run(m, 0.25);
    expect(headX(m) - x0).toBeCloseTo(25, 6);
    run(m, 0.5);
    expect(headX(m) - x0).toBeCloseTo(75, 6);
    run(m, 0.5);
    expect(headX(m) - x0).toBeCloseTo(100, 6);
    expect(m.playing).toBe('b');
  });

  it('fade 0 cuts immediately', () => {
    const { m } = make();
    const x0 = headX(m);
    m.play(hold('head', 'x', 40), { fade: 0 });
    m.update(DT);
    expect(headX(m) - x0).toBeCloseTo(40, 6);
  });

  it('uses the clip fadeIn as the default crossfade', () => {
    const { m } = make();
    m.play(hold('head', 'x', 0), { fade: 0 });
    m.update(DT);
    const x0 = headX(m);
    m.play(hold('head', 'x', 100, { fadeIn: 0.5 }));
    run(m, 0.25);
    expect(headX(m) - x0).toBeCloseTo(50, 6);
  });

  it('one-shots end, fire `end`, resolve, and return to idle', async () => {
    const { m, events } = make();
    let done = false;
    const p = m.play('wave', { fade: 0 }).then(() => (done = true));
    run(m, 0.5);
    expect(m.playing).toBe('wave');
    expect(done).toBe(false);
    run(m, 0.6);
    await p;
    expect(done).toBe(true);
    expect(m.playing).toBe('idle');
    expect(events.filter((e) => e.type === 'end').map((e) => (e as { clip: string }).clip)).toEqual(['wave']);
    expect(events.filter((e) => e.type === 'start').map((e) => (e as { clip: string }).clip)).toEqual(['wave', 'idle']);
  });

  it('`then` picks the follow-up clip', () => {
    const { m } = make();
    m.play('wave', { fade: 0, then: 'spin' });
    run(m, 1.1);
    expect(m.playing).toBe('spin');
  });

  it('`then: null` holds the last frame', () => {
    const { m } = make();
    const x0 = headX(m);
    m.play({ name: 'move', duration: 0.5, bones: { head: { x: [[0, 0, 'linear'], [0.5, 30]] } } }, { fade: 0, then: null });
    run(m, 2);
    expect(m.playing).toBe('move');
    expect(headX(m) - x0).toBeCloseTo(30, 6);
  });

  it('`repeat` stops a loop after N cycles, then continues with idle', () => {
    const { m, events } = make();
    m.play('spin', { fade: 0, repeat: 2 });
    run(m, 1.5);
    expect(m.playing).toBe('spin');
    run(m, 0.75);
    expect(m.playing).toBe('idle');
    expect(events.filter((e) => e.type === 'loop')).toHaveLength(1);
    expect(events.filter((e) => e.type === 'end')).toHaveLength(1);
  });

  it('loops fire `loop` events every cycle', () => {
    const { m, events } = make();
    m.play('spin', { fade: 0 });
    run(m, 3.5);
    expect(events.filter((e) => e.type === 'loop')).toHaveLength(3);
  });

  it('`speed` and `bpm` retime playback', () => {
    const a = make();
    a.m.play('wave', { fade: 0, speed: 2 });
    run(a.m, 0.55);
    expect(a.m.playing).toBe('idle');

    const b = make();
    const beats: Clip = { name: 'beats', duration: 4, units: 'beats', bpm: 120, bones: { head: { x: [[0, 0]] } } };
    b.m.play(beats, { fade: 0, bpm: 240 }); // 4 beats @ 240 bpm = 1 s
    run(b.m, 0.9);
    expect(b.m.playing).toBe('beats');
    run(b.m, 0.2);
    expect(b.m.playing).toBe('idle');
  });

  it('a replaced loop resolves its promise', async () => {
    const { m } = make();
    let resolved = false;
    m.play('spin', { fade: 0 }).then(() => (resolved = true));
    m.update(DT);
    m.play('idle');
    await Promise.resolve();
    expect(resolved).toBe(true);
  });
});

describe('Mascot: clip events', () => {
  const evClip: Clip = {
    name: 'ev',
    duration: 1,
    loop: true,
    bones: { head: { x: [[0, 0]] } },
    events: [{ t: 0, effect: 'sparkles' }, { t: 0.5, effect: 'hearts' }, { t: 1, effect: 'notes' }],
  };
  const count = (events: MascotEvent[], effect: string) => events.filter((e) => e.type === 'effect' && e.effect === effect).length;

  it.each([DT, 1 / 60, 0.1, 0.25])('fire exactly once per loop, including t=0 events (dt=%s)', (dt) => {
    const { m, events } = make();
    m.play(evClip, { fade: 0 });
    run(m, 2.75, dt);
    expect(count(events, 'sparkles')).toBe(3); // t = 0, 1, 2
    expect(count(events, 'hearts')).toBe(3); // t = .5, 1.5, 2.5
    expect(count(events, 'notes')).toBe(2); // t = 1, 2 (end of cycles 0 and 1)
  });

  it('fire once in one-shots and stop after the clip ends', () => {
    const { m, events } = make();
    m.play({ ...evClip, loop: false }, { fade: 0 });
    run(m, 3);
    expect(count(events, 'sparkles')).toBe(1);
    expect(count(events, 'hearts')).toBe(1);
    expect(count(events, 'notes')).toBe(1);
  });

  it('respect repeat', () => {
    const { m, events } = make();
    m.play(evClip, { fade: 0, repeat: 2 });
    run(m, 4);
    expect(count(events, 'sparkles')).toBe(2);
    expect(count(events, 'hearts')).toBe(2);
  });

  it('do not fire for clips that are fading out', () => {
    const { m, events } = make();
    m.play(evClip, { fade: 0 });
    run(m, 0.25);
    m.play('idle', { fade: 1 });
    run(m, 1);
    expect(count(events, 'hearts')).toBe(0);
  });
});

describe('Mascot: effects', () => {
  it('spawns particles that expire', () => {
    const { m } = make();
    m.emit('sparkles');
    run(m, 0.3);
    expect(m.current.particles.length).toBeGreaterThan(0);
    for (const p of m.current.particles) {
      expect(p.transform.every(Number.isFinite)).toBe(true);
      expect(p.opacity).toBeGreaterThanOrEqual(0);
      expect(p.opacity).toBeLessThanOrEqual(1);
    }
    run(m, 10, 0.1);
    expect(m.current.particles).toEqual([]);
  });

  it('emits from anchors, bones and absolute points', () => {
    const { m } = make();
    m.emit('puff', { at: [500, 500] });
    run(m, 0.2);
    for (const p of m.current.particles) expect(Math.hypot(p.transform[4] - 500, p.transform[5] - 500)).toBeLessThan(200);
    m.clearEffects();
    m.emit('puff', { at: 'top' });
    m.emit('puff', { at: 'nose' });
    run(m, 0.2);
    expect(m.current.particles.length).toBeGreaterThan(0);
  });

  it('clip events spawn particles', () => {
    const { m } = make();
    m.play('wave', { fade: 0 });
    run(m, 0.2);
    expect(m.current.particles.length).toBeGreaterThan(0);
  });

  it('warns on unknown effects without throwing', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const { m } = make();
    m.emit('nope');
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('unknown effect "nope"'));
    expect(m.update(DT).particles).toEqual([]);
  });

  it('follow effects track their bone', () => {
    const { m } = make();
    m.emit('sweat', { at: 'head' });
    run(m, 0.3);
    const before = m.current.particles.map((p) => p.transform[4]);
    m.play(hold('root', 'x', 200), { fade: 0 });
    m.update(DT);
    const after = m.current.particles.map((p) => p.transform[4]);
    expect(after.length).toBeGreaterThan(0);
    expect(after[0] - before[0]).toBeGreaterThan(150);
  });
});

describe('Mascot: expressions & blink masking', () => {
  it('setExpression overrides for a duration, then reverts', () => {
    const { m, events } = make();
    m.setExpression('smirk', 1);
    m.update(DT);
    expect(m.current.frame.slots.mouth).toBe('smile');
    run(m, 1.1);
    expect(m.current.frame.slots.mouth).toBe('flat');
    expect(events.filter((e) => e.type === 'expression').map((e) => (e as { expression?: string }).expression)).toEqual(['smirk', undefined]);
  });

  it('setExpression(null) clears the override', () => {
    const { m } = make();
    m.setExpression('smirk');
    run(m, 5);
    expect(m.current.frame.slots.mouth).toBe('smile');
    m.setExpression(null);
    m.update(DT);
    expect(m.current.frame.slots.mouth).toBe('flat');
  });

  it('hides eye-slot swaps behind a blink', () => {
    const { m } = make();
    m.setExpression('happy');
    m.update(DT);
    // non-eye slots switch immediately; eyes wait for the blink to close
    expect(m.current.frame.slots.mouth).toBe('smile');
    expect(m.current.frame.slots['eye-l']).toBe('open');
    let swappedAt = -1;
    let sy = 1;
    for (let i = 0; i < 30 && swappedAt < 0; i++) {
      m.update(1 / 240);
      if (m.current.frame.slots['eye-l'] === 'happy') {
        swappedAt = i;
        sy = m.current.frame.bones[m.rig.bonesByName['eye-l'][0].bi].local[3];
      }
    }
    expect(swappedAt).toBeGreaterThan(0);
    expect(sy).toBeLessThan(0.5); // eyes (mostly) closed at the moment of the swap
    run(m, 0.5);
    expect(m.current.frame.slots['eye-l']).toBe('happy');
  });

  it('swaps immediately when the character has no blink param', () => {
    const { blink: _blink, ...params } = testCharacter.params!;
    const { m } = make({}, { ...testCharacter, params });
    m.setExpression('happy');
    m.update(DT);
    expect(m.current.frame.slots['eye-l']).toBe('happy');
  });

  it('clip expression tracks drive slots', () => {
    const { m } = make();
    m.play({ name: 'e', duration: 2, expression: [[0, 'smirk']] }, { fade: 0 });
    run(m, 0.5);
    expect(m.current.frame.slots.mouth).toBe('smile');
  });
});

describe('Mascot: params, look and shadow', () => {
  it('setParam overrides and clears', () => {
    const { m } = make();
    m.setParam('lookX', 1);
    m.update(DT);
    expect(m.current.frame.bones[m.rig.bonesByName.head[0].bi].yaw).toBeCloseTo(20);
    m.setParam('lookX', null);
    m.update(DT);
    expect(m.current.frame.bones[m.rig.bonesByName.head[0].bi].yaw).toBeCloseTo(0);
  });

  it('lookAt eases the look params toward the target', () => {
    const { m } = make();
    m.lookAt({ x: 5, y: 0 }); // clamped to 1
    m.update(DT);
    const early = m.current.frame.bones[m.rig.bonesByName.head[0].bi].yaw;
    run(m, 2);
    const late = m.current.frame.bones[m.rig.bonesByName.head[0].bi].yaw;
    expect(early).toBeGreaterThan(0);
    expect(early).toBeLessThan(late);
    expect(late).toBeCloseTo(20, 1);
  });

  it('the shadow shrinks and fades as the root rises', () => {
    const { m } = make();
    const s0 = m.current.frame.bones[m.rig.bonesByName.shadow[0].bi];
    m.play(hold('root', 'y', -150), { fade: 0 });
    m.update(DT);
    const s1 = m.current.frame.bones[m.rig.bonesByName.shadow[0].bi];
    expect(s1.opacity).toBeLessThan(s0.opacity);
    expect(s1.local[0]).toBeLessThan(1);
  });
});

describe('Mascot: alive layers', () => {
  it('blinks on its own', () => {
    const m = new Mascot(testCharacter, { seed: 3 });
    let minSy = 1;
    for (let i = 0; i < 6 * 60; i++) {
      m.update(1 / 60);
      minSy = Math.min(minSy, m.current.frame.bones[m.rig.bonesByName['eye-l'][0].bi].local[3]);
    }
    expect(minSy).toBeLessThan(0.3);
  });

  it('does not blink when alive is false', () => {
    const { m } = make();
    let minSy = 1;
    for (let i = 0; i < 6 * 60; i++) {
      m.update(1 / 60);
      minSy = Math.min(minSy, m.current.frame.bones[m.rig.bonesByName['eye-l'][0].bi].local[3]);
    }
    expect(minSy).toBeCloseTo(1, 6);
  });

  it('plays fidgets during idle', () => {
    const m = new Mascot({ ...testCharacter, idle: { clip: 'idle', fidgetEvery: 0.5, fidgets: ['wave'] } }, { seed: 1 });
    const started: string[] = [];
    m.on((e) => e.type === 'start' && started.push(e.clip));
    run(m, 4);
    expect(started).toContain('wave');
  });
});

describe('Mascot: determinism', () => {
  const script = (m: Mascot) => {
    const frames: string[] = [];
    for (let i = 0; i < 360; i++) {
      if (i === 30) m.play('emote-love' in m.clips ? 'emote-love' : Object.keys(m.clips)[1]);
      if (i === 60) m.emit('confetti');
      if (i === 200) m.play('fidget-hop');
      const f = m.update(1 / 60);
      if (i % 10 === 0) frames.push(renderSvg(m.rig, f.frame, { particles: f.particles }));
    }
    return frames;
  };

  it('same seed → identical frames (Echo, alive, with effects)', () => {
    const a = script(new Mascot(echo, { seed: 42, library }));
    const b = script(new Mascot(echo, { seed: 42, library }));
    expect(a).toEqual(b);
  });

  it('different seeds diverge', () => {
    const a = script(new Mascot(echo, { seed: 1, library }));
    const b = script(new Mascot(echo, { seed: 2, library }));
    expect(a).not.toEqual(b);
  });
});

describe('Mascot: springs', () => {
  const armAngle = (m: Mascot) => angleOf(m.current.frame.bones[m.rig.bonesByName['arm-l'][0].bi].local);

  it('lag behind a jolt and settle back to 0', () => {
    const { m } = make({ initial: 'none' });
    run(m, 0.5);
    expect(armAngle(m)).toBeCloseTo(0, 6);
    m.play({ name: 'jump', duration: 0.15, bones: { root: { y: [[0, 0, 'linear'], [0.15, -80]] } } }, { fade: 0, then: null });
    let peak = 0;
    for (let i = 0; i < 40; i++) {
      m.update(DT);
      peak = Math.max(peak, Math.abs(armAngle(m)));
    }
    expect(peak).toBeGreaterThan(2);
    run(m, 8);
    expect(Math.abs(armAngle(m))).toBeLessThan(0.05);
  });
});
