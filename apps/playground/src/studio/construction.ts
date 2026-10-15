/**
 * Construction hero — the imperative scene behind the landing page's
 * "From a drawing to a character" animation.
 *
 * Everything shown is derived from the real compiled rig and the frames the
 * real `Mascot` solves:
 *
 * - `analyseRig` cuts the bone tree into *parts* (body/head own art, and each
 *   bone hanging off root/body/head with its subtree) and groups mirrored
 *   pairs into depth *levels*, ordered exactly like the engine draws them.
 * - `PartDom` is a pruned copy of the web `DomRenderer`: it builds the rig's
 *   SVG once (only the art a predicate accepts) and per frame only writes the
 *   transforms / opacity / slot / z-order that changed. One `PartDom` per
 *   level gives the exploded planes; one with everything is the live render.
 * - The exploded view is an orthographic tilt of the character plane
 *   (an affine map, so it stays plain SVG) with levels lifted along the depth
 *   axis. Joints and labels are projected with the same maths.
 */
import { apply, matToString, type BoneNode, type Frame, type MascotFrame, type ParticleFrame, type Rig, type RigNode } from '@openmascot/core';

const NS = 'http://www.w3.org/2000/svg';
const el = <K extends keyof SVGElementTagNameMap>(tag: K, attrs: Record<string, string | number> = {}, parent?: Element): SVGElementTagNameMap[K] => {
  const e = document.createElementNS(NS, tag);
  for (const k in attrs) e.setAttribute(k, String(attrs[k]));
  parent?.appendChild(e);
  return e;
};

/* ------------------------------------------------------------------ */
/* Rig analysis                                                         */
/* ------------------------------------------------------------------ */

interface Unit {
  bone: BoneNode | null;
  parent: number;
  visible: boolean;
}

export interface Level {
  /** Bottom (back) to top (front). */
  rank: number;
  bones: BoneNode[];
  label: string;
  meta: string;
  ghost: boolean;
  shadow: boolean;
}

export interface Joint {
  bone: BoneNode;
  parent: number;
  depth: number;
  level: number;
}

export interface Anatomy {
  levels: Level[];
  /** Art node index → level. */
  artLevel: Map<number, number>;
  /** Bone instance → level. */
  boneLevel: number[];
  joints: Joint[];
  maxJointDepth: number;
  /** Bones that are `back` surfaces (ghosted in the exploded view). */
  backBones: Set<number>;
  stats: { bones: number; instances: number; slots: number; springs: number };
}

const isContainerName = (n: string) => n === 'root' || n === 'body' || n === 'head';
const strip = (n: string) => n.replace(/-(l|r)$/, '');
const fmtN = (v: number) => String(Math.round(v * 10) / 10).replace('-', '−');

/** Short "z −20 · flat · spring" description of a bone. */
export function boneMeta(b: BoneNode): string {
  const bits: string[] = [];
  if (b.z) bits.push(`z ${fmtN(b.z)}`);
  if (b.surface !== 'volume') bits.push(b.surface);
  if (b.spring) bits.push('spring');
  if (b.shadow) bits.push('ground');
  return bits.join(' · ') || 'volume';
}

/** The bone's real `data-om-*` annotations, reconstructed from the compiled rig. */
export function boneAnnotations(b: BoneNode): [string, string][] {
  const r = (v: number) => String(Math.round(v * 10) / 10);
  const out: [string, string][] = [['data-om-bone', b.name]];
  if (b.shadow) out.push(['data-om-shadow', '']);
  out.push(['data-om-pivot', `${r(b.pivot[0])} ${r(b.pivot[1])}`]);
  if (b.z) out.push(['data-om-z', r(b.z)]);
  if (b.surface !== 'volume') out.push(['data-om-surface', b.surface]);
  if (b.normal[0] || b.normal[1]) out.push(['data-om-normal', `${r(b.normal[0])} ${r(b.normal[1])}`]);
  if (b.sortZ != null) out.push(['data-om-sort-z', r(b.sortZ)]);
  if (b.spring) out.push(['data-om-spring', `${r(b.spring.stiffness)} ${r(b.spring.damping)}`]);
  if (b.flatMin != null) out.push(['data-om-flat-min', r(b.flatMin)]);
  return out;
}

