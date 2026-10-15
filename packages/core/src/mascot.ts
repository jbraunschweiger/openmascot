/**
 * `Mascot` — the DOM-free runtime. Owns playback (crossfaded clip tracks),
 * the "alive" layers (breathing, blinking, glancing, fidgets, look-at),
 * spring secondary motion and particle effects, and produces a renderable
 * {@link MascotFrame} for any renderer (DOM, string, canvas, native).
 *
 * Advance it with `update(dt)`; it is deterministic for a given seed and
 * sequence of calls, which is what makes frame sheets and tests reliable.
 */
import { clipSeconds, sampleClip, secondsPerUnit } from './clip';
import { clamp } from './ease';
import type { EffectDef, EffectRegistry, Particle, ParticleFrame } from './effects';
import { particleDone, particleFrame, rng } from './effects';
import { builtinEffects } from './effects-library';
import { angleOf, apply } from './mat';
import { blendPoses, emptyPose, resolvePose } from './pose';
import { compileRig, type RigWarning } from './rig';
import { bonePosition, solve, type SolveOptions } from './solve';
import type { BoneNode, CharacterDef, Clip, ClipContext, EffectEvent, Frame, Pose, Rig } from './types';

export interface MascotOptions {
  /** Shared clip library; character clips override same-named entries. */
  library?: Record<string, Clip>;
  /** Effect registry; defaults to the built-in effects. Merged over built-ins. */
  effects?: EffectRegistry;
  /** RNG seed (blinks, fidgets, effects). Default 1. */
  seed?: number;
  /** Enable autonomous life (blinks, glances, fidgets). Default true. */
  alive?: boolean;
  /** Clip to start with. Default: the character's idle clip. */
  initial?: string;
  /** Solver tuning. */
  solve?: SolveOptions;
  /** Effect size multiplier. Default 1. */
  effectScale?: number;
  /** Colour substitutions (old hex → new hex) for theming. */
  recolor?: Record<string, string>;
}

export interface PlayOptions {
  /** Crossfade duration in seconds. Default: clip.fadeIn ?? 0.25. */
  fade?: number;
  /** Override the clip's loop flag. */
  loop?: boolean;
  /** Playback speed multiplier. Default 1. */
  speed?: number;
  /** Tempo for beat-based clips (dances). */
  bpm?: number;
  /** For one-shots: clip to continue with. Default idle. `null` holds the last frame. */
  then?: string | null;
  /** For loops: stop after this many repetitions, then continue with `then`. */
  repeat?: number;
  /** Start offset in seconds. */
  offset?: number;
}

export interface MascotFrame {
  time: number;
  frame: Frame;
  particles: ParticleFrame[];
}

export type MascotEvent =
  | { type: 'start'; clip: string }
  | { type: 'end'; clip: string }
  | { type: 'loop'; clip: string }
  | { type: 'effect'; clip: string; effect: string }
  | { type: 'expression'; expression: string | undefined };

interface Track {
  id: number;
  name: string;
  clip: Clip;
  /** Elapsed local seconds (speed applied). */
  elapsed: number;
  speed: number;
  spu: number;
  loop: boolean;
  repeat: number;
  weight: number;
  target: number;
  fadeRate: number;
  then: string | null;
  ended: boolean;
  ctx: ClipContext;
  resolve?: () => void;
}

interface SpringState {
  bone: BoneNode;
  qx: number;
  qy: number;
  vx: number;
  vy: number;
  tx: number;
  ty: number;
  angle: number;
  init: boolean;
}

export class Mascot {
  readonly character: CharacterDef;
  readonly rig: Rig;
  readonly warnings: RigWarning[] = [];
  readonly clips: Record<string, Clip>;
  readonly effects: EffectRegistry;

  /** Runtime seconds. */
  time = 0;
  /** Last produced frame. */
  current: MascotFrame;

  private opts: MascotOptions;
  private tracks: Track[] = [];
  private trackSeq = 0;
  private random: () => number;
  private alive: boolean;
  private listeners = new Set<(e: MascotEvent) => void>();

