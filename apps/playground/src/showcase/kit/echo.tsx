/**
 * Echo mascot helpers for the showcase.
 *
 * Clip/effect names are passed as preference lists ("try `greet`, else `wave`,
 * else …") and resolved against what the character actually has, so screens
 * keep working while the animation team is still authoring clips, and pick up
 * new clips automatically when they land.
 */
import { useCallback, useEffect, useMemo, useRef, type CSSProperties } from 'react';
import { Mascot, type MascotHandle } from '@openmascot/react';
import { echo } from '@openmascot/characters';

export type Names = string | readonly string[];
const list = (n: Names) => (typeof n === 'string' ? [n] : n);

export interface ReactOpts {
  /** Effect(s) to emit (first one that exists). */
  fx?: Names;
  /** Delay before the effect (ms). */
  fxDelay?: number;
  /** Where the effect spawns (anchor name or [x,y]). */
  fxAt?: string | [number, number];
  /** Temporary expression override while reacting. */
  expr?: string;
  /** How long (s) to blend into the expression. */
  exprIn?: number;
  /** Clip to continue with after a one-shot. Defaults to the Echo's base clip. */
  then?: string | null;
  bpm?: number;
}

export interface EchoApi {
  ref: React.RefObject<MascotHandle | null>;
  /** The resolved base clip this mascot loops when not reacting. */
  base: string;
  has(clip: string): boolean;
  pick(clips: Names): string | undefined;
  /** Play the first available clip, optionally with an effect and an expression. */
  react(clips: Names, opts?: ReactOpts): void;
  emit(fx: Names, at?: string | [number, number]): void;
  expression(name: string | null, dur?: number): void;
}

/** Create an Echo controller; pass the result to `<Echo api={…} />`. */
export function useEcho(base: Names = 'idle'): EchoApi {
  const ref = useRef<MascotHandle | null>(null);
  const timers = useRef<number[]>([]);
  useEffect(() => () => timers.current.forEach(clearTimeout), []);
  const baseList = list(base);
  const baseKey = baseList.join('|');

  return useMemo(() => {
    const rt = () => ref.current?.runtime;
    const has = (c: string) => !!rt()?.clips[c];
    const pick = (n: Names) => list(n).find(has);
    const resolvedBase = () => pick(baseList) ?? 'idle';
    const emit = (fx: Names, at?: string | [number, number]) => {
      const r = rt();
      const name = list(fx).find((f) => !!r?.effects[f]);
      if (name) ref.current?.emit(name, at ? { at } : undefined);
    };
    const later = (ms: number, fn: () => void) => {
      if (ms <= 0) return fn();
      timers.current.push(window.setTimeout(fn, ms));
    };
    const api: EchoApi = {
      ref,
      get base() {
        return resolvedBase();
      },
      has,
      pick,
      emit,
      expression: (name, dur = 0.3) => ref.current?.setExpression(name, dur),
      react(clips, opts = {}) {
        const clip = pick(clips);
        if (clip) {
          void ref.current?.play(clip, {
            then: opts.then === undefined ? resolvedBase() : opts.then,
            bpm: opts.bpm,
          });
        }
        if (opts.expr) {
          ref.current?.setExpression(opts.expr, opts.exprIn ?? 0.2);
          // When no clip carries the emotion, hold the face for a beat, then release.
          later(clip ? 2600 : 1800, () => ref.current?.setExpression(null, 0.6));
        }
        if (opts.fx) later(opts.fxDelay ?? 0, () => emit(opts.fx!, opts.fxAt));
      },
    };
    return api;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [baseKey]);
}

export interface EchoProps {
  api: EchoApi;
  /** Base clip preference list (looped / returned to after reactions). */
  anim?: Names;
  expression?: string | null;
  /** Width in phone design pixels (phones are 240 design px wide). */
  w: number;
  className?: string;
  style?: CSSProperties;
  padding?: number;
  bpm?: number;
  /** Mirror horizontally (face left). */
  flip?: boolean;
  /** Track the pointer with the eyes. Default true. */
  look?: boolean;
  paused?: boolean;
  title?: string;
  onClick?: () => void;
}

/**
 * `<Mascot>` sized in phone design units. Resolves `anim` against the clips the
 * character has once mounted.
 */
export function Echo({ api, anim, expression, w, className, style, padding = 40, bpm, flip, look = true, paused, title, onClick }: EchoProps) {
  const prefs = anim ? list(anim) : ['idle'];
  // Resolve against the bundled character directly so the first render is right.
  const initial = prefs.find((c) => !!echo.clips?.[c]) ?? 'idle';
  const click = useCallback(() => onClick?.(), [onClick]);
  return (
    <div
      className={'sc-echo' + (className ? ' ' + className : '') + (onClick ? ' sc-echo--tap' : '')}
      style={{ width: `calc(var(--p, 1px) * ${w})`, ...(flip ? { transform: 'scaleX(-1)' } : null), ...style }}
      onClick={onClick ? click : undefined}
      title={title}
    >
      <Mascot
        ref={api.ref}
        character={echo}
        animation={initial}
        bpm={bpm}
        expression={expression ?? null}
        lookAtPointer={look}
        paused={paused}
        padding={padding}
        title={title ?? 'Echo the bat'}
        style={{ width: '100%' }}
      />
    </div>
  );
}
