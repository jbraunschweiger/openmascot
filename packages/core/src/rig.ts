/**
 * Compiles an annotated SVG (docs/rig-format.md) into a {@link Rig}.
 */
import type { ArtNode, BoneNode, LayerNode, PinDef, Rig, RigNode, SlotNode, Surface } from './types';
import { parseXml, serializeXml, type XmlElement, type XmlNode } from './xml';

export class RigError extends Error {}

const SURFACES: Surface[] = ['volume', 'flat', 'face', 'back', 'feature'];

export interface RigWarning {
  message: string;
  bone?: string;
}

export interface CompileOptions {
  /** Colour substitutions applied to the markup (`#634c91` → `#ff0000`), case-insensitive. */
  recolor?: Record<string, string>;
  /** Collects non-fatal issues. */
  warnings?: RigWarning[];
}

function nums(s: string | undefined, n: number, what: string): number[] | undefined {
  if (s == null) return undefined;
  const parts = s.trim().split(/[\s,]+/).map(Number);
  if (parts.length !== n || parts.some((v) => !Number.isFinite(v))) {
    throw new RigError(`Invalid ${what}: "${s}" (expected ${n} numbers)`);
  }
  return parts;
}

function stripOm(attrs: Record<string, string>): Record<string, string> {
  const out: Record<string, string> = {};
  for (const k in attrs) {
    if (k.startsWith('data-om-') || k === 'display') continue;
    out[k] = attrs[k];
  }
  return out;
}