  // alive layers
  private nextBlink = 1.2;
  private blinkStart = -10;
  private blinkDouble = false;
  private look = { x: 0, y: 0 };
  private lookTarget: { x: number; y: number } | null = null;
  private glance = { x: 0, y: 0, until: 0, next: 2.5 };
  private nextFidget = 0;
  private exprOverride: string | undefined;
  private exprUntil = Infinity;
  private paramOverrides: Record<string, number> = {};
  private committedSlots: Record<string, string> | null = null;
  private pendingSlots: Record<string, string> | null = null;

  private springs: SpringState[] = [];
  private particles: Particle[] = [];
  private particleSeq = 0;
  private lastFrame: Frame | undefined;

  constructor(character: CharacterDef, opts: MascotOptions = {}) {
    this.character = character;
    this.opts = opts;
    this.rig = compileRig(character.svg, { recolor: opts.recolor, warnings: this.warnings });
    this.clips = { ...(opts.library ?? {}), ...(character.clips ?? {}) };
    for (const k in this.clips) this.clips[k] = { ...this.clips[k], name: this.clips[k].name ?? k };
    this.effects = { ...builtinEffects, ...(opts.effects ?? {}) };
    this.random = rng(opts.seed ?? 1);
    this.alive = opts.alive ?? true;
    this.nextFidget = this.fidgetInterval();
    for (const b of this.rig.bones) {
      if (b.spring && !this.springs.some((s) => s.bone.name === b.name)) {
        this.springs.push({ bone: b, qx: 0, qy: 0, vx: 0, vy: 0, tx: 0, ty: 0, angle: 0, init: false });
      }
    }
    const initial = opts.initial ?? this.idleClip;
    if (this.clips[initial]) this.play(initial, { fade: 0 });
    this.current = this.evaluate(0);
  }

  /** Name of the idle clip. */
  get idleClip(): string {
    return this.character.idle?.clip ?? 'idle';
  }

  /** Name of the clip currently dominating playback. */
  get playing(): string | undefined {
    for (let i = this.tracks.length - 1; i >= 0; i--) if (this.tracks[i].target > 0) return this.tracks[i].name;
    return this.tracks[this.tracks.length - 1]?.name;
  }

  on(fn: (e: MascotEvent) => void): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  private fire(e: MascotEvent) {
    for (const l of this.listeners) l(e);
  }

  /**
   * Crossfade to a clip. Returns a promise that resolves when a one-shot
   * finishes (or immediately-pending for loops, resolved when replaced).
   */
  play(nameOrClip: string | Clip, opts: PlayOptions = {}): Promise<void> {
    const clip = typeof nameOrClip === 'string' ? this.clips[nameOrClip] : nameOrClip;
    if (!clip) {
      console.warn(`[openmascot] unknown clip "${String(nameOrClip)}"`);
      return Promise.resolve();
    }
    const name = clip.name ?? (typeof nameOrClip === 'string' ? nameOrClip : 'clip');
    const fade = Math.max(0, opts.fade ?? clip.fadeIn ?? 0.25);
    for (const t of this.tracks) {
      if (t.target > 0) {
        t.target = 0;
        t.fadeRate = fade > 0 ? 1 / fade : Infinity;
        t.resolve?.();
        t.resolve = undefined;
      }
    }
    const seed = (this.opts.seed ?? 1) * 7919 + ++this.trackSeq * 104729;
    const spu = secondsPerUnit(clip, opts.bpm);
    const track: Track = {
      id: this.trackSeq,
      name,
      clip,
      elapsed: opts.offset ?? 0,
      speed: opts.speed ?? 1,
      spu,
      loop: opts.loop ?? !!clip.loop,
      repeat: opts.repeat ?? Infinity,
      weight: fade > 0 ? 0 : 1,
      target: 1,
      fadeRate: fade > 0 ? 1 / fade : Infinity,
      then: opts.then === undefined ? this.idleClip : opts.then,
      ended: false,
      ctx: { duration: clip.duration, secondsPerUnit: spu, random: rng(seed) },
    };
    this.tracks.push(track);
    if (name === this.idleClip) this.nextFidget = this.time + this.fidgetInterval();
    this.fire({ type: 'start', clip: name });
    // Fire events at t=0 immediately on the next update.
    return new Promise<void>((res) => {
      track.resolve = res;
    });
  }

