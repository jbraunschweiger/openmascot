/**
 * Gallery — every character's emotions, poses, dances and expressions as live
 * mascots (Echo's tiles recreate docs/reference/echo-emotions.webp and
 * echo-poses.webp), plus an "All characters" mode that plays the same clip or
 * expression side by side and a portability matrix of clips × characters.
 *
 * `#/gallery?char=pip` · `#/gallery?char=*&clip=dance-bop&expr=happy`
 *
 * Everything is data-driven from the registry. A clip or expression a character
 * lacks renders a "not available" tile; each mascot sits in its own error
 * boundary so one broken character can't take the page down.
 */
import { useEffect, useMemo, useRef, useState, type CSSProperties, type MouseEvent, type ReactNode } from 'react';
import { Mascot, useMascotRef } from '@openmascot/react';
import { lintClip, type CharacterDef, type MascotEvent } from '@openmascot/core';
import { ALL, CAST, castInfo, clipOf, clipsOf, expressionFor, getCharacter, hasClip, hasExpression, hashQuery, ownClips, paddedVb, setHashQuery, tintOf, useCharacterSelection } from './cast';
import { BrokenArt, CharAvatar, CharacterAbout, CharacterPicker, ErrorBoundary, SafeMascot, tintStyle } from './cast-ui';
import { CATEGORY_ORDER, isBeats, pretty } from './shared';
import { useNearViewport } from './ui';
import './studio.css';

type Pad = [number, number, number, number];

const aspectOf = (c: CharacterDef, p: Pad) => {
  const vb = paddedVb(c, p);
  return `${vb[2]} / ${vb[3]}`;
};
/** Fraction (0..1) of a padded box at character coordinate (x, y). */
const at = (c: CharacterDef, p: Pad, x: number, y: number) => {
  const vb = paddedVb(c, p);
  return [(x - vb[0]) / vb[2], (y - vb[1]) / vb[3]];
};

const EMOTE_PAD: Pad = [80, 40, 26, 40];
const POSE_PAD: Pad = [72, 40, 30, 40];
const DANCE_PAD: Pad = [70, 40, 26, 40];
const EXPR_PAD: Pad = [16, -60, 14, -60];
const COMPARE_PAD: Pad = [80, 40, 26, 40];
const FILL: CSSProperties = { width: '100%', height: '100%' };

/** The reference-sheet emotions, in sheet order (other `emote-*` clips follow). */
const EMOTIONS: [string, string][] = [
  ['emote-excited', 'Excited'],
  ['emote-love', 'Love'],
  ['emote-unimpressed', 'Unimpressed'],
  ['emote-playful', 'Playful'],
  ['emote-inlove', 'In love'],
  ['emote-sing', 'Sing'],
  ['emote-proud', 'Proud'],
  ['emote-sad', 'Sad'],
];

const isDance = (n: string, cat?: string) => cat === 'dance' || n.startsWith('dance-');

/* ------------------------------------------------------------------ */

