/**
 * Studio — an animation workbench for exploring, debugging and authoring clips.
 *
 *  - live stage (backgrounds, ground line, pointer tracking, alive toggle)
 *  - clip browser + play queue, playback controls (speed, fade, bpm, then idle/hold)
 *  - expressions, effects, params, pseudo-3D pose debugging
 *  - deterministic timeline scrubber + frame strip + onion skin
 *  - event log, exports, and a live JSON clip editor (great for AI-assisted authoring)
 *
 * Deep links: `#/studio?char=echo&clip=fly-side&bg=dark&t=0.3`. Switching characters remounts the
 * workbench (keyed by character id) and carries over stage/playback prefs and the clip when it exists.
 */
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Mascot, useMascotRef } from '@openmascot/react';
import { lintClip, renderSvg, type CharacterDef, type Clip, type EffectDef, type Mascot as MascotRuntime, type MascotEvent } from '@openmascot/core';
import { ClipSim, composeSheet, frameSvg, sampleFrames, SIM_FPS, svgUri } from './frames';
import { copyText, download, groupedClips, hashParams, isBeats, seconds } from './shared';
import { CAST, castInfo, clipOf, clipsOf, getCharacter, hasExpression, paddedVb, setHashQuery, useCharacterSelection } from './cast';
import { BrokenArt, CharacterAbout, CharacterPicker, ErrorBoundary } from './cast-ui';
import { Panel, Segmented, Slider, Toggle } from './ui';
import './studio.css';

/* ------------------------------------------------------------------ */

const STAGE_PAD: [number, number, number, number] = [96, 70, 30, 70];
const STRIP_PAD = 40;
const STAGE_OPTIONS = { seed: 11 };

type Bg = 'white' | 'lavender' | 'dark' | 'checker';
interface Current {
  name: string;
  clip: Clip;
  custom?: boolean;
}
interface LogEntry {
  id: number;
  t: number;
  e: MascotEvent;
}

const ALL_POSE_KEYS = ['root.yaw', 'root.pitch', 'body.yaw', 'body.pitch', 'head.yaw', 'head.pitch'] as const;
type PoseKey = (typeof ALL_POSE_KEYS)[number];
/** Standard anchor-ish bones offered in the effects menu when the rig has them. */
const ANCHOR_BONES = ['head', 'mouth', 'body', 'root', 'wing-l', 'wing-r', 'ear-l', 'ear-r', 'foot-l', 'foot-r', 'tuft'];

/** Stage/playback prefs carried across character switches (the workbench remounts per character). */
const carry: Partial<{ bg: Bg; ground: boolean; track: boolean; alive: boolean; speed: number; fade: number; thenIdle: boolean; editor: string; queue: string[]; logFilter: 'all' | 'clips' | 'effects' }> = {};

const EASES = ['linear', 'step', 'sineIn', 'sineOut', 'sineInOut', 'quadIn', 'quadOut', 'quadInOut', 'cubicIn', 'cubicOut', 'cubicInOut', 'backIn', 'backOut', 'backInOut', 'elasticOut', 'bounceOut'];
const CHANNELS = 'x y rot sx sy yaw pitch dz opacity';

/** Pretty JSON that keeps keyframes / short objects on one line (diff- and AI-friendly). */
function clipJson(clip: Clip): string {
  const objLike = (x: unknown) => !!x && typeof x === 'object' && !Array.isArray(x);
  const pj = (v: unknown, ind: string): string => {
    if (typeof v !== 'object' || v === null) return JSON.stringify(v) ?? 'null';
    const flat = JSON.stringify(v);
    if (Array.isArray(v)) {
      if (!v.some(objLike) && flat.length + ind.length <= 100) return `[${v.map((x) => pj(x, '')).join(', ')}]`;
      return `[\n${v.map((x) => `${ind}  ${pj(x, `${ind}  `)}`).join(',\n')}\n${ind}]`;
    }
    const entries = Object.entries(v as Record<string, unknown>).filter(([, x]) => x !== undefined && typeof x !== 'function');
    if (!entries.length) return '{}';
    if (!entries.some(([, x]) => objLike(x)) && flat.length + ind.length <= 84) return `{ ${entries.map(([k, x]) => `${JSON.stringify(k)}: ${pj(x, '')}`).join(', ')} }`;
    return `{\n${entries.map(([k, x]) => `${ind}  ${JSON.stringify(k)}: ${pj(x, `${ind}  `)}`).join(',\n')}\n${ind}}`;
  };
  const { fn: _fn, ...rest } = clip;
  return pj(rest, '');
}

const STARTER: Clip = {
  name: 'my-clip',
  description: 'Hop with wings up, sparkles at the top.',
  category: 'emotion',
  duration: 1.2,
  bones: {
    root: { y: [[0, 0, 'quadOut'], [0.15, 0], [0.45, -40, 'quadIn'], [0.75, 0, 'bounceOut']] },
    head: { rot: [[0, 0], [0.45, -6], [1.2, 0]] },
  },
  params: {
    squash: [[0, 0], [0.12, 0.5], [0.25, -0.4], [0.75, 0.4], [0.95, 0]],
    flap: [[0, 0, 'backOut'], [0.3, 1], [0.8, 0.2], [1.2, 0]],
  },
  expression: [[0, 'excited'], [0.4, 'joyful']],
  events: [{ t: 0.45, effect: 'sparkles', at: 'head' }],
};

/** The starter clip, trimmed to the params/expressions/bones the character actually has. */
function starterFor(c: CharacterDef): Clip {
  const bones = new Set(castInfo(c)?.bones ?? []);
  const params = Object.fromEntries(Object.entries(STARTER.params!).filter(([p]) => c.params?.[p]));
  const fallback = hasExpression(c, 'happy') ? 'happy' : undefined;
  const expression = STARTER.expression!.map(([t, e]) => [t, hasExpression(c, e) ? e : fallback] as [number, string | undefined]).filter((k): k is [number, string] => !!k[1]);
  return {
    ...STARTER,
    description: params.flap ? STARTER.description : 'Hop, sparkles at the top.',
    bones: Object.fromEntries(Object.entries(STARTER.bones!).filter(([b]) => bones.has(b))),
    params,
    expression: expression.length ? expression : undefined,
    events: STARTER.events!.map((e) => ({ ...e, at: bones.has('head') || c.anchors?.head ? e.at : undefined })),
  };
}

