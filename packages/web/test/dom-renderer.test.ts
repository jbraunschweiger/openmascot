// @vitest-environment happy-dom
import { beforeEach, describe, expect, it } from 'vitest';
import { compileRig, emptyPose, Mascot, resolvePose, solve, type Frame, type ParticleFrame, type Pose } from '@openmascot/core';
import { DomRenderer } from '@openmascot/web';
import { testCharacter } from '../../core/test/fixtures';

const rig = compileRig(testCharacter.svg);
const frameFor = (p: Partial<Pose> = {}): Frame => {
  const r = resolvePose(testCharacter, rig, { ...emptyPose(), ...p });
  return solve(rig, { channels: r.channels, slots: r.slots });
};
const boneEl = (r: DomRenderer, name: string, i = 0) => r.svg.querySelectorAll(`[data-om-bone="${name}"]`)[i] as SVGGElement;
const variantEl = (r: DomRenderer, slot: string, v: string) => r.svg.querySelector(`[data-om-slot="${slot}"] > [data-om-variant="${v}"]`)!;
const childBones = (el: Element) => [...el.children].map((c) => c.getAttribute('data-om-bone') ?? c.getAttribute('data-om-slot') ?? (c.getAttribute('class') || 'art'));

describe('DomRenderer', () => {
  let r: DomRenderer;
  beforeEach(() => {
    r = new DomRenderer(rig, { title: 'Blob the test' });
    document.body.innerHTML = '';
    document.body.appendChild(r.svg);
  });

  it('builds an accessible SVG with padding, defs and effect layers', () => {
    expect(r.svg.namespaceURI).toBe('http://www.w3.org/2000/svg');
    expect(r.svg.getAttribute('viewBox')).toBe('-140 -240 280 300');
    expect(r.svg.getAttribute('role')).toBe('img');
    expect(r.svg.getAttribute('class')).toBe('mascot');
    expect(r.svg.querySelector('title')!.textContent).toBe('Blob the test');
    expect(r.svg.querySelector('defs linearGradient#grad, defs #grad')).not.toBeNull();
    const top = [...r.svg.children].map((c) => c.getAttribute('data-om-fx') ?? (c.hasAttribute('data-om-top') ? 'top' : c.tagName.toLowerCase()));
    expect(top).toEqual(['title', 'defs', 'back', 'top', 'front']);
  });

  it('respects custom padding', () => {
    expect(new DomRenderer(rig, { padding: 0 }).svg.getAttribute('viewBox')).toBe('-100 -200 200 220');
  });

  it('builds one group per bone instance (including hidden variants)', () => {
    const groups = r.svg.querySelectorAll('[data-om-bone]');
    expect(groups.length).toBe(rig.bones.length);
    expect(boneEl(r, 'arm-l').getAttribute('id')).toBe('arm');
    expect(boneEl(r, 'arm-l').hasAttribute('data-om-pivot')).toBe(false);
    // static art is wrapped in its own group, layers keep their attributes
    expect(r.svg.querySelector('g.belly circle')).not.toBeNull();
  });

  it('shows only the default variant initially', () => {
    expect(variantEl(r, 'eye-l', 'open').getAttribute('display')).toBeNull();
    expect(variantEl(r, 'eye-l', 'happy').getAttribute('display')).toBe('none');
    expect(variantEl(r, 'mouth', 'smile').getAttribute('display')).toBeNull();
    expect(variantEl(r, 'mouth', 'flat').getAttribute('display')).toBe('none');
  });

  it('applies transforms and opacity', () => {
    r.render(frameFor());
    expect(boneEl(r, 'head').getAttribute('transform')).toBe('matrix(1 0 0 1 0 0)');
    expect(boneEl(r, 'head').getAttribute('opacity')).toBeNull();
    // back surfaces are culled at rest
    expect(boneEl(r, 'back-patch').getAttribute('opacity')).toBe('0');
    expect(boneEl(r, 'back-patch').getAttribute('visibility')).toBe('hidden');

    r.render(frameFor({ bones: { head: { rot: 90, opacity: 0.5 }, root: { yaw: 180 } } }));
    expect(boneEl(r, 'head').getAttribute('transform')).toMatch(/^matrix\(0 0?\.?\d+ -0?\.?\d+ 0 /);
    expect(boneEl(r, 'head').getAttribute('opacity')).toBe('0.500');
    expect(boneEl(r, 'back-patch').getAttribute('visibility')).toBeNull();
    expect(boneEl(r, 'back-patch').getAttribute('opacity')).toBeNull();

    r.render(frameFor());
    expect(boneEl(r, 'head').getAttribute('opacity')).toBeNull();
    expect(boneEl(r, 'head').getAttribute('transform')).toBe('matrix(1 0 0 1 0 0)');
  });

  it('only touches attributes that changed', () => {
    r.render(frameFor());
    const head = boneEl(r, 'head');
    let writes = 0;
    const orig = head.setAttribute.bind(head);
    head.setAttribute = (k: string, v: string) => {
      writes++;
      orig(k, v);
    };
    r.render(frameFor());
    expect(writes).toBe(0);
    r.render(frameFor({ bones: { head: { x: 3 } } }));
    expect(writes).toBe(1);
  });

  it('toggles slot variants', () => {
    r.render(frameFor({ expression: 'happy' }));
    expect(variantEl(r, 'eye-l', 'open').getAttribute('display')).toBe('none');
    expect(variantEl(r, 'eye-l', 'happy').getAttribute('display')).toBeNull();
    r.render(frameFor({ slots: { 'eye-l': 'wide' } }));
    expect(variantEl(r, 'eye-l', 'happy').getAttribute('display')).toBe('none');
    expect(variantEl(r, 'eye-l', 'wide').getAttribute('display')).toBeNull();
    // unknown variants are ignored (frame slots are already resolved, but be defensive)
    const f = frameFor();
    r.render({ ...f, slots: { ...f.slots, 'eye-l': 'nope' } });
    expect(variantEl(r, 'eye-l', 'wide').getAttribute('display')).toBeNull();
  });

  it('reorders children by depth and restores document order', () => {
    const body = boneEl(r, 'body');
    r.render(frameFor());
    const rest = childBones(body);
    expect(rest).toEqual(['back-patch', 'arm-l', 'arm-r', 'art', 'belly', 'head']);
    r.render(frameFor({ bones: { root: { yaw: 180 } } }));
    const back = childBones(body);
    expect(back).not.toEqual(rest);
    expect(back.indexOf('arm-l')).toBeGreaterThan(back.indexOf('head'));
    expect(back.indexOf('back-patch')).toBe(back.length - 1);
    r.render(frameFor());
    expect(childBones(body)).toEqual(rest);
  });

  it('adds, updates and removes particles', () => {
    const f = frameFor();
    const p = (id: number, behind = false, opacity = 1): ParticleFrame => ({ id, markup: '<circle r="2"/>', transform: [1, 0, 0, 1, id, 0], opacity, behind });
    const fx = (k: string) => r.svg.querySelector(`[data-om-fx="${k}"]`)!;
    r.render({ time: 0, frame: f, particles: [p(1), p(2, true, 0.5)] });
    expect(fx('front').children).toHaveLength(1);
    expect(fx('back').children).toHaveLength(1);
    expect(fx('front').children[0].getAttribute('transform')).toBe('matrix(1 0 0 1 1 0)');
    expect(fx('back').children[0].getAttribute('opacity')).toBe('0.500');
    expect(fx('front').querySelector('circle')).not.toBeNull();

    r.render({ time: 0.1, frame: f, particles: [{ ...p(1), transform: [1, 0, 0, 1, 9, 9] }, p(3)] });
    expect(fx('front').children).toHaveLength(2);
    expect(fx('back').children).toHaveLength(0);
    expect(fx('front').children[0].getAttribute('transform')).toBe('matrix(1 0 0 1 9 9)');

    r.render({ time: 0.2, frame: f, particles: [] });
    expect(fx('front').children).toHaveLength(0);
  });

  it('renders live Mascot frames', () => {
    const m = new Mascot(testCharacter, { alive: false });
    m.play('wave', { fade: 0 });
    for (let i = 0; i < 20; i++) r.render(m.update(1 / 60));
    expect(r.svg.querySelector('[data-om-fx="front"]')!.children.length).toBeGreaterThan(0);
    expect(boneEl(r, 'arm-r').getAttribute('transform')).not.toBe('matrix(1 0 0 1 0 0)');
  });

  it('destroy removes the svg', () => {
    r.destroy();
    expect(document.body.querySelector('svg')).toBeNull();
  });
});
