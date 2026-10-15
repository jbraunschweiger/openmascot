// @vitest-environment happy-dom
import { afterEach, describe, expect, it } from 'vitest';
import { defineOpenMascot, MascotPlayer, OpenMascotElement } from '@openmascot/web';
import { testCharacter } from '../../core/test/fixtures';

afterEach(() => {
  document.body.innerHTML = '';
});

describe('MascotPlayer', () => {
  it('mounts an svg and steps manually when autoplay is off', () => {
    const host = document.createElement('div');
    document.body.appendChild(host);
    const p = new MascotPlayer(host, testCharacter, { autoplay: false, seed: 1, alive: false });
    expect(host.querySelector('svg')).toBe(p.renderer.svg);
    expect(p.renderer.svg.querySelector('title')!.textContent).toBe('Blob');
    p.play('wave', { fade: 0 });
    p.step(0.25);
    expect(p.mascot.time).toBe(0.25);
    expect(p.mascot.playing).toBe('wave');
    p.destroy();
    expect(host.querySelector('svg')).toBeNull();
  });

  it('starts and stops the loop', async () => {
    const host = document.createElement('div');
    document.body.appendChild(host);
    const p = new MascotPlayer(host, testCharacter, { seed: 1 });
    await new Promise((r) => setTimeout(r, 120));
    p.stop();
    const t = p.mascot.time;
    expect(t).toBeGreaterThan(0);
    await new Promise((r) => setTimeout(r, 60));
    expect(p.mascot.time).toBe(t);
    p.destroy();
  });
});

describe('<open-mascot>', () => {
  defineOpenMascot({ characters: [testCharacter] });

  it('is defined once and mounts the registered character', () => {
    defineOpenMascot({ characters: { blob: testCharacter } }); // idempotent
    expect(customElements.get('open-mascot')).toBe(OpenMascotElement);
    const el = document.createElement('open-mascot') as OpenMascotElement;
    el.setAttribute('character', 'blob');
    el.setAttribute('paused', '');
    el.setAttribute('expression', 'happy');
    document.body.appendChild(el);
    expect(el.player).toBeDefined();
    expect(el.querySelector('svg')).not.toBeNull();
    expect(el.style.display).toBe('inline-block');
    el.player!.step(0.5);
    expect(el.player!.mascot.current.frame.slots.mouth).toBe('smile');
  });

  it('re-dispatches runtime events as DOM events and reacts to attributes', () => {
    const el = document.createElement('open-mascot') as OpenMascotElement;
    el.setAttribute('paused', '');
    document.body.appendChild(el);
    const seen: string[] = [];
    el.addEventListener('mascot:start', (e) => seen.push((e as CustomEvent).detail.clip));
    el.setAttribute('animation', 'spin');
    expect(seen).toEqual(['spin']);
    el.setAttribute('speed', '2');
    expect(el.player!.speed).toBe(2);
    el.remove();
    expect(el.player).toBeUndefined();
  });

  it('warns for unknown characters', () => {
    const warn = console.warn;
    const msgs: string[] = [];
    console.warn = (m: string) => msgs.push(m);
    const el = document.createElement('open-mascot') as OpenMascotElement;
    el.setAttribute('character', 'ghost');
    document.body.appendChild(el);
    console.warn = warn;
    expect(el.player).toBeUndefined();
    expect(msgs[0]).toContain('unknown character "ghost"');
  });
});
