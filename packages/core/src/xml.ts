/**
 * A tiny, dependency-free XML parser/serialiser — just enough for SVG.
 * Runs identically in browsers, Node, workers and React Native, which is why
 * we don't use DOMParser.
 */

export interface XmlElement {
  type: 'element';
  name: string;
  attrs: Record<string, string>;
  children: XmlNode[];
}
export interface XmlText {
  type: 'text';
  /** Raw (still escaped) text. */
  value: string;
}
export type XmlNode = XmlElement | XmlText;

export class XmlError extends Error {}

const NAME = /[A-Za-z_:][-A-Za-z0-9_:.]*/y;
const WS = /\s*/y;
const ATTR = /([A-Za-z_:][-A-Za-z0-9_:.]*)\s*=\s*("([^"]*)"|'([^']*)')/y;

/** Parse an XML document and return its root element. */
export function parseXml(src: string): XmlElement {
  let i = 0;
  const root: XmlElement = { type: 'element', name: '#document', attrs: {}, children: [] };
  const stack: XmlElement[] = [root];

  const fail = (msg: string): never => {
    const line = src.slice(0, i).split('\n').length;
    throw new XmlError(`${msg} (line ${line})`);
  };

  while (i < src.length) {
    const lt = src.indexOf('<', i);
    if (lt === -1) {
      pushText(src.slice(i));
      break;
    }
    if (lt > i) pushText(src.slice(i, lt));
    i = lt;
    if (src.startsWith('<!--', i)) {
      const end = src.indexOf('-->', i + 4);
      if (end === -1) fail('Unterminated comment');
      i = end + 3;
    } else if (src.startsWith('<![CDATA[', i)) {
      const end = src.indexOf(']]>', i);
      if (end === -1) fail('Unterminated CDATA');
      pushText(escapeText(src.slice(i + 9, end)));
      i = end + 3;
    } else if (src.startsWith('<?', i) || src.startsWith('<!', i)) {
      const end = src.indexOf('>', i);
      if (end === -1) fail('Unterminated declaration');
      i = end + 1;
    } else if (src.startsWith('</', i)) {
      i += 2;
      NAME.lastIndex = i;
      const m = NAME.exec(src);
      if (!m) fail('Bad closing tag');
      i = NAME.lastIndex;
      const top = stack.pop();
      if (!top || top.name !== m![0]) fail(`Mismatched </${m![0]}>`);
      const gt = src.indexOf('>', i);
      if (gt === -1) fail('Unterminated closing tag');
      i = gt + 1;
    } else {
      i += 1;
      NAME.lastIndex = i;
      const m = NAME.exec(src);
      if (!m) fail('Bad tag name');
      i = NAME.lastIndex;
      const el: XmlElement = { type: 'element', name: m![0], attrs: {}, children: [] };
      for (;;) {
        WS.lastIndex = i;
        WS.exec(src);
        i = WS.lastIndex;
        if (src.startsWith('/>', i)) {
          i += 2;
          stack[stack.length - 1].children.push(el);
          break;
        }
        if (src[i] === '>') {
          i += 1;
          stack[stack.length - 1].children.push(el);
          stack.push(el);
          break;
        }
        ATTR.lastIndex = i;
        const a = ATTR.exec(src);
        if (!a) fail(`Bad attribute in <${el.name}>`);
        el.attrs[a![1]] = a![3] ?? a![4];
        i = ATTR.lastIndex;
      }
    }
  }
  if (stack.length !== 1) throw new XmlError(`Unclosed <${stack[stack.length - 1].name}>`);
  const el = root.children.find((c): c is XmlElement => c.type === 'element');
  if (!el) throw new XmlError('No root element');
  return el;

  function pushText(value: string) {
    if (stack.length === 1) return; // ignore text outside the root element
    stack[stack.length - 1].children.push({ type: 'text', value });
  }
}

export function escapeText(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

export function escapeAttr(s: string): string {
  return s.replace(/&(?![a-zA-Z#][a-zA-Z0-9]*;)/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
}

export function serializeAttrs(attrs: Record<string, string>): string {
  let out = '';
  for (const k in attrs) out += ` ${k}="${escapeAttr(attrs[k])}"`;
  return out;
}

/** Serialise a node back to markup. Whitespace-only text is dropped. */
export function serializeXml(node: XmlNode): string {
  if (node.type === 'text') return node.value.trim() === '' ? '' : node.value;
  const inner = node.children.map(serializeXml).join('');
  const head = `<${node.name}${serializeAttrs(node.attrs)}`;
  return inner ? `${head}>${inner}</${node.name}>` : `${head}/>`;
}
