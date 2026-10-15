/**
 * ConstructionHero — "From a drawing to a character", animated.
 *
 * One `Mascot` (the real runtime) drives a scripted, looping construction
 * sequence rendered by `HeroScene` (construction.ts) from the real rig:
 *
 *   drawing  → outlines draw on, the flat SVG fills in            ┐ step 1
 *   annotate → parts lift apart by depth; labels + real data-om-*  ┘
 *   rig      → pivots and parent→child bones draw on; slots flick    step 2
 *   3D       → parts collapse, the character turns (top-view guide)  step 3
 *   clips    → wave, then a beat-synced dance                         step 4
 *   effects  → notes, hearts, confetti                                step 5
 *   anywhere → the one-liner, then loop                               step 6
 *
 * The step strip below is the timeline: it shows progress and seeks on click.
 * The loop pauses off-screen / in background tabs; with reduced motion it
 * shows a still of each step instead.
 */
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Mascot, type BoneNode, type CharacterDef, type Clip } from '@openmascot/core';
import { analyseRig, boneAnnotations, featuredBones, HeroScene, isoHeight, type Anatomy, type SceneState } from './construction';
import { DEMO_OPTIONS } from './shared';
import { hasClip, hasExpression } from './cast';
import { Code } from './ui';
import './construction.css';

/* ------------------------------------------------------------------ */
/* Timeline                                                             */
/* ------------------------------------------------------------------ */

/** Scenes (the strip's first step, "Annotated SVG", spans the drawing and its annotation). */
const DUR = [4.8, 7.4, 6.4, 6.0, 4.6, 5.0, 5.0];
const STEP_OF = [0, 0, 1, 2, 3, 4, 5];
const FIRST_SCENE = [0, 2, 3, 4, 5, 6];
/** Representative moment of each scene for the reduced-motion stills. */
const STILL = [3.4, 4.4, 4.2, 2.3, 3.6, 2.2, 2.6];
const TITLES = ['The drawing', 'Annotate the parts', 'The rig', 'Pseudo-3D', 'Clips', 'Effects', 'Anywhere'];
const EXPRS = ['happy', 'surprised', 'inlove', 'wink', 'excited'];
/** Runtime calls shown in the console card: [scene, time, effect?]. */
const CONSOLE: [number, number][] = [
  [4, 0.15],
  [4, 2.2],
  [5, 0.3],
  [5, 1.8],
  [5, 3.3],
];
const FX = ['notes', 'hearts', 'confetti'];

const clamp01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v);
const ease = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
/** Eased 0→1 between times a and b. */
const seg = (t: number, a: number, b: number) => ease(clamp01((t - a) / (b - a)));
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

type Look = Omit<SceneState, 'cx' | 'cy' | 'scaleFlat' | 'scaleIso' | 'spacing' | 'guideX' | 'guideY' | 'guideR' | 'labelMaxX' | 'mobile' | 'pivot'> & { feat: number };

function look(phase: number, t: number, nFeat: number): Look {
  const s: Look = { tilt: 0, explode: 0, planes: 1, live: 0, draw: 1, outline: 0, fill: 1, dim: 0, labels: 0, labelDim: 0, highlight: -1, skeleton: 0, skeletonAlpha: 0, guide: 0, feat: -1 };
  switch (phase) {
    case 0:
      s.draw = clamp01((t - 0.2) / 2.5);
      s.outline = 1 - seg(t, 3.3, 4.2);
      s.fill = seg(t, 2.5, 3.6);
      s.tilt = seg(t, 4.2, 4.8) * 0.12;
      break;
    case 1:
      s.tilt = lerp(0.12, 1, seg(t, 0, 1.5));
      s.explode = seg(t, 0.4, 2.1);
      s.labels = clamp01((t - 1.7) / 1.1);
      s.feat = t < 2.6 ? -1 : Math.min(nFeat - 1, Math.floor((t - 2.6) / ((DUR[1] - 2.6) / nFeat)));
      s.labelDim = s.feat >= 0 ? 1 : 0;
      break;
    case 2:
      s.tilt = s.explode = 1;
      s.labels = 1;
      s.labelDim = 1;
      s.dim = seg(t, 0, 0.7);
      s.skeleton = clamp01((t - 0.4) / 2.4);
      s.skeletonAlpha = 1;
      break;
    case 3: {
      const k = seg(t, 0, 1.4);
      s.tilt = s.explode = 1 - k;
      s.dim = 1 - seg(t, 0, 0.8);
      s.labels = 1 - seg(t, 0, 0.5);
      s.labelDim = 1;
      s.skeleton = 1;
      s.skeletonAlpha = 1 - seg(t, 0, 0.6);
      s.live = seg(t, 1.3, 1.55);
      s.planes = 1 - s.live;
      s.guide = seg(t, 1.5, 2.2);
      break;
    }
    case 4:
      s.planes = 0;
      s.live = 1;
      s.guide = 1 - seg(t, 0, 0.5);
      break;
    case 5:
      s.planes = 0;
      s.live = 1;
      break;
    case 6:
      s.planes = 0;
      s.live = 1 - seg(t, DUR[6] - 0.7, DUR[6]);
      break;
  }
  return s;
}

