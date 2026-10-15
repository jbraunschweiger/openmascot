/**
 * #/app — "Echo" app UI showcase.
 *
 * A live recreation of docs/reference/echo-app-ui.webp: an overview board of
 * every screen (like the mock), plus a focus mode that walks the flow one
 * phone at a time like a clickable prototype. Every Echo is the real animated
 * mascot, and the screens are interactive.
 */
import { Fragment, useCallback, useEffect, useRef, useState } from 'react';
import './showcase.css';
import { Echo, useEcho } from './kit/echo';
import { Phone } from './kit/phone';
import { IconArrowRight, IconChevronLeft, IconChevronRight, IconEighth, IconFocus, IconGrid, IconNote } from './kit/icons';
import { FLOW, SECTIONS, ALL_SECTIONS, type FlowScreen, type SectionDef } from './flow';

type Mode = 'grid' | 'focus';
const NEXT_DELAY = 1100; // let Echo's reaction play before moving on

function readQuery(): { mode: Mode; index: number } {
  const q = new URLSearchParams(location.hash.split('?')[1] ?? '');
  const id = q.get('focus');
  const i = id ? FLOW.findIndex((s) => s.id === id) : -1;
  return { mode: id !== null ? 'focus' : 'grid', index: Math.max(0, i) };
}
function writeQuery(mode: Mode, index: number) {
  const base = location.hash.split('?')[0] || '#/app';
  const url = mode === 'focus' ? `${base}?focus=${FLOW[index].id}` : base;
  history.replaceState(null, '', url);
}

export function Showcase() {
  const [{ mode, index }, setState] = useState(readQuery);
  const [pulse, setPulse] = useState<string | null>(null);
  const timers = useRef<number[]>([]);
  useEffect(() => () => timers.current.forEach(clearTimeout), []);
  useEffect(() => writeQuery(mode, index), [mode, index]);

  const setMode = (m: Mode) => setState((s) => ({ ...s, mode: m }));
  const goIndex = useCallback((i: number) => setState((s) => ({ ...s, index: (i + FLOW.length) % FLOW.length })), []);

  /** Advance from screen `from` to `to` (id), respecting the current mode. */
  const advance = useCallback(
    (from: number, toId?: string) => {
      const to = toId ? FLOW.findIndex((s) => s.id === toId) : (from + 1) % FLOW.length;
      timers.current.push(
        window.setTimeout(() => {
          if (mode === 'focus') return goIndex(to);
          const id = FLOW[to].id;
          setPulse(id);
          document.querySelector(`[data-screen="${id}"]`)?.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'nearest' });
          timers.current.push(window.setTimeout(() => setPulse((p) => (p === id ? null : p)), 1800));
        }, NEXT_DELAY),
      );
    },
    [mode, goIndex],
  );

  useEffect(() => {
    if (mode !== 'focus') return;
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLElement && /INPUT|TEXTAREA|SELECT/.test(e.target.tagName)) return;
      if (e.key === 'ArrowRight') setState((s) => ({ ...s, index: (s.index + 1) % FLOW.length }));
      if (e.key === 'ArrowLeft') setState((s) => ({ ...s, index: (s.index - 1 + FLOW.length) % FLOW.length }));
      if (e.key === 'Escape') setMode('grid');
    };
    addEventListener('keydown', onKey);
    return () => removeEventListener('keydown', onKey);
  }, [mode]);

  const renderPhone = (s: FlowScreen, i: number) => (
    <Phone key={s.id} id={s.id} aspect={s.aspect} dark={s.dark} mode={mode} pulse={pulse === s.id} label={s.caption} next={() => advance(i)} go={(id) => advance(i, id)}>
      <s.C />
    </Phone>
  );

  return (
    <div className={`sc-page sc-page--${mode}`}>
      <PageHeader mode={mode} setMode={setMode} />
      {mode === 'grid' ? <Overview renderPhone={renderPhone} /> : <Focus index={index} goIndex={goIndex} renderPhone={renderPhone} />}
      <footer className="sc-foot">
        <span>
          Echo <i>|</i> A happier way to learn music
        </span>
        <span className="sc-hand sc-foot-hand">
          Small steps. Big songs. <IconEighth />
        </span>
      </footer>
    </div>
  );
}