export function analyseRig(rig: Rig, rest: Frame): Anatomy {
  // 1. cut into units
  const units: Unit[] = [{ bone: null, parent: -1, visible: false }];
  const artUnit = new Map<number, number>();
  const boneUnit: number[] = [];
  const boneVisible: boolean[] = [];
  const boneHasArt: boolean[] = [];
  const parentBone: (BoneNode | null)[] = [];

  const walk = (nodes: RigNode[], unit: number, depth: number, parent: BoneNode | null, vis: boolean): boolean => {
    let any = false;
    for (const n of nodes) {
      if (n.kind === 'art') {
        artUnit.set(n.index, unit);
        if (vis) {
          units[unit].visible = true;
          any = true;
        }
      } else if (n.kind === 'bone') {
        let u = unit;
        if (n.shadow || depth <= 3 || isContainerName(n.name) || (parent && parent.name === 'head')) {
          u = units.length;
          units.push({ bone: n, parent: unit, visible: false });
        }
        boneUnit[n.bi] = u;
        boneVisible[n.bi] = vis;
        parentBone[n.bi] = parent;
        const has = walk(n.children, u, depth + 1, n, vis);
        boneHasArt[n.bi] = has;
        any = any || has;
      } else if (n.kind === 'layer') {
        any = walk(n.children, unit, depth, parent, vis) || any;
      } else {
        for (const v of n.variants) any = walk(v.children, unit, depth, parent, vis && v.name === n.defaultVariant) || any;
      }
    }
    return any;
  };
  walk(rig.nodes, 0, 1, null, true);

  // 2. units without visible art merge into their parent (or the body)
  const bodyUnit = units.findIndex((u) => u.bone?.name === 'body' && u.visible);
  const fallback = bodyUnit >= 0 ? bodyUnit : Math.max(0, units.findIndex((u) => u.visible));
  const final = (u: number): number => {
    let x = u;
    while (x >= 0 && !units[x].visible) x = units[x].parent;
    return x >= 0 ? x : fallback;
  };

  // 3. draw order of units at rest (follows Frame.order exactly like the renderers)
  const rank = new Map<number, number>();
  const visit = (nodes: RigNode[], key: number) => {
    const order = rest.order.get(key);
    for (let i = 0; i < nodes.length; i++) {
      const n = nodes[order ? order[i] : i];
      if (n.kind === 'art') {
        const u = final(artUnit.get(n.index)!);
        if (!rank.has(u)) rank.set(u, rank.size);
      } else if (n.kind === 'bone' || n.kind === 'layer') visit(n.children, n.index);
      else {
        const v = n.variants.find((x) => x.name === (rest.slots[n.name] ?? n.defaultVariant)) ?? n.variants[0];
        visit(v.children, n.index);
      }
    }
  };
  visit(rig.nodes, -1);

  // 4. levels: mirrored siblings (wing-l + wing-r) share one
  const groups = new Map<string, number[]>();
  for (const u of rank.keys()) {
    const b = units[u].bone;
    const key = `${units[u].parent}:${b ? strip(b.name) : '*'}`;
    groups.set(key, [...(groups.get(key) ?? []), u]);
  }
  const levelList = [...groups.values()].sort((a, b) => Math.min(...a.map((u) => rank.get(u)!)) - Math.min(...b.map((u) => rank.get(u)!)));
  const levelOfUnit = new Map<number, number>();
  const levels: Level[] = levelList.map((us, i) => {
    us.forEach((u) => levelOfUnit.set(u, i));
    const bones = us.map((u) => units[u].bone).filter((b): b is BoneNode => !!b);
    const b0 = bones[0];
    const names = bones.map((b) => b.name);
    const label = names.length === 2 && strip(names[0]) === strip(names[1]) ? `${strip(names[0])}-l/r` : names.join(' · ') || 'art';
    const ghost = !!b0 && b0.surface === 'back';
    return { rank: i, bones, label, meta: b0 ? (ghost ? 'back · culled' : boneMeta(b0)) : '', ghost, shadow: !!b0?.shadow };
  });

  const artLevel = new Map<number, number>();
  for (const [a, u] of artUnit) artLevel.set(a, levelOfUnit.get(final(u)) ?? 0);
  const shadowLevel = levels.findIndex((l) => l.shadow);
  const boneLevel = rig.bones.map((b) => (b.name === 'root' && shadowLevel >= 0 ? shadowLevel : levelOfUnit.get(final(boneUnit[b.bi])) ?? 0));

  // 5. joints: one per visible bone that carries art, skipping pivots that coincide with their parent's on the same level
  const joints: Joint[] = [];
  const jointOf = new Map<number, number>();
  const seen = new Set<string>();
  for (const b of rig.bones) {
    if (b.shadow || !boneVisible[b.bi] || !boneHasArt[b.bi] || seen.has(b.name)) continue;
    let p = parentBone[b.bi];
    while (p && !jointOf.has(p.bi)) p = parentBone[p.bi];
    const pj = p ? jointOf.get(p.bi)! : -1;
    const level = boneLevel[b.bi];
    if (pj >= 0) {
      const pb = joints[pj];
      if (pb.level === level && Math.hypot(pb.bone.pivot[0] - b.pivot[0], pb.bone.pivot[1] - b.pivot[1]) < 2) {
        jointOf.set(b.bi, pj);
        continue;
      }
    }
    seen.add(b.name);
    jointOf.set(b.bi, joints.length);
    joints.push({ bone: b, parent: pj, depth: pj >= 0 ? joints[pj].depth + 1 : 0, level });
  }

  const names = Object.keys(rig.bonesByName);
  return {
    levels,
    artLevel,
    boneLevel,
    joints,
    maxJointDepth: Math.max(1, ...joints.map((j) => j.depth)),
    backBones: new Set(rig.bones.filter((b) => b.surface === 'back').map((b) => b.bi)),
    stats: {
      bones: names.length,
      instances: rig.bones.length,
      slots: rig.slots.length,
      springs: names.filter((n) => rig.bonesByName[n][0].spring).length,
    },
  };
}

