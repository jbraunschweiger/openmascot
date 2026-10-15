/** Small presentational primitives shared by the showcase screens. */
import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { Chest, Flame, Gem, Heart, Star, TabChallenges, TabLearn, TabPractice, TabProfile, TabSongs } from './icons';

type BtnProps = ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'primary' | 'ghost' | 'light' };
export function Btn({ variant = 'primary', className, ...rest }: BtnProps) {
  return <button type="button" className={`sc-btn sc-btn--${variant}` + (className ? ' ' + className : '')} {...rest} />;
}

export function Title({ children, className }: { children: ReactNode; className?: string }) {
  return <h3 className={'sc-title' + (className ? ' ' + className : '')}>{children}</h3>;
}

export function Card({ children, className, onClick }: { children: ReactNode; className?: string; onClick?: () => void }) {
  return (
    <div className={'sc-card' + (className ? ' ' + className : '')} onClick={onClick}>
      {children}
    </div>
  );
}

/** Push the next children to the bottom of the screen column. */
export const Spacer = () => <div className="sc-spacer" />;

export function SuccessPill({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={'sc-okpill' + (className ? ' ' + className : '')}>
      <span className="sc-okpill-dot">
        <svg viewBox="0 0 24 24" aria-hidden>
          <path d="M6 12.5l4 4L18 8" fill="none" stroke="#fff" strokeWidth="3.4" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </span>
      {children}
    </div>
  );
}

const TABS = [
  ['Learn', TabLearn],
  ['Practice', TabPractice],
  ['Songs', TabSongs],
  ['Challenges', TabChallenges],
  ['Profile', TabProfile],
] as const;
export function TabBar({ active, onTab }: { active: (typeof TABS)[number][0]; onTab?: (t: string) => void }) {
  return (
    <nav className="sc-tabbar">
      {TABS.map(([name, Icon]) => (
        <button key={name} type="button" className={'sc-tab' + (name === active ? ' is-active' : '')} onClick={() => onTab?.(name)}>
          <Icon />
          <span>{name}</span>
        </button>
      ))}
    </nav>
  );
}

const STAT_ICONS = { flame: Flame, gem: Gem, heart: Heart, star: Star, chest: Chest } as const;
export function Stat({ icon, value, className }: { icon: keyof typeof STAT_ICONS; value: ReactNode; className?: string }) {
  const I = STAT_ICONS[icon];
  return (
    <span className={`sc-stat sc-stat--${icon}` + (className ? ' ' + className : '')}>
      <I />
      {value}
    </span>
  );
}

/** Decorative confetti squiggles (static, behind the mascot on celebration screens). */
export function ConfettiDecor({ seed = 1, count = 16 }: { seed?: number; count?: number }) {
  const colors = ['#ffd23f', '#ff8fb1', '#7ee0a1', '#8fd3ff', '#c3a6ff', '#ffb35c'];
  let s = seed * 9301;
  const r = () => ((s = (s * 9301 + 49297) % 233280) / 233280);
  const bits = Array.from({ length: count }, (_, i) => {
    // keep them out of the centre column where the mascot stands
    const side = i % 2 ? 1 : -1;
    const x = 50 + side * (14 + r() * 34);
    const y = 4 + r() * 92;
    return { x, y, rot: r() * 360, c: colors[i % colors.length], kind: i % 3, d: (r() * 2).toFixed(2) };
  });
  return (
    <div className="sc-confetti" aria-hidden>
      {bits.map((b, i) => (
        <svg key={i} viewBox="0 0 10 10" style={{ left: `${b.x}%`, top: `${b.y}%`, transform: `rotate(${b.rot}deg)`, animationDelay: `${b.d}s` }}>
          {b.kind === 0 ? (
            <path d="M2 7c1.5-4 4.5 0 6-4" fill="none" stroke={b.c} strokeWidth="2.2" strokeLinecap="round" />
          ) : b.kind === 1 ? (
            <rect x="2.5" y="3.5" width="5" height="3" rx="1" fill={b.c} />
          ) : (
            <path d="M2 3c2 0 2 4 4 4s2-4 2-4" fill="none" stroke={b.c} strokeWidth="2.2" strokeLinecap="round" />
          )}
        </svg>
      ))}
    </div>
  );
}

/** A tiny speech bubble that points left toward the mascot. */
export function Bubble({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={'sc-bubble' + (className ? ' ' + className : '')}>{children}</div>;
}