/** A tile that plays a clip, holds it briefly, and replays (instantly on hover/click). */
function ClipTile(props: {
  c: CharacterDef;
  clip: string;
  label: ReactNode;
  pad: Pad;
  /** 'replay' = one-shots replay after a pause; 'hover' = idle until hovered (dances). */
  mode?: 'replay' | 'hover';
  gap?: number;
  fallbackExpression?: string;
  decor?: ReactNode;
  meta?: ReactNode;
  /** Override the art box aspect (comparison grid uses one aspect for every character). */
  aspect?: string;
  /** Changing it restarts the clip (comparison "replay all"). */
  replayKey?: number;
  sub?: ReactNode;
  className?: string;
}) {
  const { c, clip, mode = 'replay', gap = 1600 } = props;
  const def = clipOf(c, clip);
  const exists = !!def;
  const [boxRef, near] = useNearViewport<HTMLButtonElement>();
  const ref = useMascotRef();
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const hovering = useRef(false);
  const bpm = isBeats(def) ? def!.bpm ?? 120 : undefined;

  const play = () => {
    clearTimeout(timer.current);
    if (exists) ref.current?.play(clip, { fade: 0.2, then: null, bpm });
  };
  const stop = () => {
    clearTimeout(timer.current);
    ref.current?.runtime?.idle(0.4);
  };
  useEffect(() => () => clearTimeout(timer.current), []);

  const onEvent = (e: MascotEvent) => {
    if (mode === 'replay' && e.type === 'end' && e.clip === clip) {
      clearTimeout(timer.current);
      timer.current = setTimeout(play, gap);
    }
  };

  return (
    <button
      ref={boxRef}
      className={`gl-tile ${exists ? '' : 'missing'} ${props.className ?? ''}`}
      onMouseEnter={() => {
        hovering.current = true;
        play();
      }}
      onMouseLeave={() => {
        hovering.current = false;
        if (mode === 'hover') stop();
      }}
      onClick={() => (mode === 'hover' && ref.current?.runtime?.playing === clip && !hovering.current ? stop() : play())}
      title={def?.description ?? `${c.name} has no “${clip}” clip`}
    >
      <div className="gl-art" style={{ aspectRatio: props.aspect ?? aspectOf(c, props.pad) }}>
        {props.decor}
        {near && (
          <SafeMascot
            ref={ref}
            character={c}
            padding={props.pad}
            animation={exists && mode === 'replay' ? clip : undefined}
            animationKey={props.replayKey ?? 0}
            holdLastFrame
            bpm={bpm}
            expression={exists ? undefined : props.fallbackExpression}
            onEvent={onEvent}
            className="gl-m"
            style={FILL}
          />
        )}
        {!exists ? <span className="gl-badge">not available</span> : props.meta}
        {exists && <span className="gl-replay">{mode === 'hover' ? '▶' : '↻'}</span>}
      </div>
      <div className="gl-cap">
        <b>{props.label}</b>
        {props.sub ?? <small>{clip}</small>}
      </div>
    </button>
  );
}

/* ------------------------------------------------------------------ */

/** `peek`: the character rises from behind a ledge. */
function PeekTile({ c }: { c: CharacterDef }) {
  const [boxRef, near] = useNearViewport<HTMLButtonElement>();
  const ref = useMascotRef();
  const pad: Pad = [30, 40, 30, 40];
  const vb = paddedVb(c, pad);
  const art = paddedVb(c, POSE_PAD);
  const artAspect = art[2] / art[3]; // matches the other pose tiles
  const mH = vb[2] / vb[3] / artAspect; // mascot height as a fraction of the art height
  const LEDGE = 0.7; // ledge top, fraction of art height; the ledge sits on the ground line (y = 0)
  const groundFrac = -vb[1] / vb[3];
  const top = LEDGE - groundFrac * mH;
  return (
    <button ref={boxRef} className="gl-tile" onMouseEnter={() => ref.current?.play('peek', { fade: 0.2, then: null })} onClick={() => ref.current?.play('peek', { fade: 0.2, then: null })} title={clipOf(c, 'peek')?.description}>
      <div className="gl-art" style={{ aspectRatio: String(artAspect) }}>
        <div className="gl-peek">
          <div className="gl-peek-clip" style={{ height: `${LEDGE * 100}%` }}>
            {near && (
              <SafeMascot
                ref={ref}
                character={c}
                padding={pad}
                animation="peek"
                animationKey={0}
                holdLastFrame
                className="gl-m"
                style={{ width: '100%', height: `${(mH * 100) / LEDGE}%`, top: `${(top * 100) / LEDGE}%` }}
              />
            )}
          </div>
          <div className="gl-ledge" style={{ top: `${LEDGE * 100}%` }} />
        </div>
        <span className="gl-replay">↻</span>
      </div>
      <div className="gl-cap">
        <b>Peek</b>
        <small>peek</small>
      </div>
    </button>
  );
}