/** Featured bones for the annotation callouts: a spring limb, the head, an eye, a 3D feature. */
export function featuredBones(rig: Rig, an: Anatomy): BoneNode[] {
  const reps = an.levels.flatMap((l) => l.bones).filter((b) => !b.shadow);
  const by = (f: (b: BoneNode) => boolean) => reps.find(f);
  const picks = [
    by((b) => !!b.spring && b.name.endsWith('-l') && b.surface === 'flat') ?? by((b) => !!b.spring),
    by((b) => b.name === 'head'),
    rig.bonesByName['eye-l']?.[0],
    by((b) => b.surface === 'feature') ?? by((b) => b.surface === 'back'),
  ];
  const out: BoneNode[] = [];
  for (const p of picks) if (p && !out.includes(p)) out.push(p);
  return out;
}

/* ------------------------------------------------------------------ */
/* PartDom — pruned, incremental SVG renderer                           */
/* ------------------------------------------------------------------ */

interface Container {
  key: number;
  el: Element;
  kids: (Element | null)[];
  sig: string;
  slot?: string;
  variant?: string;
}

export class PartDom {
  readonly g: SVGGElement;
  private bones: { bi: number; el: SVGGElement; t: string; o: string }[] = [];
  private containers: Container[] = [];
  private slots: { name: string; variants: Map<string, Element>; current: string }[] = [];

  constructor(
    rig: Rig,
    private include: (artIndex: number) => boolean,
    private opts: { order?: boolean; opacity?: (bi: number, o: number) => number } = {},
  ) {
    this.g = el('g');
    const kids = this.build(rig.nodes, this.g);
    this.containers.push({ key: -1, el: this.g, kids, sig: '' });
  }

  get empty() {
    return !this.g.firstChild;
  }

  private build(nodes: RigNode[], parent: Element): (Element | null)[] {
    return nodes.map((n) => {
      const g = this.node(n);
      if (g) parent.appendChild(g);
      return g;
    });
  }

  private node(n: RigNode): Element | null {
    if (n.kind === 'art') {
      if (!this.include(n.index)) return null;
      const g = el('g');
      g.innerHTML = n.markup;
      return g;
    }
    if (n.kind === 'bone' || n.kind === 'layer') {
      const g = el('g', n.attrs);
      const kids = this.build(n.children, g);
      if (!kids.some(Boolean)) return null;
      if (n.kind === 'bone') {
        g.setAttribute('data-om-bone', n.name);
        this.bones.push({ bi: n.bi, el: g, t: '', o: '' });
      }
      this.containers.push({ key: n.index, el: g, kids, sig: '' });
      return g;
    }
    const g = el('g', n.attrs);
    const variants = new Map<string, Element>();
    for (const v of n.variants) {
      const vg = el('g', v.attrs);
      const kids = this.build(v.children, vg);
      if (!kids.some(Boolean)) continue;
      if (v.name !== n.defaultVariant) vg.setAttribute('display', 'none');
      g.appendChild(vg);
      variants.set(v.name, vg);
      this.containers.push({ key: n.index, el: vg, kids, sig: '', slot: n.name, variant: v.name });
    }
    if (!variants.size) return null;
    this.slots.push({ name: n.name, variants, current: n.defaultVariant });
    return g;
  }

