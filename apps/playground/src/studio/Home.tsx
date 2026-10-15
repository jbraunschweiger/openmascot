/**
 * Home — landing page for the OpenMascot open-source project.
 */
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Mascot, useMascotRef } from '@openmascot/react';
import type { MascotEvent } from '@openmascot/core';
import { allClips, copyText, DEMO_OPTIONS, echo, hasClip, isBeats } from './shared';
import { Code, useInterval } from './ui';
import './studio.css';

const HERO_PAD: [number, number, number, number] = [110, 40, 30, 40];
const MINI_PAD = 46;
const CARD_PAD = 30;

/* ------------------------------------------------------------------ */
/* Hero                                                                */
/* ------------------------------------------------------------------ */

const FALLBACK_REACTIONS = ['demo-spin', 'demo-bop', 'fidget-hop', 'fidget-wing-stretch', 'fly'];
const REACTION_FX = ['sparkles', 'hearts', 'notes', 'confetti', 'burst'];

function Hero() {
  const ref = useMascotRef();
  const [label, setLabel] = useState('Click me!');
  const last = useRef('');

  const react = () => {
    const rt = ref.current?.runtime;
    if (!rt) return;
    let cands = Object.entries(allClips())
      .filter(([n, c]) => c.category === 'emotion' || c.category === 'dance' || /^(emote|dance)-/.test(n))
      .map(([n]) => n);
    if (!cands.length) cands = FALLBACK_REACTIONS.filter((n) => rt.clips[n]);
    if (cands.length > 1) cands = cands.filter((n) => n !== last.current);
    const name = cands[Math.floor(Math.random() * cands.length)];
    last.current = name;
    const clip = rt.clips[name];
    setLabel(`▶ ${name}`);
    rt.play(name, { fade: 0.2, repeat: clip.loop ? (isBeats(clip) ? 1 : 3) : undefined }).then(() => setLabel((l) => (l === `▶ ${name}` ? 'Again!' : l)));
    if (!clip.events?.length) {
      const fx = REACTION_FX.filter((f) => rt.effects[f]);
      if (fx.length) setTimeout(() => rt.emit(fx[Math.floor(Math.random() * fx.length)]), 250);
    }
  };

  const [copied, setCopied] = useState(false);
  return (
    <header className="hm-hero">
      <div className="hm-wrap hm-hero-grid">
        <div>
          <span className="hm-eyebrow">
            <b>Open source</b> MIT · SVG · TypeScript
          </span>
          <h1 className="hm-h1">
            Rig any SVG.
            <br />
            <em>Animate it like a pro.</em>
          </h1>
          <p className="hm-lede">
            OpenMascot turns a plain, annotated SVG into a living brand mascot — pseudo-3D turns, expressive faces, beat-synced dances, springy ears and particle effects — in a tiny, DOM-free engine
            that runs anywhere.
          </p>
          <div className="hm-cta">
            <a className="st-btn" href="#/studio">
              Open the Studio →
            </a>
            <a className="st-btn ghost" href="#/gallery">
              Browse the gallery
            </a>
          </div>
          <div className="hm-install">
            <span>$</span> npm i @openmascot/react @openmascot/characters
            <button onClick={async () => (setCopied(await copyText('npm i @openmascot/react @openmascot/characters')), setTimeout(() => setCopied(false), 1400))}>{copied ? 'Copied' : 'Copy'}</button>
          </div>
        </div>
        <div className="hm-stage" onClick={react} role="button" tabIndex={0} aria-label="Make Echo react" onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && (e.preventDefault(), react())}>
          <div className="hm-stage-ring" />
          <Mascot ref={ref} character={echo} lookAtPointer padding={HERO_PAD} options={DEMO_OPTIONS} className="hm-mascot" style={{ width: '100%', height: '100%' }} title="Echo the bat — click me" />
          <span className="hm-bubble">{label}</span>
        </div>
      </div>
    </header>
  );
}

/* ------------------------------------------------------------------ */
/* Pipeline                                                            */
/* ------------------------------------------------------------------ */