  /** Return to the idle clip. */
  idle(fade = 0.35): Promise<void> {
    return this.play(this.idleClip, { fade });
  }

  /** Override the facial expression (until cleared with `null`, or for `duration` seconds). */
  setExpression(name: string | null, duration?: number) {
    this.exprOverride = name ?? undefined;
    this.exprUntil = duration != null ? this.time + duration : Infinity;
    this.fire({ type: 'expression', expression: this.exprOverride });
  }

  /** Set a parameter override (e.g. `lookX`), or clear with `null`. */
  setParam(name: string, value: number | null) {
    if (value == null) delete this.paramOverrides[name];
    else this.paramOverrides[name] = value;
  }

  /** Look toward a normalised direction (-1..1 each axis), or `null` to resume idle glancing. */
  lookAt(target: { x: number; y: number } | null) {
    this.lookTarget = target ? { x: clamp(target.x, -1, 1), y: clamp(target.y, -1, 1) } : null;
  }

  /** Look toward a point in character coordinates. */
  lookAtPoint(x: number, y: number, range = 260) {
    const head = bonePosition(this.rig, this.current.frame, 'head') ?? [0, -150];
    this.lookAt({ x: (x - head[0]) / range, y: (y - head[1]) / range });
  }

  /** Emit an effect now. */
  emit(effect: string, opts: { at?: string | [number, number]; params?: Record<string, unknown> } = {}) {
    this.spawnEffect({ t: 0, effect, at: opts.at, params: opts.params }, this.lastFrame ?? this.current.frame);
  }

  /** Trigger a blink right now. */
  blink() {
    this.blinkStart = this.time;
    this.blinkDouble = false;
  }

  /** Advance by `dt` seconds and return the new frame. */
  update(dt: number): MascotFrame {
    dt = clamp(dt, 0, 0.25);
    this.time += dt;
    this.advanceTracks(dt);
    this.current = this.evaluate(dt);
    return this.current;
  }

  /** Remove all particles. */
  clearEffects() {
    this.particles = [];
  }

  /* ------------------------------------------------------------------ */

  private fidgetInterval() {
    const every = this.character.idle?.fidgetEvery ?? 6;
    if (!every) return Infinity;
    return every * (0.6 + this.random() * 0.8);
  }

  private advanceTracks(dt: number) {
    for (const t of this.tracks) {
      // weights
      if (t.weight !== t.target) {
        const step = t.fadeRate === Infinity ? 1 : dt * t.fadeRate;
        t.weight = t.target > t.weight ? Math.min(t.target, t.weight + step) : Math.max(t.target, t.weight - step);
      }
      if (t.ended) continue;
      const dur = clipSeconds(t.clip) * (t.spu / secondsPerUnit(t.clip));
      const prev = t.elapsed;
      t.elapsed += dt * t.speed;
      // events (only for the dominant / incoming track)
      if (t.target > 0) this.fireClipEvents(t, prev, t.elapsed);
      if (t.loop) {
        const loops = Math.floor(t.elapsed / dur);
        if (loops >= t.repeat) {
          t.elapsed = dur;
          this.endTrack(t);
        } else if (Math.floor(prev / dur) !== loops) {
          this.fire({ type: 'loop', clip: t.name });
        }
      } else if (t.elapsed >= dur) {
        t.elapsed = dur;
        this.endTrack(t);
      }
    }
    this.tracks = this.tracks.filter((t) => t.weight > 0 || t.target > 0);
  }