  render(frame: Frame) {
    for (const b of this.bones) {
      const sb = frame.bones[b.bi];
      if (!sb) continue;
      const t = matToString(sb.local);
      if (t !== b.t) b.el.setAttribute('transform', (b.t = t));
      const op = this.opts.opacity ? this.opts.opacity(b.bi, sb.opacity) : sb.opacity;
      const o = op >= 0.999 ? '' : op <= 0.001 ? '0' : op.toFixed(3);
      if (o !== b.o) {
        if (o) b.el.setAttribute('opacity', o);
        else b.el.removeAttribute('opacity');
        if (o === '0') b.el.setAttribute('visibility', 'hidden');
        else if (b.o === '0') b.el.removeAttribute('visibility');
        b.o = o;
      }
    }
    for (const s of this.slots) {
      const want = frame.slots[s.name];
      if (want && want !== s.current) {
        s.variants.get(s.current)?.setAttribute('display', 'none');
        s.variants.get(want)?.removeAttribute('display');
        s.current = want;
      }
    }
    if (!this.opts.order) return;
    for (const c of this.containers) {
      if (c.slot && this.slots.find((s) => s.name === c.slot)?.current !== c.variant) continue;
      const order = frame.order.get(c.key);
      const sig = order ? order.join(',') : '';
      if (sig === c.sig) continue;
      c.sig = sig;
      for (const k of order ? order.map((i) => c.kids[i]) : c.kids) if (k) c.el.appendChild(k);
    }
  }
}

/** Particles, as in the web DomRenderer. */
class ParticleDom {
  private items = new Map<number, { el: SVGGElement; t: string; o: string }>();
  constructor(
    private back: SVGGElement,
    private front: SVGGElement,
  ) {}
  render(ps: ParticleFrame[]) {
    const seen = new Set<number>();
    for (const p of ps) {
      seen.add(p.id);
      let r = this.items.get(p.id);
      if (!r) {
        const g = el('g', {}, p.behind ? this.back : this.front);
        g.innerHTML = p.markup;
        r = { el: g, t: '', o: '' };
        this.items.set(p.id, r);
      }
      const t = matToString(p.transform);
      if (t !== r.t) r.el.setAttribute('transform', (r.t = t));
      const o = p.opacity >= 0.999 ? '1' : p.opacity.toFixed(3);
      if (o !== r.o) r.el.setAttribute('opacity', (r.o = o));
    }
    for (const [id, r] of this.items) {
      if (!seen.has(id)) {
        r.el.remove();
        this.items.delete(id);
      }
    }
  }
}

/* ------------------------------------------------------------------ */
/* Scene                                                                */
/* ------------------------------------------------------------------ */

export interface SceneState {
  /** Screen position of the character centre and scale (px per character unit) for the flat & tilted views. */
  cx: number;
  cy: number;
  scaleFlat: number;
  scaleIso: number;
  /** Vertical px between exploded levels. */
  spacing: number;
  /** 0 = front view, 1 = tilted exploded-view camera. */
  tilt: number;
  /** 0 = parts together, 1 = parts lifted apart by depth. */
  explode: number;
  /** Planes (exploded renderer) vs live renderer opacity. */
  planes: number;
  live: number;
  /** Phase 1: outline draw-on progress (0..1, staggered back → front), outline and fill opacity. */
  draw: number;
  outline: number;
  fill: number;
  /** Planes dimmed so the skeleton reads (0..1). */
  dim: number;
  /** Level labels (0..1, staggered) and the index of the highlighted level (-1 none). */
  labels: number;
  labelDim: number;
  highlight: number;
  /** Highlighted bone (pivot marker). */
  pivot: BoneNode | null;
  /** Skeleton draw-on progress (0..1) and opacity. */
  skeleton: number;
  skeletonAlpha: number;
  /** Top-view depth guide. */
  guide: number;
  guideX: number;
  guideY: number;
  guideR: number;
  /** Right-most x for the label column. */
  labelMaxX: number;
  mobile: boolean;
}

