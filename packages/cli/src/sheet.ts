/**
 * Frame sheets: render many frames of a mascot into one image so motion can be
 * reviewed at a glance (by humans and by AI agents that can read images).
 */
import { Mascot, paddedViewBox, renderSvg, type CharacterDef, type MascotFrame, type MascotOptions } from '@openmascot/core';

export interface Tile {
  label: string;
  svg: string;
}

export interface SheetOptions {
  cols?: number;
  /** Tile width in px. */
  tile?: number;
  title?: string;
  background?: string;
}

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;');

/** Lay tiles (each a full `<svg>` string) out in a grid with labels. */
export function composeSheet(tiles: Tile[], opts: SheetOptions = {}): string {
  const cols = Math.max(1, Math.min(opts.cols ?? 6, tiles.length));
  const tw = opts.tile ?? 220;
  // Tile aspect from the first tile's viewBox.
  const vb = /viewBox="([^"]+)"/.exec(tiles[0]?.svg ?? '')?.[1]?.split(/\s+/).map(Number) ?? [0, 0, 1, 1];
  const th = Math.round((tw * vb[3]) / vb[2]);
  const labelH = 20;
  const titleH = opts.title ? 34 : 0;
  const rows = Math.ceil(tiles.length / cols);
  const W = cols * tw;
  const H = titleH + rows * (th + labelH);
  let out = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">`;
  out += `<rect width="${W}" height="${H}" fill="${opts.background ?? '#ffffff'}"/>`;
  if (opts.title) out += `<text x="12" y="23" font-family="Inter, DejaVu Sans, sans-serif" font-size="17" font-weight="700" fill="#2b2340">${esc(opts.title)}</text>`;
  tiles.forEach((t, i) => {
    const x = (i % cols) * tw;
    const y = titleH + Math.floor(i / cols) * (th + labelH);
    out += `<rect x="${x + 0.5}" y="${y + 0.5}" width="${tw - 1}" height="${th + labelH - 1}" fill="none" stroke="#eeeaf5"/>`;
    out += t.svg.replace('<svg', `<svg x="${x}" y="${y}" width="${tw}" height="${th}"`).replace(/ xmlns="[^"]*"/, '');
    out += `<text x="${x + tw / 2}" y="${y + th + 14}" text-anchor="middle" font-family="Inter, DejaVu Sans, sans-serif" font-size="12" fill="#6b6280">${esc(t.label)}</text>`;
  });
  return out + '</svg>';
}

export interface ClipSheetOptions extends SheetOptions {
  frames?: number;
  /** Seconds to sample (default: clip length). */
  duration?: number;
  /** Seconds to simulate before the first sample (lets springs settle). Default 0. */
  warmup?: number;
  fps?: number;
  padding?: number;
  bpm?: number;
  mascot?: MascotOptions;
  /** Run the autonomous layers (blinks/glances). Default false for reproducible sheets. */
  alive?: boolean;
  /** Clip to play before the sampled clip (to review transitions). */
  from?: string;
  /** Seconds to hold `from` before switching. */
  fromHold?: number;
}

/** Step a mascot at a fixed rate and capture `frames` evenly spaced frames. */
export function clipFrames(character: CharacterDef, clip: string, opts: ClipSheetOptions = {}): { time: number; frame: MascotFrame; mascot: Mascot }[] {
  const fps = opts.fps ?? 60;
  const m = new Mascot(character, { alive: opts.alive ?? false, seed: 7, ...opts.mascot, initial: opts.from ?? clip });
  const dt = 1 / fps;
  let t = 0;
  const step = (sec: number) => {
    const n = Math.round(sec * fps);
    for (let i = 0; i < n; i++) {
      m.update(dt);
      t += dt;
    }
  };
  if (opts.from) {
    step(opts.fromHold ?? 0.6);
    m.play(clip, { bpm: opts.bpm, then: null });
  } else {
    // restart the clip cleanly (fade 0) so frame 0 is the clip's first frame
    m.play(clip, { fade: 0, bpm: opts.bpm, then: null });
  }
  step(opts.warmup ?? 0);
  const c = m.clips[clip];
  const spu = c?.units === 'beats' ? 60 / (opts.bpm ?? c.bpm ?? 120) : 1;
  const total = opts.duration ?? (c ? c.duration * spu : 2);
  const frames = Math.max(1, opts.frames ?? 12);
  const out: { time: number; frame: MascotFrame; mascot: Mascot }[] = [];
  let last = 0;
  for (let i = 0; i < frames; i++) {
    const at = frames === 1 ? 0 : (i * total) / (frames - 1);
    step(at - last);
    last = at;
    out.push({ time: at, frame: m.update(0), mascot: m });
  }
  return out;
}

export function clipSheet(character: CharacterDef, clip: string, opts: ClipSheetOptions = {}): string {
  const frames = clipFrames(character, clip, opts);
  const m = frames[0]?.mascot;
  const pad = opts.padding ?? 50;
  const tiles = frames.map((f) => ({
    label: `${f.time.toFixed(2)}s`,
    svg: renderSvg(m.rig, f.frame.frame, { padding: pad, particles: f.frame.particles }),
  }));
  return composeSheet(tiles, { title: opts.title ?? `${character.name} — ${clip}${opts.from ? ` (from ${opts.from})` : ''}`, ...opts });
}

/** One tile per expression. */
export function expressionSheet(character: CharacterDef, opts: SheetOptions & { padding?: number } = {}): string {
  const m = new Mascot(character, { alive: false });
  const tiles: Tile[] = [];
  for (const name of Object.keys(character.expressions)) {
    m.setExpression(name);
    // a few updates to pass the blink that masks eye changes
    for (let i = 0; i < 20; i++) m.update(1 / 60);
    tiles.push({ label: name, svg: renderSvg(m.rig, m.current.frame, { padding: opts.padding ?? 30 }) });
  }
  return composeSheet(tiles, { title: `${character.name} — expressions`, cols: 4, ...opts });
}

/** Sweep a bone's channel (default: root yaw 0→360) to review the pseudo-3D rig. */
export function sweepSheet(
  character: CharacterDef,
  opts: SheetOptions & { bone?: string; channel?: string; from?: number; to?: number; frames?: number; padding?: number; param?: string } = {},
): string {
  const bone = opts.bone ?? 'root';
  const channel = opts.channel ?? 'yaw';
  const from = opts.from ?? 0;
  const to = opts.to ?? 360;
  const n = opts.frames ?? 12;
  const m = new Mascot(character, { alive: false, initial: '__none__' });
  const tiles: Tile[] = [];
  for (let i = 0; i < n; i++) {
    const v = from + ((to - from) * i) / Math.max(1, n - 1);
    const clip = opts.param
      ? { duration: 1, params: { [opts.param]: [[0, v]] as [number, number][] } }
      : { duration: 1, bones: { [bone]: { [channel]: [[0, v]] as [number, number][] } } };
    m.play({ ...clip, name: 'sweep' }, { fade: 0, then: null });
    m.update(0);
    tiles.push({ label: `${opts.param ?? `${bone}.${channel}`} ${Math.round(v * 100) / 100}`, svg: renderSvg(m.rig, m.current.frame, { padding: opts.padding ?? 30 }) });
  }
  return composeSheet(tiles, { title: `${character.name} — sweep ${opts.param ?? `${bone}.${channel}`}`, ...opts });
}

export { paddedViewBox };