/* ------------------------------------------------------------------ */
/* Engine                                                               */
/* ------------------------------------------------------------------ */

interface Engine {
  m: Mascot;
  an: Anatomy;
  scene: HeroScene;
  feat: BoneNode[];
  rest: Clip;
  turn: Clip;
  dance: string;
  exprs: string[];
}

function makeClips(c: CharacterDef) {
  // the drawing as authored: every rest param at its default (no relaxed wings)
  const params: Clip['params'] = {};
  for (const k of Object.keys(c.restParams ?? {})) params[k] = [[0, c.params?.[k]?.default ?? 0]];
  const rest: Clip = { name: 'hero-rest', description: 'The rest pose (the drawing).', category: 'idle', duration: 1, loop: true, params };
  const turn: Clip = {
    name: 'hero-turn',
    description: 'Look left, right, then a full turn with a hop.',
    category: 'gesture',
    duration: 4.2,
    bones: {
      root: {
        yaw: [[0, 0, 'cubicInOut'], [0.8, -38], [1.25, -38, 'cubicInOut'], [2.0, 38], [2.35, 38, 'cubicInOut'], [3.7, 360], [4.2, 360]],
        y: [[0, 0], [2.5, 0, 'quadOut'], [2.95, -30, 'quadIn'], [3.45, 0], [4.2, 0]],
      },
    },
    params: { squash: [[0, 0], [2.3, 0.4], [2.5, -0.3], [3.45, 0.35], [3.75, 0], [4.2, 0]] },
    suppress: { look: true },
  };
  return { rest, turn };
}

function enter(e: Engine, phase: number) {
  const { m } = e;
  if (phase <= 2) {
    m.clearEffects();
    m.setExpression(null);
    m.play(e.rest, { fade: 0.4 });
    m.lookAt({ x: 0, y: 0 });
  } else if (phase === 3) {
    m.setExpression(null);
    if (m.playing !== e.rest.name) m.play(e.rest, { fade: 0.4 });
  } else if (phase === 4) {
    m.lookAt(null);
  } else if (phase >= 5) {
    m.lookAt(null);
    if (m.playing !== e.dance) m.play(e.dance, { fade: 0.3, bpm: 120 });
  }
}

/** Timed actions within a phase: fired once when the playhead crosses `at`. */
function cues(e: Engine, phase: number): [number, () => void][] {
  const { m } = e;
  if (phase === 2) {
    const list: [number, () => void][] = e.exprs.slice(0, 4).map((x, i) => [2.6 + i * 0.8, () => m.setExpression(x)]);
    list.push([5.8, () => m.setExpression(null)]);
    return list;
  }
  if (phase === 3)
    return [
      [1.4, () => (m.lookAt(null), m.play(e.turn, { fade: 0.3 }))],
    ];
  if (phase === 4)
    return [
      [CONSOLE[0][1], () => m.play('wave', { fade: 0.3 })],
      [CONSOLE[1][1], () => m.play(e.dance, { fade: 0.3, bpm: 120 })],
    ];
  if (phase === 5) return FX.map((f, i) => [CONSOLE[2 + i][1], () => m.emit(f)]);
  return [];
}

/* ------------------------------------------------------------------ */
/* Component                                                            */
/* ------------------------------------------------------------------ */