const PIPE: [string, ReactNode][] = [
  ['Annotated SVG', <>Draw in any tool. Mark bones, pivots & depth with <code>data-om-*</code>.</>],
  ['Rig', <>Compiled to a bone tree with slots, variants and springs.</>],
  ['Pseudo-3D', <>Yaw & pitch with parallax, foreshortening and face culling.</>],
  ['Clips', <>Plain-JSON keyframes, crossfades, beat-synced dances.</>],
  ['Effects', <>Hearts, sparkles, notes, confetti — deterministic particles.</>],
  ['Anywhere', <>React, <code>&lt;open-mascot&gt;</code>, or the DOM-free core (mobile-ready).</>],
];

/* ------------------------------------------------------------------ */
/* Feature demos                                                       */
/* ------------------------------------------------------------------ */

function Feature(props: { title: string; tag?: ReactNode; ctl?: ReactNode; children: ReactNode; body: ReactNode }) {
  return (
    <article className="hm-card">
      <div className="hm-demo">
        {props.tag && <span className="hm-demo-tag">{props.tag}</span>}
        {props.ctl && <div className="hm-demo-ctl">{props.ctl}</div>}
        {props.children}
      </div>
      <div className="hm-card-b">
        <h3>{props.title}</h3>
        <p>{props.body}</p>
      </div>
    </article>
  );
}

const mini = { width: '84%', height: '100%' };

function SpinDemo() {
  return (
    <Feature title="Pseudo-3D from flat art" tag="root.yaw: 0 → 360" body={<>A single front-view drawing spins, turns its head and nods. Depth sorting, parallax and back-face culling come from a few <code>data-om-*</code> hints.</>}>
      <Mascot character={echo} animation="demo-spin" options={DEMO_OPTIONS} padding={MINI_PAD} style={mini} />
    </Feature>
  );
}

const EXPR_CYCLE = ['happy', 'excited', 'inlove', 'unimpressed', 'playful', 'surprised', 'sad', 'proud', 'dizzy', 'wink'];

function ExpressionDemo() {
  const list = useMemo(() => EXPR_CYCLE.filter((e) => echo.expressions[e]), []);
  const [i, setI] = useState(0);
  useInterval(() => setI((n) => (n + 1) % list.length), 1500);
  return (
    <Feature title="Expressions" tag={`setExpression('${list[i]}')`} body={<>Swap eyes, mouth and blush variants by name. Eye changes hide behind a quick blink — the way a 2D animator would do it.</>}>
      <Mascot character={echo} expression={list[i]} padding={MINI_PAD} style={mini} />
    </Feature>
  );
}

