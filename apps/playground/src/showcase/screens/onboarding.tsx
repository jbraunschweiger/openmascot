/** Section 1 — Onboarding flow: six screens from hello to the first note. */
import { useEffect, useState } from 'react';
import { Echo, useEcho } from '../kit/echo';
import { usePhone, useWhenVisible } from '../kit/phone';
import { Btn, Card, ConfettiDecor, Spacer, SuccessPill, Title } from '../kit/ui';
import { Drums, Guitar, IconChevronDown, IconEighth, IconFingers, IconNodes, IconNote, IconTuningFork, Piano, Ukulele } from '../kit/icons';
import { ListenRing, NeckView, Waveform } from '../kit/music';

/* 1. Welcome ------------------------------------------------------------- */
export function Welcome() {
  const { next } = usePhone();
  const e = useEcho(['fly', 'idle']);
  useWhenVisible(() => e.react(['greet', 'wave'], { fx: ['notes', 'music-burst'], fxDelay: 300 }), { delay: 900 });
  return (
    <div className="sc-col sc-welcome">
      <div className="sc-welcome-sky" aria-hidden>
        <span className="sc-cloud sc-cloud--1" />
        <span className="sc-cloud sc-cloud--2" />
        <IconEighth className="sc-float sc-float--1" />
        <IconNote className="sc-float sc-float--2" />
        <IconEighth className="sc-float sc-float--3" />
      </div>
      <div className="sc-welcome-logo">Echo</div>
      <Echo api={e} anim={['fly', 'idle']} w={330} className="sc-welcome-echo" onClick={() => e.react(['emote-playful', 'emote-happy'], { fx: 'notes', expr: 'playful' })} />
      <div className="sc-welcome-copy">
        <div className="sc-welcome-hey">
          Hey!
          <br />
          I’m Echo.
        </div>
        <div className="sc-welcome-sub">
          Let’s make
          <br />
          some music.
        </div>
      </div>
      <Spacer />
      <Btn
        variant="light"
        onClick={() => {
          e.react(['takeoff', 'emote-excited', 'jump'], { fx: ['music-burst', 'notes'], expr: 'excited' });
          next();
        }}
      >
        Let’s go
      </Btn>
      <div className="sc-fine">
        Already have an account? <b>Sign in</b>
      </div>
    </div>
  );
}

/* 2. Choose instrument --------------------------------------------------- */
const INSTRUMENTS = [
  { id: 'guitar', label: 'Guitar', Icon: Guitar, ready: true },
  { id: 'piano', label: 'Piano', Icon: Piano },
  { id: 'ukulele', label: 'Ukulele', Icon: Ukulele },
  { id: 'drums', label: 'Drums', Icon: Drums },
] as const;
export function ChooseInstrument() {
  const { next } = usePhone();
  const e = useEcho(['peek', 'idle']);
  const [sel, setSel] = useState('guitar');
  const [toast, setToast] = useState<string | null>(null);
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 1600);
    return () => clearTimeout(t);
  }, [toast]);
  return (
    <div className="sc-col">
      <Title>Choose your instrument</Title>
      <div className="sc-instruments">
        {INSTRUMENTS.map(({ id, label, Icon, ...r }) => {
          const ready = 'ready' in r;
          return (
            <button
              key={id}
              type="button"
              className={'sc-instrument' + (sel === id ? ' is-selected' : '') + (ready ? '' : ' is-soon')}
              onClick={() => {
                if (ready) {
                  setSel(id);
                  e.react(['nod-yes', 'emote-happy'], { fx: 'notes', expr: 'happy' });
                } else {
                  setToast(`${label} is coming soon!`);
                  e.react(['shake-no', 'emote-confused'], { fx: 'question', expr: 'sad' });
                }
              }}
            >
              <Icon className="sc-instrument-icon" />
              <span>{label}</span>
              {!ready && <small>(coming soon)</small>}
            </button>
          );
        })}
      </div>
      <div className="sc-instrument-echo">
        {toast && <div className="sc-toast">{toast}</div>}
        <Echo api={e} anim={['peek', 'idle']} w={124} />
      </div>
      <Spacer />
      <Btn
        onClick={() => {
          e.react(['encourage', 'nod-yes'], { fx: 'sparkles' });
          next();
        }}
      >
        Continue
      </Btn>
    </div>
  );
}

/* 3. Experience level ---------------------------------------------------- */
const LEVELS = [
  { title: 'Brand new', sub: 'Never played before', Icon: IconNote, clip: ['encourage', 'emote-love'], fx: ['heart-burst', 'hearts'], expr: 'love' },
  { title: 'Know a few chords', sub: 'A little experience', Icon: IconFingers, clip: ['nod-yes', 'emote-happy'], fx: 'sparkles', expr: 'happy' },
  { title: 'Play a little', sub: 'Comfortable with basics', Icon: IconTuningFork, clip: ['emote-happy', 'nod-yes'], fx: 'notes', expr: 'joyful' },
  { title: 'Already play', sub: 'Looking to improve', Icon: IconNodes, clip: ['emote-excited', 'emote-surprised'], fx: 'exclaim', expr: 'excited' },
] as const;
export function ExperienceLevel() {
  const { next } = usePhone();
  const e = useEcho('idle');
  const [sel, setSel] = useState(0);
  return (
    <div className="sc-col">
      <Title>What’s your experience?</Title>
      <div className="sc-levels">
        {LEVELS.map((l, i) => (
          <button
            key={l.title}
            type="button"
            className={'sc-level' + (sel === i ? ' is-selected' : '')}
            onClick={() => {
              setSel(i);
              e.react(l.clip, { fx: l.fx, expr: l.expr });
            }}
          >
            <span className="sc-level-icon">
              <l.Icon />
            </span>
            <span className="sc-level-text">
              <b>{l.title}</b>
              <small>{l.sub}</small>
            </span>
          </button>
        ))}
      </div>
      <Spacer />
      <Echo api={e} w={120} className="sc-level-echo" />
      <Btn
        onClick={() => {
          e.react(['nod-yes', 'encourage'], { fx: 'sparkles' });
          next();
        }}
      >
        Continue
      </Btn>
    </div>
  );
}

