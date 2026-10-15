/** Sections 6–8 — song play-along, practice and profile tabs. */
import { useEffect, useState } from 'react';
import { Echo, useEcho } from '../kit/echo';
import { usePhone } from '../kit/phone';
import { Spacer, Stat, TabBar } from '../kit/ui';
import { Chest, IconBars, IconEighth, IconGear, IconInfinity, IconNote, IconPause, IconPlay, IconTarget } from '../kit/icons';
import { NoteHighway, Waveform } from '../kit/music';

/* 6. Song playback ------------------------------------------------------- */
const DANCES = ['dance-bop', 'dance-sway', 'dance-hop', 'emote-sing', 'idle'];
export function SongPlayback() {
  const { visible } = usePhone();
  const e = useEcho('idle');
  const [playing, setPlaying] = useState(true);
  const [mode, setMode] = useState<'learn' | 'play'>('learn');
  const [chord, setChord] = useState(0);
  const live = playing && visible;
  useEffect(() => {
    if (!live) {
      e.react('idle');
      return;
    }
    // Wait for the player to exist on first mount.
    const t = setTimeout(() => {
      e.react(DANCES, { bpm: 124, then: null });
      e.emit('notes');
    }, 300);
    const id = setInterval(() => setChord((c) => (c + 1) % 2), 1935);
    return () => (clearTimeout(t), clearInterval(id));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [live]);
  return (
    <div className="sc-col sc-song">
      <header className="sc-song-top">
        <Echo api={e} w={92} padding={30} className="sc-song-echo" onClick={() => e.emit(['music-burst', 'notes'])} />
        <div>
          <b className="sc-song-title">Play along!</b>
          <small>Seven Nation Army (Intro)</small>
        </div>
        <button type="button" className="sc-roundbtn" aria-label={playing ? 'Pause' : 'Play'} onClick={() => setPlaying((p) => !p)}>
          {playing ? <IconPause /> : <IconPlay />}
        </button>
      </header>
      <div className="sc-seg">
        <button type="button" className={mode === 'learn' ? 'is-on' : ''} onClick={() => setMode('learn')}>
          Learn
        </button>
        <button type="button" className={mode === 'play' ? 'is-on' : ''} onClick={() => setMode('play')}>
          Play
        </button>
      </div>
      <NoteHighway playing={live} />
      <div className="sc-chordpair">
        {['E5', 'G5'].map((c, i) => (
          <span key={c} className={'sc-chordtile' + (chord === i ? ' is-now' : '')}>
            {c}
          </span>
        ))}
      </div>
      <Spacer />
      <div className="sc-song-foot">
        <IconEighth className="sc-gold" />
        <Waveform bars={40} active={0} tone="violet" live={live} />
      </div>
    </div>
  );
}

/* 7. Practice ------------------------------------------------------------ */
const PRACTICE = {
  Recommended: [
    { t: 'G chord transitions', s: 'Based on your recent lessons', I: IconTarget, c: 'violet' },
    { t: 'Strumming practice', s: 'Keep a steady beat', I: IconNote, c: 'violet' },
    { t: 'Chord progression', s: 'G → C → D → G', I: IconBars, c: 'blue' },
    { t: 'Free play', s: 'Play anything and get feedback', I: IconInfinity, c: 'indigo' },
  ],
  Chords: [
    { t: 'G major', s: 'Mastered · keep it fresh', I: IconTarget, c: 'violet' },
    { t: 'C major', s: '3 of 6 · finger stretch', I: IconTarget, c: 'violet' },
    { t: 'D major', s: 'New · unlocks next', I: IconTarget, c: 'blue' },
    { t: 'E minor', s: 'Easiest chord there is', I: IconTarget, c: 'indigo' },
  ],
  Rhythm: [
    { t: 'Down strums', s: '4/4 at 70 bpm', I: IconBars, c: 'violet' },
    { t: 'Down-up pattern', s: 'Eighth notes', I: IconBars, c: 'blue' },
    { t: 'Clap along', s: 'No guitar needed', I: IconNote, c: 'violet' },
    { t: 'Tempo ladder', s: '60 → 100 bpm', I: IconInfinity, c: 'indigo' },
  ],
} as const;
type Chip = keyof typeof PRACTICE;
export function Practice() {
  const e = useEcho(['peek', 'idle']);
  const [chip, setChip] = useState<Chip>('Recommended');
  const [started, setStarted] = useState<string | null>(null);
  useEffect(() => {
    if (!started) return;
    const t = setTimeout(() => setStarted(null), 1800);
    return () => clearTimeout(t);
  }, [started]);
  return (
    <div className="sc-col sc-practice">
      <h3 className="sc-h1">Practice</h3>
      <div className="sc-chips">
        {(Object.keys(PRACTICE) as Chip[]).map((c) => (
          <button
            key={c}
            type="button"
            className={'sc-chip' + (chip === c ? ' is-on' : '')}
            onClick={() => {
              setChip(c);
              e.react(['look-right', 'think'], {});
            }}
          >
            {c}
          </button>
        ))}
      </div>
      <div className="sc-plist">
        {PRACTICE[chip].map(({ t, s, I, c }) => (
          <button
            key={t}
            type="button"
            className={'sc-pitem' + (started === t ? ' is-started' : '')}
            onClick={() => {
              setStarted(t);
              e.react(['emote-excited', 'encourage', 'nod-yes'], { fx: 'notes', expr: 'excited' });
            }}
          >
            <span className={`sc-pitem-icon sc-pitem-icon--${c}`}>
              <I />
            </span>
            <span className="sc-pitem-text">
              <b>{t}</b>
              <small>{started === t ? 'Starting…' : s}</small>
            </span>
            <span className="sc-pitem-play">
              <IconPlay />
            </span>
          </button>
        ))}
      </div>
      <Spacer />
      <Echo api={e} anim={['peek', 'idle']} w={74} padding={30} className="sc-practice-echo" />
      <TabBar active="Practice" />
    </div>
  );
}

/* 8. Profile ------------------------------------------------------------- */
const SKILLS = [
  { n: 'G Chord', v: 6, c: '#3a3150' },
  { n: 'C Chord', v: 3.6, c: '#55607a' },
  { n: 'Strumming', v: 3, c: '#4cbf68' },
  { n: 'Rhythm', v: 1.6, c: '#8a74e0' },
];
const ACH = [
  { n: 'First Note', I: IconNote },
  { n: 'Chord Collector', I: IconEighth },
  { n: 'In the Pocket', I: Chest, gold: true },
];
export function Profile() {
  const e = useEcho('idle');
  const [streak, setStreak] = useState(7);
  const [ach, setAch] = useState<string | null>(null);
  const party = () => e.react(['dance-party', 'dance-spin', 'dance-bop', 'emote-celebrate'], { fx: ['stars', 'sparkles'], fxDelay: 200, bpm: 128, expr: 'joyful' });
  return (
    <div className="sc-col sc-profile">
      <header className="sc-prof-top">
        <span className="sc-avatar">J</span>
        <span className="sc-prof-name">
          <b>Jakob</b>
          <small>Making music</small>
        </span>
        <Echo api={e} w={70} padding={30} className="sc-prof-echo" onClick={party} title="Tap for a victory dance" />
        <IconGear className="sc-gear" />
      </header>
      <button
        type="button"
        className="sc-statcard"
        onClick={() => {
          setStreak((s) => s + 1);
          party();
        }}
        aria-label="Practice today to extend your streak"
      >
        <span>
          <Stat icon="flame" value={streak} />
          <small>Day streak</small>
        </span>
        <span>
          <Stat icon="gem" value="320" />
          <small>XP total</small>
        </span>
        <span>
          <Stat icon="star" value="12" />
          <small>Songs</small>
        </span>
      </button>
      <div className="sc-prof-sec">
        <div className="sc-prof-h">
          <b>Skill mastery</b>
          <span>See all</span>
        </div>
        {SKILLS.map((s) => (
          <div key={s.n} className="sc-skill">
            <span className="sc-skill-dot" style={{ background: s.c }} />
            <span className="sc-skill-n">{s.n}</span>
            <span className="sc-skill-bar">
              {Array.from({ length: 6 }, (_, i) => (
                <i key={i} style={{ '--f': Math.max(0, Math.min(1, s.v - i)) } as React.CSSProperties} />
              ))}
            </span>
          </div>
        ))}
      </div>
      <div className="sc-prof-sec">
        <div className="sc-prof-h">
          <b>Achievements</b>
          <span>See all</span>
        </div>
        <div className="sc-achs">
          {ACH.map(({ n, I, gold }) => (
            <button
              key={n}
              type="button"
              className={'sc-achv' + (ach === n ? ' is-on' : '')}
              onClick={() => {
                setAch(n);
                e.react(['emote-proud', 'nod-yes'], { fx: ['stars', 'sparkles'], expr: 'proud' });
              }}
            >
              <span className={'sc-achv-icon' + (gold ? ' is-gold' : '')}>
                <I />
              </span>
              {n}
            </button>
          ))}
        </div>
      </div>
      <Spacer />
      <TabBar active="Profile" />
    </div>
  );
}