/** Compile annotated SVG source into a rig. */
export function compileRig(svgSource: string, opts: CompileOptions = {}): Rig {
  let src = svgSource;
  if (opts.recolor) {
    for (const from in opts.recolor) {
      src = src.replace(new RegExp(escapeRe(from), 'gi'), opts.recolor[from]);
    }
  }
  const svg = parseXml(src);
  if (svg.name !== 'svg') throw new RigError(`Root element must be <svg>, got <${svg.name}>`);
  const vb = nums(svg.attrs.viewBox, 4, 'viewBox');
  if (!vb) throw new RigError('The root <svg> needs a viewBox');

  const warnings = opts.warnings ?? [];
  let nodeIndex = 0;
  const bones: BoneNode[] = [];
  const bonesByName: Record<string, BoneNode[]> = {};
  const slots: SlotNode[] = [];
  const slotsByName: Record<string, SlotNode> = {};
  let defs = '';

  const compileChildren = (children: XmlNode[], parentPivot: [number, number], inVariant: string | null): RigNode[] => {
    const out: RigNode[] = [];
    let artBuf: string[] = [];
    const flush = () => {
      if (artBuf.length) {
        out.push({ kind: 'art', index: nodeIndex++, markup: artBuf.join('') } satisfies ArtNode);
        artBuf = [];
      }
    };
    for (const c of children) {
      if (c.type === 'text') {
        if (c.value.trim()) artBuf.push(c.value);
        continue;
      }
      if (c.name === 'defs') {
        defs += c.children.map(serializeXml).join('');
        continue;
      }
      if (c.name === 'title' || c.name === 'desc' || c.name === 'metadata') continue;
      const a = c.attrs;
      if ('data-om-bone' in a || 'data-om-slot' in a || 'data-om-layer' in a) {
        flush();
        out.push(compileNode(c, parentPivot, inVariant));
      } else if (containsAnnotated(c)) {
        // An unannotated group that contains bones: treat as a static layer so
        // nothing gets lost, and warn — the author probably forgot an attribute.
        flush();
        warnings.push({ message: `<${c.name}${a.id ? ` id="${a.id}"` : ''}> contains rig nodes but is not annotated; treated as a layer` });
        out.push(compileNode({ ...c, attrs: { ...a, 'data-om-layer': '' } }, parentPivot, inVariant));
      } else {
        artBuf.push(serializeXml(c));
      }
    }
    flush();
    return out;
  };

  const compileNode = (el: XmlElement, parentPivot: [number, number], inVariant: string | null): RigNode => {
    const a = el.attrs;
    const z = Number(a['data-om-z'] ?? 0);
    if (!Number.isFinite(z)) throw new RigError(`Invalid data-om-z "${a['data-om-z']}"`);
    if (el.name !== 'g') warnings.push({ message: `Rig node <${el.name}> should be a <g>` });

    if ('data-om-bone' in a) {
      const name = a['data-om-bone'] || a.id;
      if (!name) throw new RigError('data-om-bone needs a name');
      const pivot = (nums(a['data-om-pivot'], 2, `pivot of "${name}"`) as [number, number]) ?? [...parentPivot];
      const surface = (a['data-om-surface'] ?? 'volume') as Surface;
      if (!SURFACES.includes(surface)) throw new RigError(`Unknown surface "${surface}" on "${name}"`);
      const normal = (nums(a['data-om-normal'], 2, `normal of "${name}"`) as [number, number]) ?? [0, 0];
      const springNums = nums(a['data-om-spring'], 2, `spring of "${name}"`);
      const tip = (nums(a['data-om-tip'], 2, `tip of "${name}"`) as [number, number]) ?? [pivot[0], pivot[1] - 30];
      const limit = nums(a['data-om-spring-limit'], 2, `spring limit of "${name}"`) as [number, number] | undefined;
      if (limit && !(limit[0] <= limit[1])) throw new RigError(`Invalid spring limit of "${name}": min must be <= max`);
      if (limit && !springNums) warnings.push({ bone: name, message: `Bone "${name}" has data-om-spring-limit but no data-om-spring` });
      const sortZ = a['data-om-sort-z'] != null ? nums(a['data-om-sort-z'], 1, `sort-z of "${name}"`)![0] : undefined;
      const pin = parsePins(a['data-om-pin'], name);
      const flatMin = a['data-om-flat-min'] != null ? nums(a['data-om-flat-min'], 1, `flat-min of "${name}"`)![0] : undefined;
      if (flatMin !== undefined && !(flatMin >= 0 && flatMin <= 1)) throw new RigError(`Invalid flat-min of "${name}": expected 0..1`);
      const featureMin = a['data-om-feature-min'] != null ? nums(a['data-om-feature-min'], 1, `feature-min of "${name}"`)![0] : undefined;
      if (featureMin !== undefined && !(featureMin >= 0 && featureMin <= 1)) throw new RigError(`Invalid feature-min of "${name}": expected 0..1`);
      if (featureMin !== undefined && surface !== 'feature') warnings.push({ bone: name, message: `Bone "${name}" has data-om-feature-min but is not a feature surface` });
      if (flatMin !== undefined && surface !== 'flat') warnings.push({ bone: name, message: `Bone "${name}" has data-om-flat-min but is not a flat surface` });
      const bone: BoneNode = {
        kind: 'bone',
        index: nodeIndex++,
        bi: bones.length,
        name,
        pivot,
        z,
        surface,
        normal,
        spring: springNums ? { stiffness: springNums[0], damping: springNums[1], tip, ...(limit ? { limit } : {}) } : undefined,
        shadow: 'data-om-shadow' in a || undefined,
        ...(sortZ !== undefined ? { sortZ } : {}),
        ...(flatMin !== undefined ? { flatMin } : {}),
        ...(featureMin !== undefined ? { featureMin } : {}),
        ...(pin ? { pin } : {}),
        attrs: stripOm(a),
        children: [],
      };
      bones.push(bone);
      const list = (bonesByName[name] ??= []);
      if (list.length && !inVariant) {
        warnings.push({ bone: name, message: `Bone "${name}" is defined more than once outside of slot variants` });
      }
      list.push(bone);
      bone.children = compileChildren(el.children, pivot, inVariant);
      return bone;
    }

    if ('data-om-slot' in a) {
      const name = a['data-om-slot'] || a.id;
      if (!name) throw new RigError('data-om-slot needs a name');
      if (slotsByName[name]) throw new RigError(`Duplicate slot "${name}"`);
      const slot: SlotNode = {
        kind: 'slot',
        index: nodeIndex++,
        name,
        z,
        defaultVariant: '',
        variants: [],
        attrs: stripOm(a),
      };
      slots.push(slot);
      slotsByName[name] = slot;
      for (const c of el.children) {
        if (c.type !== 'element') continue;
        const vname = c.attrs['data-om-variant'];
        if (vname == null) {
          warnings.push({ message: `Slot "${name}" has a child without data-om-variant; ignored` });
          continue;
        }
        if (slot.variants.some((v) => v.name === vname)) throw new RigError(`Duplicate variant "${vname}" in slot "${name}"`);
        if ('data-om-default' in c.attrs || !slot.defaultVariant) {
          if ('data-om-default' in c.attrs || slot.variants.length === 0) slot.defaultVariant = vname;
        }
        slot.variants.push({
          name: vname,
          attrs: stripOm(c.attrs),
          children: compileChildren(c.children, parentPivot, `${name}:${vname}`),
        });
      }
      if (!slot.variants.length) throw new RigError(`Slot "${name}" has no variants`);
      return slot;
    }

    const layer: LayerNode = {
      kind: 'layer',
      index: nodeIndex++,
      z,
      attrs: stripOm(a),
      children: [],
    };
    layer.children = compileChildren(el.children, parentPivot, inVariant);
    return layer;
  };

  const nodes = compileChildren(svg.children, [0, 0], null);

  // Pinned bones are solved after the rest of the tree (see solve.ts), in
  // document order, so they may follow any bone except their own subtree or a
  // pinned bone that comes later.
  const pinned = bones.filter((b) => b.pin);
  for (const b of pinned) {
    for (const p of b.pin!) {
      const target = bonesByName[p.bone]?.[0];
      if (!target) warnings.push({ bone: b.name, message: `Bone "${b.name}" is pinned to unknown bone "${p.bone}"` });
      else if (target === b || isDescendant(target, b)) warnings.push({ bone: b.name, message: `Bone "${b.name}" cannot be pinned to itself or its own descendant "${p.bone}"` });
      else if (target.pin && pinned.indexOf(target) > pinned.indexOf(b)) warnings.push({ bone: b.name, message: `Bone "${b.name}" is pinned to "${p.bone}", a pinned bone later in the document` });
    }
  }
  if (!bonesByName.root) warnings.push({ message: 'No "root" bone; whole-body animations will have no effect' });

  // Layer-order consistency check: document order should match z order.
  const checkOrder = (children: RigNode[], where: string) => {
    let last = -Infinity;
    for (const c of children) {
      // bones sort by data-om-sort-z when present (see solve.ts)
      const z = c.kind === 'art' ? 0 : c.kind === 'bone' && c.sortZ !== undefined ? c.sortZ : c.z;
      if (z < last) {
        warnings.push({ message: `In ${where}: z-order differs from document order (z=${z} after z=${last}); the raw SVG preview will not match the engine` });
        break;
      }
      last = z;
    }
    for (const c of children) {
      if (c.kind === 'bone') checkOrder(c.children, `bone "${c.name}"`);
      else if (c.kind === 'layer') checkOrder(c.children, 'layer');
      else if (c.kind === 'slot') for (const v of c.variants) checkOrder(v.children, `slot "${c.name}:${v.name}"`);
    }
  };
  checkOrder(nodes, 'the top level');

  const svgAttrs: Record<string, string> = {};
  for (const k in svg.attrs) {
    if (k === 'viewBox' || k === 'xmlns' || k.startsWith('xmlns:') || k.startsWith('data-om-') || k === 'width' || k === 'height') continue;
    svgAttrs[k] = svg.attrs[k];
  }

  return {
    id: svg.attrs['data-om-character'] ?? 'character',
    viewBox: vb as [number, number, number, number],
    defs,
    nodes,
    bones,
    bonesByName,
    slots,
    slotsByName,
    svgAttrs,
  };
}

