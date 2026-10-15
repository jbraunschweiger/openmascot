/**
 * Inline SVG icons for the Echo app showcase. Line icons use `currentColor`;
 * the illustrated ones (instruments, stats, chest) carry their own palette.
 */
import type { SVGProps } from 'react';

type P = SVGProps<SVGSVGElement>;
const line = (p: P) => ({
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 2,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
  'aria-hidden': true,
  ...p,
});

/* ---------- line icons ---------- */
export const IconArrowRight = (p: P) => (
  <svg {...line(p)}><path d="M4 12h15M14 6l6 6-6 6" /></svg>
);
export const IconChevronDown = (p: P) => (
  <svg {...line(p)}><path d="M6 9l6 6 6-6" /></svg>
);
export const IconChevronLeft = (p: P) => (
  <svg {...line(p)}><path d="M15 5l-7 7 7 7" /></svg>
);
export const IconChevronRight = (p: P) => (
  <svg {...line(p)}><path d="M9 5l7 7-7 7" /></svg>
);
export const IconClose = (p: P) => (
  <svg {...line(p)}><path d="M6 6l12 12M18 6L6 18" /></svg>
);
export const IconCheck = (p: P) => (
  <svg {...line({ strokeWidth: 3, ...p })}><path d="M5 12.5l4.5 4.5L19 7.5" /></svg>
);
export const IconLock = (p: P) => (
  <svg viewBox="0 0 24 24" aria-hidden {...p}>
    <rect x="5" y="10.5" width="14" height="10" rx="2.5" fill="currentColor" />
    <path d="M8.5 10.5V8a3.5 3.5 0 0 1 7 0v2.5" fill="none" stroke="currentColor" strokeWidth="2.4" />
    <circle cx="12" cy="15.3" r="1.4" fill="#fff" opacity=".7" />
  </svg>
);
export const IconPlay = (p: P) => (
  <svg viewBox="0 0 24 24" aria-hidden {...p}><path d="M8 5.5v13l10.5-6.5z" fill="currentColor" /></svg>
);
export const IconPause = (p: P) => (
  <svg viewBox="0 0 24 24" aria-hidden {...p}>
    <rect x="6.5" y="5" width="3.6" height="14" rx="1.2" fill="currentColor" />
    <rect x="13.9" y="5" width="3.6" height="14" rx="1.2" fill="currentColor" />
  </svg>
);
export const IconGear = (p: P) => (
  <svg {...line(p)}>
    <circle cx="12" cy="12" r="3.2" />
    <path d="M12 2.8v2.4M12 18.8v2.4M2.8 12h2.4M18.8 12h2.4M5.5 5.5l1.7 1.7M16.8 16.8l1.7 1.7M5.5 18.5l1.7-1.7M16.8 7.2l1.7-1.7" />
    <circle cx="12" cy="12" r="6.6" />
  </svg>
);
export const IconBulb = (p: P) => (
  <svg viewBox="0 0 24 24" aria-hidden {...p}>
    <path d="M12 3a6 6 0 0 0-3.6 10.8c.7.6 1.1 1.3 1.1 2.2h5c0-.9.4-1.6 1.1-2.2A6 6 0 0 0 12 3z" fill="currentColor" />
    <rect x="9.6" y="17.3" width="4.8" height="2.2" rx="1" fill="currentColor" />
  </svg>
);
export const IconNote = (p: P) => (
  <svg viewBox="0 0 24 24" aria-hidden {...p}>
    <path d="M9 17.5V5.5l10-2v12" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinejoin="round" />
    <ellipse cx="6.6" cy="17.6" rx="3" ry="2.4" fill="currentColor" />
    <ellipse cx="16.6" cy="15.6" rx="3" ry="2.4" fill="currentColor" />
  </svg>
);
export const IconEighth = (p: P) => (
  <svg viewBox="0 0 24 24" aria-hidden {...p}>
    <path d="M12 18V4c1.5 2.8 5.5 3.6 5.5 7.5" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
    <ellipse cx="9" cy="18" rx="3.4" ry="2.7" fill="currentColor" />
  </svg>
);
export const IconTarget = (p: P) => (
  <svg viewBox="0 0 24 24" aria-hidden {...p}>
    <circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" strokeWidth="2.6" />
    <circle cx="12" cy="12" r="5" fill="none" stroke="currentColor" strokeWidth="2.6" />
    <circle cx="12" cy="12" r="1.8" fill="currentColor" />
  </svg>
);
export const IconBars = (p: P) => (
  <svg viewBox="0 0 24 24" aria-hidden {...p}>
    <rect x="3.5" y="6" width="4" height="14" rx="1.6" fill="currentColor" />
    <rect x="10" y="9" width="4" height="11" rx="1.6" fill="currentColor" opacity=".8" />
    <rect x="16.5" y="12" width="4" height="8" rx="1.6" fill="currentColor" opacity=".6" />
  </svg>
);
export const IconInfinity = (p: P) => (
  <svg {...line({ strokeWidth: 3, ...p })}>
    <path d="M12 12c-2-3-3.6-4.5-6-4.5a4.5 4.5 0 0 0 0 9c2.4 0 4-1.5 6-4.5s3.6-4.5 6-4.5a4.5 4.5 0 0 1 0 9c-2.4 0-4-1.5-6-4.5z" />
  </svg>
);
export const IconMic = (p: P) => (
  <svg {...line(p)}>
    <rect x="9" y="3" width="6" height="11" rx="3" />
    <path d="M5.5 11a6.5 6.5 0 0 0 13 0M12 17.5V21" />
  </svg>
);
export const IconSound = (p: P) => (
  <svg viewBox="0 0 24 24" aria-hidden {...p}>
    {[7, 10, 13, 16].map((x, i) => (
      <rect key={x} x={x} y={[9, 6.5, 8, 10][i]} width="1.9" height={[6, 11, 8, 4][i]} rx=".95" fill="currentColor" />
    ))}
  </svg>
);
export const IconSpark = (p: P) => (
  <svg viewBox="0 0 24 24" aria-hidden {...p}>
    <path d="M12 2.5l1.9 6.2 6.2 1.9-6.2 1.9L12 18.7l-1.9-6.2-6.2-1.9 6.2-1.9z" fill="currentColor" />
  </svg>
);
export const IconFocus = (p: P) => (
  <svg {...line(p)}><rect x="7" y="3" width="10" height="18" rx="2.5" /><path d="M11 18h2" /></svg>
);
export const IconGrid = (p: P) => (
  <svg {...line(p)}>
    <rect x="3" y="4" width="5" height="16" rx="1.5" />
    <rect x="9.5" y="4" width="5" height="16" rx="1.5" />
    <rect x="16" y="4" width="5" height="16" rx="1.5" />
  </svg>
);

