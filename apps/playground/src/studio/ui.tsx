/** Small UI primitives shared by the studio pages. */
import { useEffect, useRef, useState, type ReactNode } from 'react';

export function Panel(props: { title: ReactNode; actions?: ReactNode; children: ReactNode; className?: string; collapsible?: boolean; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(props.defaultOpen ?? true);
  return (
    <section className={`st-panel ${props.className ?? ''} ${open ? '' : 'closed'}`}>
      <header className="st-panel-h">
        {props.collapsible ? (
          <button className="st-panel-t" onClick={() => setOpen(!open)} aria-expanded={open}>
            <span className="st-caret">{open ? '▾' : '▸'}</span>
            {props.title}
          </button>
        ) : (
          <h3 className="st-panel-t">{props.title}</h3>
        )}
        {props.actions && <div className="st-panel-a">{props.actions}</div>}
      </header>
      {open && <div className="st-panel-b">{props.children}</div>}
    </section>
  );
}

export function Slider(props: {
  label: ReactNode;
  value: number;
  min: number;
  max: number;
  step?: number;
  onChange: (v: number) => void;
  format?: (v: number) => string;
  onReset?: () => void;
  active?: boolean;
  title?: string;
}) {
  const fmt = props.format ?? ((v: number) => String(Math.round(v * 100) / 100));
  return (
    <label className={`st-slider ${props.active ? 'active' : ''}`} title={props.title}>
      <span className="st-slider-l">{props.label}</span>
      <input type="range" min={props.min} max={props.max} step={props.step ?? 0.01} value={props.value} onChange={(e) => props.onChange(Number(e.target.value))} />
      <span className="st-slider-v">{fmt(props.value)}</span>
      {props.onReset && (
        <button className="st-mini" onClick={(e) => (e.preventDefault(), props.onReset!())} title="Reset" disabled={!props.active}>
          ↺
        </button>
      )}
    </label>
  );
}

export function Toggle(props: { label: ReactNode; checked: boolean; onChange: (v: boolean) => void; title?: string }) {
  return (
    <label className="st-toggle" title={props.title}>
      <input type="checkbox" checked={props.checked} onChange={(e) => props.onChange(e.target.checked)} />
      <span className="st-toggle-k" />
      <span>{props.label}</span>
    </label>
  );
}

export function Segmented<T extends string>(props: { value: T; options: { value: T; label: ReactNode; title?: string }[]; onChange: (v: T) => void; className?: string }) {
  return (
    <div className={`st-seg ${props.className ?? ''}`} role="radiogroup">
      {props.options.map((o) => (
        <button key={o.value} role="radio" aria-checked={o.value === props.value} className={o.value === props.value ? 'on' : ''} onClick={() => props.onChange(o.value)} title={o.title}>
          {o.label}
        </button>
      ))}
    </div>
  );
}

/** Minimal syntax highlighting for the code samples (TS/TSX/HTML). */
export function Code(props: { code: string; lang?: string }) {
  const html = highlight(props.code);
  return (
    <pre className="hm-code">
      <code dangerouslySetInnerHTML={{ __html: html }} />
    </pre>
  );
}

const escHtml = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

function highlight(src: string): string {
  const re = /(\/\/[^\n]*|<!--[\s\S]*?-->)|('(?:[^'\\]|\\.)*'|"(?:[^"\\]|\\.)*"|`(?:[^`\\]|\\.)*`)|(<\/?[a-zA-Z][\w-]*)|\b(import|from|export|const|let|await|async|new|return|function|type)\b|\b(\d+(?:\.\d+)?)\b/g;
  let out = '';
  let last = 0;
  for (let m; (m = re.exec(src)); ) {
    out += escHtml(src.slice(last, m.index));
    const cls = m[1] ? 'c' : m[2] ? 's' : m[3] ? 't' : m[4] ? 'k' : 'n';
    out += `<span class="tk-${cls}">${escHtml(m[0])}</span>`;
    last = m.index + m[0].length;
  }
  return out + escHtml(src.slice(last));
}

/** Fire `fn` every `ms` while mounted (latest `fn` is used). */
export function useInterval(fn: () => void, ms: number | null) {
  const ref = useRef(fn);
  ref.current = fn;
  useEffect(() => {
    if (ms == null) return;
    const id = setInterval(() => ref.current(), ms);
    return () => clearInterval(id);
  }, [ms]);
}

/** True once the element has been near the viewport (lazy mount for heavy tiles). */
export function useNearViewport<T extends Element>(margin = '600px') {
  const ref = useRef<T>(null);
  const [near, setNear] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el || near) return;
    if (typeof IntersectionObserver === 'undefined') return setNear(true);
    const io = new IntersectionObserver((es) => es.some((e) => e.isIntersecting) && setNear(true), { rootMargin: margin });
    io.observe(el);
    return () => io.disconnect();
  }, [near, margin]);
  return [ref, near] as const;
}
