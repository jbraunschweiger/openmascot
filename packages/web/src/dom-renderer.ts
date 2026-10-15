/**
 * Live DOM renderer: builds the SVG once, then each frame only touches the
 * attributes that changed (transforms, opacity, slot visibility, z-order,
 * particles). No virtual DOM, no per-frame allocations of elements.
 */
import {
  matToString,
  paddedViewBox,
  type Frame,
  type MascotFrame,
  type ParticleFrame,
  type Rig,
  type RigNode,
} from '@openmascot/core';

const SVG_NS = 'http://www.w3.org/2000/svg';

export interface DomRendererOptions {
  /** Padding around the rig viewBox (character units). Default 40. */
  padding?: number | [number, number, number, number];
  /** Accessible label. */
  title?: string;
}

interface Container {
  el: Element;
  /** Child elements in document order (art nodes are wrapped). */
  children: Element[];
  /** Last applied order signature. */
  sig: string;
}

export class DomRenderer {
  readonly svg: SVGSVGElement;
  private rig: Rig;
  private boneEls: SVGGElement[] = [];
  private boneState: { t: string; o: string }[] = [];
  private containers = new Map<number, Container>();
  private slotEls = new Map<string, { variants: Map<string, Element>; current: string }>();
  private fxBack: SVGGElement;
  private fxFront: SVGGElement;
  private particles = new Map<number, { el: SVGGElement; t: string; o: string }>();

  constructor(rig: Rig, opts: DomRendererOptions = {}) {
    this.rig = rig;
    const svg = document.createElementNS(SVG_NS, 'svg') as SVGSVGElement;
    svg.setAttribute('viewBox', paddedViewBox(rig, opts.padding ?? 40).join(' '));
    svg.setAttribute('overflow', 'visible');
    for (const k in rig.svgAttrs) svg.setAttribute(k, rig.svgAttrs[k]);
    svg.setAttribute('role', 'img');
    if (opts.title) {
      const t = document.createElementNS(SVG_NS, 'title');
      t.textContent = opts.title;
      svg.appendChild(t);
    }
    if (rig.defs) {
      const defs = document.createElementNS(SVG_NS, 'defs');
      defs.innerHTML = rig.defs;
      svg.appendChild(defs);
    }
    this.fxBack = document.createElementNS(SVG_NS, 'g') as SVGGElement;
    this.fxBack.setAttribute('data-om-fx', 'back');
    svg.appendChild(this.fxBack);
    const top = document.createElementNS(SVG_NS, 'g');
    top.setAttribute('data-om-top', '');
    svg.appendChild(top);
    this.containers.set(-1, { el: top, children: this.build(rig.nodes, top), sig: '' });
    this.fxFront = document.createElementNS(SVG_NS, 'g') as SVGGElement;
    this.fxFront.setAttribute('data-om-fx', 'front');
    svg.appendChild(this.fxFront);
    this.svg = svg;
  }

  private build(nodes: RigNode[], parent: Element): Element[] {
    const els: Element[] = [];
    for (const n of nodes) {
      const g = document.createElementNS(SVG_NS, 'g');
      if (n.kind === 'art') {
        g.innerHTML = n.markup;
      } else if (n.kind === 'bone') {
        for (const k in n.attrs) g.setAttribute(k, n.attrs[k]);
        g.setAttribute('data-om-bone', n.name);
        this.boneEls[n.bi] = g as SVGGElement;
        this.boneState[n.bi] = { t: '', o: '' };
        this.containers.set(n.index, { el: g, children: this.build(n.children, g), sig: '' });
      } else if (n.kind === 'layer') {
        for (const k in n.attrs) g.setAttribute(k, n.attrs[k]);
        this.containers.set(n.index, { el: g, children: this.build(n.children, g), sig: '' });
      } else {
        for (const k in n.attrs) g.setAttribute(k, n.attrs[k]);
        g.setAttribute('data-om-slot', n.name);
        const variants = new Map<string, Element>();
        for (const v of n.variants) {
          const vg = document.createElementNS(SVG_NS, 'g');
          for (const k in v.attrs) vg.setAttribute(k, v.attrs[k]);
          vg.setAttribute('data-om-variant', v.name);
          const kids = this.build(v.children, vg);
          if (v.name !== n.defaultVariant) vg.setAttribute('display', 'none');
          g.appendChild(vg);
          variants.set(v.name, vg);
          // The slot's sortable container is the variant group.
          this.containers.set(variantKey(n.index, v.name), { el: vg, children: kids, sig: '' });
        }
        this.slotEls.set(n.name, { variants, current: n.defaultVariant });
      }
      parent.appendChild(g);
      els.push(g);
    }
    return els;
  }