function FrontTile({ c }: { c: CharacterDef }) {
  const [boxRef, near] = useNearViewport<HTMLButtonElement>();
  const ref = useMascotRef();
  const fidget = c.idle?.fidgets?.find((f) => hasClip(c, f));
  return (
    <button ref={boxRef} className="gl-tile" onClick={() => fidget && ref.current?.play(fidget)} title="Front view — the rest pose, alive">
      <div className="gl-art" style={{ aspectRatio: aspectOf(c, POSE_PAD) }}>
        {near && <SafeMascot ref={ref} character={c} padding={POSE_PAD} lookAtPointer className="gl-m" style={FILL} />}
      </div>
      <div className="gl-cap">
        <b>Front</b>
        <small>{c.idle?.clip ?? 'idle'}</small>
      </div>
    </button>
  );
}

function ExprTile({ c, name, label, aspect }: { c: CharacterDef; name: string; label?: ReactNode; aspect?: string }) {
  const [boxRef, near] = useNearViewport<HTMLDivElement>();
  const exists = hasExpression(c, name);
  return (
    <div className={`gl-expr ${exists ? '' : 'missing'}`} ref={boxRef} title={exists ? undefined : `${c.name} has no “${name}” expression`}>
      <div className="gl-art" style={{ aspectRatio: aspect ?? aspectOf(c, EXPR_PAD) }}>
        {near && <SafeMascot character={c} padding={EXPR_PAD} expression={exists ? name : undefined} className="gl-m" style={FILL} />}
        {!exists && <span className="gl-badge">not available</span>}
      </div>
      <b>{label ?? name}</b>
    </div>
  );
}

/** Pose/locomotion tile with scenery for the clips that need it. */
function PoseTile({ c, name }: { c: CharacterDef; name: string }) {
  if (name === 'peek') return <PeekTile c={c} />;
  let decor: ReactNode;
  if (name === 'hang') {
    // a branch just above the rig's top edge (the character hangs from y = viewBox top)
    const frac = at(c, POSE_PAD, 0, paddedVb(c, [0, 0, 0, 0])[1] + 2)[1];
    decor = <div className="gl-branch" style={{ top: `calc(${frac * 100}% - 10px)` }} />;
  }
  const label = name === 'fly-side' ? 'Fly (side)' : pretty(name);
  return <ClipTile c={c} clip={name} label={label} pad={POSE_PAD} decor={decor} fallbackExpression={name === 'wink' ? expressionFor(c, 'wink') : undefined} />;
}

/* ------------------------------------------------------------------ */

function Section(props: { id: string; title: ReactNode; sub?: ReactNode; children: ReactNode }) {
  return (
    <section className="gl-sec" id={props.id}>
      <div className="gl-sec-h">
        <h2>{props.title}</h2>
        {props.sub && <span>{props.sub}</span>}
      </div>
      {props.children}
    </section>
  );
}

const jump = (id: string) => (e: MouseEvent) => {
  e.preventDefault();
  document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' });
};

/* ------------------------------------------------------------------ */