interface Info {
  an: Anatomy;
  feat: BoneNode[];
  slots: { name: string; variants: string[] }[];
  dance: string;
}

export function ConstructionHero({ c, steps }: { c: CharacterDef; steps: [string, ReactNode][] }) {
  const stageRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const progRefs = useRef<(HTMLElement | null)[]>([]);
  const eng = useRef<Engine | null>(null);
  const tl = useRef({ phase: 0, t: 0 });
  const size = useRef({ w: 1100, h: 560 });
  const [phase, setPhase] = useState(0);
  const [cue, setCue] = useState({ feat: -1, cons: -1, slots: '' });
  const [info, setInfo] = useState<Info | null>(null);
  const reduced = useMemo(() => typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches, []);
  const [playing, setPlaying] = useState(!reduced);
  const [visible, setVisible] = useState(false);
  const drawRef = useRef<() => void>(() => {});

  // build the engine + scene for this character
  useLayoutEffect(() => {
    const svg = svgRef.current;
    if (!svg) return;
    let e: Engine | null = null;
    try {
      const { rest, turn } = makeClips(c);
      const def: CharacterDef = { ...c, idle: { ...c.idle, fidgetEvery: 0 } };
      const m = new Mascot(def, { ...DEMO_OPTIONS, seed: 11, initial: '__none__', alive: !reduced });
      m.play(rest, { fade: 0 });
      m.update(0);
      const an = analyseRig(m.rig, m.current.frame);
      const scene = new HeroScene(svg, m.rig, an, m.current.frame);
      scene.resize(size.current.w, size.current.h);
      const feat = featuredBones(m.rig, an);
      const dance = hasClip(c, 'dance-bop') ? 'dance-bop' : 'demo-bop';
      e = { m, an, scene, feat, rest, turn, dance, exprs: EXPRS.filter((x) => hasExpression(c, x)) };
      const pref = ['eye-l', 'mouth', 'blush'];
      const slots = [...m.rig.slots]
        .filter((s) => s.variants.length > 1)
        .sort((a, b) => (pref.indexOf(a.name) + 1 || 99) - (pref.indexOf(b.name) + 1 || 99))
        .slice(0, 3)
        .map((s) => ({ name: s.name, variants: s.variants.map((v) => v.name) }));
      setInfo({ an, feat, slots, dance });
    } catch (err) {
      console.warn('[playground] construction hero failed:', err);
    }
    eng.current = e;
    tl.current = { phase: reduced ? 1 : 0, t: 0 };
    setPhase(tl.current.phase);
    if (e) enter(e, tl.current.phase);
    if (e && reduced) still(tl.current.phase);
    return () => {
      e?.scene.destroy();
      eng.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [c, reduced]);

  /** Lay out + draw the current playhead. */
  const draw = useCallback(() => {
    const e = eng.current;
    if (!e) return;
    const { w, h } = size.current;
    const { phase: p, t } = tl.current;
    const mobile = w < 720;
    const L = look(p, t, e.feat.length);
    const vb = e.m.rig.viewBox;
    const n = e.an.levels.length;
    // character region (the card / guide sits on the right, or below on phones)
    const x0 = mobile ? 8 : 28;
    const x1 = mobile ? w - 8 : w - 420;
    const y0 = mobile ? 52 : 64;
    const y1 = mobile ? h - 236 : h - 30;
    const rw = x1 - x0;
    const rh = y1 - y0;
    const scaleFlat = Math.min((rw * 0.86) / vb[2], (rh * 0.9) / vb[3]);
    const spacing = Math.min(mobile ? 14 : 30, (rh * (mobile ? 0.36 : 0.5)) / Math.max(1, n - 1));
    const st: SceneState = {
      ...L,
      cx: lerp((x0 + x1) / 2, x0 + rw * (mobile ? 0.5 : 0.36), L.tilt),
      cy: (y0 + y1) / 2,
      scaleFlat,
      scaleIso: Math.min(scaleFlat * (mobile ? 0.98 : 0.84), (rh - spacing * (n - 1) - 10) / isoHeight(vb)),
      spacing,
      highlight: L.feat >= 0 ? e.an.boneLevel[e.feat[L.feat].bi] : -1,
      pivot: L.feat >= 0 ? e.feat[L.feat] : null,
      guideX: mobile ? w / 2 : w - 200,
      guideY: mobile ? h - 142 : h / 2 - 16,
      guideR: mobile ? 62 : 118,
      labelMaxX: x1 - 150,
      mobile,
    };
    e.scene.draw(st, e.m.current);
    // step progress
    const step = STEP_OF[p];
    const into = DUR.slice(0, p).reduce((a, d, i) => a + (STEP_OF[i] === step ? d : 0), 0) + t;
    const len = DUR.reduce((a, d, i) => a + (STEP_OF[i] === step ? d : 0), 0);
    progRefs.current.forEach((el, i) => {
      if (el) el.style.transform = `scaleX(${i < step ? 1 : i > step ? 0 : (into / len).toFixed(4)})`;
    });
    // discrete UI state for the cards
    const cons = p === 4 || p === 5 ? CONSOLE.filter(([sc, a]) => sc < p || (sc === p && t >= a)).length - 1 : -1;
    const slots = p === 2 ? JSON.stringify(e.m.current.frame.slots) : '';
    setCue((o) => (o.feat === L.feat && o.cons === cons && o.slots === slots ? o : { feat: L.feat, cons, slots }));
    setPhase((o) => (o === p ? o : p));
  }, []);
  drawRef.current = draw;

  /** Reduced motion: simulate a phase up to its representative moment and draw it once. */
  const still = useCallback((p: number) => {
    const e = eng.current;
    if (!e) return;
    tl.current = { phase: p, t: 0 };
    enter(e, p);
    const cs = cues(e, p);
    const dt = 1 / 60;
    for (let t = 0; t < STILL[p]; t += dt) {
      for (const [at, fn] of cs) if (at > t && at <= t + dt) fn();
      e.m.update(dt);
    }
    tl.current.t = STILL[p];
    drawRef.current();
  }, []);

  // phones: keep the active step in view inside the swipeable strip (never scrolls the page)
  const stepsRef = useRef<HTMLOListElement>(null);
  const activeStep = STEP_OF[phase];
  useEffect(() => {
    const ol = stepsRef.current;
    const li = ol?.children[activeStep] as HTMLElement | undefined;
    if (!ol || !li || ol.scrollWidth <= ol.clientWidth) return;
    ol.scrollTo({ left: li.offsetLeft - ol.offsetLeft - 2, behavior: reduced ? 'auto' : 'smooth' });
  }, [activeStep, reduced]);

  // size
  useEffect(() => {
    const el = stageRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => {
      const r = el.getBoundingClientRect();
      size.current = { w: Math.max(300, Math.round(r.width)), h: Math.max(300, Math.round(r.height)) };
      eng.current?.scene.resize(size.current.w, size.current.h);
      drawRef.current();
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // visibility (pause off-screen)
  useEffect(() => {
    const el = stageRef.current;
    if (!el || typeof IntersectionObserver === 'undefined') return setVisible(true);
    const io = new IntersectionObserver(([en]) => setVisible(en.isIntersecting), { threshold: 0.05 });
    io.observe(el);
    return () => io.disconnect();
  }, []);

  // the loop
  useEffect(() => {
    if (!playing || !visible || !info) return;
    let raf = 0;
    let last = performance.now();
    const tick = (now: number) => {
      raf = requestAnimationFrame(tick);
      const e = eng.current;
      if (!e || document.hidden) {
        last = now;
        return;
      }
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      const T = tl.current;
      const prev = T.t;
      T.t += dt;
      for (const [at, fn] of cues(e, T.phase)) if (at > prev && at <= T.t) fn();
      if (T.t >= DUR[T.phase]) {
        T.t -= DUR[T.phase];
        T.phase = (T.phase + 1) % DUR.length;
        enter(e, T.phase);
      }
      e.m.update(dt);
      drawRef.current();
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [playing, visible, info]);

  const jump = (step: number) => {
    const e = eng.current;
    if (!e) return;
    const i = FIRST_SCENE[step];
    if (!playing) return still(i);
    tl.current = { phase: i, t: 0 };
    enter(e, i);
    stageRef.current?.classList.remove('ch-cut');
    void stageRef.current?.offsetWidth;
    stageRef.current?.classList.add('ch-cut');
    drawRef.current();
  };

  const toggle = () => {
    setPlaying((v) => {
      eng.current?.m.setAlive(!v);
      return !v;
    });
  };

  return (
    <div className="ch">
      <div className="ch-stage" ref={stageRef} data-phase={phase}>
        <div className="ch-bar">
          <span className="ch-file">
            <i />
            {c.id}.svg
          </span>
          <span className="ch-title" key={phase}>
            <b>{STEP_OF[phase] + 1}</b> {TITLES[phase]}
          </span>
          <button className="ch-play" onClick={toggle} aria-label={playing ? 'Pause animation' : 'Play animation'} title={playing ? 'Pause' : 'Play'}>
            {playing ? (
              <svg viewBox="0 0 16 16" aria-hidden="true">
                <rect x="3.5" y="3" width="3" height="10" rx="1" />
                <rect x="9.5" y="3" width="3" height="10" rx="1" />
              </svg>
            ) : (
              <svg viewBox="0 0 16 16" aria-hidden="true">
                <path d="M5 3.2v9.6a.6.6 0 0 0 .9.5l7.6-4.8a.6.6 0 0 0 0-1L5.9 2.7a.6.6 0 0 0-.9.5z" />
              </svg>
            )}
          </button>
        </div>
        <svg ref={svgRef} className="ch-svg" role="img" aria-label={`${c.name} being constructed: ${TITLES[phase]}`} />
        {info && <Card phase={phase} c={c} info={info} cue={cue} />}
      </div>
      <ol className="hm-pipe ch-steps" ref={stepsRef}>
        {steps.map(([t, d], i) => (
          <li
            key={t}
            className={i === STEP_OF[phase] ? 'on' : i < STEP_OF[phase] ? 'done' : ''}
            role="button"
            tabIndex={0}
            aria-current={i === STEP_OF[phase] ? 'step' : undefined}
            aria-label={`Step ${i + 1}: ${t}`}
            onClick={() => jump(i)}
            onKeyDown={(ev) => (ev.key === 'Enter' || ev.key === ' ') && (ev.preventDefault(), jump(i))}
          >
            <b>{t}</b>
            <span>{d}</span>
            <i className="ch-prog" ref={(el) => void (progRefs.current[i] = el)} />
          </li>
        ))}
      </ol>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Cards                                                                */
/* ------------------------------------------------------------------ */

const SURFACE_NOTE: Record<string, string> = {
  volume: 'round volume — looks the same from every side',
  flat: 'flat — foreshortens and mirrors as it turns',
  face: 'face — fades out when it turns away',
  back: 'back — only visible from behind',
  feature: 'feature — sticks out in profile, never culled',
};

function Card({ phase, c, info, cue }: { phase: number; c: CharacterDef; info: Info; cue: { feat: number; cons: number; slots: string } }) {
  const file = useMemo(() => {
    const shapes = (c.svg.match(/<(path|circle|ellipse|rect|polygon|polyline|line)\b/g) ?? []).length;
    const vb = /viewBox="([^"]+)"/.exec(c.svg)?.[1] ?? '';
    const fill = /<path[^>]*fill="(#[0-9a-fA-F]{3,6})"/.exec(c.svg)?.[1] ?? '#6b4fd8';
    return { kb: Math.round(c.svg.length / 1024), shapes, vb, fill };
  }, [c]);

  let body: ReactNode = null;
  if (phase === 0) {
    body = (
      <>
        <div className="ch-card-h">
          <b>{c.id}.svg</b>
          <span>
            {file.kb} kB · {file.shapes} shapes
          </span>
        </div>
        <pre className="ch-pre">
          <T>&lt;svg</T> <A>viewBox</A>=<S>"{file.vb}"</S>&gt;{'\n'}
          {'  '}
          <T>&lt;path</T> <A>d</A>=<S>"M…"</S> <A>fill</A>=<S>"{file.fill}"</S>/&gt;{'\n'}
          {'  '}
          <C>… {file.shapes - 1} more shapes</C>
          {'\n'}
          <T>&lt;/svg&gt;</T>
        </pre>
        <p>A plain, front-on SVG — drawn in Figma, Inkscape, Illustrator or by an AI. It previews anywhere.</p>
      </>
    );
  } else if (phase === 1) {
    const i = Math.max(0, cue.feat);
    const b = info.feat[i];
    body = b && (
      <>
        <div className="ch-card-h">
          <b>Annotations</b>
          <span className="ch-dots">
            {info.feat.map((f, k) => (
              <i key={f.name} className={k === cue.feat ? 'on' : ''} />
            ))}
          </span>
        </div>
        <pre className="ch-pre" key={b.name}>
          {boneAnnotations(b).map(([k, v], j, all) => (
            <span key={k} className="ch-ln" style={{ animationDelay: `${j * 70}ms` }}>
              {j === 0 ? <T>&lt;g </T> : '   '}
              <A>{k}</A>
              {v !== '' && (
                <>
                  =<S>"{v}"</S>
                </>
              )}
              {j === all.length - 1 ? '>' : ''}
              {'\n'}
            </span>
          ))}
        </pre>
        <p>
          <b>{b.name}</b>: {SURFACE_NOTE[b.surface]}
          {b.spring ? '; a spring adds follow-through.' : '.'}
        </p>
      </>
    );
  } else if (phase === 2) {
    const slots = cue.slots ? (JSON.parse(cue.slots) as Record<string, string>) : {};
    body = (
      <>
        <div className="ch-card-h">
          <b>compileRig(svg)</b>
          <span>→ Rig</span>
        </div>
        <div className="ch-stats">
          <span>
            <b>{info.an.stats.bones}</b> bones
          </span>
          <span>
            <b>{info.an.stats.slots}</b> slots
          </span>
          <span>
            <b>{info.an.stats.springs}</b> springs
          </span>
        </div>
        <div className="ch-slots">
          {info.slots.map((s) => {
            const cur = slots[s.name] ?? s.variants[0];
            const shown = s.variants.slice(0, 5);
            if (!shown.includes(cur)) shown[4] = cur;
            return (
              <div key={s.name} className="ch-slot">
                <code>{s.name}</code>
                <div>
                  {shown.map((v) => (
                    <i key={v} className={v === cur ? 'on' : ''}>
                      {v}
                    </i>
                  ))}
                  {s.variants.length > 5 && <i className="more">+{s.variants.length - 5}</i>}
                </div>
              </div>
            );
          })}
        </div>
        <p>Pivots become joints in a parent → child bone tree. Slots swap art by name.</p>
      </>
    );
  } else if (phase === 4 || phase === 5) {
    const lines = [`m.play('wave')`, `m.play('${info.dance}', { bpm: 120 })`, ...FX.map((f) => `m.emit('${f}')`)];
    body = (
      <>
        <div className="ch-card-h">
          <b>Runtime</b>
          <span>new Mascot({c.id})</span>
        </div>
        <div className="ch-console">
          {lines.map((l, i) => (
            <div key={l} className={i < cue.cons ? 'done' : i === cue.cons ? 'on' : ''}>
              <Code code={l} />
            </div>
          ))}
        </div>
        <p>Clips are plain JSON keyframes; blinking, breathing and springs keep running underneath.</p>
      </>
    );
  } else if (phase === 6) {
    body = (
      <>
        <div className="ch-card-h">
          <b>App.tsx</b>
          <span>that's it</span>
        </div>
        <Code code={`import { Mascot } from '@openmascot/react';\nimport { ${c.id} } from '@openmascot/characters';\n\n<Mascot\n  character={${c.id}}\n  animation="${info.dance}"\n/>`} />
        <div className="ch-chips">
          <i>React</i>
          <i>&lt;open-mascot&gt;</i>
          <i>DOM-free core</i>
          <i className="soon">React Native · planned</i>
        </div>
      </>
    );
  }
  if (!body) return null;
  return (
    <div className="ch-card" key={phase === 5 ? 4 : phase}>
      {body}
    </div>
  );
}

const T = ({ children }: { children: ReactNode }) => <span className="tk-t">{children}</span>;
const A = ({ children }: { children: ReactNode }) => <span className="tk-k">{children}</span>;
const S = ({ children }: { children: ReactNode }) => <span className="tk-s">{children}</span>;
const C = ({ children }: { children: ReactNode }) => <span className="tk-c">{children}</span>;
