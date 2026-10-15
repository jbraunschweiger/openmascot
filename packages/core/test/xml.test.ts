import { describe, expect, it } from 'vitest';
import { escapeAttr, escapeText, parseXml, serializeAttrs, serializeXml, XmlError, type XmlElement } from '../src/xml';
import { TEST_SVG } from './fixtures';

describe('parseXml', () => {
  it('parses elements, attributes and nesting', () => {
    const el = parseXml(`<svg viewBox="0 0 10 10" a='single'><g id="x"><rect width="1"/></g></svg>`);
    expect(el.name).toBe('svg');
    expect(el.attrs).toEqual({ viewBox: '0 0 10 10', a: 'single' });
    const g = el.children[0] as XmlElement;
    expect(g.name).toBe('g');
    expect(g.attrs.id).toBe('x');
    expect((g.children[0] as XmlElement).name).toBe('rect');
    expect((g.children[0] as XmlElement).children).toEqual([]);
  });

  it('skips XML declarations, doctypes and comments', () => {
    const el = parseXml(`<?xml version="1.0"?>\n<!DOCTYPE svg>\n<!-- hi --><svg><!-- inner --><g/></svg>`);
    expect(el.name).toBe('svg');
    expect(el.children).toHaveLength(1);
  });

  it('keeps text (still escaped) and escapes CDATA', () => {
    const el = parseXml(`<svg><text>a &amp; b</text><style><![CDATA[a<b]]></style></svg>`);
    const text = el.children[0] as XmlElement;
    expect(text.children).toEqual([{ type: 'text', value: 'a &amp; b' }]);
    const style = el.children[1] as XmlElement;
    expect(style.children).toEqual([{ type: 'text', value: 'a&lt;b' }]);
  });

  it('ignores text outside the root element', () => {
    const el = parseXml(`junk <svg/> trailing`);
    expect(el.name).toBe('svg');
  });

  it('accepts names with namespaces, dashes and dots', () => {
    const el = parseXml(`<svg xmlns:xlink="http://www.w3.org/1999/xlink"><use xlink:href="#a" data-om-bone="a.b-c"/></svg>`);
    const use = el.children[0] as XmlElement;
    expect(use.attrs['xlink:href']).toBe('#a');
    expect(use.attrs['data-om-bone']).toBe('a.b-c');
  });

  it.each([
    ['<svg><g></svg>', /Mismatched <\/svg>/],
    ['<svg><g>', /Unclosed <g>/],
    ['<svg a=1></svg>', /Bad attribute in <svg>/],
    ['<svg><!-- oops</svg>', /Unterminated comment/],
    ['<svg><![CDATA[x</svg>', /Unterminated CDATA/],
    ['<svg></ ></svg>', /Bad closing tag/],
    ['<svg>< g/></svg>', /Bad tag name/],
    ['just text', /No root element/],
    ['', /No root element/],
  ])('rejects %j', (src, msg) => {
    expect(() => parseXml(src)).toThrow(XmlError);
    expect(() => parseXml(src)).toThrow(msg);
  });

  it('reports the line number of errors', () => {
    expect(() => parseXml('<svg>\n<g>\n</h>\n</svg>')).toThrow(/line 3/);
  });
});

describe('serializeXml', () => {
  it('self-closes empty elements and drops whitespace-only text', () => {
    const el = parseXml(`<svg>\n  <g>\n    <rect/>\n  </g>\n</svg>`);
    expect(serializeXml(el)).toBe('<svg><g><rect/></g></svg>');
  });

  it('round-trips a document stably', () => {
    const once = serializeXml(parseXml(TEST_SVG));
    const twice = serializeXml(parseXml(once));
    expect(twice).toBe(once);
    // Structure is preserved.
    expect(parseXml(once)).toEqual(parseXml(twice));
  });

  it('preserves attribute values including entities', () => {
    const el = parseXml(`<svg><text title="a &amp; b" q='say "hi"'>x</text></svg>`);
    const out = serializeXml(el);
    expect(out).toContain('title="a &amp; b"');
    expect(out).toContain('q="say &quot;hi&quot;"');
    expect(() => parseXml(out)).not.toThrow();
  });
});

describe('escaping', () => {
  it('escapes text', () => {
    expect(escapeText('a<b>&c')).toBe('a&lt;b&gt;&amp;c');
  });
  it('escapes attributes without double-escaping entities', () => {
    expect(escapeAttr('a & b')).toBe('a &amp; b');
    expect(escapeAttr('&amp; &#38; &x')).toBe('&amp; &#38; &amp;x');
    expect(escapeAttr('"<')).toBe('&quot;&lt;');
  });
  it('serialises attribute maps in insertion order', () => {
    expect(serializeAttrs({ b: '1', a: '2' })).toBe(' b="1" a="2"');
    expect(serializeAttrs({})).toBe('');
  });
});