function CharacterGallery({ c }: { c: CharacterDef }) {
  const clips = clipsOf(c);
  const emotions = useMemo(() => {
    const extra = Object.keys(clips)
      .filter((n) => n.startsWith('emote-') && !EMOTIONS.some(([e]) => e === n))
      .sort()
      .map((n) => [n, pretty(n)] as [string, string]);
    return [...EMOTIONS, ...extra];
  }, [clips]);
  const own = useMemo(() => ownClips(c), [c]);
  const poses = useMemo(() => {
    const rank = (n: string) => (clips[n].category === 'pose' ? 0 : 1);
    return own.filter((n) => clips[n].category === 'pose' || clips[n].category === 'locomotion').sort((a, b) => rank(a) - rank(b));
  }, [own, clips]);
  const signature = useMemo(() => own.filter((n) => !['pose', 'locomotion', 'dance', 'idle', 'fidget'].includes(clips[n].category ?? '') && !isDance(n, clips[n].category)).sort(), [own, clips]);
  const dances = useMemo(
    () =>
      Object.entries(clips)
        .filter(([n, cl]) => isDance(n, cl.category))
        .map(([n]) => n)
        .sort(),
    [clips],
  );
  const exprs = Object.keys(c.expressions ?? {});
  const ready = EMOTIONS.filter(([n]) => hasClip(c, n)).length;

  return (
    <>
      <nav className="gl-nav">
        <a href="#/gallery" onClick={jump('gl-emotions')}>Emotions</a>
        <a href="#/gallery" onClick={jump('gl-poses')}>Poses</a>
        {signature.length > 0 && <a href="#/gallery" onClick={jump('gl-signature')}>Signature</a>}
        <a href="#/gallery" onClick={jump('gl-dances')}>Dances</a>
        <a href="#/gallery" onClick={jump('gl-expressions')}>Expressions</a>
      </nav>

      <div className="gl-about">
        <CharacterAbout c={c} />
        <a className="st-btn ghost" href={`#/studio?char=${encodeURIComponent(c.id)}`}>
          Open {c.name} in the Studio →
        </a>
      </div>

      <Section id="gl-emotions" title="Emotions" sub={`${ready}/${EMOTIONS.length} reference emotes · ${emotions.length} total · shared library clips`}>
        <div className="gl-grid">
          {emotions.map(([clip, label], i) => (
            <ClipTile key={clip} c={c} clip={clip} label={label} pad={EMOTE_PAD} gap={1400 + (i % 4) * 350} fallbackExpression={expressionFor(c, clip)} />
          ))}
        </div>
      </Section>

      <Section id="gl-poses" title="Poses" sub={poses.length ? `front · ${poses.join(' · ')}` : `${c.name}-specific pose & locomotion clips`}>
        <div className="gl-grid poses">
          <FrontTile c={c} />
          {poses.map((n) => (
            <PoseTile key={n} c={c} name={n} />
          ))}
          {!poses.length && <p className="gl-empty">{c.name} has no character-specific pose or locomotion clips yet.</p>}
        </div>
      </Section>

      {signature.length > 0 && (
        <Section id="gl-signature" title="Signature moves" sub={`${c.name}-only clips`}>
          <div className="gl-grid poses">
            {signature.map((n) => (
              <ClipTile key={n} c={c} clip={n} label={pretty(n)} pad={POSE_PAD} meta={<span className={`gl-badge cat cat-${clips[n].category ?? 'other'}`}>{clips[n].category ?? 'other'}</span>} />
            ))}
          </div>
        </Section>
      )}

      <Section id="gl-dances" title="Dances" sub={dances.length ? `${dances.length} beat-synced routines · hover to dance` : 'beat-synced routines'}>
        <div className="gl-grid dances">
          {dances.length ? (
            dances.map((d) => {
              const cl = clips[d];
              return <ClipTile key={d} c={c} clip={d} label={pretty(d)} pad={DANCE_PAD} mode="hover" meta={<span className="gl-badge bpm">♪ {isBeats(cl) ? `${cl.bpm ?? 120} bpm` : `${cl.duration}s`}</span>} />;
            })
          ) : (
            <p className="gl-empty">{c.name} has no dances yet.</p>
          )}
        </div>
      </Section>

      <Section id="gl-expressions" title="Expressions" sub={`${exprs.length} named slot maps · eye swaps hide behind a blink`}>
        <div className="gl-strip">
          {exprs.map((e) => (
            <ExprTile key={e} c={c} name={e} />
          ))}
        </div>
      </Section>
    </>
  );
}

/* ------------------------------------------------------------------ */
/* All characters                                                       */
/* ------------------------------------------------------------------ */

/** Union of clip names across the cast, grouped by category. */
function castClipGroups(): [string, string[]][] {
  const cats: Record<string, Set<string>> = {};
  for (const c of CAST) for (const [n, cl] of Object.entries(clipsOf(c))) (cats[cl.category ?? 'other'] ??= new Set()).add(n);
  return Object.keys(cats)
    .sort((a, b) => {
      const ia = CATEGORY_ORDER.indexOf(a);
      const ib = CATEGORY_ORDER.indexOf(b);
      return (ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib) || a.localeCompare(b);
    })
    .map((k) => [k, [...cats[k]].sort()]);
}

type Cell = { kind: 'ok' } | { kind: 'warn'; problems: string[] } | { kind: 'missing' } | { kind: 'error' };

