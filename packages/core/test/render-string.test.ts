import { describe, expect, it } from 'vitest';
import { echo } from '@openmascot/characters';
import { Mascot } from '../src/mascot';
import { paddedViewBox, renderParticles, renderSvg } from '../src/render-string';
import { parseXml, type XmlElement } from '../src/xml';
import { testCharacter } from './fixtures';

const all = (el: XmlElement): XmlElement[] => [el, ...el.children.filter((c): c is XmlElement => c.type === 'element').flatMap(all)];
const byAttr = (root: XmlElement, k: string, v?: string) => all(root).filter((e) => k in e.attrs && (v === undefined || e.attrs[k] === v));

describe('renderSvg', () => {
  const m = new Mascot(testCharacter, { alive: false });
  const svg = renderSvg(m.rig, m.current.frame);
  const doc = parseXml(svg);

  it('produces a well-formed standalone SVG', () => {
    expect(doc.name).toBe('svg');
    expect(doc.attrs.xmlns).toBe('http://www.w3.org/2000/svg');
    expect(doc.attrs.viewBox).toBe('-100 -200 200 220');
    expect(doc.attrs.class).toBe('mascot');
    expect((doc.children[0] as XmlElement).name).toBe('defs');
  });

  it('renders one group per visible bone, with no transform at rest', () => {
    const bones = byAttr(doc, 'data-om-bone');
    // back-patch is culled at rest; the hidden variant's pupil is not rendered
    expect(bones.map((b) => b.attrs['data-om-bone'])).toEqual(['shadow', 'root', 'body', 'arm-l', 'arm-r', 'head', 'eye-l', 'pupil-l', 'nose']);
    for (const b of bones) expect(b.attrs.transform, b.attrs['data-om-bone']).toBeUndefined();
    expect(bones.find((b) => b.attrs['data-om-bone'] === 'arm-l')!.attrs.id).toBe('arm');
  });

  it('renders only the visible variant of each slot', () => {
    const eye = byAttr(doc, 'data-om-slot', 'eye-l')[0];
    expect(eye.children).toHaveLength(1);
    expect((eye.children[0] as XmlElement).attrs['data-om-variant']).toBe('open');
    expect(byAttr(doc, 'data-om-variant', 'happy')).toEqual([]);
    expect(byAttr(doc, 'data-om-variant', 'wide')).toEqual([]);
    expect(svg).not.toContain('display="none"');
  });

  it('reflects slot changes and transforms', () => {
    m.setExpression('happy');
    m.play({ name: 'tilt', duration: 1, loop: true, bones: { head: { rot: [[0, 15]] }, body: { opacity: [[0, 0.5]] } } }, { fade: 0 });
    for (let i = 0; i < 30; i++) m.update(1 / 60);
    const d = parseXml(renderSvg(m.rig, m.current.frame));
    expect(byAttr(d, 'data-om-variant').map((v) => v.attrs['data-om-variant'])).toEqual(['happy', 'smile']);
    const head = byAttr(d, 'data-om-bone', 'head')[0];
    expect(head.attrs.transform).toMatch(/^matrix\(/);
    expect(byAttr(d, 'data-om-bone', 'body')[0].attrs.opacity).toBe('0.5');
  });

  it('applies padding, size, background and extra attributes', () => {
    const s = parseXml(renderSvg(m.rig, m.current.frame, { padding: 10, width: 300, height: '50%', background: '#fff', attrs: { role: 'img' }, xmlns: false }));
    expect(s.attrs.viewBox).toBe('-110 -210 220 240');
    expect(s.attrs.width).toBe('300');
    expect(s.attrs.height).toBe('50%');
    expect(s.attrs.role).toBe('img');
    expect(s.attrs.xmlns).toBeUndefined();
    expect(all(s).some((e) => e.name === 'rect' && e.attrs.fill === '#fff')).toBe(true);
    expect(paddedViewBox(m.rig, [1, 2, 3, 4])).toEqual([-104, -201, 206, 224]);
  });

  it('draws particles behind and in front of the character', () => {
    const front = { id: 1, markup: '<circle r="1"/>', transform: [1, 0, 0, 1, 5, 5] as [number, number, number, number, number, number], opacity: 0.5, behind: false };
    const back = { ...front, id: 2, behind: true, opacity: 1 };
    const gone = { ...front, id: 3, opacity: 0 };
    const s = renderSvg(m.rig, m.current.frame, { particles: [front, back, gone] });
    const d = parseXml(s);
    const top = d.children.filter((c): c is XmlElement => c.type === 'element');
    // defs, back particle, shadow, root, front particle
    expect(top.map((e) => e.attrs['data-om-bone'] ?? e.attrs.opacity ?? e.name)).toEqual(['defs', 'g', 'shadow', 'root', '0.5']);
    expect(renderParticles([gone])).toBe('');
  });

  it('renders every Echo expression as valid XML', () => {
    const e = new Mascot(echo, { alive: false });
    for (const name of Object.keys(echo.expressions)) {
      e.setExpression(name);
      for (let i = 0; i < 20; i++) e.update(1 / 60);
      const out = renderSvg(e.rig, e.current.frame, { particles: e.current.particles });
      expect(() => parseXml(out), name).not.toThrow();
      const vis = byAttr(parseXml(out), 'data-om-slot').map((s) => (s.children[0] as XmlElement).attrs['data-om-variant']);
      expect(vis.length, name).toBe(e.rig.slots.length);
    }
  });
});

