/** Sections 2 & 3 — the learn path map and the lesson intro. */
import { useEffect, useState } from 'react';
import { Echo, useEcho } from '../kit/echo';
import { usePhone } from '../kit/phone';
import { Bubble, Btn, Spacer, Stat, TabBar } from '../kit/ui';
import { Chest, IconBulb, IconCheck, IconChevronDown, IconClose, IconLock } from '../kit/icons';
import { ChordDiagram } from '../kit/music';

/* 2. Learn path ---------------------------------------------------------- */
const LESSONS = ['First Note', 'First Chord', 'Chord Switch', 'Keep the Beat', 'First Performance'];

function Scenery() {
  return (
    <svg className="sc-scenery" viewBox="0 0 240 330" preserveAspectRatio="xMidYMax slice" aria-hidden>
      <defs>
        <linearGradient id="sc-sky" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#f6f3ff" />
          <stop offset="1" stopColor="#eef0fb" />
        </linearGradient>
      </defs>
      <rect width="240" height="330" fill="url(#sc-sky)" />
      <path d="M14 70c4-10 18-10 22-3 6-6 18-2 17 7H10c-2-2 1-5 4-4z" fill="#fff" opacity=".9" />
      <path d="M186 40c3-8 14-8 17-2 5-4 14-1 13 5h-33c-1-2 1-4 3-3z" fill="#fff" opacity=".8" />
      {/* far hills */}
      <path d="M0 250c40-26 80-30 120-18s80 10 120-12v110H0z" fill="#dcd5f4" />
      {/* distant trees */}
      {[
        [26, 150, 1],
        [44, 160, 0.8],
        [205, 120, 1.1],
        [222, 200, 0.85],
        [196, 220, 0.7],
      ].map(([x, y, s], i) => (
        <g key={i} transform={`translate(${x} ${y}) scale(${s})`}>
          <rect x="-1.6" y="0" width="3.2" height="26" fill="#8f7bc8" />
          <path d="M0-30c9 10 12 20 10 30-3 5-17 5-20 0-2-10 1-20 10-30z" fill="#a593e2" />
        </g>
      ))}
      {/* round tree under Echo */}
      <rect x="40" y="200" width="5" height="70" fill="#8a6b59" />
      <circle cx="28" cy="200" r="24" fill="#b7d99a" />
      <circle cx="54" cy="192" r="22" fill="#a7cf88" />
      <circle cx="210" cy="140" r="20" fill="#c4dfaa" />
      {/* near hills */}
      <path d="M0 292c50-18 110-26 170-12 30 7 50 4 70-6v56H0z" fill="#bfe0a6" />
      <path d="M150 300c30-10 60-12 90-4v34h-90z" fill="#a9cf8e" />
      <circle cx="226" cy="306" r="10" fill="#9fc4ef" opacity=".7" />
    </svg>
  );
}