function clipCell(c: CharacterDef, name: string): Cell {
  const clip = clipOf(c, name);
  if (!clip) return { kind: 'missing' };
  const info = castInfo(c);
  if (!info) return { kind: 'error' };
  const problems = lintClip(clip, new Set(info.bones), new Set(Object.keys(c.params ?? {})));
  for (const [t, e] of clip.expression ?? []) if (!hasExpression(c, e)) problems.push(`expression @${t}: unknown "${e}"`);
  return problems.length ? { kind: 'warn', problems } : { kind: 'ok' };
}

function CompareAll() {
  const groups = useMemo(castClipGroups, []);
  const allNames = useMemo(() => groups.flatMap(([, n]) => n), [groups]);
  const allExprs = useMemo(() => [...new Set(CAST.flatMap((c) => Object.keys(c.expressions ?? {})))], []);
  const q = useMemo(hashQuery, []);
  const [clip, setClipState] = useState(() => (q.get('clip') && allNames.includes(q.get('clip')!) ? q.get('clip')! : allNames.includes('emote-excited') ? 'emote-excited' : allNames[0]));
  const [expr, setExprState] = useState(() => (q.get('expr') && allExprs.includes(q.get('expr')!) ? q.get('expr')! : allExprs.includes('happy') ? 'happy' : allExprs[0]));
  const [replay, setReplay] = useState(0);
  const [onlyGaps, setOnlyGaps] = useState(false);
  const setClip = (n: string) => (setClipState(n), setReplay((r) => r + 1), setHashQuery({ clip: n }));
  const setExpr = (n: string) => (setExprState(n), setHashQuery({ expr: n }));
  const step = (d: number) => setClip(allNames[(allNames.indexOf(clip) + d + allNames.length) % allNames.length]);
  const cols = { gridTemplateColumns: `repeat(${Math.max(3, Math.min(CAST.length, 4))}, minmax(0, 1fr))` };
  const cmpAspect = '1.5';

  const matrix = useMemo(() => groups.map(([cat, names]) => [cat, names.map((n) => [n, CAST.map((c) => clipCell(c, n))] as [string, Cell[]])] as [string, [string, Cell[]][]]), [groups]);
  const gaps = matrix.reduce((s, [, rows]) => s + rows.filter(([, cells]) => cells.some((x) => x.kind !== 'ok')).length, 0);

  return (
    <>
      <nav className="gl-nav">
        <a href="#/gallery" onClick={jump('gl-cmp-clip')}>Clip</a>
        <a href="#/gallery" onClick={jump('gl-cmp-expr')}>Expression</a>
        <a href="#/gallery" onClick={jump('gl-matrix')}>Portability</a>
      </nav>

      <Section id="gl-cmp-clip" title="Same clip, every character" sub="checks clip portability across the cast">
        <div className="gl-cmp-bar">
          <button className="st-icon" onClick={() => step(-1)} title="Previous clip">
            ◀
          </button>
          <select className="st-select gl-cmp-sel" value={clip} onChange={(e) => setClip(e.target.value)} aria-label="Clip">
            {groups.map(([cat, names]) => (
              <optgroup key={cat} label={cat}>
                {names.map((n) => (
                  <option key={n} value={n}>
                    {n}
                    {CAST.some((c) => !hasClip(c, n)) ? ` (${CAST.filter((c) => hasClip(c, n)).length}/${CAST.length})` : ''}
                  </option>
                ))}
              </optgroup>
            ))}
          </select>
          <button className="st-icon" onClick={() => step(1)} title="Next clip">
            ▶
          </button>
          <button className="st-btn sm" onClick={() => setReplay((r) => r + 1)}>
            ↻ Replay all
          </button>
        </div>
        <div className="gl-grid gl-cmp" style={cols}>
          {CAST.map((c) => {
            const def = clipOf(c, clip);
            const cell = clipCell(c, clip);
            return (
              <ClipTile
                key={`${c.id}:${clip}`}
                c={c}
                clip={clip}
                label={c.name}
                sub={cell.kind === 'warn' ? <small className="gl-lint" title={cell.problems.join('\n')}>⚠ {cell.problems.length}</small> : <small>{c.id}</small>}
                pad={COMPARE_PAD}
                aspect={cmpAspect}
                replayKey={replay}
                gap={1200}
                fallbackExpression={expressionFor(c, clip)}
                meta={isBeats(def) ? <span className="gl-badge bpm">♪ {def!.bpm ?? 120} bpm</span> : undefined}
              />
            );
          })}
        </div>
      </Section>

      <Section id="gl-cmp-expr" title="Same expression, every character">
        <div className="gl-cmp-bar">
          <div className="st-chips">
            {allExprs.map((e) => (
              <button key={e} className={`st-pill ${expr === e ? 'on' : ''}`} onClick={() => setExpr(e)}>
                {e}
                {CAST.some((c) => !hasExpression(c, e)) && ' *'}
              </button>
            ))}
          </div>
        </div>
        <div className="gl-grid gl-cmp" style={cols}>
          {CAST.map((c) => (
            <ExprTile key={c.id} c={c} name={expr} label={c.name} aspect="1.6" />
          ))}
        </div>
      </Section>

      <Section id="gl-matrix" title="Portability matrix" sub={`${allNames.length} clips × ${CAST.length} characters · ${gaps} with gaps or lint warnings · click a row to compare`}>
        <label className="st-toggle gl-gaps">
          <input type="checkbox" checked={onlyGaps} onChange={(e) => setOnlyGaps(e.target.checked)} />
          <span className="st-toggle-k" />
          <span>Only rows with gaps</span>
        </label>
        <div className="gl-matrix-wrap">
          <table className="gl-matrix">
            <thead>
              <tr>
                <th>clip</th>
                {CAST.map((c) => (
                  <th key={c.id} style={tintStyle(c)}>
                    <CharAvatar c={c} size={26} />
                    <span>{c.name}</span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {matrix.map(([cat, rows]) => {
                const shown = onlyGaps ? rows.filter(([, cells]) => cells.some((x) => x.kind !== 'ok')) : rows;
                if (!shown.length) return null;
                return [
                  <tr key={`cat:${cat}`} className="gl-mx-cat">
                    <td colSpan={CAST.length + 1}>
                      <span className={`st-dot cat-${cat}`} /> {cat}
                    </td>
                  </tr>,
                  ...shown.map(([n, cells]) => (
                    <tr key={`clip:${n}`} className={n === clip ? 'on' : ''} onClick={() => (setClip(n), document.getElementById('gl-cmp-clip')?.scrollIntoView({ behavior: 'smooth' }))}>
                      <td>{n}</td>
                      {cells.map((x, i) => (
                        <td key={CAST[i].id} className={`mx-${x.kind}`} title={x.kind === 'warn' ? x.problems.join('\n') : x.kind === 'missing' ? `${CAST[i].name} has no “${n}”` : undefined}>
                          {x.kind === 'ok' ? '✓' : x.kind === 'warn' ? `⚠ ${x.problems.length}` : x.kind === 'missing' ? '—' : '✕'}
                        </td>
                      ))}
                    </tr>
                  )),
                ];
              })}
            </tbody>
          </table>
        </div>
        <p className="st-hint">✓ available and lint-clean for that rig · ⚠ lint warnings (unknown bones/params/expressions — hover for details) · — not available.</p>
      </Section>
    </>
  );
}

/* ------------------------------------------------------------------ */

export function Gallery() {
  const [id, select] = useCharacterSelection({ allowAll: true });
  const all = id === ALL && CAST.length > 1;
  const c = getCharacter(id) ?? CAST[0];
  return (
    <div className="gl" style={all ? undefined : { ['--tint' as string]: tintOf(c) }}>
      <div className="gl-head">
        <div>
          <h1>{all ? 'The whole cast' : `${c.name} gallery`}</h1>
          <p>{all ? 'The same clip and expression on every character, side by side.' : 'Every tile is a live mascot. Hover or tap to replay.'}</p>
        </div>
      </div>
      <CharacterPicker value={all ? ALL : c.id} onChange={select} allowAll className="gl-picker" />
      {all ? (
        <CompareAll />
      ) : (
        <ErrorBoundary resetKey={c.id} fallback={(e) => <BrokenArt error={e} name={c.name} />}>
          <CharacterGallery key={c.id} c={c} />
        </ErrorBoundary>
      )}
    </div>
  );
}
