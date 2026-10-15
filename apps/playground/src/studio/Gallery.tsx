/**
 * Gallery — recreations of the reference sheets (docs/reference/echo-emotions.webp,
 * echo-poses.webp) as live mascots, plus all dances and every expression.
 *
 * Clips are authored in parallel; a missing clip renders a "coming soon" tile
 * (falling back to the closest matching expression where there is one).
 */
import { useEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { Mascot, useMascotRef } from '@openmascot/react';
import type { MascotEvent } from '@openmascot/core';
import { allClips, echo, expressionFor, getClip, hasClip, isBeats } from './shared';
import { useNearViewport } from './ui';
import './studio.css';

type Pad = [number, number, number, number];
const RIG_VB = (/viewBox="([^"]+)"/.exec(echo.svg)?.[1] ?? '-212 -242 424 252').split(/\s+/).map(Number);
const vbOf = (p: Pad) => [RIG_VB[0] - p[3], RIG_VB[1] - p[0], RIG_VB[2] + p[1] + p[3], RIG_VB[3] + p[0] + p[2]];
/** Fraction (0..1) of a padded box at character coordinate (x, y). */
const at = (p: Pad, x: number, y: number) => {
  const vb = vbOf(p);
  return [(x - vb[0]) / vb[2], (y - vb[1]) / vb[3]];
};
const aspect = (p: Pad) => {
  const vb = vbOf(p);
  return `${vb[2]} / ${vb[3]}`;
};

const EMOTE_PAD: Pad = [80, 40, 26, 40];
const POSE_PAD: Pad = [72, 40, 30, 40];
const DANCE_PAD: Pad = [70, 40, 26, 40];
const EXPR_PAD: Pad = [16, -60, 14, -60];
const FILL: CSSProperties = { width: '100%', height: '100%' };

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

/* ------------------------------------------------------------------ */

/** A tile that plays a clip, holds it briefly, and replays (instantly on hover/click). */
function ClipTile(props: {
  clip: string;
  label: ReactNode;
  pad: Pad;
  /** 'replay' = one-shots replay after a pause; 'hover' = idle until hovered (dances). */
  mode?: 'replay' | 'hover';
  gap?: number;
  fallbackExpression?: string;
  decor?: ReactNode;
  meta?: ReactNode;
  className?: string;
}) {
  const { clip, mode = 'replay', gap = 1600 } = props;
  const def = getClip(clip);
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
      title={def?.description ?? `${clip} — coming soon`}
    >
      <div className="gl-art" style={{ aspectRatio: aspect(props.pad) }}>
        {props.decor}
        {near && (
          <Mascot
            ref={ref}
            character={echo}
            padding={props.pad}
            animation={exists && mode === 'replay' ? clip : undefined}
            animationKey={0}
            holdLastFrame
            bpm={bpm}
            expression={exists ? undefined : props.fallbackExpression}
            onEvent={onEvent}
            className="gl-m"
            style={FILL}
          />
        )}
        {!exists ? <span className="gl-badge">coming soon</span> : props.meta}
        {exists && <span className="gl-replay">{mode === 'hover' ? '▶' : '↻'}</span>}
      </div>
      <div className="gl-cap">
        <b>{props.label}</b>
        <small>{clip}</small>
      </div>
    </button>
  );
}

/* ------------------------------------------------------------------ */

function PeekTile() {
  const exists = hasClip('peek');
  const [boxRef, near] = useNearViewport<HTMLButtonElement>();
  const ref = useMascotRef();
  const pad: Pad = [30, 40, 30, 40];
  const vb = vbOf(pad);
  const artAspect = 1.565; // matches the other pose tiles
  const mH = vb[2] / vb[3] / artAspect; // mascot height as a fraction of the art height
  const LEDGE = 0.7; // ledge top, fraction of art height
  // With a `peek` clip the ledge sits on the ground line (y = 0); without one we
  // drop the idle character so that only the head and ears show above the ledge.
  const drop = exists ? 0 : 118;
  const groundFrac = (drop - vb[1]) / vb[3];
  const top = LEDGE - groundFrac * mH;
  const pawsY = exists ? null : LEDGE;
  return (
    <button ref={boxRef} className={`gl-tile ${exists ? '' : 'missing-soft'}`} onMouseEnter={() => exists && ref.current?.play('peek', { fade: 0.2, then: null })} onClick={() => ref.current?.blink()} title={getClip('peek')?.description ?? 'peek — clip coming soon (idle stand-in)'}>
      <div className="gl-art" style={{ aspectRatio: String(artAspect) }}>
        <div className="gl-peek">
          <div className="gl-peek-clip" style={{ height: `${LEDGE * 100}%` }}>
            {near && (
              <Mascot
                ref={ref}
                character={echo}
                padding={pad}
                animation={exists ? 'peek' : undefined}
                animationKey={0}
                holdLastFrame
                className="gl-m"
                style={{ width: '100%', height: `${(mH * 100) / LEDGE}%`, top: `${(top * 100) / LEDGE}%` }}
              />
            )}
          </div>
          <div className="gl-ledge" style={{ top: `${LEDGE * 100}%` }} />
          {pawsY != null && (
            <div className="gl-paws" style={{ top: `${pawsY * 100}%` }}>
              <i style={{ left: `${at(pad, -74, 0)[0] * 100}%` }} />
              <i style={{ left: `${at(pad, 74, 0)[0] * 100}%` }} />
            </div>
          )}
        </div>
        {!exists && <span className="gl-badge">clip coming soon</span>}
      </div>
      <div className="gl-cap">
        <b>Peek</b>
        <small>peek</small>
      </div>
    </button>
  );
}

