/** Sections 4 & 5 — real-time feedback during the lesson, and the results screen. */
import { useEffect, useState } from 'react';
import { Echo, useEcho } from '../kit/echo';
import { usePhone, useWhenVisible } from '../kit/phone';
import { Btn, Card, ConfettiDecor, Spacer, SuccessPill, Title } from '../kit/ui';
import { IconCheck, IconArrowRight } from '../kit/icons';
import { ChordDiagram, Fretboard, LevelMeter, type FretDot } from '../kit/music';

// G chord as seen on camera: strings 0 (high e, top) … 5 (low E, bottom).
const G_DOTS: Omit<FretDot, 'state'>[] = [
  { s: 0, f: 2.5 },
  { s: 4, f: 1.5 },
  { s: 5, f: 2.5 },
];
const G_OPEN: Omit<FretDot, 'state'>[] = [
  { s: 1, f: 0.4 },
  { s: 2, f: 0.4 },
  { s: 3, f: 0.4 },
];

/** Tap-to-strum: lights the G chord notes one by one. */
function useStrum(total: number, autoplay: boolean) {
  const { visible } = usePhone();
  const [lit, setLit] = useState(0);
  const [run, setRun] = useState(0);
  useEffect(() => {
    if (!visible || (!autoplay && run === 0)) return;
    setLit(0);
    let n = 0;
    const id = setInterval(() => {
      n += 1;
      setLit(n);
      if (n >= total) clearInterval(id);
    }, 380);
    return () => clearInterval(id);
  }, [visible, run, total, autoplay]);
  return { lit, done: lit >= total, strum: () => setRun((r) => r + 1) };
}