function DanceDemo() {
  const dance = useMemo(() => Object.entries(allClips()).find(([n, c]) => c.category === 'dance' || n.startsWith('dance-'))?.[0] ?? 'demo-bop', []);
  const [bpm, setBpm] = useState(120);
  const ref = useMascotRef();
  const dot = useRef<HTMLSpanElement>(null);
  const start = useRef(0);
  const onEvent = (e: MascotEvent) => {
    if (e.type === 'start' && e.clip === dance && ref.current?.runtime) start.current = ref.current.runtime.time;
  };
  useEffect(() => {
    let raf = 0;
    const tick = () => {
      raf = requestAnimationFrame(tick);
      const rt = ref.current?.runtime;
      if (!rt || !dot.current) return;
      const phase = (((rt.time - start.current) * bpm) / 60) % 1;
      dot.current.style.transform = `scale(${1.6 - Math.min(1, phase * 2.2) * 0.8})`;
      dot.current.style.opacity = String(1 - phase * 0.6);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [bpm, ref]);
  return (
    <Feature
      title="Dances synced to any BPM"
      tag={`play('${dance}', { bpm: ${bpm} })`}
      ctl={
        <>
          <span className="hm-beat" ref={dot} style={{ animation: 'none' }} />
          <div className="st-seg">
            {[90, 120, 150].map((b) => (
              <button key={b} className={b === bpm ? 'on' : ''} onClick={() => setBpm(b)}>
                {b}
              </button>
            ))}
          </div>
        </>
      }
      body={<>Author dances in beats and retime them to the song playing in your app. Moves chain into routines with <code>sequence()</code>.</>}
    >
      <Mascot ref={ref} character={echo} animation={dance} bpm={bpm} options={DEMO_OPTIONS} padding={MINI_PAD} style={mini} onEvent={onEvent} />
    </Feature>
  );
}

const FX_CYCLE = ['hearts', 'sparkles', 'notes', 'confetti', 'burst', 'question', 'exclaim', 'zzz', 'dizzy'];

function EffectsDemo() {
  const ref = useMascotRef();
  const [name, setName] = useState('hearts');
  const i = useRef(0);
  useInterval(() => {
    const rt = ref.current?.runtime;
    if (!rt || document.hidden) return;
    const list = FX_CYCLE.filter((f) => rt.effects[f]);
    if (!list.length) return;
    const fx = list[i.current++ % list.length];
    setName(fx);
    rt.emit(fx);
  }, 1700);
  return (
    <Feature title="Effects that punctuate" tag={`emit('${name}')`} body={<>Analytic particles anchored to bones: deterministic for frame sheets and video, free to simulate, and triggered from clips on the accent frame.</>}>
      <Mascot ref={ref} character={echo} padding={[70, 46, 30, 46]} style={mini} />
    </Feature>
  );
}

function SpringDemo() {
  return (
    <Feature title="Secondary motion" tag="data-om-spring=&quot;90 9&quot;" body={<>Ears, tuft and wings are springs: they lag behind, overshoot and settle on their own. Follow-through you never have to keyframe.</>}>
      <Mascot character={echo} animation="demo-springs" options={DEMO_OPTIONS} padding={MINI_PAD} style={mini} />
    </Feature>
  );
}

const XFADE = ['idle', 'fly', 'cloak', 'fly-side', 'hang'];

function CrossfadeDemo() {
  const list = useMemo(() => XFADE.filter(hasClip), []);
  const [i, setI] = useState(0);
  useInterval(() => setI((n) => (n + 1) % list.length), 2600);
  const name = list[i] ?? 'idle';
  return (
    <Feature title="Natural crossfades" tag={`play('${name}', { fade: .6 })`} body={<>Every transition blends pose tracks over time, layered with breathing, blinking, glances and idle fidgets, so the character never pops or freezes.</>}>
      <Mascot character={echo} animation={name} fade={0.6} padding={[60, 46, 46, 46]} style={mini} />
    </Feature>
  );
}

/* ------------------------------------------------------------------ */
/* Code                                                                */
/* ------------------------------------------------------------------ */

const SNIPPETS: { id: string; title: string; sub: string; file: string; code: string }[] = [
  {
    id: 'react',
    title: 'React',
    sub: '<Mascot> component + ref handle',
    file: 'App.tsx',
    code: `import { Mascot, useMascotRef } from '@openmascot/react';
import { echo } from '@openmascot/characters';

export function Celebrate() {
  const echoRef = useMascotRef();
  return (
    <button onClick={() => echoRef.current?.play('emote-excited')}>
      <Mascot
        ref={echoRef}
        character={echo}
        animation="dance-bop"   // crossfades when it changes
        bpm={112}               // retime beat clips to your song
        lookAtPointer
        style={{ width: 280 }}
      />
    </button>
  );
}`,
  },
  {
    id: 'element',
    title: 'Custom element',
    sub: '<open-mascot> — zero framework',
    file: 'index.html',
    code: `<script type="module">
  import { defineOpenMascot } from '@openmascot/web';
  import { echo } from '@openmascot/characters';
  defineOpenMascot({ characters: { echo } });
</script>

<open-mascot character="echo" animation="dance-bop"
             bpm="120" look-at-pointer style="width:240px">
</open-mascot>

<script>
  const m = document.querySelector('open-mascot');
  m.addEventListener('mascot:end', (e) => console.log(e.detail));
  m.emit('confetti');
</script>`,
  },
  {
    id: 'core',
    title: 'Core API',
    sub: 'DOM-free runtime for any renderer',
    file: 'mascot.ts',
    code: `import { Mascot, renderSvg } from '@openmascot/core';
import { echo } from '@openmascot/characters';

const m = new Mascot(echo, { seed: 7 });
m.play('dance-spin', { fade: 0.3, bpm: 110, repeat: 2 });
m.setExpression('happy', 2);        // 2 s override
m.emit('confetti');
m.lookAt({ x: 0.5, y: -0.2 });
m.on((e) => console.log(e.type));   // start / end / loop / effect

// advance & render anywhere — DOM, canvas, server, native
const { frame, particles } = m.update(1 / 60);
const svg = renderSvg(m.rig, frame, { particles, padding: 40 });`,
  },
  {
    id: 'clip',
    title: 'Author a clip',
    sub: 'Plain JSON — great for AI agents',
    file: 'cheer.ts',
    code: `export const cheer = defineClip({
  description: 'Jump with both wings up, sparkles at the top.',
  category: 'emotion',
  duration: 1.2,
  bones: {
    root: { y: keys('quadOut', [0, 0], [0.45, -40], [0.75, 0, 'bounceOut']) },
  },
  params: { squash: [[0, 0], [0.12, 0.5], [0.25, -0.4], [0.75, 0.4], [0.95, 0]] },
  expression: [[0, 'excited'], [0.4, 'joyful']],
  events: [{ t: 0.45, effect: 'sparkles', at: 'head' }],
});`,
  },
];

function CodeSection() {
  const [tab, setTab] = useState('react');
  const s = SNIPPETS.find((x) => x.id === tab)!;
  const [copied, setCopied] = useState(false);
  return (
    <div className="hm-codegrid">
      <div className="hm-tabs" role="tablist">
        {SNIPPETS.map((x) => (
          <button key={x.id} role="tab" aria-selected={x.id === tab} className={`hm-tab ${x.id === tab ? 'on' : ''}`} onClick={() => setTab(x.id)}>
            <b>{x.title}</b>
            <span>{x.sub}</span>
          </button>
        ))}
      </div>
      <div className="hm-codebox">
        <div className="hm-codebar">
          <i />
          <i />
          <i />
          <span>{s.file}</span>
          <button onClick={async () => (setCopied(await copyText(s.code)), setTimeout(() => setCopied(false), 1400))}>{copied ? 'Copied' : 'Copy'}</button>
        </div>
        <Code code={s.code} />
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Lineup                                                              */
/* ------------------------------------------------------------------ */

const eye = (x: number, y: number, r = 16, look = 2) => (
  <g>
    <circle cx={x} cy={y} r={r} fill="#fff" />
    <circle cx={x + look} cy={y + 2} r={r * 0.5} fill="#2b2b33" />
    <circle cx={x + look - r * 0.2} cy={y - r * 0.12} r={r * 0.16} fill="#fff" />
  </g>
);
const shadow = <ellipse cx="100" cy="164" rx="62" ry="6" fill="#2b2340" opacity=".08" />;

const LINEUP: { name: string; blurb: string; tint: string; art: ReactNode }[] = [
  {
    name: 'Pip',
    blurb: 'the curious bluebird',
    tint: '#4aa8f0',
    art: (
      <>
        {shadow}
        <path d="M94 46 C86 20 106 10 110 30 C116 14 134 22 120 42 Z" fill="#3d95e8" />
        <ellipse cx="44" cy="112" rx="15" ry="28" fill="#2f86df" />
        <ellipse cx="156" cy="112" rx="15" ry="28" fill="#2f86df" />
        <circle cx="100" cy="102" r="60" fill="#4aa8f0" />
        <ellipse cx="100" cy="132" rx="32" ry="24" fill="#bfe0ff" />
        {eye(78, 94, 17)}
        {eye(122, 94, 17, -2)}
        <path d="M88 106 Q100 98 112 106 Q100 122 88 106Z" fill="#f7a823" />
        <ellipse cx="84" cy="161" rx="12" ry="5" fill="#f7a823" />
        <ellipse cx="116" cy="161" rx="12" ry="5" fill="#f7a823" />
      </>
    ),
  },
  {
    name: 'Riff',
    blurb: 'the laid-back frog',
    tint: '#7dc52e',
    art: (
      <>
        {shadow}
        <ellipse cx="38" cy="150" rx="22" ry="12" fill="#6fb522" />
        <ellipse cx="162" cy="150" rx="22" ry="12" fill="#6fb522" />
        <circle cx="68" cy="66" r="30" fill="#7dc52e" />
        <circle cx="132" cy="66" r="30" fill="#7dc52e" />
        <ellipse cx="100" cy="112" rx="74" ry="52" fill="#7dc52e" />
        <ellipse cx="100" cy="134" rx="40" ry="26" fill="#b5e05a" />
        {eye(68, 64, 20)}
        {eye(132, 64, 20, -2)}
        <path d="M84 102 Q100 112 116 102" stroke="#4d8c16" strokeWidth="4" fill="none" strokeLinecap="round" />
      </>
    ),
  },
  {
    name: 'Tootie',
    blurb: 'the bubbly octopus',
    tint: '#f2607a',
    art: (
      <>
        {shadow}
        {[42, 70, 100, 130, 158].map((x, i) => (
          <ellipse key={x} cx={x} cy={146 - Math.abs(i - 2) * 4} rx="18" ry="16" fill="#ea4f6b" />
        ))}
        <path d="M44 92 C44 34 156 34 156 92 C156 128 132 150 100 150 C68 150 44 128 44 92Z" fill="#f2607a" />
        <circle cx="74" cy="56" r="8" fill="#f68598" />
        {eye(78, 96, 17)}
        {eye(122, 96, 17, -2)}
        <path d="M90 118 Q100 126 110 118" stroke="#a8263e" strokeWidth="4" fill="none" strokeLinecap="round" />
      </>
    ),
  },
  {
    name: 'Ziggy',
    blurb: 'the zippy gecko',
    tint: '#f6bd2f',
    art: (
      <>
        {shadow}
        <path d="M70 140 C20 150 14 100 40 92 C56 88 62 104 50 110" stroke="#f2a91e" strokeWidth="18" fill="none" strokeLinecap="round" />
        <ellipse cx="104" cy="128" rx="44" ry="34" fill="#f6bd2f" />
        <ellipse cx="104" cy="134" rx="22" ry="24" fill="#fde7a6" />
        <ellipse cx="76" cy="156" rx="13" ry="7" fill="#f2a91e" />
        <ellipse cx="132" cy="156" rx="13" ry="7" fill="#f2a91e" />
        <ellipse cx="104" cy="74" rx="50" ry="40" fill="#f6bd2f" />
        <circle cx="96" cy="40" r="5" fill="#f2a91e" />
        <circle cx="112" cy="38" r="4" fill="#f2a91e" />
        {eye(82, 72, 17)}
        {eye(126, 72, 17, -2)}
        <path d="M94 96 Q104 104 114 96" stroke="#b9780c" strokeWidth="4" fill="none" strokeLinecap="round" />
      </>
    ),
  },
  {
    name: 'Forte',
    blurb: 'the gentle elephant',
    tint: '#4a9ff0',
    art: (
      <>
        {shadow}
        <rect x="62" y="104" width="76" height="58" rx="24" fill="#3e8fe0" />
        <ellipse cx="46" cy="80" rx="40" ry="44" fill="#4a9ff0" />
        <ellipse cx="154" cy="80" rx="40" ry="44" fill="#4a9ff0" />
        <ellipse cx="50" cy="82" rx="26" ry="30" fill="#7dbaf5" />
        <ellipse cx="150" cy="82" rx="26" ry="30" fill="#7dbaf5" />
        <circle cx="100" cy="84" r="46" fill="#4a9ff0" />
        {eye(82, 80, 15)}
        {eye(118, 80, 15, -2)}
        <path d="M100 96 C100 120 96 132 112 136" stroke="#3e8fe0" strokeWidth="16" fill="none" strokeLinecap="round" />
      </>
    ),
  },
];

function Lineup() {
  return (
    <div className="hm-lineup">
      <article className="hm-char" style={{ ['--tint' as string]: '#6b4fd8' }}>
        <span className="hm-live-badge">Live</span>
        <div className="hm-char-art">
          <Mascot character={echo} padding={CARD_PAD} lookAtPointer className="hm-char-mascot" style={{ width: '92%', height: '100%' }} />
        </div>
        <h4>Echo</h4>
        <p>the music-loving bat</p>
      </article>
      {LINEUP.map((c) => (
        <article key={c.name} className="hm-char soon" style={{ ['--tint' as string]: c.tint }}>
          <span className="hm-soon">Coming soon</span>
          <div className="hm-char-art">
            <svg viewBox="0 0 200 172" aria-hidden="true">
              {c.art}
            </svg>
          </div>
          <h4>{c.name}</h4>
          <p>{c.blurb}</p>
        </article>
      ))}
    </div>
  );
}

/* ------------------------------------------------------------------ */

export function Home() {
  return (
    <div className="hm">
      <Hero />

      <section className="hm-section">
        <div className="hm-wrap">
          <div className="hm-kicker">How it works</div>
          <h2 className="hm-h2">From a drawing to a character</h2>
          <p className="hm-sub">No proprietary editor, no runtime bloat. A rig is just an SVG with a few annotations — readable by humans, designers’ tools and AI models alike.</p>
          <ol className="hm-pipe">
            {PIPE.map(([t, d]) => (
              <li key={t}>
                <b>{t}</b>
                <span>{d}</span>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section className="hm-section" style={{ paddingTop: 8 }}>
        <div className="hm-wrap">
          <div className="hm-kicker">Features</div>
          <h2 className="hm-h2">Game-engine animation, web-sized</h2>
          <p className="hm-sub">Clips crossfade on top of living idle layers, params drive bones portably across characters, and springs add follow-through for free. Everything below is running live.</p>
          <div className="hm-features">
            <SpinDemo />
            <ExpressionDemo />
            <DanceDemo />
            <EffectsDemo />
            <SpringDemo />
            <CrossfadeDemo />
          </div>
        </div>
      </section>

      <section className="hm-section">
        <div className="hm-wrap">
          <div className="hm-kicker">Use it</div>
          <h2 className="hm-h2">Drop it into anything</h2>
          <p className="hm-sub">A DOM-free TypeScript core with thin bindings for the web. The same character, clips and frames can drive a React Native or canvas renderer.</p>
          <CodeSection />
        </div>
      </section>

      <section className="hm-section">
        <div className="hm-wrap">
          <div className="hm-kicker">The cast</div>
          <h2 className="hm-h2">Meet the band</h2>
          <p className="hm-sub">Echo is the first rigged character. More friends sharing the same standard bone names — and therefore the same clip library — are on their way.</p>
          <Lineup />
        </div>
      </section>

      <section className="hm-section">
        <div className="hm-wrap">
          <div className="hm-final">
            <h2 className="hm-h2">Make something move.</h2>
            <p>Open the Studio to scrub clips frame by frame, tweak params, and paste JSON clips straight from your favourite AI.</p>
            <a className="st-btn" href="#/studio">
              Open the Studio
            </a>{' '}
            <a className="st-btn ghost" href="https://github.com/jbraunschweiger/openmascot">
              Star on GitHub
            </a>
          </div>
          <footer className="hm-footer">
            <span>OpenMascot — MIT licensed. Echo © the OpenMascot authors.</span>
            <span>
              <a href="#/studio">Studio</a> · <a href="#/gallery">Gallery</a> · <a href="#/app">App showcase</a>
            </span>
          </footer>
        </div>
      </section>
    </div>
  );
}