const A0 = (50 * Math.PI) / 180; // camera tilt
const B0 = (-24 * Math.PI) / 180; // in-plane turn

/** Height of the tilted character plane per unit of scale. */
export const isoHeight = (vb: [number, number, number, number]) => (vb[2] * Math.abs(Math.sin(B0)) + vb[3] * Math.cos(B0)) * Math.cos(A0);

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const clamp01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v);
const f1 = (v: number) => v.toFixed(1);

export class HeroScene {
  private planeEls: { g: SVGGElement; sheet: SVGRectElement; dom: PartDom; outline: SVGGElement | null; t: string }[] = [];
  private live: PartDom;
  private liveG: SVGGElement;
  private particles: ParticleDom;
  private skelLines: SVGLineElement[] = [];
  private skelDots: SVGCircleElement[] = [];
  private labelEls: { g: SVGGElement; lead: SVGPolylineElement; dot: SVGCircleElement; text: SVGTextElement; anchor: [number, number] }[] = [];
  private marker: SVGGElement;
  private guide: SVGGElement;
  private guideDots: SVGCircleElement[] = [];
  private guideLines: SVGLineElement[] = [];
  private guideYaw: SVGTextElement;
  private guideChips: SVGGElement[] = [];
  private layers: Record<'planes' | 'live' | 'skel' | 'labels' | 'mark', SVGGElement>;
  private pc: [number, number];
  private extent: number;
  private rootBi: number;
  private explode = 0;

  constructor(
    private svg: SVGSVGElement,
    private rig: Rig,
    private an: Anatomy,
    rest: Frame,
  ) {
    const vb = rig.viewBox;
    this.pc = [vb[0] + vb[2] / 2, vb[1] + vb[3] / 2];
    this.rootBi = rig.bonesByName.root?.[0]?.bi ?? 0;
    const L = (cls: string) => el('g', { class: cls }, svg);
    this.layers = { planes: L('ch-planes'), live: L('ch-live'), skel: L('ch-skel'), labels: L('ch-labels'), mark: L('ch-mark') };

    // exploded planes
    const back = an.backBones;
    for (const lv of an.levels) {
      const g = el('g', { class: `ch-plane${lv.ghost ? ' ghost' : ''}` }, this.layers.planes);
      const inset = 6;
      const sheet = el('rect', { class: 'ch-sheet', x: vb[0] + inset, y: vb[1] + inset, width: vb[2] - 2 * inset, height: vb[3] - 2 * inset, rx: 22 }, g);
      // `back` surfaces are culled at rest; ghost them in once the parts separate
      const dom = new PartDom(rig, (i) => an.artLevel.get(i) === lv.rank, {
        order: true,
        opacity: (bi, o) => (back.has(bi) ? Math.max(o, 0.5 * this.explode) : o),
      });
      dom.g.setAttribute('class', 'ch-fill');
      g.appendChild(dom.g);
      dom.render(rest);
      this.planeEls.push({ g, sheet, dom, outline: null, t: '' });
    }
    // outlines for the "drawing" phase: a static clone of each plane's rest pose
    for (const p of this.planeEls) {
      const o = p.dom.g.cloneNode(true) as SVGGElement;
      o.setAttribute('class', 'ch-outline');
      o.querySelectorAll('path,circle,ellipse,rect,polygon,polyline,line').forEach((s) => s.setAttribute('pathLength', '1'));
      p.g.appendChild(o);
      p.outline = o;
    }

    // live renderer
    this.liveG = el('g', {}, this.layers.live);
    const fxBack = el('g', {}, this.liveG);
    this.live = new PartDom(rig, () => true, { order: true });
    this.liveG.appendChild(this.live.g);
    const fxFront = el('g', {}, this.liveG);
    this.particles = new ParticleDom(fxBack, fxFront);

    // skeleton
    for (const j of an.joints) {
      const line = el('line', { class: 'ch-bone', pathLength: 1 }, this.layers.skel);
      if (j.parent < 0) line.setAttribute('display', 'none');
      this.skelLines.push(line);
    }
    for (const j of an.joints) this.skelDots.push(el('circle', { class: `ch-joint${j.bone.spring ? ' spring' : ''}`, r: j.depth === 0 ? 5 : 3.6 }, this.layers.skel));

    // labels (anchored on the right edge of each level's art)
    for (const lv of an.levels) {
      const g = el('g', { class: 'ch-label' }, this.layers.labels);
      const lead = el('polyline', { class: 'ch-lead' }, g);
      const dot = el('circle', { r: 2.6, class: 'ch-lead-dot' }, g);
      const text = el('text', {}, g);
      const n = el('tspan', { class: 'n' }, text);
      n.textContent = lv.label;
      const m = el('tspan', { class: 'm', dx: 8 }, text);
      m.textContent = lv.meta;
      this.labelEls.push({ g, lead, dot, text, anchor: [this.pc[0], this.pc[1]] });
    }
    this.measureAnchors();

    // pivot marker
    this.marker = el('g', { class: 'ch-pivot' }, this.layers.mark);
    el('circle', { r: 11, class: 'ring' }, this.marker);
    el('circle', { r: 3.4, class: 'core' }, this.marker);
    el('line', { x1: -17, x2: 17, y1: 0, y2: 0 }, this.marker);
    el('line', { x1: 0, x2: 0, y1: -17, y2: 17 }, this.marker);

    // top-view depth guide
    this.guide = el('g', { class: 'ch-guide' }, svg);
    el('circle', { class: 'disc', r: 1 }, this.guide);
    el('line', { class: 'axis', x1: -1, x2: 1 }, this.guide);
    el('line', { class: 'axis', y1: -1, y2: 1 }, this.guide);
    const t1 = el('text', { class: 'cap', 'text-anchor': 'middle' }, this.guide);
    t1.textContent = 'TOP VIEW · solved depth';
    const t2 = el('text', { class: 'cam', 'text-anchor': 'middle' }, this.guide);
    t2.textContent = '▲ camera';
    this.guideYaw = el('text', { class: 'yaw', 'text-anchor': 'middle' }, this.guide);
    for (const j of an.joints) {
      const l = el('line', { class: 'g-bone' }, this.guide);
      if (j.parent < 0) l.setAttribute('display', 'none');
      this.guideLines.push(l);
    }
    for (const j of an.joints) this.guideDots.push(el('circle', { class: `g-joint s-${j.bone.surface}`, r: j.depth === 0 ? 4.5 : 3.4 }, this.guide));
    ['parallax', 'depth sort', 'back-face cull'].forEach((s) => {
      const g = el('g', { class: 'chip' }, this.guide);
      el('rect', { rx: 10, height: 20, y: -14 }, g);
      const t = el('text', { 'text-anchor': 'middle' }, g);
      t.textContent = s;
      this.guideChips.push(g);
    });
    let ext = 60;
    for (const j of an.joints) ext = Math.max(ext, Math.abs(j.bone.pivot[0]));
    this.extent = ext;
  }

