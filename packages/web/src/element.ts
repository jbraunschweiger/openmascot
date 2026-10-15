/**
 * `<open-mascot>` custom element — the zero-framework way to use OpenMascot.
 *
 * ```html
 * <script type="module">
 *   import { defineOpenMascot } from '@openmascot/web';
 *   import { echo } from '@openmascot/characters';
 *   defineOpenMascot({ characters: { echo } });
 * </script>
 * <open-mascot character="echo" animation="dance-bop" look-at-pointer style="width:240px"></open-mascot>
 * ```
 *
 * Attributes: `character`, `animation`, `expression`, `bpm`, `speed`, `padding`,
 * `look-at-pointer`, `paused`. Methods: `play()`, `emit()`, `setExpression()`, `lookAt()`.
 * Events: `mascot:start`, `mascot:end`, `mascot:loop`, `mascot:effect` (CustomEvent detail = event).
 */
import type { CharacterDef, PlayOptions } from '@openmascot/core';
import { MascotPlayer } from './player';

const registry: Record<string, CharacterDef> = {};

export function registerCharacter(def: CharacterDef) {
  registry[def.id] = def;
}

const BaseElement: typeof HTMLElement = typeof HTMLElement !== 'undefined' ? HTMLElement : (class {} as typeof HTMLElement);

export class OpenMascotElement extends BaseElement {
  static observedAttributes = ['character', 'animation', 'expression', 'bpm', 'speed', 'look-at-pointer', 'paused', 'padding'];
  player?: MascotPlayer;
  private off?: () => void;

  connectedCallback() {
    if (!this.style.display) this.style.display = 'inline-block';
    this.mount();
  }

  disconnectedCallback() {
    this.off?.();
    this.player?.destroy();
    this.player = undefined;
  }

  attributeChangedCallback(name: string, old: string | null, val: string | null) {
    if (old === val || !this.isConnected) return;
    if (name === 'character' || name === 'padding') {
      this.disconnectedCallback();
      this.mount();
      return;
    }
    const p = this.player;
    if (!p) return;
    if (name === 'animation' && val) p.play(val, { bpm: this.num('bpm'), then: null });
    if (name === 'expression') p.mascot.setExpression(val || null);
    if (name === 'speed') p.speed = this.num('speed') ?? 1;
    if (name === 'look-at-pointer') p.trackPointer(val !== null);
    if (name === 'paused') (val !== null ? p.stop() : p.start());
  }

  private num(attr: string) {
    const v = this.getAttribute(attr);
    return v != null && v !== '' ? Number(v) : undefined;
  }

  private mount() {
    const id = this.getAttribute('character') ?? Object.keys(registry)[0];
    const def = id ? registry[id] : undefined;
    if (!def) {
      console.warn(`[openmascot] <open-mascot>: unknown character "${id}". Call registerCharacter() first.`);
      return;
    }
    const anim = this.getAttribute('animation');
    this.player = new MascotPlayer(this, def, {
      initial: anim ?? undefined,
      lookAtPointer: this.hasAttribute('look-at-pointer'),
      speed: this.num('speed'),
      padding: this.num('padding'),
      autoplay: !this.hasAttribute('paused'),
    });
    if (anim) this.player.play(anim, { fade: 0, bpm: this.num('bpm'), then: null });
    const expr = this.getAttribute('expression');
    if (expr) this.player.mascot.setExpression(expr);
    this.off = this.player.mascot.on((e) => this.dispatchEvent(new CustomEvent(`mascot:${e.type}`, { detail: e })));
  }

  play(name: string, opts?: PlayOptions) {
    return this.player?.play(name, opts);
  }
  emit(effect: string, opts?: { at?: string | [number, number]; params?: Record<string, unknown> }) {
    this.player?.mascot.emit(effect, opts);
  }
  setExpression(name: string | null, duration?: number) {
    this.player?.mascot.setExpression(name, duration);
  }
  lookAt(target: { x: number; y: number } | null) {
    this.player?.mascot.lookAt(target);
  }
}

/** Register characters and define the `<open-mascot>` element (idempotent). */
export function defineOpenMascot(opts: { characters?: Record<string, CharacterDef> | CharacterDef[]; tag?: string } = {}) {
  const chars = opts.characters ? (Array.isArray(opts.characters) ? opts.characters : Object.values(opts.characters)) : [];
  chars.forEach(registerCharacter);
  const tag = opts.tag ?? 'open-mascot';
  if (typeof customElements !== 'undefined' && !customElements.get(tag)) customElements.define(tag, OpenMascotElement);
}