/* ------------------------------------------------------------------ */

export function Studio() {
  const [id, select] = useCharacterSelection();
  const character = getCharacter(id) ?? CAST[0];
  const picker = <CharacterPicker value={character.id} onChange={select} label="Character" />;
  return (
    <ErrorBoundary
      resetKey={character.id}
      fallback={(e) => (
        <div className="st-root">
          <div className="st-charbar">{picker}</div>
          <div className="st-panel cx-crash">
            <BrokenArt error={e} name={character.name} />
            <p className="st-hint">This character crashed the studio. Pick another one above.</p>
          </div>
        </div>
      )}
    >
      <StudioView key={character.id} character={character} picker={picker} onSelectCharacter={select} />
    </ErrorBoundary>
  );
}

function StudioView({ character, picker, onSelectCharacter }: { character: CharacterDef; picker: ReactNode; onSelectCharacter: (id: string) => void }) {
  const q = useMemo(hashParams, []);
  const info = useMemo(() => castInfo(character), [character]);
  const STAGE_VB = useMemo(() => paddedVb(character, STAGE_PAD), [character]);
  const GROUND_PCT = ((0 - STAGE_VB[1]) / STAGE_VB[3]) * 100;
  const STRIP_VB = useMemo(() => paddedVb(character, [STRIP_PAD, STRIP_PAD, STRIP_PAD, STRIP_PAD]), [character]);
  const boneSet = useMemo(() => new Set(info?.bones ?? []), [info]);
  const POSE_KEYS = useMemo(() => ALL_POSE_KEYS.filter((k) => boneSet.has(k.split('.')[0])), [boneSet]);
  const anchors = useMemo(() => [...new Set([...Object.keys(character.anchors ?? {}), ...ANCHOR_BONES.filter((b) => boneSet.has(b))])], [character, boneSet]);
  const allClips = () => clipsOf(character);
  const getClip = (name: string) => clipOf(character, name);
  const starter = useMemo(() => starterFor(character), [character]);
  const ref = useMascotRef();
  const [rt, setRt] = useState<MascotRuntime>();

  // Keep `rt` in sync with the component's runtime (it is recreated on HMR).
  useEffect(() => {
    const sync = () => setRt((old) => (ref.current?.runtime !== old ? ref.current?.runtime : old));
    sync();
    const id = setInterval(sync, 500);
    return () => clearInterval(id);
  }, [ref]);

  /* stage */
  const [bg, setBg] = useState<Bg>(() => carry.bg ?? ((q.get('bg') as Bg) || 'lavender'));
  const [ground, setGround] = useState(carry.ground ?? true);
  const [track, setTrack] = useState(carry.track ?? false);
  const [alive, setAliveState] = useState(carry.alive ?? true);

  /* playback */
  const wanted = q.get('clip');
  const idleName = character.idle?.clip ?? 'idle';
  const initialName = wanted && getClip(wanted) ? wanted : idleName;
  const [current, setCurrent] = useState<Current>(() => ({ name: initialName, clip: getClip(initialName) ?? { duration: 1 } }));
  const [speed, setSpeed] = useState(carry.speed ?? 1);
  const [fade, setFade] = useState(carry.fade ?? 0.25);
  const [thenIdle, setThenIdle] = useState(carry.thenIdle ?? true);
  const [bpm, setBpm] = useState(() => current.clip.bpm ?? 120);
  const [search, setSearch] = useState('');
  const [queue, setQueue] = useState<string[]>(() => (carry.queue ?? []).filter((n) => getClip(n)));
  const [queueRunning, setQueueRunning] = useState(false);
  const queueToken = useRef(0);

  /* inspector */
  const [expr, setExpr] = useState<string | null>(null);
  const [anchor, setAnchor] = useState('');
  const [params, setParams] = useState<Record<string, number>>({});
  const [pose, setPose] = useState<Record<PoseKey, number>>(() => Object.fromEntries(ALL_POSE_KEYS.map((k) => [k, 0])) as Record<PoseKey, number>);
  const poseClip = useRef<Clip>({
    name: '__pose',
    description: 'Studio pose override',
    duration: 1,
    loop: true,
    bones: Object.fromEntries(['root', 'body', 'head'].filter((b) => boneSet.has(b)).map((b) => [b, { yaw: [[0, 0]], pitch: [[0, 0]] }])),
  });

  /* timeline */
  const [scrub, setScrub] = useState<number | null>(null);
  const [onion, setOnion] = useState(false);
  const [onionGap, setOnionGap] = useState(4);
  const [stripN, setStripN] = useState(10);
  const [stripOnion, setStripOnion] = useState(false);
  const playheadRef = useRef<HTMLDivElement>(null);
  const timeRef = useRef<HTMLSpanElement>(null);
  const startRef = useRef<{ clip: string; at: number }>({ clip: initialName, at: 0 });

  /* log, editor, toast */
  const [log, setLog] = useState<LogEntry[]>([]);
  const logSeq = useRef(0);
  const [logFilter, setLogFilter] = useState<'all' | 'clips' | 'effects'>(carry.logFilter ?? 'all');
  const [editor, setEditor] = useState(() => carry.editor ?? clipJson(starter));
  const [problems, setProblems] = useState<{ level: 'error' | 'warn'; msg: string }[]>([]);
  const [toast, setToast] = useState<string | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const say = useCallback((msg: string) => {
    setToast(msg);
    clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 2200);
  }, []);

  // remember prefs for the next character; keep the URL in sync with the clip
  useEffect(() => {
    Object.assign(carry, { bg, ground, track, alive, speed, fade, thenIdle, editor, queue, logFilter });
  });
  useEffect(() => {
    if (!current.custom && current.name !== '__pose') setHashQuery({ clip: current.name === idleName ? null : current.name });
  }, [current, idleName]);
  useEffect(() => {
    if (wanted && wanted !== initialName) say(`${character.name} has no “${wanted}” clip — showing ${initialName}`);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const bpmEff = isBeats(current.clip) ? bpm : undefined;
  const total = seconds(current.clip, bpmEff);
  const tickCount = Math.min(40, Math.max(2, Math.round(isBeats(current.clip) ? current.clip.duration : total * 4)));

  /* ---------------------------------------------------------------- */
  /* playback                                                          */

  const runtime = () => ref.current?.runtime;
  const player = () => ref.current?.player;

  const exitScrub = useCallback(() => {
    setScrub(null);
    player()?.start();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const playClip = useCallback(
    (name: string, clip: Clip, opts: { custom?: boolean; offset?: number; keepQueue?: boolean; bpm?: number } = {}) => {
      const r = runtime();
      if (!r) return Promise.resolve();
      if (!opts.keepQueue) {
        queueToken.current++;
        setQueueRunning(false);
      }
      setScrub(null);
      player()?.start();
      setCurrent((c) => (c.name === name && c.clip === clip ? c : { name, clip, custom: opts.custom }));
      const b = isBeats(clip) ? opts.bpm ?? bpm : undefined;
      return r.play(opts.custom ? { ...clip, name } : name, { fade, bpm: b, then: thenIdle ? undefined : null, offset: opts.offset });
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [fade, thenIdle, bpm],
  );

  const selectClip = (name: string) => {
    const clip = getClip(name);
    if (!clip) return;
    const b = clip.bpm ?? 120;
    if (isBeats(clip)) setBpm(b);
    playClip(name, clip, { bpm: b });
  };

  // re-time a playing beat clip when the bpm slider moves (debounced)
  const bpmTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const changeBpm = (v: number) => {
    setBpm(v);
    clearTimeout(bpmTimer.current);
    bpmTimer.current = setTimeout(() => {
      const r = runtime();
      if (r && r.playing === current.name && isBeats(current.clip)) r.play(current.custom ? { ...current.clip, name: current.name } : current.name, { fade: 0.15, bpm: v, then: thenIdle ? undefined : null });
    }, 220);
  };

  const runQueue = async () => {
    const r = runtime();
    if (!r || !queue.length) return;
    const token = ++queueToken.current;
    setQueueRunning(true);
    setScrub(null);
    player()?.start();
    for (let i = 0; i < queue.length; i++) {
      const name = queue[i];
      const clip = getClip(name);
      if (!clip) continue;
      setCurrent({ name, clip });
      const last = i === queue.length - 1;
      await r.play(name, {
        fade,
        bpm: isBeats(clip) ? clip.bpm ?? 120 : undefined,
        repeat: clip.loop ? 1 : undefined,
        then: last ? (thenIdle ? undefined : null) : null,
      });
      if (queueToken.current !== token) return;
    }
    setQueueRunning(false);
  };

  /* live playhead (no React re-render per frame) */
  useEffect(() => {
    let raf = 0;
    const tick = () => {
      raf = requestAnimationFrame(tick);
      const r = runtime();
      if (!r || scrub != null) return;
      let u = 0;
      if (startRef.current.clip === current.name) {
        const el = r.time - startRef.current.at;
        u = current.clip.loop && !(queueRunning) ? (el / total) % 1 : Math.min(1, el / total);
        if (timeRef.current) timeRef.current.textContent = `${(u * total).toFixed(2)}s`;
      } else if (!current.clip.loop) u = 1;
      if (playheadRef.current) playheadRef.current.style.left = `${u * 100}%`;
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [current, total, scrub, queueRunning]);

  /* event log */
  const onEvent = useCallback((e: MascotEvent) => {
    const r = ref.current?.runtime;
    if (e.type === 'start' && r) startRef.current = { clip: e.clip, at: r.time };
    setLog((l) => {
      const next = [...l, { id: ++logSeq.current, t: r?.time ?? 0, e }];
      return next.length > 250 ? next.slice(-250) : next;
    });
  }, [ref]);

  /* ---------------------------------------------------------------- */
  /* scrubbing                                                         */

  const sim = useMemo(() => new ClipSim(character, { ...current.clip, name: current.name }, bpmEff), [current, bpmEff]);
  const scrubT = scrub == null ? null : Math.min(Math.max(0, scrub), total);

  const enterScrub = (t?: number) => {
    player()?.stop();
    let at = t;
    if (at == null) {
      const r = runtime();
      at = r && startRef.current.clip === current.name ? ((r.time - startRef.current.at) % total) : 0;
    }
    setScrub(Math.round(at * SIM_FPS) / SIM_FPS);
  };

  const scrubImgs = useMemo(() => {
    if (scrubT == null) return null;
    const main = svgUri(frameSvg(sim, sim.at(scrubT), { padding: STAGE_PAD }));
    const ghosts: { uri: string; side: 'prev' | 'next'; k: number }[] = [];
    if (onion) {
      // render in ascending time order to keep the sim stepping forward
      const times: [number, 'prev' | 'next', number][] = [];
      for (let k = 2; k >= 1; k--) times.push([scrubT - (k * onionGap) / SIM_FPS, 'prev', k]);
      for (let k = 1; k <= 2; k++) times.push([scrubT + (k * onionGap) / SIM_FPS, 'next', k]);
      const ghostSim = new ClipSim(character, { ...current.clip, name: current.name }, bpmEff);
      for (const [t, side, k] of times) {
        if (t < 0 || t > total) continue;
        ghosts.push({ uri: svgUri(frameSvg(ghostSim, ghostSim.at(t), { padding: STAGE_PAD, particles: [] })), side, k });
      }
    }
    return { main, ghosts };
  }, [sim, scrubT, onion, onionGap, current, bpmEff, total]);

  const strip = useMemo(() => {
    const s = new ClipSim(character, { ...current.clip, name: current.name }, bpmEff);
    return sampleFrames(s, total, stripN, { padding: STRIP_PAD });
  }, [current, bpmEff, total, stripN]);

  const step = (frames: number) => {
    const base = scrubT ?? 0;
    if (scrub == null) enterScrub(base);
    setScrub(Math.min(total, Math.max(0, Math.round((base + frames / SIM_FPS) * SIM_FPS) / SIM_FPS)));
  };

  const togglePlay = () => {
    if (scrub == null) enterScrub();
    else {
      const t = scrubT ?? 0;
      playClip(current.name, current.clip, { custom: current.custom, offset: t >= total - 1e-3 ? 0 : t });
    }
  };

  // deep link: ?t=0.4 opens scrubbed
  useEffect(() => {
    const t = q.get('t');
    if (t != null && rt) enterScrub(Number(t));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rt]);

  // keyboard: space = play/pause, ←/→ = step
  useEffect(() => {
    const on = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || (e.target as HTMLElement)?.isContentEditable) return;
      if (e.key === ' ') {
        e.preventDefault();
        togglePlay();
      } else if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
        e.preventDefault();
        step((e.key === 'ArrowRight' ? 1 : -1) * (e.shiftKey ? 10 : 1));
      }
    };
    addEventListener('keydown', on);
    return () => removeEventListener('keydown', on);
  });

  /* ---------------------------------------------------------------- */
  /* inspector actions                                                 */

  const setAlive = (v: boolean) => {
    setAliveState(v);
    runtime()?.setAlive(v);
  };

  const setParam = (name: string, v: number | null) => {
    runtime()?.setParam(name, v);
    setParams((p) => {
      const n = { ...p };
      if (v == null) delete n[name];
      else n[name] = v;
      return n;
    });
  };

  const setPoseValue = (key: PoseKey, v: number) => {
    const [bone, ch] = key.split('.') as ['root' | 'body' | 'head', 'yaw' | 'pitch'];
    const keys = poseClip.current.bones![bone]![ch]!;
    keys[0] = [0, v];
    setPose((p) => ({ ...p, [key]: v }));
    const r = runtime();
    if (r && r.playing !== '__pose') {
      setScrub(null);
      player()?.start();
      r.play(poseClip.current, { fade: 0.2, then: null });
    }
  };
  const releasePose = () => {
    for (const k of POSE_KEYS) {
      const [bone, ch] = k.split('.') as ['root' | 'body' | 'head', 'yaw' | 'pitch'];
      poseClip.current.bones![bone]![ch]![0] = [0, 0];
    }
    setPose(Object.fromEntries(POSE_KEYS.map((k) => [k, 0])) as Record<PoseKey, number>);
    const r = runtime();
    if (r?.playing === '__pose') r.idle(0.3);
  };
  const poseActive = POSE_KEYS.some((k) => pose[k] !== 0);

  const effects: EffectDef[] = useMemo(() => Object.entries(rt?.effects ?? {}).map(([k, d]) => ({ ...d, name: d.name ?? k })), [rt]);
  const emit = (name: string) => {
    if (scrub != null) exitScrub();
    runtime()?.emit(name, anchor ? { at: anchor } : {});
  };

  /* exports */
  const copyClip = async () => {
    const ok = await copyText(clipJson({ ...current.clip, name: current.name }));
    say(ok ? `Copied “${current.name}” as JSON${current.clip.fn ? ' (procedural fn omitted)' : ''}` : 'Copy failed');
  };
  const downloadSheet = () => {
    const tiles = strip.map((f) => ({ label: `${f.t.toFixed(2)}s`, svg: f.svg }));
    download(`${current.name}-sheet.svg`, composeSheet(tiles, { title: `${character.name} — ${current.name}${bpmEff ? ` @ ${bpmEff} bpm` : ''}`, cols: Math.min(6, stripN) }));
  };
  const downloadFrame = () => {
    const r = runtime();
    if (scrubT != null) download(`${current.name}-${scrubT.toFixed(2)}s.svg`, frameSvg(sim, sim.at(scrubT), { padding: STAGE_PAD }));
    else if (r) download(`${current.name}-live.svg`, renderSvg(r.rig, r.current.frame, { padding: STAGE_PAD, particles: r.current.particles }));
  };

  /* editor */
  const knownBones = useMemo(() => new Set(Object.keys(rt?.rig.bonesByName ?? {})), [rt]);
  const knownParams = useMemo(() => new Set(Object.keys(character.params ?? {})), [character]);
  const validate = (text: string): { clip?: Clip; problems: { level: 'error' | 'warn'; msg: string }[] } => {
    const out: { level: 'error' | 'warn'; msg: string }[] = [];
    let clip: Clip;
    try {
      clip = JSON.parse(text);
    } catch (e) {
      return { problems: [{ level: 'error', msg: `JSON: ${(e as Error).message}` }] };
    }
    if (!clip || typeof clip !== 'object' || Array.isArray(clip)) return { problems: [{ level: 'error', msg: 'A clip must be a JSON object' }] };
    if (typeof clip.duration !== 'number') out.push({ level: 'error', msg: '“duration” (number) is required' });
    for (const p of lintClip(clip, knownBones, knownParams)) out.push({ level: /^unknown (bone|param)/.test(p) ? 'warn' : 'error', msg: p });
    if (clip.units && clip.units !== 'beats' && clip.units !== 'seconds') out.push({ level: 'error', msg: `units must be "seconds" or "beats"` });
    if (clip.units === 'beats' && clip.bpm != null && !(clip.bpm > 0)) out.push({ level: 'error', msg: 'bpm must be > 0' });
    for (const [t, e] of clip.expression ?? []) if (!hasExpression(character, e)) out.push({ level: 'warn', msg: `expression @${t}: unknown expression "${e}"` });
    for (const s in clip.slots ?? {}) {
      const slot = rt?.rig.slotsByName[s];
      if (!slot) out.push({ level: 'warn', msg: `unknown slot "${s}"` });
      else for (const [, v] of clip.slots![s]) if (!slot.variants.some((x) => x.name === v)) out.push({ level: 'warn', msg: `slot ${s}: unknown variant "${v}"` });
    }
    for (const ev of clip.events ?? []) {
      if (!rt?.effects[ev.effect]) out.push({ level: 'warn', msg: `event @${ev.t}: unknown effect "${ev.effect}"` });
      if (ev.t < 0 || ev.t > clip.duration) out.push({ level: 'warn', msg: `event @${ev.t}: outside [0, ${clip.duration}]` });
    }
    return { clip, problems: out };
  };
  const runEditor = () => {
    const { clip, problems } = validate(editor);
    setProblems(problems);
    if (!clip || problems.some((p) => p.level === 'error')) return;
    const name = clip.name || 'custom';
    if (isBeats(clip)) setBpm(clip.bpm ?? 120);
    playClip(name, clip, { custom: true, bpm: clip.bpm ?? 120 });
  };
  const loadIntoEditor = () => {
    setEditor(clipJson({ ...current.clip, name: current.name }));
    setProblems([]);
  };

  // A tiny API for agents driving the page (e.g. via devtools / playwright).
  useEffect(() => {
    (window as unknown as Record<string, unknown>).openmascotStudio = {
      runtime: rt,
      character: character.id,
      characters: () => CAST.map((c) => c.id),
      setCharacter: (id: string) => onSelectCharacter(id),
      clips: () => Object.keys(allClips()),
      play: (name: string) => selectClip(name),
      playJson: (clip: Clip | string) => {
        const text = typeof clip === 'string' ? clip : clipJson(clip);
        setEditor(text);
        const v = validate(text);
        setProblems(v.problems);
        if (v.clip && !v.problems.some((p) => p.level === 'error')) playClip(v.clip.name || 'custom', v.clip, { custom: true, bpm: v.clip.bpm ?? 120 });
        return v.problems;
      },
      scrub: (t: number) => enterScrub(t),
    };
  });

  /* ---------------------------------------------------------------- */
  /* render                                                            */

  const groups = useMemo(() => groupedClips(character), [character]);
  const filtered = groups
    .map(([cat, names]) => [cat, names.filter((n) => !search || n.includes(search.toLowerCase()) || (getClip(n)?.description ?? '').toLowerCase().includes(search.toLowerCase()))] as [string, string[]])
    .filter(([, n]) => n.length);

  const logShown = log.filter((l) => logFilter === 'all' || (logFilter === 'effects' ? l.e.type === 'effect' : l.e.type !== 'effect' && l.e.type !== 'expression')).slice(-80).reverse();

  return (
    <div className="st-root">
      <div className="st-charbar">{picker}</div>
      <div className="st-grid">
        {/* ------------------------------ left ------------------------------ */}
        <aside className="st-col st-left">
          <Panel
            title={<>Clips <span className="st-count">{Object.keys(allClips()).length}</span></>}
            className="st-browser"
          >
            <input className="st-search" placeholder="Search clips…" value={search} onChange={(e) => setSearch(e.target.value)} />
            <div className="st-cliplist">
              {filtered.map(([cat, names]) => (
                <div key={cat} className="st-cat">
                  <div className="st-cat-h">
                    <span className={`st-dot cat-${cat}`} />
                    {cat}
                    <span className="st-count">{names.length}</span>
                  </div>
                  {names.map((n) => {
                    const c = getClip(n)!;
                    return (
                      <div key={n} className={`st-clip ${current.name === n ? 'on' : ''}`}>
                        <button className="st-clip-main" onClick={() => selectClip(n)} title={c.description}>
                          <span className="st-clip-n">{n}</span>
                          <span className="st-clip-m">
                            {isBeats(c) ? `${c.duration} beats` : `${c.duration.toFixed(2)}s`}
                            {c.loop && <span title="loops"> · ↻</span>}
                            {isBeats(c) && <span> · ♪{c.bpm ?? 120}</span>}
                          </span>
                        </button>
                        <button className="st-mini st-add" title="Add to queue" onClick={() => setQueue((qq) => [...qq, n])}>
                          +
                        </button>
                      </div>
                    );
                  })}
                </div>
              ))}
              {!filtered.length && <p className="st-empty">No clips match “{search}”.</p>}
            </div>
          </Panel>

          <Panel
            title={<>Play queue <span className="st-count">{queue.length}</span></>}
            actions={
              <>
                <button className="st-btn sm" disabled={!queue.length} onClick={runQueue}>
                  {queueRunning ? 'Restart' : '▶ Play'}
                </button>
                <button className="st-btn sm ghost" disabled={!queue.length} onClick={() => (setQueue([]), queueToken.current++, setQueueRunning(false))}>
                  Clear
                </button>
              </>
            }
          >
            {queue.length ? (
              <ol className="st-queue">
                {queue.map((n, i) => (
                  <li key={i} className={queueRunning && current.name === n ? 'on' : ''}>
                    <span>{n}</span>
                    <button className="st-mini" onClick={() => setQueue((qq) => qq.filter((_, j) => j !== i))} title="Remove">
                      ×
                    </button>
                  </li>
                ))}
              </ol>
            ) : (
              <p className="st-hint">Use “+” on clips to chain them. Loops play once each, then the queue moves on.</p>
            )}
          </Panel>
        </aside>

        {/* ------------------------------ centre ------------------------------ */}
        <div className="st-col st-center">
          <div className={`st-stage bg-${bg}`}>
            <div className="st-stage-bar">
              <div className="st-now">
                <span className={`st-live ${scrub != null ? 'paused' : ''}`}>{scrub != null ? 'SCRUB' : 'LIVE'}</span>
                <strong>{current.name}</strong>
                {current.custom && <span className="st-tag">custom</span>}
                {poseActive && <span className="st-tag warn">pose override</span>}
              </div>
              <Segmented
                className="st-bgseg"
                value={bg}
                onChange={setBg}
                options={(['white', 'lavender', 'dark', 'checker'] as Bg[]).map((b) => ({ value: b, label: <span className={`st-sw sw-${b}`} />, title: b }))}
              />
            </div>
            <div className="st-stage-box" style={{ aspectRatio: `${STAGE_VB[2]} / ${STAGE_VB[3]}`, width: `min(100%, 980px, calc(64vh * ${(STAGE_VB[2] / STAGE_VB[3]).toFixed(3)}))` }}>
              {ground && <div className="st-ground" style={{ top: `${GROUND_PCT}%` }} />}
              <Mascot
                ref={ref}
                character={character}
                padding={STAGE_PAD}
                options={STAGE_OPTIONS}
                animation={initialName}
                lookAtPointer={track}
                speed={speed}
                onEvent={onEvent}
                className="st-live-mascot"
                style={{ width: '100%', height: '100%', visibility: scrubImgs ? 'hidden' : 'visible' }}
              />
              {scrubImgs && (
                <div className="st-scrubview">
                  {scrubImgs.ghosts.map((g) => (
                    <img key={`${g.side}${g.k}`} src={g.uri} className={`st-ghost ${g.side}`} style={{ opacity: g.k === 1 ? 0.32 : 0.16 }} alt="" />
                  ))}
                  <img src={scrubImgs.main} alt={`${current.name} at ${scrubT?.toFixed(2)}s`} />
                </div>
              )}
            </div>
            <div className="st-stage-foot">
              <Toggle label="Ground" checked={ground} onChange={setGround} />
              <Toggle label="Follow pointer" checked={track} onChange={setTrack} />
              <Toggle label="Alive" checked={alive} onChange={setAlive} title="Breathing, blinks, glances and fidgets" />
            </div>
          </div>

          {/* transport + timeline */}
          <div className="st-transport">
            <div className="st-tbtns">
              <button className="st-icon" onClick={() => (scrub == null ? enterScrub(0) : setScrub(0))} title="First frame">
                ⏮
              </button>
              <button className="st-icon" onClick={() => step(-1)} title="Previous frame (←)">
                ◀
              </button>
              <button className="st-icon big" onClick={togglePlay} title="Play / pause (space)">
                {scrub == null ? '❚❚' : '▶'}
              </button>
              <button className="st-icon" onClick={() => step(1)} title="Next frame (→)">
                ▶
              </button>
              <button className="st-icon" onClick={() => (scrub == null ? enterScrub(total) : setScrub(total))} title="Last frame">
                ⏭
              </button>
            </div>
            <div className="st-timeline">
              <div className="st-ticks">
                {Array.from({ length: tickCount + 1 }, (_, i) => (
                  <span key={i} style={{ left: `${(i / tickCount) * 100}%` }} className={isBeats(current.clip) || i % 4 === 0 ? 'major' : ''} />
                ))}
                {(current.clip.events ?? []).map((ev, i) => (
                  <span key={`e${i}`} className="st-evmark" style={{ left: `${(ev.t / current.clip.duration) * 100}%` }} title={`${ev.effect} @ ${ev.t}`} />
                ))}
              </div>
              <input
                type="range"
                className={`st-scrubber ${scrub == null ? 'live' : ''}`}
                min={0}
                max={total}
                step={1 / SIM_FPS}
                value={scrubT ?? 0}
                onChange={(e) => (scrub == null ? enterScrub(Number(e.target.value)) : setScrub(Number(e.target.value)))}
                aria-label="Timeline"
              />
              {scrub == null && <div className="st-playhead" ref={playheadRef} />}
            </div>
            <div className="st-time">
              {scrubT != null ? (
                <>
                  <b>{scrubT.toFixed(2)}s</b>
                  <small>
                    frame {Math.round(scrubT * SIM_FPS)}/{Math.round(total * SIM_FPS)}
                    {isBeats(current.clip) && ` · beat ${(scrubT / (60 / bpm)).toFixed(2)}`}
                  </small>
                </>
              ) : (
                <>
                  <b>
                    <span ref={timeRef}>0.00s</span>
                  </b>
                  <small>of {total.toFixed(2)}s</small>
                </>
              )}
            </div>
          </div>

          <Panel
            title="Frame strip"
            className="st-strip-panel"
            actions={
              <>
                <label className="st-inline">
                  frames
                  <input type="number" min={4} max={24} value={stripN} onChange={(e) => setStripN(Math.min(24, Math.max(4, Number(e.target.value) || 10)))} />
                </label>
                <Toggle label="Onion (strip)" checked={stripOnion} onChange={setStripOnion} />
                <Toggle label="Onion (stage)" checked={onion} onChange={(v) => (setOnion(v), v && scrub == null && enterScrub())} />
                {onion && (
                  <label className="st-inline">
                    gap
                    <input type="number" min={1} max={30} value={onionGap} onChange={(e) => setOnionGap(Math.min(30, Math.max(1, Number(e.target.value) || 4)))} />
                    f
                  </label>
                )}
              </>
            }
          >
            <div className="st-strip" style={{ gridTemplateColumns: `repeat(${stripN}, minmax(64px, 1fr))` }}>
              {strip.map((f, i) => {
                const on = scrubT != null && Math.abs(scrubT - f.t) < total / (stripN - 1) / 2;
                return (
                  <button key={i} className={`st-thumb ${on ? 'on' : ''}`} onClick={() => enterScrub(f.t)} title={`Scrub to ${f.t.toFixed(2)}s`}>
                    <span className="st-thumb-img" style={{ aspectRatio: `${STRIP_VB[2]} / ${STRIP_VB[3]}` }}>
                      {stripOnion && i > 0 && <img src={svgUri(strip[i - 1].svg)} className="st-ghost prev" alt="" style={{ opacity: 0.3 }} />}
                      <img src={svgUri(f.svg)} alt="" loading="lazy" />
                    </span>
                    <small>{f.t.toFixed(2)}s</small>
                  </button>
                );
              })}
            </div>
          </Panel>

          <div className="st-two">
            <Panel
              title="Clip editor (JSON)"
              className="st-editor"
              actions={
                <>
                  <button className="st-btn sm ghost" onClick={loadIntoEditor} title="Load the current clip into the editor">
                    Load current
                  </button>
                  <button className="st-btn sm ghost" onClick={() => (setEditor(clipJson(starter)), setProblems([]))}>
                    Starter
                  </button>
                  <button className="st-btn sm" onClick={runEditor} title="Validate & play (Ctrl/⌘+Enter)">
                    ▶ Validate & play
                  </button>
                </>
              }
            >
              <textarea
                className="st-json"
                wrap="off"
                spellCheck={false}
                value={editor}
                onChange={(e) => setEditor(e.target.value)}
                onKeyDown={(e) => {
                  if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
                    e.preventDefault();
                    runEditor();
                  }
                  if (e.key === 'Tab') {
                    e.preventDefault();
                    const ta = e.currentTarget;
                    const s = ta.selectionStart;
                    setEditor(editor.slice(0, s) + '  ' + editor.slice(ta.selectionEnd));
                    requestAnimationFrame(() => ta.setSelectionRange(s + 2, s + 2));
                  }
                }}
              />
              <div className="st-problems">
                {problems.length === 0 ? (
                  <span className="st-ok">Paste or edit a clip, then press Ctrl/⌘+Enter. Problems from <code>lintClip</code> show here.</span>
                ) : (
                  problems.map((p, i) => (
                    <div key={i} className={`st-prob ${p.level}`}>
                      <b>{p.level === 'error' ? 'Error' : 'Warning'}</b> {p.msg}
                    </div>
                  ))
                )}
              </div>
              <RigReference rt={rt} effects={effects} character={character} />
            </Panel>

            <Panel
              title={<>Event log <span className="st-count">{log.length}</span></>}
              className="st-log-panel"
              actions={
                <>
                  <Segmented
                    value={logFilter}
                    onChange={setLogFilter}
                    options={[
                      { value: 'all', label: 'All' },
                      { value: 'clips', label: 'Clips' },
                      { value: 'effects', label: 'FX' },
                    ]}
                  />
                  <button className="st-btn sm ghost" onClick={() => setLog([])}>
                    Clear
                  </button>
                </>
              }
            >
              <div className="st-log">
                {logShown.length ? (
                  logShown.map((l) => (
                    <div key={l.id} className={`st-ev ev-${l.e.type}`}>
                      <span className="st-ev-t">{l.t.toFixed(2)}</span>
                      <span className="st-ev-k">{l.e.type}</span>
                      <span className="st-ev-d">
                        {'clip' in l.e ? l.e.clip : ''}
                        {l.e.type === 'effect' ? ` → ${l.e.effect}` : ''}
                        {l.e.type === 'expression' ? l.e.expression ?? '(cleared)' : ''}
                      </span>
                    </div>
                  ))
                ) : (
                  <p className="st-hint">start / end / loop / effect / expression events appear here.</p>
                )}
              </div>
            </Panel>
          </div>
        </div>

        {/* ------------------------------ right ------------------------------ */}
        <aside className="st-col st-right">
          <Panel title="Character" collapsible>
            <CharacterAbout c={character} compact />
          </Panel>

          <Panel title="Clip">
            <div className="st-info">
              <div className="st-info-h">
                <h2>{current.name}</h2>
                {current.clip.category && <span className={`st-chip cat-${current.clip.category}`}>{current.clip.category}</span>}
              </div>
              <p className="st-desc">{current.clip.description ?? <i>No description.</i>}</p>
              <dl className="st-meta">
                <div>
                  <dt>duration</dt>
                  <dd>
                    {current.clip.duration} {isBeats(current.clip) ? 'beats' : 's'}
                    {isBeats(current.clip) && <small> = {total.toFixed(2)}s</small>}
                  </dd>
                </div>
                <div>
                  <dt>loop</dt>
                  <dd>{current.clip.loop ? 'yes' : 'no'}</dd>
                </div>
                <div>
                  <dt>units</dt>
                  <dd>{current.clip.units ?? 'seconds'}</dd>
                </div>
                <div>
                  <dt>events</dt>
                  <dd>{current.clip.events?.length ?? 0}</dd>
                </div>
              </dl>
            </div>
          </Panel>

          <Panel title="Playback">
            <Slider label="Speed" value={speed} min={0.1} max={3} step={0.05} onChange={setSpeed} format={(v) => `${v.toFixed(2)}×`} onReset={() => setSpeed(1)} active={speed !== 1} />
            <Slider label="Fade" value={fade} min={0} max={1.5} step={0.05} onChange={setFade} format={(v) => `${v.toFixed(2)}s`} onReset={() => setFade(0.25)} active={fade !== 0.25} />
            {isBeats(current.clip) && (
              <Slider label="BPM" value={bpm} min={50} max={200} step={1} onChange={changeBpm} format={(v) => `${v}`} onReset={() => changeBpm(current.clip.bpm ?? 120)} active={bpm !== (current.clip.bpm ?? 120)} />
            )}
            <div className="st-row">
              <span className="st-lbl">After one-shots</span>
              <Segmented
                value={thenIdle ? 'idle' : 'hold'}
                onChange={(v) => setThenIdle(v === 'idle')}
                options={[
                  { value: 'idle', label: 'Then idle' },
                  { value: 'hold', label: 'Hold' },
                ]}
              />
            </div>
            <div className="st-row">
              <button className="st-btn" onClick={() => playClip(current.name, current.clip, { custom: current.custom })}>
                ↻ Replay
              </button>
              <button className="st-btn ghost" onClick={() => (runtime()?.idle(fade), setScrub(null), player()?.start())}>
                Idle
              </button>
            </div>
          </Panel>

          <Panel title="Expression" collapsible>
            <div className="st-chips">
              <button className={`st-pill ${expr == null ? 'on' : ''}`} onClick={() => (setExpr(null), runtime()?.setExpression(null))}>
                auto
              </button>
              {Object.keys(character.expressions ?? {}).map((e) => (
                <button key={e} className={`st-pill ${expr === e ? 'on' : ''}`} onClick={() => (setExpr(e), runtime()?.setExpression(e))}>
                  {e}
                </button>
              ))}
            </div>
          </Panel>

          <Panel
            title={<>Effects <span className="st-count">{effects.length}</span></>}
            collapsible
            actions={
              <select className="st-select" value={anchor} onChange={(e) => setAnchor(e.target.value)} title="Anchor">
                <option value="">default anchor</option>
                {anchors.map((a) => (
                  <option key={a} value={a}>
                    at {a}
                  </option>
                ))}
              </select>
            }
          >
            <div className="st-fx">
              {effects.map((d) => (
                <button key={d.name} className="st-fxbtn" onClick={() => emit(d.name)} title={d.description}>
                  <b>{d.name}</b>
                  {d.description && <small>{d.description.split(/(?<=\))\.|\. Params/)[0]}</small>}
                </button>
              ))}
            </div>
          </Panel>

          <Panel
            title="Params"
            collapsible
            actions={
              <button className="st-btn sm ghost" disabled={!Object.keys(params).length} onClick={() => Object.keys(params).forEach((p) => setParam(p, null))}>
                Reset all
              </button>
            }
          >
            {Object.entries(character.params ?? {}).map(([name, def]) => (
              <Slider
                key={name}
                label={name}
                min={def.min ?? -1}
                max={def.max ?? 1}
                value={params[name] ?? def.default ?? 0}
                onChange={(v) => setParam(name, v)}
                onReset={() => setParam(name, null)}
                active={name in params}
                title={`${def.drives.length} driver(s): ${def.drives.map((d) => `${d.bone}.${d.channel}`).join(', ')}`}
              />
            ))}
            {!Object.keys(character.params ?? {}).length && <p className="st-empty">{character.name} defines no params.</p>}
            <p className="st-hint">Overrides replace the runtime’s value (look, blink, breathe…) until reset.</p>
          </Panel>

          <Panel
            title="Pseudo-3D"
            collapsible
            actions={
              <button className="st-btn sm ghost" disabled={!poseActive} onClick={releasePose}>
                Release
              </button>
            }
          >
            {POSE_KEYS.map((k) => (
              <Slider
                key={k}
                label={k}
                min={k.endsWith('yaw') ? (k.startsWith('root') ? -180 : -90) : -60}
                max={k.endsWith('yaw') ? (k.startsWith('root') ? 180 : 90) : 60}
                step={1}
                value={pose[k]}
                onChange={(v) => setPoseValue(k, v)}
                onReset={() => setPoseValue(k, 0)}
                active={pose[k] !== 0}
                format={(v) => `${v}°`}
              />
            ))}
            {!POSE_KEYS.length && <p className="st-empty">{character.name} has no root/body/head bones.</p>}
            <p className="st-hint">Plays a held one-frame clip; drag to inspect parallax, culling and depth sorting.</p>
          </Panel>

          <Panel title="Export" collapsible>
            <div className="st-export">
              <button className="st-btn ghost" onClick={copyClip}>
                Copy clip JSON
              </button>
              <button className="st-btn ghost" onClick={downloadSheet}>
                Frame sheet .svg
              </button>
              <button className="st-btn ghost" onClick={downloadFrame}>
                {scrub != null ? 'This frame .svg' : 'Live frame .svg'}
              </button>
            </div>
          </Panel>
        </aside>
      </div>
      {toast && <div className="st-toast">{toast}</div>}
    </div>
  );
}

/* ------------------------------------------------------------------ */

function RigReference({ rt, effects, character }: { rt?: MascotRuntime; effects: EffectDef[]; character: CharacterDef }) {
  const text = useMemo(() => {
    if (!rt) return '';
    const lines: string[] = [];
    lines.push(`character: ${character.id} (${character.name})`);
    lines.push(`bones: ${Object.keys(rt.rig.bonesByName).join(', ')}`);
    lines.push(`channels: ${CHANNELS}`);
    lines.push(
      `params: ${Object.entries(character.params ?? {})
        .map(([n, d]) => `${n} [${d.min ?? -1}..${d.max ?? 1}]`)
        .join(', ')}`,
    );
    lines.push(`slots: ${rt.rig.slots.map((s) => `${s.name}(${s.variants.map((v) => v.name).join('|')})`).join(', ')}`);
    lines.push(`expressions: ${Object.keys(character.expressions ?? {}).join(', ')}`);
    lines.push(`effects: ${effects.map((e) => e.name).join(', ')}`);
    lines.push(`anchors: ${Object.keys(character.anchors ?? {}).join(', ')} (or any bone, or [x, y])`);
    lines.push(`eases: ${EASES.join(', ')} or [x1,y1,x2,y2]`);
    lines.push(`categories: idle, fidget, emotion, gesture, pose, dance, locomotion`);
    return lines.join('\n');
  }, [rt, effects, character]);
  const [copied, setCopied] = useState(false);
  return (
    <details className="st-ref">
      <summary>
        Rig reference <small>— bones, params, slots, expressions, effects (copy for an AI prompt)</small>
      </summary>
      <pre>{text}</pre>
      <button className="st-btn sm ghost" onClick={async () => (setCopied(await copyText(text)), setTimeout(() => setCopied(false), 1500))}>
        {copied ? 'Copied!' : 'Copy'}
      </button>
    </details>
  );
}

