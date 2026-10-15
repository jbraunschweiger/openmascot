/**
 * Phone frame + per-phone context.
 *
 * Every screen is laid out in "design pixels" on a 240-px-wide canvas: the
 * frame is a CSS size container and `--p` (= 100cqw / 240) converts design px
 * to real px, so the same screen renders crisply as a thumbnail in the
 * overview grid and at full size in focus mode.
 */
import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react';

export interface PhoneCtxValue {
  /** True while the phone is at least partly on screen. */
  visible: boolean;
  /** Ask the flow to move on from this screen (focus mode advances; overview highlights the next phone). */
  next(): void;
  /** Jump to a screen by id. */
  go(id: string): void;
  mode: 'grid' | 'focus';
}

export const PhoneCtx = createContext<PhoneCtxValue>({ visible: true, next() {}, go() {}, mode: 'grid' });
export const usePhone = () => useContext(PhoneCtx);

/**
 * Run `fn` each time the phone scrolls into view (and every `every` ms while it
 * stays visible). Good for "ambient" reactions on hero screens.
 */
export function useWhenVisible(fn: () => void, opts: { delay?: number; every?: number } = {}) {
  const { visible } = usePhone();
  const fnRef = useRef(fn);
  fnRef.current = fn;
  useEffect(() => {
    if (!visible) return;
    const ids: number[] = [];
    ids.push(window.setTimeout(() => fnRef.current(), opts.delay ?? 400));
    if (opts.every) ids.push(window.setInterval(() => fnRef.current(), opts.every));
    return () => ids.forEach((id) => (clearTimeout(id), clearInterval(id)));
  }, [visible, opts.delay, opts.every]);
}

interface PhoneProps {
  id: string;
  /** Width / height of the screen (taken from the mock). */
  aspect: number;
  dark?: boolean;
  children: ReactNode;
  mode: 'grid' | 'focus';
  pulse?: boolean;
  next(): void;
  go(id: string): void;
  label?: string;
}

export function Phone({ id, aspect, dark, children, mode, pulse, next, go, label }: PhoneProps) {
  const el = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const node = el.current;
    if (!node || typeof IntersectionObserver === 'undefined') return setVisible(true);
    const io = new IntersectionObserver(([e]) => setVisible(e.isIntersecting), { threshold: 0.35 });
    io.observe(node);
    return () => io.disconnect();
  }, []);
  return (
    <div
      ref={el}
      className={'sc-phone' + (pulse ? ' sc-phone--pulse' : '')}
      data-screen={id}
      style={{ aspectRatio: String(aspect) }}
      aria-label={label}
      role="group"
    >
      <div className={'sc-screen' + (dark ? ' sc-screen--dark' : '')}>
        <PhoneCtx.Provider value={{ visible, next, go, mode }}>{children}</PhoneCtx.Provider>
      </div>
    </div>
  );
}
