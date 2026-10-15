import { describe, expect, it } from 'vitest';
import { compileRig, describeRig, RigError, type RigWarning } from '../src/rig';
import type { ArtNode, BoneNode, LayerNode, RigNode } from '../src/types';
import { TEST_SVG } from './fixtures';

const svg = (inner: string, attrs = 'viewBox="0 0 100 100"') => `<svg xmlns="http://www.w3.org/2000/svg" ${attrs}>${inner}</svg>`;

function compile(src: string) {
  const warnings: RigWarning[] = [];
  const rig = compileRig(src, { warnings });
  return { rig, warnings: warnings.map((w) => w.message) };
}

describe('compileRig: the fixture character', () => {
  const { rig, warnings } = compile(TEST_SVG);
  const bone = (name: string, i = 0) => rig.bonesByName[name][i];

  it('compiles without warnings', () => {
    expect(warnings).toEqual([]);
  });

  it('reads the character id, viewBox, defs and root attributes', () => {
    expect(rig.id).toBe('blob');
    expect(rig.viewBox).toEqual([-100, -200, 200, 220]);
    expect(rig.defs).toContain('<linearGradient id="grad">');
    // viewBox/xmlns/width/height/data-om-* are dropped, the rest is kept.
    expect(rig.svgAttrs).toEqual({ class: 'mascot' });
  });

  it('builds the bone tree in document order with stable indices', () => {
    expect(rig.nodes.map((n) => (n as BoneNode).name)).toEqual(['shadow', 'root']);
    expect(rig.bones.map((b) => b.name)).toEqual([
      'shadow', 'root', 'body', 'back-patch', 'arm-l', 'arm-r', 'head', 'eye-l', 'pupil-l', 'pupil-l', 'nose',
    ]);
    rig.bones.forEach((b, i) => expect(b.bi).toBe(i));
    // node indices are unique across all node kinds
    const seen = new Set<number>();
    const walk = (ns: RigNode[]) =>
      ns.forEach((n) => {
        expect(seen.has(n.index)).toBe(false);
        seen.add(n.index);
        if (n.kind === 'bone' || n.kind === 'layer') walk(n.children);
        if (n.kind === 'slot') n.variants.forEach((v) => walk(v.children));
      });
    walk(rig.nodes);
  });

  it('parses pivots, z, surfaces and normals; pivots default to the parent pivot', () => {
    expect(bone('body').pivot).toEqual([0, -60]);
    expect(bone('back-patch').pivot).toEqual([0, -60]);
    expect(bone('back-patch').surface).toBe('back');
    expect(bone('back-patch').z).toBe(-30);
    expect(bone('root').surface).toBe('volume');
    expect(bone('eye-l').surface).toBe('face');
    expect(bone('eye-l').normal).toEqual([-20, 0]);
    expect(bone('head').normal).toEqual([0, 0]);
    expect(bone('nose').surface).toBe('feature');
  });

  it('parses springs and tips (tip defaults to 30 units above the pivot)', () => {
    expect(bone('arm-l').spring).toEqual({ stiffness: 100, damping: 10, tip: [-80, -80] });
    expect(bone('arm-r').spring).toBeUndefined();
    const { rig: r } = compile(svg('<g data-om-bone="root"><g data-om-bone="ear" data-om-pivot="10 20" data-om-spring="1 2"/></g>'));
    expect(r.bonesByName.ear[0].spring!.tip).toEqual([10, -10]);
  });

  it('marks the shadow bone', () => {
    expect(bone('shadow').shadow).toBe(true);
    expect(bone('root').shadow).toBeUndefined();
  });

  it('keeps non-om attributes on bones and strips data-om-* and display', () => {
    expect(bone('arm-l').attrs).toEqual({ id: 'arm' });
    expect(bone('root').attrs).toEqual({});
  });

  it('groups consecutive static art into a single art node', () => {
    const kinds = bone('body').children.map((c) => c.kind);
    expect(kinds).toEqual(['bone', 'bone', 'bone', 'art', 'layer', 'bone']);
    const art = bone('body').children[3] as ArtNode;
    expect(art.markup).toContain('<circle cy="-60" r="50"');
    expect(art.markup).toContain('<path d="M0 0L1 1"/>');
    expect(art.markup).not.toContain('<!--');
  });

  it('compiles layers with their z and attributes', () => {
    const layer = bone('body').children[4] as LayerNode;
    expect(layer.kind).toBe('layer');
    expect(layer.z).toBe(2);
    expect(layer.attrs).toEqual({ class: 'belly' });
    expect(layer.children[0].kind).toBe('art');
  });

  it('compiles slots, variants and defaults', () => {
    const eye = rig.slotsByName['eye-l'];
    const mouth = rig.slotsByName.mouth;
    expect(rig.slots.map((s) => s.name)).toEqual(['eye-l', 'mouth']);
    expect(eye.variants.map((v) => v.name)).toEqual(['open', 'happy', 'wide']);
    expect(eye.defaultVariant).toBe('open'); // first variant
    expect(mouth.defaultVariant).toBe('smile'); // data-om-default wins
    expect(mouth.z).toBe(35);
    // display="none" and data-om-* are stripped from variant attributes
    expect(eye.variants[1].attrs).toEqual({});
  });

  it('allows the same bone name in several variants (one instance each)', () => {
    const pupils = rig.bonesByName['pupil-l'];
    expect(pupils).toHaveLength(2);
    expect(pupils[0].pivot).toEqual([-20, -130]);
    // the second one has no pivot: inherits the pivot of the bone around the slot
    expect(pupils[1].pivot).toEqual([-20, -130]);
  });

  it('applies recolouring case-insensitively', () => {
    const r = compileRig(TEST_SVG, { recolor: { '#634c91': '#ff0000' } });
    const all = JSON.stringify(r.nodes);
    expect(all).not.toMatch(/#634c91/i);
    expect(all).toContain('#ff0000');
  });

  it('describeRig prints the tree', () => {
    const d = describeRig(rig);
    expect(d).toContain('● root');
    expect(d).toContain('◆ slot eye-l: [open] happy wide');
    expect(d).toContain('◆ slot mouth (z 35): flat [smile]');
    expect(d).toContain('open: bones pupil-l');
    expect(d).toContain('▢ layer (z 2)');
    expect(d).toContain('spring 100/10');
  });
});

describe('compileRig: warnings', () => {
  it('warns about unannotated groups that contain rig nodes and treats them as layers', () => {
    const { rig, warnings } = compile(svg('<g data-om-bone="root"><g id="wrap"><g data-om-bone="arm"/></g></g>'));
    expect(warnings).toEqual([expect.stringContaining('<g id="wrap"> contains rig nodes but is not annotated')]);
    const root = rig.bonesByName.root[0];
    expect(root.children[0].kind).toBe('layer');
    expect(((root.children[0] as LayerNode).children[0] as BoneNode).name).toBe('arm');
  });

  it('warns when document order disagrees with z order', () => {
    const { warnings } = compile(
      svg('<g data-om-bone="root"><g data-om-bone="a" data-om-z="5"/><g data-om-bone="b" data-om-z="-5"/></g>'),
    );
    expect(warnings).toEqual([expect.stringMatching(/In bone "root": z-order differs from document order \(z=-5 after z=5\)/)]);
  });

  it('art counts as z=0 for the order check', () => {
    const { warnings } = compile(svg('<g data-om-bone="root"><g data-om-bone="a" data-om-z="5"/><rect/></g>'));
    expect(warnings.some((w) => w.includes('z-order differs'))).toBe(true);
  });

  it('warns when there is no root bone', () => {
    const { warnings } = compile(svg('<g data-om-bone="body"/>'));
    expect(warnings).toEqual([expect.stringContaining('No "root" bone')]);
  });

  it('warns about duplicate bones outside slot variants', () => {
    const { rig, warnings } = compile(svg('<g data-om-bone="root"><g data-om-bone="a"/><g data-om-bone="a"/></g>'));
    expect(warnings).toEqual([expect.stringContaining('Bone "a" is defined more than once')]);
    expect(rig.bonesByName.a).toHaveLength(2);
  });

  it('warns about rig nodes that are not <g> and slot children without variants', () => {
    const { warnings } = compile(
      svg('<g data-om-bone="root"><rect data-om-bone="r"/><g data-om-slot="s"><g data-om-variant="a"/><g/></g></g>'),
    );
    expect(warnings).toContain('Rig node <rect> should be a <g>');
    expect(warnings).toContain('Slot "s" has a child without data-om-variant; ignored');
  });

  it('uses the id as a fallback name', () => {
    const { rig } = compile(svg('<g data-om-bone="" id="root"><g data-om-slot="" id="s"><g data-om-variant="x"/></g></g>'));
    expect(rig.bonesByName.root).toHaveLength(1);
    expect(rig.slotsByName.s.defaultVariant).toBe('x');
  });

  it('defaults the character id', () => {
    expect(compile(svg('<g data-om-bone="root"/>')).rig.id).toBe('character');
  });
});

describe('compileRig: errors', () => {
  it.each([
    ['<g/>', /Root element must be <svg>, got <g>/],
    ['<svg><g data-om-bone="root"/></svg>', /needs a viewBox/],
    [svg('', 'viewBox="0 0 100"'), /Invalid viewBox/],
    [svg('<g data-om-bone="root" data-om-pivot="1"/>'), /Invalid pivot of "root"/],
    [svg('<g data-om-bone="root" data-om-pivot="a b"/>'), /Invalid pivot of "root"/],
    [svg('<g data-om-bone="root" data-om-normal="1 2 3"/>'), /Invalid normal of "root"/],
    [svg('<g data-om-bone="root" data-om-spring="1"/>'), /Invalid spring of "root"/],
    [svg('<g data-om-bone="root" data-om-tip="x y"/>'), /Invalid tip of "root"/],
    [svg('<g data-om-bone="root" data-om-z="deep"/>'), /Invalid data-om-z "deep"/],
    [svg('<g data-om-bone="root" data-om-surface="shiny"/>'), /Unknown surface "shiny" on "root"/],
    [svg('<g data-om-bone=""/>'), /data-om-bone needs a name/],
    [svg('<g data-om-slot=""/>'), /data-om-slot needs a name/],
    [svg('<g data-om-slot="s"/>'), /Slot "s" has no variants/],
    [svg('<g data-om-slot="s"><g data-om-variant="a"/></g><g data-om-slot="s"><g data-om-variant="a"/></g>'), /Duplicate slot "s"/],
    [svg('<g data-om-slot="s"><g data-om-variant="a"/><g data-om-variant="a"/></g>'), /Duplicate variant "a" in slot "s"/],
    ['<svg viewBox="0 0 1 1"><g></svg>', /Mismatched/],
  ])('rejects %#', (src, msg) => {
    expect(() => compileRig(src)).toThrow(msg);
  });

  it('throws RigError for annotation problems', () => {
    expect(() => compileRig(svg('<g data-om-bone="root" data-om-surface="x"/>'))).toThrow(RigError);
  });
});

