/**
 * @openmascot/react — `<Mascot>` component and `useMascot` hook.
 *
 * ```tsx
 * import { Mascot } from '@openmascot/react';
 * import { echo } from '@openmascot/characters';
 *
 * <Mascot character={echo} animation="dance-bop" lookAtPointer style={{ width: 240 }} />
 * ```
 */
import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
  type CSSProperties,
  type HTMLAttributes,
  type ForwardedRef,
} from 'react';
import type { CharacterDef, Mascot as MascotRuntime, MascotEvent, MascotOptions, PlayOptions } from '@openmascot/core';
import { MascotPlayer } from '@openmascot/web';

export interface MascotProps extends Omit<HTMLAttributes<HTMLDivElement>, 'children' | 'onEvent'> {
  character: CharacterDef;
  /**
   * Clip to play. Changing it crossfades. Loops follow the clip's loop flag;
   * one-shots return to idle unless `holdLastFrame`.
   */
  animation?: string;
  /** Changing this value re-triggers `animation` even if the name is the same. */
  animationKey?: string | number;
  /** Expression override (`null`/undefined = clip/neutral). */
  expression?: string | null;
  /** Tempo for beat-based clips. */
  bpm?: number;
  speed?: number;
  /** Crossfade duration (s). */
  fade?: number;
  /** For one-shots, stay on the last frame instead of returning to idle. */
  holdLastFrame?: boolean;
  lookAtPointer?: boolean;
  /** Fixed look direction (-1..1). Overrides pointer tracking. */
  look?: { x: number; y: number } | null;
  paused?: boolean;
  /** Padding around the character in character units (room for effects). Default 40. */
  padding?: number | [number, number, number, number];
  /** Extra runtime options (seed, recolor, library…), read on mount. */
  options?: MascotOptions;
  onEvent?: (e: MascotEvent) => void;
  className?: string;
  style?: CSSProperties;
  title?: string;
}

export interface MascotHandle {
  play(name: string, opts?: PlayOptions): Promise<void>;
  emit(effect: string, opts?: { at?: string | [number, number]; params?: Record<string, unknown> }): void;
  setExpression(name: string | null, duration?: number): void;
  lookAt(target: { x: number; y: number } | null): void;
  blink(): void;
  /** The underlying runtime (advanced). */
  readonly runtime: MascotRuntime | undefined;
  readonly player: MascotPlayer | undefined;
}

function MascotImpl(props: MascotProps, ref: ForwardedRef<MascotHandle>) {
  const host = useRef<HTMLDivElement>(null);
  const player = useRef<MascotPlayer | undefined>(undefined);
  const eventRef = useRef(props.onEvent);
  eventRef.current = props.onEvent;
  const [ready, setReady] = useState(0);

  // (Re)create the player when the character or padding changes.
  useEffect(() => {
    const el = host.current;
    if (!el) return;
    const p = new MascotPlayer(el, props.character, {
      ...props.options,
      initial: props.animation,
      initialOptions: { then: props.holdLastFrame ? null : undefined, bpm: props.bpm },
      padding: props.padding,
      lookAtPointer: props.lookAtPointer,
      speed: props.speed,
      autoplay: !props.paused,
      title: props.title,
    });
    player.current = p;
    const off = p.mascot.on((e) => eventRef.current?.(e));
    setReady((n) => n + 1);
    return () => {
      off();
      p.destroy();
      player.current = undefined;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [props.character, JSON.stringify(props.padding)]);

  useEffect(() => {
    const p = player.current;
    if (!p || !props.animation) return;
    if (p.mascot.playing === props.animation && props.animationKey === undefined) return;
    p.play(props.animation, { bpm: props.bpm, fade: props.fade, then: props.holdLastFrame ? null : undefined });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, props.animation, props.animationKey, props.bpm]);

  useEffect(() => {
    player.current?.mascot.setExpression(props.expression ?? null);
  }, [ready, props.expression]);

  useEffect(() => {
    if (player.current) player.current.speed = props.speed ?? 1;
  }, [ready, props.speed]);

  useEffect(() => {
    const p = player.current;
    if (!p) return;
    if (props.paused) p.stop();
    else p.start();
  }, [ready, props.paused]);

  useEffect(() => {
    const p = player.current;
    if (!p) return;
    if (props.look) {
      p.trackPointer(false);
      p.mascot.lookAt(props.look);
    } else {
      p.trackPointer(!!props.lookAtPointer);
    }
  }, [ready, props.lookAtPointer, props.look?.x, props.look?.y]);

  useImperativeHandle(
    ref,
    () => ({
      play: (name, opts) => player.current?.play(name, opts) ?? Promise.resolve(),
      emit: (effect, opts) => player.current?.mascot.emit(effect, opts),
      setExpression: (name, d) => player.current?.mascot.setExpression(name, d),
      lookAt: (t) => player.current?.mascot.lookAt(t),
      blink: () => player.current?.mascot.blink(),
      get runtime() {
        return player.current?.mascot;
      },
      get player() {
        return player.current;
      },
    }),
    [],
  );

  const {
    character: _c, animation: _a, animationKey: _k, expression: _e, bpm: _b, speed: _s, fade: _f, holdLastFrame: _h,
    lookAtPointer: _l, look: _lk, paused: _p, padding: _pd, options: _o, onEvent: _oe, title: _t, style, ...rest
  } = props;
  return <div ref={host} {...rest} style={{ display: 'inline-block', lineHeight: 0, ...style }} />;
}

export const Mascot = forwardRef(MascotImpl);
Mascot.displayName = 'Mascot';

/** Imperative handle helper: `const m = useMascotRef(); <Mascot ref={m} …/>; m.current?.play('wave')`. */
export function useMascotRef() {
  return useRef<MascotHandle>(null);
}

export type { MascotEvent, PlayOptions };