/* 4a. Detecting correct notes ------------------------------------------- */
export function Detecting() {
  const e = useEcho(['listen', 'idle']);
  const all = [...G_DOTS, ...G_OPEN];
  const { lit, done, strum } = useStrum(all.length, true);
  useEffect(() => {
    if (done) e.react(['nod-yes', 'correct'], { fx: 'sparkles', expr: 'happy' });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [done]);
  return (
    <div className="sc-col sc-fb">
      <Title>Play the G chord</Title>
      <div className="sc-fb-hero">
        <Echo api={e} anim={['listen', 'idle']} w={150} className="sc-fb-echo sc-fb-echo--edge" />
        <div className="sc-minichord">
          <b>G</b>
          <ChordDiagram chord="G" ok={done} />
        </div>
      </div>
      <SuccessPill className={'sc-fb-nice' + (done ? ' sc-pop' : ' is-waiting')}>{done ? 'Nice!' : 'Listening…'}</SuccessPill>
      <Fretboard className="sc-fb-board" onClick={strum} dots={all.map((d, i) => ({ ...d, state: i < lit ? 'hit' : 'idle' }))} />
      <LevelMeter value={Math.round((lit / all.length) * 5)} />
      <Spacer />
    </div>
  );
}

/* 4b. Success feedback --------------------------------------------------- */
export function SuccessFeedback() {
  const e = useEcho('idle');
  const cheer = () => e.react(['emote-happy', 'correct', 'nod-yes'], { fx: ['check', 'sparkles'], fxDelay: 120, expr: 'joyful' });
  useWhenVisible(cheer, { delay: 900, every: 8000 });
  return (
    <div className="sc-col sc-fb">
      <Title>Play the G chord</Title>
      <div className="sc-fb-hero">
        <Echo api={e} w={140} className="sc-fb-echo" onClick={cheer} />
        <div className="sc-minichord">
          <b>G</b>
          <ChordDiagram chord="G" ok />
        </div>
      </div>
      <Card className="sc-perfect" onClick={cheer}>
        <b>G</b>
        <span className="sc-perfect-pill">Perfect!</span>
      </Card>
      <Fretboard className="sc-fb-board" dots={[...G_DOTS, ...G_OPEN].map((d) => ({ ...d, state: 'hit' }))} />
      <Spacer />
    </div>
  );
}

/* 4c. Next prompt -------------------------------------------------------- */
export function NextPrompt() {
  const { next } = usePhone();
  const e = useEcho('idle');
  const [hit, setHit] = useState(false);
  const { visible } = usePhone();
  useEffect(() => {
    if (!visible) setHit(false);
  }, [visible]);
  useWhenVisible(() => !hit && e.react(['point-right', 'look-right', 'encourage'], { expr: 'determined' }), { delay: 800, every: 7000 });
  return (
    <div className="sc-col sc-fb">
      <Title>Now try C</Title>
      <div className="sc-fb-hero">
        <Echo api={e} w={156} className="sc-fb-echo sc-fb-echo--edge" />
        <div className="sc-minichord sc-minichord--plain">
          <b>C</b>
          <ChordDiagram chord="C" ok={hit} />
        </div>
      </div>
      <div className="sc-yourturn">{hit ? 'That’s it!' : 'Your turn!'}</div>
      <Fretboard
        className="sc-fb-board sc-fb-board--target"
        onClick={() => {
          if (hit) return;
          setHit(true);
          e.react(['correct', 'emote-happy'], { fx: ['check', 'sparkles'], expr: 'happy' });
          setTimeout(next, 1400);
        }}
        dots={[
          { s: 1, f: 1.5, state: hit ? 'hit' : 'ghost' },
          { s: 3, f: 2.5, state: hit ? 'hit' : 'target' },
          { s: 4, f: 3.5, state: hit ? 'hit' : 'ghost' },
        ]}
      />
      <div className="sc-small sc-tap-hint">{hit ? '' : 'Tap the fretboard to play'}</div>
      <Spacer />
    </div>
  );
}

/* 4d. Progress within lesson -------------------------------------------- */
export function LessonProgress() {
  const e = useEcho(['fly', 'idle']);
  const [steps, setSteps] = useState(2);
  const cheer = () => e.react(['encourage', 'emote-proud', 'nod-yes'], { fx: 'sparkles', expr: 'proud' });
  useWhenVisible(cheer, { delay: 1100, every: 9000 });
  return (
    <div className="sc-col sc-fb">
      <Title>Great!</Title>
      <Card className="sc-switch">
        <div className="sc-switch-chords">
          G <IconArrowRight /> C
        </div>
        <Echo api={e} anim={['fly', 'idle']} w={200} onClick={cheer} />
      </Card>
      <div className="sc-getting">{steps >= 3 ? 'Chord switch done!' : 'You’re getting it!'}</div>
      <button
        type="button"
        className="sc-steps"
        onClick={() => {
          const n = steps >= 3 ? 2 : 3;
          setSteps(n);
          if (n === 3) e.react(['emote-celebrate', 'jump', 'emote-proud'], { fx: ['stars', 'confetti'], expr: 'joyful' });
        }}
        aria-label="Complete the next step"
      >
        {[0, 1, 2].map((i) => (
          <span key={i} className={'sc-step' + (i < steps ? ' is-done' : '')}>
            {i < steps && <IconCheck />}
          </span>
        ))}
      </button>
      <Spacer />
    </div>
  );
}

/* 5. Lesson complete ----------------------------------------------------- */
export function LessonComplete() {
  const { next, go } = usePhone();
  const e = useEcho('idle');
  const celebrate = () => {
    e.react(['emote-celebrate', 'dance-party', 'jump'], { fx: 'confetti', fxDelay: 200, expr: 'joyful' });
    setTimeout(() => e.emit(['xp', 'stars']), 1000);
  };
  useWhenVisible(celebrate, { delay: 600, every: 10000 });
  return (
    <div className="sc-col sc-complete">
      <ConfettiDecor seed={7} count={18} />
      <div className="sc-dark-title">Lesson complete!</div>
      <Echo api={e} w={170} expression="joyful" className="sc-complete-echo" onClick={celebrate} />
      <Card className="sc-results">
        <div className="sc-xp">
          <span className="sc-xp-plus">+</span>25 XP
        </div>
        <div className="sc-mastered">
          <span className="sc-mastered-icon">
            <svg viewBox="0 0 24 24" aria-hidden>
              <path d="M17 6.5A7 7 0 1 0 19 12" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
              <circle cx="12" cy="12" r="2.4" fill="currentColor" />
            </svg>
          </span>
          <span>
            <b>G Chord</b>
            <small>mastered!</small>
          </span>
        </div>
        <div className="sc-kpis">
          <span>
            <b>92%</b>Accuracy
          </span>
          <span>
            <b>18s</b>Avg. switch time
          </span>
          <span>
            <b>Great</b>Timing
          </span>
        </div>
      </Card>
      <Spacer />
      <Btn
        onClick={() => {
          celebrate();
          next();
        }}
      >
        Continue
      </Btn>
      <Btn
        variant="ghost"
        onClick={() => {
          e.react(['encourage', 'nod-yes'], { fx: 'sparkles' });
          go('practice');
        }}
      >
        Practice this skill
      </Btn>
    </div>
  );
}
