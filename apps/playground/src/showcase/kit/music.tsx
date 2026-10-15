/** Music UI drawings: chord diagrams, fretboards, waveforms, listen ring, note highway. */
import { useMemo } from 'react';
import { IconSound } from './icons';

export type Fret = number | 'x';
export const CHORDS: Record<string, Fret[]> = {
  // low E → high e
  G: [3, 2, 0, 0, 0, 3],
  C: ['x', 3, 2, 0, 1, 0],
};

/** Standard chord box. `ok` colours the fretted notes green (chord heard). */
export function ChordDiagram({ chord, ok, className }: { chord: string; ok?: boolean; className?: string }) {
  const frets = CHORDS[chord] ?? CHORDS.G;
  const xs = [8, 16.8, 25.6, 34.4, 43.2, 52];
  const fy = (f: number) => 14 + (f - 0.5) * 11;
  return (
    <svg viewBox="0 0 60 72" className={'sc-chord' + (ok ? ' is-ok' : '') + (className ? ' ' + className : '')} aria-label={`${chord} chord diagram`}>
      <rect x="8" y="12" width="44" height="3" rx="1" className="sc-chord-nut" />
      {[1, 2, 3, 4, 5].map((i) => (
        <path key={i} d={`M8 ${14 + i * 11}H52`} className="sc-chord-line" />
      ))}
      {xs.map((x) => (
        <path key={x} d={`M${x} 14V69`} className="sc-chord-line" />
      ))}
      {frets.map((f, i) =>
        f === 'x' ? (
          <path key={i} d={`M${xs[i] - 2.4} 3.6l4.8 4.8M${xs[i] + 2.4} 3.6l-4.8 4.8`} className="sc-chord-x" />
        ) : f === 0 ? (
          <circle key={i} cx={xs[i]} cy="6" r="2.6" className="sc-chord-open" />
        ) : (
          <g key={i} className="sc-chord-dot" style={{ animationDelay: `${i * 0.07}s` }}>
            <circle cx={xs[i]} cy={fy(f)} r="3.9" />
            <circle cx={xs[i]} cy={fy(f)} r="1.5" className="sc-chord-dot-in" />
          </g>
        ),
      )}
    </svg>
  );
}

export interface FretDot {
  /** string index 0 (top) … 5 (bottom) */
  s: number;
  /** fret position 0.5 … 4.5 (in fret cells) */
  f: number;
  state: 'hit' | 'idle' | 'target' | 'ghost';
}

/** Horizontal fretboard close-up as seen through the camera. */
export function Fretboard({ dots, className, onClick }: { dots: FretDot[]; className?: string; onClick?: () => void }) {
  const sy = (s: number) => 14 + s * 22.4;
  return (
    <svg viewBox="0 0 200 140" className={'sc-fretboard' + (className ? ' ' + className : '')} onClick={onClick} aria-hidden>
      <defs>
        <linearGradient id="sc-wood" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#7d6b78" />
          <stop offset="1" stopColor="#5f4f61" />
        </linearGradient>
        <filter id="sc-glow" x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="2.4" />
        </filter>
      </defs>
      <rect width="200" height="140" fill="url(#sc-wood)" />
      {[0, 1, 2, 3, 4, 5].map((s) => (
        <rect key={s} x="0" y={sy(s) - 5} width="200" height="10" fill="#000" opacity=".05" />
      ))}
      {[22, 64, 106, 148, 190].map((x) => (
        <rect key={x} x={x} y="0" width="2.6" height="140" fill="#d8d2d6" opacity=".85" />
      ))}
      {[0, 1, 2, 3, 4, 5].map((s) => (
        <rect key={s} x="0" y={sy(s) - 0.4 - s * 0.12} width="200" height={0.9 + s * 0.25} fill="#efe9ee" opacity=".9" />
      ))}
      {dots.map((d, i) => {
        const cx = 22 + d.f * 42;
        const cy = sy(d.s);
        return (
          <g key={i} className={`sc-fdot sc-fdot--${d.state}`} style={{ animationDelay: `${i * 0.12}s` }}>
            {d.state === 'hit' && <circle cx={cx} cy={cy} r="9" className="sc-fdot-glow" filter="url(#sc-glow)" />}
            <circle cx={cx} cy={cy} r="7.4" className="sc-fdot-c" />
            {d.state === 'target' && <circle cx={cx} cy={cy} r="2.6" fill="#fff" />}
          </g>
        );
      })}
    </svg>
  );
}