function FrontTile() {
  const [boxRef, near] = useNearViewport<HTMLButtonElement>();
  const ref = useMascotRef();
  return (
    <button ref={boxRef} className="gl-tile" onClick={() => ref.current?.play('fidget-hop')} title="Front view — the rest pose, alive">
      <div className="gl-art" style={{ aspectRatio: aspect(POSE_PAD) }}>
        {near && <Mascot ref={ref} character={echo} padding={POSE_PAD} lookAtPointer className="gl-m" style={FILL} />}
      </div>
      <div className="gl-cap">
        <b>Front</b>
        <small>idle</small>
      </div>
    </button>
  );
}

function ExprTile({ name }: { name: string }) {
  const [boxRef, near] = useNearViewport<HTMLDivElement>();
  return (
    <div className="gl-expr" ref={boxRef}>
      <div className="gl-art" style={{ aspectRatio: aspect(EXPR_PAD) }}>
        {near && <Mascot character={echo} padding={EXPR_PAD} expression={name} className="gl-m" style={FILL} />}
      </div>
      <b>{name}</b>
    </div>
  );
}

/* ------------------------------------------------------------------ */

export function Gallery() {
  const clips = allClips();
  const emotions = useMemo(() => {
    const extra = Object.keys(clips)
      .filter((n) => n.startsWith('emote-') && !EMOTIONS.some(([e]) => e === n))
      .sort()
      .map((n) => [n, n.replace(/^emote-/, '').replace(/-/g, ' ')] as [string, string]);
    return [...EMOTIONS, ...extra];
  }, [clips]);
  const dances = useMemo(
    () =>
      Object.entries(clips)
        .filter(([n, c]) => c.category === 'dance' || n.startsWith('dance-'))
        .map(([n]) => n)
        .sort(),
    [clips],
  );
  const hangFrac = at(POSE_PAD, 0, -240)[1];
  const ready = EMOTIONS.filter(([n]) => hasClip(n)).length;

  return (
    <div className="gl">
      <div className="gl-head">
        <div>
          <h1>Echo gallery</h1>
          <p>Every tile is a live mascot. Hover or tap to replay.</p>
        </div>
        <nav className="gl-nav">
          <a href="#/gallery" onClick={(e) => (e.preventDefault(), document.getElementById('gl-emotions')?.scrollIntoView({ behavior: 'smooth' }))}>
            Emotions
          </a>
          <a href="#/gallery" onClick={(e) => (e.preventDefault(), document.getElementById('gl-poses')?.scrollIntoView({ behavior: 'smooth' }))}>
            Poses
          </a>
          <a href="#/gallery" onClick={(e) => (e.preventDefault(), document.getElementById('gl-dances')?.scrollIntoView({ behavior: 'smooth' }))}>
            Dances
          </a>
          <a href="#/gallery" onClick={(e) => (e.preventDefault(), document.getElementById('gl-expressions')?.scrollIntoView({ behavior: 'smooth' }))}>
            Expressions
          </a>
        </nav>
      </div>

      <section className="gl-sec" id="gl-emotions">
        <div className="gl-sec-h">
          <h2>Emotions</h2>
          <span>
            {ready}/{EMOTIONS.length} reference emotes ready · clips with effects
          </span>
        </div>
        <div className="gl-grid">
          {emotions.map(([clip, label], i) => (
            <ClipTile key={clip} clip={clip} label={label} pad={EMOTE_PAD} gap={1400 + (i % 4) * 350} fallbackExpression={expressionFor(clip)} />
          ))}
        </div>
      </section>

      <section className="gl-sec" id="gl-poses">
        <div className="gl-sec-h">
          <h2>Poses</h2>
          <span>front · hang · fly-side · cloak · wink · peek</span>
        </div>
        <div className="gl-grid poses">
          <FrontTile />
          <ClipTile clip="hang" label="Hang" pad={POSE_PAD} decor={<div className="gl-branch" style={{ top: `calc(${hangFrac * 100}% - 10px)` }} />} />
          <ClipTile clip="fly-side" label="Fly (side)" pad={POSE_PAD} />
          <ClipTile clip="cloak" label="Cloak" pad={POSE_PAD} />
          <ClipTile clip="wink" label="Wink" pad={POSE_PAD} fallbackExpression="wink" />
          <PeekTile />
        </div>
      </section>

      <section className="gl-sec" id="gl-dances">
        <div className="gl-sec-h">
          <h2>Dances</h2>
          <span>{dances.length ? `${dances.length} beat-synced routines · hover to dance` : 'beat-synced routines'}</span>
        </div>
        <div className="gl-grid dances">
          {dances.length ? (
            dances.map((d) => {
              const c = clips[d];
              return (
                <ClipTile
                  key={d}
                  clip={d}
                  label={d.replace(/^dance-/, '').replace(/-/g, ' ')}
                  pad={DANCE_PAD}
                  mode="hover"
                  meta={<span className="gl-badge bpm">♪ {isBeats(c) ? `${c.bpm ?? 120} bpm` : `${c.duration}s`}</span>}
                />
              );
            })
          ) : (
            <>
              {['dance-bop', 'dance-spin', 'dance-shuffle'].map((d) => (
                <ClipTile key={d} clip={d} label={d.replace(/^dance-/, '')} pad={DANCE_PAD} mode="hover" fallbackExpression="happy" />
              ))}
            </>
          )}
        </div>
      </section>

      <section className="gl-sec" id="gl-expressions">
        <div className="gl-sec-h">
          <h2>Expressions</h2>
          <span>{Object.keys(echo.expressions).length} named slot maps · eye swaps hide behind a blink</span>
        </div>
        <div className="gl-strip">
          {Object.keys(echo.expressions).map((e) => (
            <ExprTile key={e} name={e} />
          ))}
        </div>
      </section>
    </div>
  );
}