/* tab bar */
export const TabLearn = (p: P) => (
  <svg viewBox="0 0 24 24" aria-hidden {...p}>
    <path d="M3.5 11.2L12 4l8.5 7.2V19a1.5 1.5 0 0 1-1.5 1.5h-4.2v-5.2h-5.6v5.2H5A1.5 1.5 0 0 1 3.5 19z" fill="currentColor" />
  </svg>
);
export const TabPractice = (p: P) => (
  <svg viewBox="0 0 24 24" aria-hidden {...p}>
    <rect x="4" y="6.5" width="16" height="14" rx="3" fill="none" stroke="currentColor" strokeWidth="2" />
    <path d="M12 3v6M9.5 6.5L12 9l2.5-2.5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    <circle cx="12" cy="14.5" r="2.4" fill="currentColor" />
  </svg>
);
export const TabSongs = IconNote;
export const TabChallenges = (p: P) => (
  <svg viewBox="0 0 24 24" aria-hidden {...p}>
    <path d="M12 3l7.5 3v5.6c0 4.5-3.2 8-7.5 9.4-4.3-1.4-7.5-4.9-7.5-9.4V6z" fill="currentColor" />
    <path d="M12 9.5l1 2 2.2.3-1.6 1.5.4 2.2-2-1.1-2 1.1.4-2.2-1.6-1.5 2.2-.3z" fill="#fff" opacity=".9" />
  </svg>
);
export const TabProfile = (p: P) => (
  <svg viewBox="0 0 24 24" aria-hidden {...p}>
    <circle cx="12" cy="8" r="4" fill="currentColor" />
    <path d="M4.5 20.5c.6-4 3.6-6.3 7.5-6.3s6.9 2.3 7.5 6.3z" fill="currentColor" />
  </svg>
);