/* 4. Microphone setup ---------------------------------------------------- */
export function MicSetup() {
  const { next, visible } = usePhone();
  const e = useEcho(['listen', 'idle']);
  const [detected, setDetected] = useState(false);
  const [mic, setMic] = useState(0);
  const mics = ['MacBook Microphone (Default)', 'USB Audio Interface', 'AirPods Pro'];
  useEffect(() => {
    if (!visible) return;
    setDetected(false);
    const t = setTimeout(() => {
      setDetected(true);
      e.react(['nod-yes', 'correct'], { fx: ['check', 'sparkles'], fxDelay: 200, expr: 'happy' });
    }, 2200);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, mic]);
  return (
    <div className="sc-col">
      <Title>Let’s set up your mic</Title>
      <Echo api={e} anim={['listen', 'idle']} w={220} className="sc-mic-echo" />
      <p className="sc-body">I need to hear your guitar!</p>
      <Waveform active={detected ? 0.45 : 0.12} className="sc-mic-wave" />
      <button type="button" className="sc-select" onClick={() => setMic((m) => (m + 1) % mics.length)}>
        <span>{mics[mic]}</span>
        <IconChevronDown />
      </button>
      {detected ? <SuccessPill className="sc-pop">Audio detected!</SuccessPill> : <div className="sc-pending">Listening for sound…</div>}
      <Spacer />
      <Btn
        onClick={() => {
          e.react(['encourage', 'emote-happy'], { fx: 'notes' });
          next();
        }}
      >
        Continue
      </Btn>
    </div>
  );
}

/* 5. Play your first note ------------------------------------------------ */
export function FirstNote() {
  const { next, visible } = usePhone();
  const e = useEcho(['hang', 'idle']);
  const [heard, setHeard] = useState(false);
  useEffect(() => {
    if (!visible) setHeard(false);
  }, [visible]);
  const pluck = () => {
    if (heard) return;
    setHeard(true);
    e.react(['correct', 'emote-excited', 'nod-yes'], { fx: ['check', 'sparkles'], expr: 'excited' });
    setTimeout(next, 1500);
  };
  return (
    <div className="sc-col sc-firstnote">
      <Echo api={e} anim={['hang', 'idle']} w={72} padding={30} className="sc-firstnote-echo" />
      <Title>Play your first note</Title>
      <div className={'sc-notebadge' + (heard ? ' is-ok' : '')}>E</div>
      <NeckView plucked={heard} onPluck={pluck} />
      <p className="sc-body">
        {heard ? (
          <b className="sc-green">That’s an E!</b>
        ) : (
          <>
            Try plucking the open
            <br />
            high E string.
          </>
        )}
      </p>
      <button type="button" className="sc-ringbtn" onClick={pluck} aria-label="Simulate playing the note">
        <ListenRing heard={heard} />
      </button>
      <div className="sc-small">{heard ? 'Got it!' : 'I’m listening...'}</div>
      <Spacer />
    </div>
  );
}

/* 6. First success ------------------------------------------------------- */
export function FirstSuccess() {
  const { next } = usePhone();
  const e = useEcho('idle');
  const cheer = () => {
    e.react(['emote-celebrate', 'emote-proud', 'jump'], { fx: 'confetti', fxDelay: 150, expr: 'joyful' });
    setTimeout(() => e.emit(['xp', 'stars']), 900);
  };
  useWhenVisible(cheer, { delay: 700, every: 9000 });
  return (
    <div className="sc-col sc-success">
      <ConfettiDecor seed={3} />
      <div className="sc-dark-title">You did it!</div>
      <Echo api={e} w={240} expression="joyful" className="sc-success-echo" onClick={cheer} />
      <div className="sc-success-line">
        That’s a <span className="sc-gold">perfect E!</span>
      </div>
      <Card className="sc-reward">
        <div className="sc-xp">
          <span className="sc-xp-plus">+</span>10 XP
        </div>
        <div className="sc-ach">
          <span className="sc-ach-icon">
            <IconNote />
          </span>
          <span>
            <b>First Note</b>
            <small>achievement unlocked!</small>
          </span>
        </div>
      </Card>
      <Spacer />
      <Btn
        onClick={() => {
          e.react(['jump', 'emote-celebrate'], { fx: ['stars', 'sparkles'] });
          next();
        }}
      >
        Continue
      </Btn>
    </div>
  );
}