  private endTrack(t: Track) {
    t.ended = true;
    this.fire({ type: 'end', clip: t.name });
    const res = t.resolve;
    t.resolve = undefined;
    if (t.target > 0 && t.then !== null && this.clips[t.then]) {
      this.play(t.then, { fade: 0.35 });
    }
    res?.();
  }

  private fireClipEvents(t: Track, prevSec: number, nowSec: number) {
    const events = t.clip.events;
    if (!events?.length) return;
    const dur = t.clip.duration;
    // Events at exactly t=0 fire on the first update.
    const lo = prevSec === 0 ? -1e-9 : prevSec / t.spu;
    let hi = nowSec / t.spu;
    if (!t.loop) hi = Math.min(hi, dur);
    const c0 = Math.max(0, Math.floor(lo / dur));
    const c1 = t.loop ? Math.floor(hi / dur) : 0;
    for (let c = c0; c <= c1; c++) {
      if (c >= t.repeat) break;
      for (const ev of events) {
        const at = c * dur + ev.t;
        if (at > lo && at <= hi) {
          this.spawnEffect(ev, this.lastFrame ?? this.current?.frame);
          this.fire({ type: 'effect', clip: t.name, effect: ev.effect });
        }
      }
    }
  }

  private spawnEffect(ev: EffectEvent, frame: Frame | undefined) {
    const def: EffectDef | undefined = this.effects[ev.effect];
    if (!def) {
      console.warn(`[openmascot] unknown effect "${ev.effect}"`);
      return;
    }
    const at = ev.at ?? def.defaultAnchor ?? 'head';
    let origin: [number, number] = [0, -150];
    let follow: Particle['follow'];
    let angle = 0;
    if (Array.isArray(at)) origin = [at[0], at[1]];
    else {
      const anchor = this.character.anchors?.[at];
      const bone = anchor?.bone ?? at;
      const offset = anchor?.offset ?? [0, 0];
      const pos = frame ? bonePosition(this.rig, frame, bone, offset) : undefined;
      if (pos) origin = pos;
      else {
        const b = this.rig.bonesByName[bone]?.[0];
        if (b) origin = [b.pivot[0] + offset[0], b.pivot[1] + offset[1]];
      }
      const inst = this.rig.bonesByName[bone]?.[0];
      if (inst && frame?.bones[inst.bi]) angle = angleOf(frame.bones[inst.bi].world);
      if (def.follow) follow = { bone, offset };
    }
    const seed = Math.floor(this.random() * 2 ** 31);
    const specs = def.spawn({
      random: rng(seed),
      params: ev.params ?? {},
      scale: this.opts.effectScale ?? 1,
      angle,
    });
    for (const spec of specs) {
      this.particles.push({ id: ++this.particleSeq, spec, born: this.time, origin, follow });
    }
  }

  private dominantClip(): Clip | undefined {
    let best: Track | undefined;
    for (const t of this.tracks) if (!best || t.weight >= best.weight) best = t;
    return best?.clip;
  }

  private samplePose(): Pose {
    let pose: Pose | undefined;
    for (const t of this.tracks) {
      if (t.weight <= 0 && t !== this.tracks[this.tracks.length - 1]) continue;
      const dur = t.clip.duration;
      let u = t.elapsed / t.spu;
      if (t.loop && !t.ended) u = ((u % dur) + dur) % dur;
      else u = Math.min(u, dur);
      const p = sampleClip(t.clip, u, t.ctx);
      pose = pose ? blendPoses(pose, p, t.weight) : p;
    }
    return pose ?? emptyPose();
  }