function parsePins(s: string | undefined, name: string): PinDef[] | undefined {
  if (s == null) return undefined;
  const t = s.trim().split(/[\s,;]+/).filter(Boolean);
  const usage = `Invalid pin of "${name}": "${s}" (expected 1–3 groups of "bone x y")`;
  if (t.length === 0 || t.length % 3 !== 0 || t.length > 9) throw new RigError(usage);
  const out: PinDef[] = [];
  for (let i = 0; i < t.length; i += 3) {
    const x = Number(t[i + 1]);
    const y = Number(t[i + 2]);
    if (!Number.isFinite(x) || !Number.isFinite(y) || Number.isFinite(Number(t[i]))) throw new RigError(usage);
    out.push({ bone: t[i], at: [x, y] });
  }
  return out;
}

function isDescendant(node: BoneNode | undefined, of: BoneNode): boolean {
  if (!node) return false;
  const walk = (ns: RigNode[]): boolean =>
    ns.some((n) => n === node || (n.kind === 'bone' || n.kind === 'layer' ? walk(n.children) : n.kind === 'slot' ? n.variants.some((v) => walk(v.children)) : false));
  return walk(of.children);
}

function containsAnnotated(el: XmlElement): boolean {
  for (const c of el.children) {
    if (c.type !== 'element') continue;
    if ('data-om-bone' in c.attrs || 'data-om-slot' in c.attrs || 'data-om-layer' in c.attrs) return true;
    if (containsAnnotated(c)) return true;
  }
  return false;
}