/* ---------- illustrated icons ---------- */
export const Flame = (p: P) => (
  <svg viewBox="0 0 24 24" aria-hidden {...p}>
    <path d="M12.5 2.5c.6 3.2 5.8 5.6 5.8 11.1A6.3 6.3 0 0 1 12 20.5a6.3 6.3 0 0 1-6.3-6.4c0-3 1.7-4.6 3-5.8.2 1.8.9 2.9 2 3.4-.3-3.4.4-6.6 1.8-9.2z" fill="#ff7a1a" />
    <path d="M12.2 11.3c2 1.9 3.3 3.2 3.3 5.1A3.5 3.5 0 0 1 12 20a3.5 3.5 0 0 1-3.5-3.6c0-1.6 1-2.6 1.8-3.3.2 1 .6 1.6 1.2 1.9-.2-1.4.1-2.7.7-3.7z" fill="#ffc531" />
  </svg>
);
export const Gem = (p: P) => (
  <svg viewBox="0 0 24 24" aria-hidden {...p}>
    <path d="M12 2.5l8.3 4.8v9.4L12 21.5l-8.3-4.8V7.3z" fill="#1d9bf0" />
    <path d="M12 2.5l8.3 4.8L12 12 3.7 7.3z" fill="#7dd3ff" />
    <path d="M12 12l8.3-4.7v9.4L12 21.5z" fill="#1178c9" />
  </svg>
);
export const Heart = (p: P) => (
  <svg viewBox="0 0 24 24" aria-hidden {...p}>
    <path d="M12 20.5S3 15 3 8.8A4.6 4.6 0 0 1 7.7 4c1.9 0 3.3 1 4.3 2.5C13 5 14.4 4 16.3 4A4.6 4.6 0 0 1 21 8.8C21 15 12 20.5 12 20.5z" fill="#ef4565" />
    <ellipse cx="8" cy="8.5" rx="2" ry="1.3" fill="#fff" opacity=".45" transform="rotate(-30 8 8.5)" />
  </svg>
);
export const Star = (p: P) => (
  <svg viewBox="0 0 24 24" aria-hidden {...p}>
    <path d="M12 2.8l2.8 5.8 6.3.8-4.6 4.4 1.2 6.3L12 17.1l-5.7 3 1.2-6.3-4.6-4.4 6.3-.8z" fill="#ffbf2e" stroke="#f0a400" strokeWidth=".8" strokeLinejoin="round" />
  </svg>
);
export const Chest = (p: P) => (
  <svg viewBox="0 0 32 32" aria-hidden {...p}>
    <path d="M4 13h24v13a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2z" fill="#c9752a" />
    <path d="M4 13a12 7 0 0 1 24 0z" fill="#e08b35" />
    <path d="M4 13h24v3H4z" fill="#f3b33d" />
    <path d="M7 7.6V28M25 7.6V28" stroke="#f3b33d" strokeWidth="2.4" />
    <rect x="12.5" y="12" width="7" height="8" rx="1.5" fill="#ffd54a" stroke="#b86a1f" strokeWidth="1" />
    <circle cx="16" cy="15.5" r="1.3" fill="#8a4a12" />
  </svg>
);

