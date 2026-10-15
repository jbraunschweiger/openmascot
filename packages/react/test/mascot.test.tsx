// @vitest-environment happy-dom
import { act, createRef } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { Mascot, type MascotHandle } from '@openmascot/react';
import type { MascotEvent } from '@openmascot/core';
import { testCharacter } from '../../core/test/fixtures';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let host: HTMLDivElement;
let root: Root;
beforeEach(() => {
  host = document.createElement('div');
  document.body.appendChild(host);
  root = createRoot(host);
});
afterEach(() => {
  act(() => root.unmount());
  host.remove();
});

describe('<Mascot>', () => {
  it('mounts an SVG, exposes an imperative handle and unmounts cleanly', () => {
    const ref = createRef<MascotHandle>();
    const events: MascotEvent[] = [];
    act(() => {
      root.render(
        <Mascot ref={ref} character={testCharacter} paused title="Test blob" className="m" style={{ width: 120 }} options={{ seed: 1, alive: false }} onEvent={(e) => events.push(e)} />,
      );
    });
    const div = host.firstElementChild as HTMLDivElement;
    expect(div.className).toBe('m');
    expect(div.style.width).toBe('120px');
    const svg = div.querySelector('svg')!;
    expect(svg).not.toBeNull();
    expect(svg.querySelector('title')!.textContent).toBe('Test blob');
    expect(ref.current!.runtime!.playing).toBe('idle');

    act(() => {
      ref.current!.play('wave', { fade: 0 });
    });
    expect(ref.current!.runtime!.playing).toBe('wave');
    expect(events.some((e) => e.type === 'start' && e.clip === 'wave')).toBe(true);

    act(() => root.unmount());
    expect(host.querySelector('svg')).toBeNull();
    root = createRoot(host);
  });

  it('plays the `animation` prop, re-plays on change, and applies `expression`', () => {
    const ref = createRef<MascotHandle>();
    act(() => root.render(<Mascot ref={ref} character={testCharacter} paused animation="spin" options={{ alive: false }} />));
    expect(ref.current!.runtime!.playing).toBe('spin');
    act(() => root.render(<Mascot ref={ref} character={testCharacter} paused animation="wave" expression="happy" options={{ alive: false }} />));
    expect(ref.current!.runtime!.playing).toBe('wave');
    act(() => ref.current!.player!.step(0.5));
    expect(ref.current!.runtime!.current.frame.slots.mouth).toBe('smile');
  });

  it('recreates the player when the character changes', () => {
    const ref = createRef<MascotHandle>();
    act(() => root.render(<Mascot ref={ref} character={testCharacter} paused />));
    const first = ref.current!.runtime;
    act(() => root.render(<Mascot ref={ref} character={{ ...testCharacter }} paused />));
    expect(ref.current!.runtime).not.toBe(first);
    expect(host.querySelectorAll('svg')).toHaveLength(1);
  });
});