export function LearnPath() {
  const { next } = usePhone();
  const e = useEcho(['hang', 'idle']);
  const [msg, setMsg] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  useEffect(() => {
    if (!msg) return;
    const t = setTimeout(() => setMsg(null), 1700);
    return () => clearTimeout(t);
  }, [msg]);
  return (
    <div className="sc-col sc-learn">
      <Scenery />
      <header className="sc-learn-top">
        <b>Learn</b>
        <Stat icon="flame" value="7" />
        <Stat icon="gem" value="320" />
        <Stat icon="heart" value="3" />
      </header>
      <button type="button" className={'sc-unit' + (open ? ' is-open' : '')} onClick={() => setOpen((o) => !o)}>
        <span>
          <b>Unit 1</b>
          <b>First Sounds</b>
          <small>{open ? '5 lessons · ~12 min · Ends with your first song' : 'Learn the basics and play your first song!'}</small>
        </span>
        <IconChevronDown />
      </button>
      <ol className="sc-path">
        {LESSONS.map((name, i) => {
          const state = i === 0 ? 'done' : i === 1 ? 'current' : 'locked';
          return (
            <li key={name} className={`sc-node sc-node--${state}`} style={{ marginLeft: `calc(var(--p) * ${[56, 58, 74, 70, 62][i]})` }}>
              <button
                type="button"
                onClick={() => {
                  if (state === 'done') {
                    setMsg('Already mastered! ⭐');
                    e.react(['emote-proud', 'nod-yes'], { fx: ['stars', 'sparkles'], expr: 'proud' });
                  } else if (state === 'current') {
                    e.react(['takeoff', 'emote-excited', 'encourage'], { fx: 'sparkles', expr: 'excited' });
                    next();
                  } else {
                    setMsg('Finish “First Chord” first');
                    e.react(['shake-no', 'think'], { fx: 'question' });
                  }
                }}
              >
                {state === 'done' ? <IconCheck /> : <IconLock />}
              </button>
              <span>
                {i + 1}. {name}
              </span>
            </li>
          );
        })}
      </ol>
      <Echo api={e} anim={['hang', 'idle']} w={96} padding={30} className="sc-learn-echo" />
      <button
        type="button"
        className="sc-learn-chest"
        aria-label="Unit reward"
        onClick={() => {
          setMsg('Unit reward: 50 XP + a new song!');
          e.react(['emote-surprised', 'emote-excited'], { fx: ['stars', 'sparkles'], expr: 'surprised' });
        }}
      >
        <Chest />
      </button>
      {msg && <div className="sc-toast sc-toast--learn">{msg}</div>}
      <Spacer />
      <TabBar active="Learn" />
    </div>
  );
}

/* 3. Lesson start -------------------------------------------------------- */
type Phase = 'intro' | 'listening' | 'heard';
export function LessonStart() {
  const { next, visible } = usePhone();
  const e = useEcho('idle');
  const [phase, setPhase] = useState<Phase>('intro');
  useEffect(() => {
    if (!visible) setPhase('intro');
  }, [visible]);
  useEffect(() => {
    if (phase !== 'listening') return;
    const t = setTimeout(() => {
      setPhase('heard');
      e.react(['correct', 'emote-happy', 'nod-yes'], { fx: ['check', 'sparkles'], expr: 'joyful' });
    }, 2000);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase]);
  const bubble = { intro: 'Let’s learn the G chord!', listening: 'I’m listening…', heard: 'That’s a G! Nice one!' }[phase];
  return (
    <div className="sc-col sc-lstart">
      <header className="sc-lesson-top">
        <IconClose />
        <div className="sc-progress">
          <span style={{ width: phase === 'heard' ? '45%' : '22%' }} />
        </div>
        <IconBulb className="sc-hint" />
      </header>
      <div className="sc-lstart-hero">
        <Echo api={e} w={140} className="sc-lstart-echo" />
        <Bubble className={phase === 'heard' ? 'is-ok' : ''}>{bubble}</Bubble>
      </div>
      <div className={'sc-chordcard' + (phase === 'heard' ? ' is-ok' : '')}>
        <div className="sc-chordname">G</div>
        <ChordDiagram chord="G" ok={phase === 'heard'} />
      </div>
      <p className="sc-body sc-lstart-copy">Play this chord and I’ll let you know when I hear it.</p>
      <Spacer />
      {phase === 'heard' ? (
        <Btn onClick={next}>Continue</Btn>
      ) : (
        <Btn
          className={phase === 'listening' ? 'is-listening' : ''}
          onClick={() => {
            if (phase !== 'intro') return;
            setPhase('listening');
            e.react(['listen', 'think'], { expr: 'determined', then: null });
          }}
        >
          {phase === 'listening' ? 'Listening…' : 'Listen'}
        </Btn>
      )}
      <div className="sc-fine sc-fine--light">
        Need a refresher? <b>Watch guide</b>
      </div>
    </div>
  );
}