  /** Right edge (at mid height) of each level's art in character space; needs the planes in the DOM. */
  measureAnchors() {
    this.planeEls.forEach((p, i) => {
      try {
        const b = p.dom.g.getBBox();
        if (b.width || b.height) this.labelEls[i].anchor = [b.x + b.width, b.y + b.height / 2];
      } catch {
        /* not rendered yet */
      }
    });
  }

  /** Screen matrix of level `i` (or the flat live view with `i < 0`). */
  private matrix(s: SceneState, i: number): [number, number, number, number, number, number] {
    const a = s.tilt * A0;
    const b = s.tilt * B0;
    const S = lerp(s.scaleFlat, s.scaleIso, s.tilt);
    const ma = S * Math.cos(b);
    const mb = S * Math.sin(b) * Math.cos(a);
    const mc = -S * Math.sin(b);
    const md = S * Math.cos(b) * Math.cos(a);
    const n = this.an.levels.length;
    const off = i < 0 ? 0 : (i - (n - 1) / 2) * s.spacing * s.explode;
    const [px, py] = this.pc;
    return [ma, mb, mc, md, s.cx - ma * px - mc * py, s.cy - off - mb * px - md * py];
  }

  draw(s: SceneState, mf: MascotFrame) {
    const frame = mf.frame;
    const n = this.an.levels.length;
    const mats = this.an.levels.map((_, i) => this.matrix(s, i));
    const P = (i: number, x: number, y: number): [number, number] => apply(mats[i], x, y);

    // planes
    this.explode = s.explode;
    this.layers.planes.style.opacity = s.planes.toFixed(3);
    this.layers.planes.style.display = s.planes > 0.001 ? '' : 'none';
    if (s.planes > 0.001) {
      this.planeEls.forEach((p, i) => {
        p.dom.render(frame);
        const t = matToString(mats[i]);
        if (t !== p.t) p.g.setAttribute('transform', (p.t = t));
        const hl = i === s.highlight;
        p.g.classList.toggle('hl', hl);
        p.sheet.style.opacity = (s.explode * (hl ? 1 : 0.9)).toFixed(3);
        p.dom.g.style.opacity = (s.fill * (1 - 0.6 * s.dim * (hl ? 0.3 : 1))).toFixed(3);
        if (p.outline) {
          const st = 0.55;
          const d = clamp01((s.draw * (1 + st) - (st * i) / Math.max(1, n - 1)) / 1);
          p.outline.style.display = s.outline > 0.001 ? '' : 'none';
          p.outline.style.opacity = s.outline.toFixed(3);
          p.outline.style.setProperty('--draw', (1 - d).toFixed(4));
        }
      });
    }

    // live view
    this.layers.live.style.display = s.live > 0.001 ? '' : 'none';
    if (s.live > 0.001) {
      this.layers.live.style.opacity = s.live.toFixed(3);
      this.live.render(frame);
      this.particles.render(mf.particles);
      this.liveG.setAttribute('transform', matToString(this.matrix(s, -1)));
    }

    // world pivot of each joint, projected onto its level
    const jp = this.an.joints.map((j) => {
      const sb = frame.bones[j.bone.bi];
      const w = sb ? apply(sb.world, j.bone.pivot[0], j.bone.pivot[1]) : j.bone.pivot;
      return P(j.level, w[0], w[1]);
    });

    // skeleton
    const showSkel = s.skeletonAlpha > 0.001;
    this.layers.skel.style.display = showSkel ? '' : 'none';
    if (showSkel) {
      this.layers.skel.style.opacity = s.skeletonAlpha.toFixed(3);
      const D = this.an.maxJointDepth;
      this.an.joints.forEach((j, k) => {
        const p = clamp01((s.skeleton * 1.6 - (0.6 * j.depth) / D) / 1);
        const dot = this.skelDots[k];
        dot.setAttribute('cx', f1(jp[k][0]));
        dot.setAttribute('cy', f1(jp[k][1]));
        const pop = clamp01(p * 4);
        dot.style.opacity = pop.toFixed(2);
        dot.style.transform = `scale(${(0.4 + 0.6 * pop).toFixed(3)})`;
        dot.style.transformOrigin = `${f1(jp[k][0])}px ${f1(jp[k][1])}px`;
        if (j.parent >= 0) {
          const l = this.skelLines[k];
          const a = jp[j.parent];
          l.setAttribute('x1', f1(a[0]));
          l.setAttribute('y1', f1(a[1]));
          l.setAttribute('x2', f1(jp[k][0]));
          l.setAttribute('y2', f1(jp[k][1]));
          l.style.strokeDashoffset = (1 - clamp01(p * 1.4)).toFixed(3);
        }
      });
    }

    // labels
    const showLabels = s.labels > 0.001;
    this.layers.labels.style.display = showLabels ? '' : 'none';
    if (showLabels) {
      const pts = this.labelEls.map((l, i) => P(i, l.anchor[0], l.anchor[1]));
      const colX = Math.min(Math.max(...pts.map((p) => p[0])) + 30, s.labelMaxX);
      // resolve overlaps (labels sorted by y, min gap)
      const idx = pts.map((_, i) => i).sort((a, b) => pts[a][1] - pts[b][1]);
      const ys = new Array<number>(n);
      const gap = s.mobile ? 0 : 17;
      let prev = -Infinity;
      for (const i of idx) prev = ys[i] = Math.max(pts[i][1], prev + gap);
      const over = prev - (pts[idx[idx.length - 1]]?.[1] ?? prev);
      if (over > 0) for (const i of idx) ys[i] -= over / 2;
      this.labelEls.forEach((l, i) => {
        const st = clamp01(s.labels * 1.8 - (0.8 * (n - 1 - i)) / Math.max(1, n - 1));
        const hl = i === s.highlight;
        const vis = s.mobile ? (hl ? 1 : 0) : st * (hl || s.highlight < 0 ? 1 : 1 - 0.55 * s.labelDim);
        l.g.style.display = vis > 0.001 ? '' : 'none';
        if (vis <= 0.001) return;
        l.g.style.opacity = vis.toFixed(3);
        l.g.classList.toggle('hl', hl);
        l.g.classList.toggle('compact', s.mobile);
        const [ax, ay] = pts[i];
        const x = s.mobile ? Math.min(ax + 26, this.width - 90) : colX + (1 - st) * 14;
        const y = ys[i];
        l.lead.setAttribute('points', `${f1(ax)},${f1(ay)} ${f1(x - 16)},${f1(y)} ${f1(x - 4)},${f1(y)}`);
        l.dot.setAttribute('cx', f1(ax));
        l.dot.setAttribute('cy', f1(ay));
        l.text.setAttribute('x', f1(x));
        l.text.setAttribute('y', f1(y + 4));
      });
    }

    // pivot marker of the highlighted bone
    const b = s.pivot;
    if (b && s.highlight >= 0 && s.labels > 0.3) {
      const sb = frame.bones[b.bi];
      const w = sb ? apply(sb.world, b.pivot[0], b.pivot[1]) : b.pivot;
      const [x, y] = P(this.an.boneLevel[b.bi], w[0], w[1]);
      this.marker.style.display = '';
      this.marker.setAttribute('transform', `translate(${f1(x)} ${f1(y)})`);
    } else this.marker.style.display = 'none';

    // top-view guide: x and solved depth of every joint
    this.guide.style.display = s.guide > 0.001 ? '' : 'none';
    if (s.guide > 0.001) {
      const R = s.guideR;
      this.guide.style.opacity = s.guide.toFixed(3);
      this.guide.setAttribute('transform', `translate(${f1(s.guideX)} ${f1(s.guideY + (1 - s.guide) * 12)})`);
      const disc = this.guide.querySelector('.disc')!;
      disc.setAttribute('r', f1(R));
      const axes = this.guide.querySelectorAll('.axis');
      axes[0].setAttribute('x1', f1(-R));
      axes[0].setAttribute('x2', f1(R));
      axes[1].setAttribute('y1', f1(-R));
      axes[1].setAttribute('y2', f1(R));
      const caps = this.guide.querySelectorAll('text');
      caps[0].setAttribute('y', f1(-R - 12));
      caps[1].setAttribute('y', f1(R + 18));
      this.guideYaw.setAttribute('y', f1(-R + 26));
      const root = frame.bones[this.rootBi];
      const rw = root ? apply(root.world, 0, 0) : [0, 0];
      const k = (R * 0.86) / this.extent;
      const gp = this.an.joints.map((j) => {
        const sb = frame.bones[j.bone.bi];
        const w = sb ? apply(sb.world, j.bone.pivot[0], j.bone.pivot[1]) : j.bone.pivot;
        return [(w[0] - rw[0]) * k, (sb?.depth ?? 0) * k] as [number, number];
      });
      this.an.joints.forEach((j, i) => {
        const d = this.guideDots[i];
        d.setAttribute('cx', f1(gp[i][0]));
        d.setAttribute('cy', f1(gp[i][1]));
        if (j.parent >= 0) {
          const l = this.guideLines[i];
          l.setAttribute('x1', f1(gp[j.parent][0]));
          l.setAttribute('y1', f1(gp[j.parent][1]));
          l.setAttribute('x2', f1(gp[i][0]));
          l.setAttribute('y2', f1(gp[i][1]));
        }
      });
      const yaw = root?.yaw ?? 0;
      const yn = ((((yaw + 180) % 360) + 360) % 360) - 180;
      this.guideYaw.textContent = `root.yaw ${Math.round(yn)}°`;
      const on = [Math.abs(yn) > 4, frame.order.size > 0, Math.cos((yaw * Math.PI) / 180) < 0.35];
      const w = [74, 86, 112];
      let x = -(w.reduce((a, c) => a + c, 0) + 12) / 2;
      this.guideChips.forEach((c, i) => {
        c.classList.toggle('on', on[i]);
        c.setAttribute('transform', `translate(${f1(x)} ${f1(R + 52)})`);
        c.querySelector('rect')!.setAttribute('width', String(w[i]));
        c.querySelector('text')!.setAttribute('x', String(w[i] / 2));
        x += w[i] + 6;
      });
    }
  }

  width = 1000;
  resize(w: number, h: number) {
    this.width = w;
    this.svg.setAttribute('viewBox', `0 0 ${w} ${h}`);
  }

  destroy() {
    while (this.svg.firstChild) this.svg.firstChild.remove();
  }
}
