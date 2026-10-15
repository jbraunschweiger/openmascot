/**
 * Serialise a solved frame to a standalone SVG string. Used for server-side
 * rendering, frame sheets, snapshot tests and static exports.
 */
import type { ParticleFrame } from './effects';
import { isIdentity, matToString } from './mat';
import type { Frame, Rig, RigNode } from './types';
import { serializeAttrs } from './xml';

export interface RenderOptions {
  /** Extra space around the rig viewBox, in character units: number or [top, right, bottom, left]. Default 0. */
  padding?: number | [number, number, number, number];
  /** Explicit viewBox override. */
  viewBox?: [number, number, number, number];
  width?: number | string;
  height?: number | string;
  /** Background fill (omit for transparent). */
  background?: string;
  /** Particles to draw. */
  particles?: ParticleFrame[];
  /** Include `xmlns` (default true). */
  xmlns?: boolean;
  /** Extra attributes on the root `<svg>`. */
  attrs?: Record<string, string>;
}

export function paddedViewBox(rig: Rig, padding: RenderOptions['padding'] = 0): [number, number, number, number] {
  const [t, r, b, l] = typeof padding === 'number' ? [padding, padding, padding, padding] : padding;
  const [x, y, w, h] = rig.viewBox;
  return [x - l, y - t, w + l + r, h + t + b];
}

const fmt = (v: number) => String(Math.round(v * 1000) / 1000);

/** Render one frame of a rig as SVG markup. */
export function renderSvg(rig: Rig, frame: Frame, opts: RenderOptions = {}): string {
  const vb = opts.viewBox ?? paddedViewBox(rig, opts.padding);
  const attrs: Record<string, string> = {
    ...(opts.xmlns === false ? {} : { xmlns: 'http://www.w3.org/2000/svg' }),
    viewBox: vb.map(fmt).join(' '),
    ...rig.svgAttrs,
    ...(opts.attrs ?? {}),
  };
  if (opts.width != null) attrs.width = String(opts.width);
  if (opts.height != null) attrs.height = String(opts.height);
  let out = `<svg${serializeAttrs(attrs)}>`;
  if (rig.defs) out += `<defs>${rig.defs}</defs>`;
  if (opts.background) out += `<rect x="${fmt(vb[0])}" y="${fmt(vb[1])}" width="${fmt(vb[2])}" height="${fmt(vb[3])}" fill="${opts.background}"/>`;
  const particles = opts.particles ?? [];
  out += renderParticles(particles.filter((p) => p.behind));
  out += renderChildren(rig.nodes, -1, frame);
  out += renderParticles(particles.filter((p) => !p.behind));
  return out + '</svg>';
}

export function renderParticles(ps: ParticleFrame[]): string {
  let s = '';
  for (const p of ps) {
    if (p.opacity <= 0.001) continue;
    s += `<g transform="${matToString(p.transform)}"${p.opacity < 1 ? ` opacity="${fmt(p.opacity)}"` : ''}>${p.markup}</g>`;
  }
  return s;
}

function renderChildren(children: RigNode[], key: number, frame: Frame): string {
  const order = frame.order.get(key);
  let s = '';
  for (let i = 0; i < children.length; i++) s += renderNode(children[order ? order[i] : i], frame);
  return s;
}

function renderNode(n: RigNode, frame: Frame): string {
  switch (n.kind) {
    case 'art':
      return n.markup;
    case 'layer':
      return `<g${serializeAttrs(n.attrs)}>${renderChildren(n.children, n.index, frame)}</g>`;
    case 'slot': {
      const vname = frame.slots[n.name] ?? n.defaultVariant;
      const v = n.variants.find((x) => x.name === vname) ?? n.variants[0];
      return `<g${serializeAttrs({ ...n.attrs, 'data-om-slot': n.name })}><g${serializeAttrs({ ...v.attrs, 'data-om-variant': v.name })}>${renderChildren(v.children, n.index, frame)}</g></g>`;
    }
    case 'bone': {
      const sb = frame.bones[n.bi];
      const a: Record<string, string> = { ...n.attrs, 'data-om-bone': n.name };
      if (sb) {
        if (sb.opacity <= 0.001) return '';
        if (!isIdentity(sb.local)) a.transform = matToString(sb.local);
        if (sb.opacity < 0.999) a.opacity = fmt(sb.opacity);
      }
      return `<g${serializeAttrs(a)}>${renderChildren(n.children, n.index, frame)}</g>`;
    }
  }
}