  /** Apply a frame. */
  render(mf: MascotFrame | Frame) {
    const frame: Frame = 'frame' in mf ? mf.frame : mf;
    const bones = frame.bones;
    for (let i = 0; i < bones.length; i++) {
      const sb = bones[i];
      const el = this.boneEls[i];
      if (!sb || !el) continue;
      const st = this.boneState[i];
      const t = matToString(sb.local);
      if (t !== st.t) {
        el.setAttribute('transform', t);
        st.t = t;
      }
      const o = sb.opacity >= 0.999 ? '' : sb.opacity <= 0.001 ? '0' : sb.opacity.toFixed(3);
      if (o !== st.o) {
        if (o) el.setAttribute('opacity', o);
        else el.removeAttribute('opacity');
        if (o === '0') el.setAttribute('visibility', 'hidden');
        else if (st.o === '0') el.removeAttribute('visibility');
        st.o = o;
      }
    }
    for (const [name, s] of this.slotEls) {
      const want = frame.slots[name];
      if (want && want !== s.current && s.variants.has(want)) {
        s.variants.get(s.current)?.setAttribute('display', 'none');
        s.variants.get(want)!.removeAttribute('display');
        s.current = want;
      }
    }
    // z-order
    for (const [key, c] of this.containers) {
      let order: number[] | undefined;
      if (key <= -1000) {
        continue; // variant containers handled through their slot key below
      }
      order = frame.order.get(key);
      this.applyOrder(c, order);
    }
    for (const slot of this.rig.slots) {
      const s = this.slotEls.get(slot.name)!;
      const c = this.containers.get(variantKey(slot.index, s.current));
      if (c) this.applyOrder(c, frame.order.get(slot.index));
    }
    if ('particles' in mf) this.renderParticles(mf.particles);
  }

  private applyOrder(c: Container, order: number[] | undefined) {
    const sig = order ? order.join(',') : '';
    if (sig === c.sig) return;
    c.sig = sig;
    const list = order ? order.map((i) => c.children[i]) : c.children;
    for (const el of list) c.el.appendChild(el); // appendChild moves; result = desired order
  }

  private renderParticles(ps: ParticleFrame[]) {
    const seen = new Set<number>();
    for (const p of ps) {
      seen.add(p.id);
      let rec = this.particles.get(p.id);
      if (!rec) {
        const el = document.createElementNS(SVG_NS, 'g') as SVGGElement;
        el.innerHTML = p.markup;
        (p.behind ? this.fxBack : this.fxFront).appendChild(el);
        rec = { el, t: '', o: '' };
        this.particles.set(p.id, rec);
      }
      const t = matToString(p.transform);
      if (t !== rec.t) rec.el.setAttribute('transform', (rec.t = t));
      const o = p.opacity >= 0.999 ? '' : p.opacity.toFixed(3);
      if (o !== rec.o) {
        if (o) rec.el.setAttribute('opacity', o);
        else rec.el.removeAttribute('opacity');
        rec.o = o;
      }
    }
    for (const [id, rec] of this.particles) {
      if (!seen.has(id)) {
        rec.el.remove();
        this.particles.delete(id);
      }
    }
  }

  destroy() {
    this.svg.remove();
    this.particles.clear();
  }
}

// Variant containers get synthetic negative keys that can't collide with node indices.
const variantKeys = new Map<string, number>();
let nextVariantKey = -1000;
function variantKey(slotIndex: number, variant: string): number {
  const k = `${slotIndex}\u0000${variant}`;
  let v = variantKeys.get(k);
  if (v === undefined) variantKeys.set(k, (v = nextVariantKey--));
  return v;
}