  private evaluate(dt: number): MascotFrame {
    const pose = this.samplePose();
    const dom = this.dominantClip();
    const sup = dom?.suppress ?? {};
    const now = this.time;

    // --- alive layers -------------------------------------------------
    const params = this.character.params ?? {};
    if (this.alive) {
      // breathing
      if (!sup.breathe && params.breathe) {
        pose.params.breathe = (pose.params.breathe ?? 0) + Math.sin((now * Math.PI * 2) / 3.4);
      }
      // blinking
      if (!sup.blink && now >= this.nextBlink) {
        this.blinkStart = now;
        this.blinkDouble = this.random() < 0.18;
        const every = this.character.idle?.blinkEvery ?? 3.5;
        this.nextBlink = now + every * (0.45 + this.random() * 1.1);
      }
      // glancing
      if (!this.lookTarget && !sup.look) {
        if (now >= this.glance.next) {
          const r = this.random();
          this.glance.x = r < 0.35 ? 0 : (this.random() - 0.5) * 0.9;
          this.glance.y = (this.random() - 0.6) * 0.5;
          this.glance.until = now + 0.8 + this.random() * 1.6;
          this.glance.next = this.glance.until + 1 + this.random() * 3;
        }
        if (now > this.glance.until) {
          this.glance.x = 0;
          this.glance.y = 0;
        }
      }
      // fidgets
      const fidgets = this.character.idle?.fidgets ?? [];
      if (!sup.fidget && fidgets.length && this.playing === this.idleClip && now >= this.nextFidget) {
        const f = fidgets[Math.floor(this.random() * fidgets.length)];
        this.nextFidget = now + this.fidgetInterval() + 3;
        if (this.clips[f]) this.play(f, { then: this.idleClip, fade: 0.3 });
      }
    }
    // blink curve (also used for expression changes)
    const bt = now - this.blinkStart;
    const blinkDur = 0.17;
    let blink = 0;
    if (bt >= 0 && bt < blinkDur) blink = bt < 0.06 ? bt / 0.06 : bt < 0.09 ? 1 : 1 - (bt - 0.09) / 0.08;
    else if (this.blinkDouble && bt >= blinkDur + 0.08 && bt < 2 * blinkDur + 0.08) {
      const b2 = bt - blinkDur - 0.08;
      blink = b2 < 0.06 ? b2 / 0.06 : b2 < 0.09 ? 1 : 1 - (b2 - 0.09) / 0.08;
    }
    if (params.blink && !sup.blink) pose.params.blink = Math.max(pose.params.blink ?? 0, blink);

    // look
    const target = this.lookTarget ?? (this.alive && !sup.look ? this.glance : { x: 0, y: 0 });
    const k = 1 - Math.exp(-dt * (this.lookTarget ? 10 : 6));
    this.look.x += (target.x - this.look.x) * k;
    this.look.y += (target.y - this.look.y) * k;
    if (!sup.look) {
      if (params.lookX) pose.params.lookX = (pose.params.lookX ?? 0) + this.look.x;
      if (params.lookY) pose.params.lookY = (pose.params.lookY ?? 0) + this.look.y;
    }
    Object.assign(pose.params, this.paramOverrides);

    // expression override
    if (this.exprOverride && now > this.exprUntil) {
      this.exprOverride = undefined;
      this.fire({ type: 'expression', expression: undefined });
    }
    if (this.exprOverride) pose.expression = this.exprOverride;

    const resolved = resolvePose(this.character, this.rig, pose);

    // Mask eye-art swaps behind a blink, like a traditional animator would.
    const slots = this.maskSlotChange(resolved.slots, !!params.blink && !sup.blink, blink);
    if (this.pendingSlots && blink >= 0.7) {
      this.committedSlots = this.pendingSlots;
      this.pendingSlots = null;
    }

    // Shadow follows root and fades/shrinks with height.
    const root = resolved.channels.get('root');
    if (root) {
      const shadowBones = this.rig.bones.filter((b) => b.shadow);
      for (const sb of shadowBones) {
        const c = resolved.channels.get(sb.name) ?? { x: 0, y: 0, rot: 0, sx: 1, sy: 1, yaw: 0, pitch: 0, dz: 0, opacity: 1 };
        const lift = clamp(-root.y / 220, 0, 0.75);
        c.x += root.x;
        c.sx *= (1 - lift * 0.55) * root.sx;
        c.sy *= 1 - lift * 0.4;
        c.opacity *= 1 - lift * 0.7;
        resolved.channels.set(sb.name, c);
      }
    }

    // springs (extra rotation from previous simulation step)
    const extraRot: Record<string, number> = {};
    for (const s of this.springs) extraRot[s.bone.name] = s.angle;

    const frame = solve(this.rig, { channels: resolved.channels, slots, extraRot }, this.opts.solve, undefined);
    this.stepSprings(frame, dt);
    this.lastFrame = frame;

    // particles
    const particles: ParticleFrame[] = [];
    this.particles = this.particles.filter((p) => !particleDone(p, now));
    for (const p of this.particles) {
      let origin = p.origin;
      if (p.follow) origin = bonePosition(this.rig, frame, p.follow.bone, p.follow.offset) ?? origin;
      const pf = particleFrame(p, now, origin);
      if (pf) particles.push(pf);
    }
    return { time: now, frame, particles };
  }