export function Guitar({ muted, ...p }: P & { muted?: boolean }) {
  const body = muted ? '#cfcadb' : '#f4b443';
  const dark = muted ? '#b3adc3' : '#c9822a';
  const neck = muted ? '#bdb7cc' : '#5b3d2e';
  return (
    <svg viewBox="0 0 64 64" aria-hidden {...p}>
      <path d="M40 9l8-6 4 4-6 8z" fill={neck} />
      <path d="M46.5 8.5L28 27" stroke={neck} strokeWidth="4.2" strokeLinecap="round" />
      <path d="M27 21c-3-1-6 0-8 2.2-1.6 1.8-1.3 4-3.7 5.4C11 31 7 32 6 38c-1.5 8.5 6.7 18 15.6 17.4 5.6-.4 8-4.3 9.7-8.8 1-2.6 3.4-2.8 5-4.6 2.2-2.4 3-5.4 1.7-8.3-1.2-2.7-5.8-1.8-6.8-4.4C30.6 27 29.7 22 27 21z" fill={body} />
      <path d="M12.5 40c-1 4.4 2.5 9.6 7.3 10.5" stroke={dark} strokeWidth="1.8" fill="none" strokeLinecap="round" opacity=".55" />
      <circle cx="23.5" cy="38.5" r="4.3" fill={muted ? '#a39db4' : '#3a2620'} />
      <path d="M17 46l5.5-5.5" stroke={muted ? '#a39db4' : '#3a2620'} strokeWidth="2.4" strokeLinecap="round" />
      <path d="M44 6.5l2 2M47.5 3.5l2 2M50.5 7l2 2" stroke={muted ? '#d8d3e3' : '#e7d7c9'} strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}
export function Ukulele(p: P) {
  return (
    <svg viewBox="0 0 64 64" aria-hidden {...p}>
      <path d="M33 4l2-1 2 2-1 2z" fill="#bdb7cc" />
      <path d="M34.5 5L32 30" stroke="#bdb7cc" strokeWidth="3.8" strokeLinecap="round" />
      <path d="M31.5 28c-4 0-6 2.5-6 6 0 2 1.2 3 1.2 4.5 0 1.6-3.7 3-3.7 8.8C23 54 27.3 59 32 59s9-5 9-11.7c0-5.8-3.7-7.2-3.7-8.8 0-1.5 1.2-2.5 1.2-4.5 0-3.5-2.4-6-7-6z" fill="#cfcadb" />
      <circle cx="32" cy="42" r="3.2" fill="#a39db4" />
      <path d="M28 51h8" stroke="#a39db4" strokeWidth="2.4" strokeLinecap="round" />
    </svg>
  );
}
export function Piano(p: P) {
  return (
    <svg viewBox="0 0 64 64" aria-hidden {...p}>
      <rect x="8" y="12" width="48" height="40" rx="4" fill="#cfcadb" />
      <rect x="12" y="16" width="40" height="8" rx="2" fill="#b3adc3" />
      <rect x="12" y="27" width="40" height="21" rx="1.5" fill="#f4f2f8" />
      {[17, 22, 27, 32, 37, 42, 47].map((x) => (
        <path key={x} d={`M${x} 27v21`} stroke="#c8c2d6" strokeWidth="1" />
      ))}
      {[15.5, 20.5, 30.5, 35.5, 40.5].map((x) => (
        <rect key={x} x={x} y="27" width="3" height="12" rx=".8" fill="#a39db4" />
      ))}
      {[16, 22, 28, 34, 40, 46].map((x) => (
        <rect key={x} x={x} y="18.5" width="3" height="3" rx="1" fill="#e6e2ee" />
      ))}
    </svg>
  );
}
export function Drums(p: P) {
  return (
    <svg viewBox="0 0 64 64" aria-hidden {...p}>
      <path d="M8 14l12 2M44 16l12-2" stroke="#b3adc3" strokeWidth="2" strokeLinecap="round" />
      <ellipse cx="13" cy="18" rx="8" ry="2.2" fill="#cfcadb" />
      <ellipse cx="51" cy="18" rx="8" ry="2.2" fill="#cfcadb" />
      <path d="M13 20v30M51 20v30" stroke="#bdb7cc" strokeWidth="1.6" />
      <rect x="18" y="22" width="12" height="9" rx="2" fill="#cfcadb" />
      <rect x="34" y="22" width="12" height="9" rx="2" fill="#cfcadb" />
      <circle cx="32" cy="43" r="13" fill="#d9d4e4" stroke="#bdb7cc" strokeWidth="2" />
      <circle cx="32" cy="43" r="7" fill="#e9e6f0" />
      <rect x="6" y="38" width="10" height="9" rx="2" fill="#cfcadb" />
      <rect x="48" y="38" width="10" height="9" rx="2" fill="#cfcadb" />
      <path d="M22 56l-3 4M42 56l3 4" stroke="#bdb7cc" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}
/** Simple chord-hand glyph used in the experience list. */
export const IconFingers = (p: P) => (
  <svg viewBox="0 0 24 24" aria-hidden {...p}>
    <rect x="5" y="4" width="4.6" height="11" rx="2.3" fill="currentColor" />
    <rect x="14.4" y="4" width="4.6" height="11" rx="2.3" fill="currentColor" />
    <path d="M5.5 14c0 4 2.5 6.5 6.5 6.5s6.5-2.5 6.5-6.5" fill="none" stroke="currentColor" strokeWidth="2.2" />
  </svg>
);
export const IconTuningFork = (p: P) => (
  <svg viewBox="0 0 24 24" aria-hidden {...p}>
    <path d="M8 3v8a4 4 0 0 0 8 0V3" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" />
    <path d="M12 15v6" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" />
  </svg>
);
export const IconNodes = (p: P) => (
  <svg viewBox="0 0 24 24" aria-hidden {...p}>
    <path d="M7 7l5 10 5-10" fill="none" stroke="currentColor" strokeWidth="1.8" />
    <circle cx="7" cy="7" r="3" fill="currentColor" />
    <circle cx="17" cy="7" r="3" fill="currentColor" />
    <circle cx="12" cy="17.5" r="3" fill="currentColor" />
  </svg>
);
