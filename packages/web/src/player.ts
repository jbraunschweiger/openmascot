/**
 * MascotPlayer — a Mascot + DomRenderer + animation loop, mounted in an element.
 * Handles pausing when off-screen / tab hidden, reduced motion, and pointer tracking.
 */
import { Mascot, type CharacterDef, type MascotOptions, type PlayOptions } from '@openmascot/core';
import { DomRenderer, type DomRendererOptions } from './dom-renderer';

export interface PlayerOptions extends MascotOptions, DomRendererOptions {
  /** Start the loop immediately. Default true. */
  autoplay?: boolean;
  /** Eyes/head follow the pointer anywhere on the page. Default false. */
  lookAtPointer?: boolean;
  /** Global playback speed. Default 1. */
  speed?: number;
  /** Respect `prefers-reduced-motion` (fewer idle motions, no fidgets). Default true. */
  respectReducedMotion?: boolean;
}

export class MascotPlayer {
  readonly mascot: Mascot;
  readonly renderer: DomRenderer;
  readonly element: HTMLElement;
  speed: number;
  private raf = 0;
  private last = 0;
  private running = false;
  private visible = true;
  private io?: IntersectionObserver;
  private cleanup: (() => void)[] = [];

  constructor(element: HTMLElement, character: CharacterDef, opts: PlayerOptions = {}) {
    this.element = element;
    const reduced =
      (opts.respectReducedMotion ?? true) &&
      typeof matchMedia !== 'undefined' &&
      matchMedia('(prefers-reduced-motion: reduce)').matches;
    this.mascot = new Mascot(character, {
      ...opts,
      seed: opts.seed ?? Math.floor(Math.random() * 1e9),
      ...(reduced ? { alive: opts.alive ?? false } : {}),
    });
    this.renderer = new DomRenderer(this.mascot.rig, { padding: opts.padding, title: opts.title ?? character.name });
    this.renderer.svg.style.width = '100%';
    this.renderer.svg.style.height = '100%';
    this.renderer.svg.style.display = 'block';
    element.appendChild(this.renderer.svg);
    this.renderer.render(this.mascot.current);
    this.speed = opts.speed ?? 1;

    if (typeof IntersectionObserver !== 'undefined') {
      this.io = new IntersectionObserver((entries) => {
        this.visible = entries.some((e) => e.isIntersecting);
        if (this.visible && this.running) this.kick();
      });
      this.io.observe(element);
    }
    if (opts.lookAtPointer) this.trackPointer(true);
    if (opts.autoplay ?? true) this.start();
  }

  start() {
    if (this.running) return;
    this.running = true;
    this.kick();
  }

  stop() {
    this.running = false;
    cancelAnimationFrame(this.raf);
    this.raf = 0;
  }

  private kick() {
    if (this.raf) return;
    this.last = performance.now();
    this.raf = requestAnimationFrame(this.tick);
  }

  private tick = (now: number) => {
    this.raf = 0;
    if (!this.running) return;
    const dt = Math.min(0.1, (now - this.last) / 1000) * this.speed;
    this.last = now;
    this.renderer.render(this.mascot.update(dt));
    if (this.visible && !document.hidden) this.raf = requestAnimationFrame(this.tick);
    else if (!this.visible) {
      /* resumed by IntersectionObserver */
    } else {
      const onVis = () => {
        document.removeEventListener('visibilitychange', onVis);
        if (this.running) this.kick();
      };
      document.addEventListener('visibilitychange', onVis);
    }
  };

  /** Advance manually (when autoplay is off), e.g. for scrubbing. */
  step(dt: number) {
    this.renderer.render(this.mascot.update(dt));
  }

  play(name: string, opts?: PlayOptions) {
    return this.mascot.play(name, opts);
  }

  /** Make the eyes follow the pointer. */
  trackPointer(on: boolean) {
    this.cleanup.forEach((f) => f());
    this.cleanup = [];
    if (!on) {
      this.mascot.lookAt(null);
      return;
    }
    let idleTimer: ReturnType<typeof setTimeout> | undefined;
    const move = (e: PointerEvent) => {
      const p = this.clientToCharacter(e.clientX, e.clientY);
      if (p) this.mascot.lookAtPoint(p[0], p[1], 420);
      clearTimeout(idleTimer);
      idleTimer = setTimeout(() => this.mascot.lookAt(null), 2500);
    };
    const leave = () => this.mascot.lookAt(null);
    window.addEventListener('pointermove', move, { passive: true });
    document.addEventListener('pointerleave', leave);
    this.cleanup.push(() => {
      window.removeEventListener('pointermove', move);
      document.removeEventListener('pointerleave', leave);
      clearTimeout(idleTimer);
    });
  }

  /** Convert a client (page) point to character coordinates. */
  clientToCharacter(x: number, y: number): [number, number] | null {
    const svg = this.renderer.svg;
    const ctm = svg.getScreenCTM?.();
    if (!ctm) return null;
    const inv = ctm.inverse();
    return [inv.a * x + inv.c * y + inv.e, inv.b * x + inv.d * y + inv.f];
  }

  destroy() {
    this.stop();
    this.io?.disconnect();
    this.cleanup.forEach((f) => f());
    this.renderer.destroy();
  }
}