  private maskSlotChange(next: Record<string, string>, canBlink: boolean, blink: number): Record<string, string> {
    if (!this.committedSlots) {
      this.committedSlots = next;
      return next;
    }
    const cur = this.committedSlots;
    let eyeChange = false;
    let any = false;
    for (const k in next) {
      if (next[k] !== cur[k]) {
        any = true;
        if (k.startsWith('eye')) eyeChange = true;
      }
    }
    if (!any) {
      this.pendingSlots = null;
      return cur;
    }
    if (!eyeChange || !canBlink) {
      this.committedSlots = next;
      this.pendingSlots = null;
      return next;
    }
    // Eye change: apply non-eye slots now, eyes at the blink's peak.
    const merged: Record<string, string> = { ...next };
    for (const k in next) if (k.startsWith('eye')) merged[k] = cur[k];
    if (!this.pendingSlots) {
      if (this.time - this.blinkStart > 0.2) {
        this.blinkStart = this.time;
        this.blinkDouble = false;
      }
    }
    this.pendingSlots = next;
    if (blink >= 0.7) {
      this.committedSlots = next;
      this.pendingSlots = null;
      return next;
    }
    this.committedSlots = merged;
    return merged;
  }

  private stepSprings(frame: Frame, dt: number) {
    for (const s of this.springs) {
      const solved = frame.bones[s.bone.bi];
      const m = solved?.rigid ?? solved?.world;
      if (!m) continue;
      const [px, py] = apply(m, s.bone.pivot[0], s.bone.pivot[1]);
      const [tx, ty] = apply(m, s.bone.spring!.tip[0], s.bone.spring!.tip[1]);
      if (!s.init || dt <= 0) {
        s.qx = tx;
        s.qy = ty;
        s.tx = tx;
        s.ty = ty;
        s.vx = s.vy = 0;
        s.init = true;
        continue;
      }
      const { stiffness, damping } = s.bone.spring!;
      const tvx = (tx - s.tx) / dt;
      const tvy = (ty - s.ty) / dt;
      const n = Math.max(1, Math.ceil(dt / (1 / 240)));
      const h = dt / n;
      for (let i = 0; i < n; i++) {
        const ax = stiffness * (tx - s.qx) - damping * (s.vx - tvx);
        const ay = stiffness * (ty - s.qy) - damping * (s.vy - tvy);
        s.vx += ax * h;
        s.vy += ay * h;
        s.qx += s.vx * h;
        s.qy += s.vy * h;
      }
      s.tx = tx;
      s.ty = ty;
      // angle between rigid tip direction and simulated tip direction
      const rx = tx - px;
      const ry = ty - py;
      const qx = s.qx - px;
      const qy = s.qy - py;
      let a = (Math.atan2(rx * qy - ry * qx, rx * qx + ry * qy) * 180) / Math.PI;
      // keep the simulated tip near the rigid length (avoid drift)
      a = clamp(a, -55, 55);
      // world angle → local: divide out mirroring
      const det = m[0] * m[3] - m[1] * m[2];
      s.angle = det < 0 ? -a : a;
    }
  }
}