/* ---------------------------------------------------------------- header */
function PageHeader({ mode, setMode }: { mode: Mode; setMode: (m: Mode) => void }) {
  const e = useEcho('idle');
  useEffect(() => {
    const t = setTimeout(() => e.react(['wave', 'greet'], { expr: 'happy' }), 700);
    const id = setInterval(() => e.react(['wave', 'greet', 'emote-happy'], {}), 12000);
    return () => (clearTimeout(t), clearInterval(id));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return (
    <header className="sc-head">
      <div className="sc-brand">
        <h1>Echo</h1>
        <p>
          Play. Learn. Progress.
          <br />A more musical you.
        </p>
      </div>
      <div className="sc-head-echo" style={{ ['--p' as string]: '1px' }}>
        <Echo api={e} w={190} padding={30} onClick={() => e.react(['emote-sing', 'wave'], { fx: 'notes', expr: 'singing' })} title="Hi! I’m Echo." />
      </div>
      <div className="sc-hand sc-head-hand">
        Music
        <br />
        hears you
        <br />
        back.
      </div>
      <div className="sc-head-right">
        <div className="sc-claims">
          <span>
            Real instruments.
            <br />
            Real progress.
            <br />
            More music in your life.
          </span>
          <span className="sc-claims-notes" aria-hidden>
            <IconNote />
            <IconEighth />
          </span>
        </div>
        <div className="sc-modes" role="tablist" aria-label="View">
          <button type="button" role="tab" aria-selected={mode === 'grid'} className={mode === 'grid' ? 'is-on' : ''} onClick={() => setMode('grid')}>
            <IconGrid /> Overview
          </button>
          <button type="button" role="tab" aria-selected={mode === 'focus'} className={mode === 'focus' ? 'is-on' : ''} onClick={() => setMode('focus')}>
            <IconFocus /> Focus mode
          </button>
        </div>
      </div>
    </header>
  );
}

function SectionLabel({ s }: { s: SectionDef }) {
  return (
    <h2 className="sc-sec-label">
      {s.num}. {s.title} <span>— {s.sub}</span>
    </h2>
  );
}

/* -------------------------------------------------------------- overview */
function Overview({ renderPhone }: { renderPhone: (s: FlowScreen, i: number) => React.ReactNode }) {
  return (
    <div className="sc-board">
      {SECTIONS.map((row, r) => (
        <div className="sc-row" key={r}>
          {row.map((sec, si) => (
            <Fragment key={sec.id}>
              {si > 0 && (
                <span className="sc-arrow sc-arrow--between" aria-hidden>
                  <IconArrowRight />
                </span>
              )}
              <section className={`sc-sec sc-sec--${sec.id}` + (sec.screens.length > 1 ? ' sc-sec--multi' : '')} style={{ flexGrow: sec.grow }}>
                <SectionLabel s={sec} />
                <div className="sc-sec-phones">
                  {sec.screens.map((screen, k) => {
                    const i = FLOW.findIndex((f) => f.id === screen.id);
                    return (
                      <Fragment key={screen.id}>
                        {k > 0 && (
                          <span className="sc-arrow" aria-hidden>
                            <IconArrowRight />
                          </span>
                        )}
                        <figure className="sc-slot">
                          {renderPhone(FLOW[i], i)}
                          {!screen.hideCaption && <figcaption>{screen.caption}</figcaption>}
                        </figure>
                      </Fragment>
                    );
                  })}
                </div>
              </section>
            </Fragment>
          ))}
        </div>
      ))}
    </div>
  );
}

/* ----------------------------------------------------------------- focus */
function Focus({ index, goIndex, renderPhone }: { index: number; goIndex: (i: number) => void; renderPhone: (s: FlowScreen, i: number) => React.ReactNode }) {
  const s = FLOW[index];
  return (
    <div className="sc-focus">
      <div className="sc-focus-stage">
        <button type="button" className="sc-focus-nav" onClick={() => goIndex(index - 1)} aria-label="Previous screen">
          <IconChevronLeft />
        </button>
        <div className="sc-focus-phone" style={{ ['--aspect' as string]: s.aspect }}>
          {renderPhone(s, index)}
        </div>
        <button type="button" className="sc-focus-nav" onClick={() => goIndex(index + 1)} aria-label="Next screen">
          <IconChevronRight />
        </button>
      </div>
      <aside className="sc-focus-info">
        <SectionLabel s={s.section} />
        <div className="sc-focus-step">
          Screen {index + 1} of {FLOW.length}
        </div>
        <h3 className="sc-focus-title">{s.caption.replace(/^\d+\.\s*/, '')}</h3>
        <p className="sc-focus-echo">{s.echo}</p>
        <div className="sc-focus-map">
          {ALL_SECTIONS.map((sec) => (
            <div key={sec.id} className="sc-focus-group">
              <span className="sc-focus-group-n">{sec.num}</span>
              {sec.screens.map((scr) => {
                const i = FLOW.findIndex((f) => f.id === scr.id);
                return (
                  <button key={scr.id} type="button" className={'sc-dot' + (i === index ? ' is-on' : '')} onClick={() => goIndex(i)} aria-label={scr.caption} title={scr.caption} />
                );
              })}
            </div>
          ))}
        </div>
        <p className="sc-focus-tip">Use the buttons inside the phone to move through the flow, or ← / → keys.</p>
      </aside>
    </div>
  );
}