/** Vertical neck used on the "Play your first note" screen. */
export function NeckView({ plucked, onPluck }: { plucked: boolean; onPluck?: () => void }) {
  const strings = [34, 44, 54, 64, 74, 84];
  return (
    <svg viewBox="0 0 120 130" className={'sc-neck' + (plucked ? ' is-plucked' : '')} onClick={onPluck} role="button" aria-label="Pluck the high E string">
      <defs>
        <linearGradient id="sc-neckshade" x1="0" x2="1">
          <stop offset="0" stopColor="#000" stopOpacity=".18" />
          <stop offset=".5" stopColor="#000" stopOpacity="0" />
          <stop offset="1" stopColor="#000" stopOpacity=".18" />
        </linearGradient>
      </defs>
      <rect x="2" y="2" width="116" height="126" rx="12" fill="#efeaf6" />
      <rect x="2" y="40" width="20" height="44" rx="6" fill="#f6c95b" opacity=".9" />
      <rect x="98" y="40" width="20" height="44" rx="6" fill="#f6c95b" opacity=".9" />
      <rect x="26" y="10" width="68" height="118" fill="#5a4a5e" />
      <rect x="26" y="10" width="68" height="118" fill="url(#sc-neckshade)" />
      {[10, 34, 58, 82, 106].map((y) => (
        <rect key={y} x="26" y={y} width="68" height="1.8" fill="#cfc4cf" />
      ))}
      {strings.map((x, i) => (
        <rect key={x} x={x - 0.6} y="10" width={1.2 + (5 - i) * 0.12} height="118" fill="#eee6ee" opacity=".9" className={i === 5 ? 'sc-neck-e' : ''} />
      ))}
      <rect x="82" y="10" width="4" height="118" rx="2" className="sc-neck-glow" />
      <circle cx="84" cy="112" r="6.5" className="sc-neck-dot" />
      <path d="M60 0v8" stroke="#a98ff0" strokeWidth="2" strokeDasharray="2 2" />
    </svg>
  );
}

/** Mic waveform: the first `active` fraction of bars is green (signal). */
export function Waveform({ bars = 34, active = 0.4, live = true, tone = 'green', className }: { bars?: number; active?: number; live?: boolean; tone?: 'green' | 'violet'; className?: string }) {
  const heights = useMemo(() => Array.from({ length: bars }, (_, i) => 0.25 + 0.75 * Math.abs(Math.sin(i * 1.7) * Math.cos(i * 0.45))), [bars]);
  return (
    <div className={`sc-wave sc-wave--${tone}` + (live ? ' is-live' : '') + (className ? ' ' + className : '')} aria-hidden>
      {heights.map((h, i) => (
        <span key={i} className={i / bars < active ? 'on' : ''} style={{ height: `${h * 100}%`, animationDelay: `${-(i * 0.13) % 1.1}s` }} />
      ))}
    </div>
  );
}

/** Concentric "listening" indicator. */
export function ListenRing({ heard }: { heard: boolean }) {
  return (
    <div className={'sc-ring' + (heard ? ' is-heard' : '')} aria-hidden>
      <svg viewBox="0 0 60 60">
        <circle cx="30" cy="30" r="26" className="sc-ring-track" />
        <circle cx="30" cy="30" r="26" className="sc-ring-arc sc-ring-arc--a" />
        <circle cx="30" cy="30" r="26" className="sc-ring-arc sc-ring-arc--b" />
        <circle cx="30" cy="30" r="18" className="sc-ring-in" />
      </svg>
      <IconSound className="sc-ring-icon" />
    </div>
  );
}

/** Input level meter (row of rounded segments). */
export function LevelMeter({ value, of = 14 }: { value: number; of?: number }) {
  return (
    <div className="sc-meter" aria-hidden>
      {Array.from({ length: of }, (_, i) => (
        <span key={i} className={i < value ? 'on' : ''} style={{ height: `${55 + ((i * 37) % 45)}%` }} />
      ))}
    </div>
  );
}

const HIGHWAY = [
  // lane, start (beats), length (beats), colour
  [1, 0.4, 0.7, 'gold'],
  [1, 2.2, 1.1, 'gold'],
  [1, 3.4, 0.9, 'violet'],
  [0, 5.2, 1.4, 'pink'],
  [0, 7, 1.8, 'pink'],
  [1, 7, 1.3, 'violet'],
  [1, 9.3, 0.8, 'gold'],
  [1, 10.4, 1.1, 'gold'],
  [1, 11.8, 0.9, 'violet'],
  [0, 13.4, 1.4, 'pink'],
  [0, 15.2, 1.8, 'pink'],
  [1, 15.2, 1.3, 'violet'],
] as const;

/** Scrolling play-along note highway with a fixed playhead. */
export function NoteHighway({ playing }: { playing: boolean }) {
  const beat = 24;
  return (
    <div className={'sc-highway' + (playing ? ' is-playing' : '')} aria-hidden>
      <svg viewBox="0 0 220 72" preserveAspectRatio="none">
        <rect x="0" y="6" width="220" height="60" fill="#f1eff7" />
        {[30, 70, 110, 150, 190].map((x) => (
          <path key={x} d={`M${x} 6V66`} stroke="#e1dcec" strokeWidth="1" />
        ))}
        <path d="M6 4V68" stroke="#3d3363" strokeWidth="1.6" />
        <g className="sc-highway-notes">
          {[0, 1].map((rep) =>
            HIGHWAY.map(([lane, start, len, c], i) => (
              <rect
                key={`${rep}-${i}`}
                x={20 + (start + rep * 16.8) * beat * 0.55}
                y={lane === 0 ? 18 : 33}
                width={len * beat * 0.55}
                height="10"
                rx="5"
                className={`sc-hn sc-hn--${c}`}
              />
            )),
          )}
        </g>
        <path d="M100 2V70" stroke="#7a5ae0" strokeWidth="2.2" />
        <circle cx="100" cy="3" r="3.2" fill="#7a5ae0" />
        <circle cx="100" cy="69" r="3.2" fill="#7a5ae0" />
      </svg>
    </div>
  );
}