function escapeRe(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** Pretty-print a rig's node tree (used by `openmascot validate`). */
export function describeRig(rig: Rig): string {
  const lines: string[] = [];
  const walk = (nodes: RigNode[], depth: number) => {
    const pad = '  '.repeat(depth);
    for (const n of nodes) {
      if (n.kind === 'bone') {
        const bits = [`pivot ${n.pivot.join(',')}`];
        if (n.z) bits.push(`z ${n.z}`);
        if (n.surface !== 'volume') bits.push(n.surface);
        if (n.spring) bits.push(`spring ${n.spring.stiffness}/${n.spring.damping}${n.spring.limit ? ` ${n.spring.limit.join('..')}°` : ''}`);
        if (n.sortZ !== undefined) bits.push(`sort-z ${n.sortZ}`);
        if (n.flatMin !== undefined) bits.push(`flat-min ${n.flatMin}`);
        if (n.pin) bits.push(`pin ${n.pin.map((p) => p.bone).join('+')}`);
        lines.push(`${pad}● ${n.name}  (${bits.join(', ')})`);
        walk(n.children, depth + 1);
      } else if (n.kind === 'slot') {
        lines.push(`${pad}◆ slot ${n.name}${n.z ? ` (z ${n.z})` : ''}: ${n.variants.map((v) => (v.name === n.defaultVariant ? `[${v.name}]` : v.name)).join(' ')}`);
        for (const v of n.variants) {
          const inner: string[] = [];
          const collect = (ns: RigNode[]) => ns.forEach((x) => (x.kind === 'bone' ? inner.push(x.name) : x.kind !== 'art' && 'children' in x ? collect(x.children) : null));
          collect(v.children);
          if (inner.length) lines.push(`${pad}    ${v.name}: bones ${inner.join(', ')}`);
        }
      } else if (n.kind === 'layer') {
        lines.push(`${pad}▢ layer${n.z ? ` (z ${n.z})` : ''}`);
        walk(n.children, depth + 1);
      }
    }
  };
  walk(rig.nodes, 0);
  return lines.join('\n');
}
