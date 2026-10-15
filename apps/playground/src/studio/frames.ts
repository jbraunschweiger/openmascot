/**
 * Deterministic clip sampling for the Studio timeline, frame strip and exports.
 *
 * A fresh `Mascot` (fixed seed, alive layers off) is stepped at a fixed 60 fps
 * from the clip's first frame, so the same time always yields the same frame —
 * the same approach as the CLI frame sheets. Times are quantised to the 60 fps
 * grid; stepping forward reuses the simulation, stepping back restarts it.
 */
import { Mascot, renderSvg, type CharacterDef, type Clip, type MascotFrame, type RenderOptions } from '@openmascot/core';

export const SIM_FPS = 60;

export class ClipSim {
  private m!: Mascot;
  private frameNo = 0;
  constructor(
    private character: CharacterDef,
    private clip: Clip,
    private bpm?: number,
    private seed = 7,
  ) {
    this.reset();
  }

  get rig() {
    return this.m.rig;
  }

  private reset() {
    this.m = new Mascot(this.character, { alive: false, seed: this.seed, initial: '__none__' });
    this.m.play({ ...this.clip, name: this.clip.name ?? 'clip' }, { fade: 0, bpm: this.bpm, then: null });
    this.m.update(0);
    this.frameNo = 0;
  }

  /** Frame at time `t` seconds (quantised to 1/60 s). */
  at(t: number): MascotFrame {
    const target = Math.max(0, Math.round(t * SIM_FPS));
    if (target < this.frameNo) this.reset();
    while (this.frameNo < target) {
      this.m.update(1 / SIM_FPS);
      this.frameNo++;
    }
    return this.m.current;
  }
}

export function frameSvg(sim: ClipSim, f: MascotFrame, opts: RenderOptions = {}): string {
  return renderSvg(sim.rig, f.frame, { particles: f.particles, ...opts });
}

export const svgUri = (svg: string) => `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;

/** Sample `n` evenly spaced frames across `[0, total]` seconds. */
export function sampleFrames(sim: ClipSim, total: number, n: number, opts: RenderOptions = {}): { t: number; svg: string }[] {
  const out: { t: number; svg: string }[] = [];
  for (let i = 0; i < n; i++) {
    const t = n === 1 ? 0 : (i * total) / (n - 1);
    out.push({ t, svg: frameSvg(sim, sim.at(t), opts) });
  }
  return out;
}

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;');

/** Lay tiles out in a labelled grid (same layout as the CLI `framesheet`). */
export function composeSheet(tiles: { label: string; svg: string }[], opts: { cols?: number; tile?: number; title?: string; background?: string } = {}): string {
  const cols = Math.max(1, Math.min(opts.cols ?? 6, tiles.length));
  const tw = opts.tile ?? 220;
  const vb = /viewBox="([^"]+)"/.exec(tiles[0]?.svg ?? '')?.[1]?.split(/\s+/).map(Number) ?? [0, 0, 1, 1];
  const th = Math.round((tw * vb[3]) / vb[2]);
  const labelH = 20;
  const titleH = opts.title ? 34 : 0;
  const rows = Math.ceil(tiles.length / cols);
  const W = cols * tw;
  const H = titleH + rows * (th + labelH);
  let out = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">`;
  out += `<rect width="${W}" height="${H}" fill="${opts.background ?? '#ffffff'}"/>`;
  if (opts.title) out += `<text x="12" y="23" font-family="Nunito, Inter, sans-serif" font-size="17" font-weight="700" fill="#2b2340">${esc(opts.title)}</text>`;
  tiles.forEach((t, i) => {
    const x = (i % cols) * tw;
    const y = titleH + Math.floor(i / cols) * (th + labelH);
    out += `<rect x="${x + 0.5}" y="${y + 0.5}" width="${tw - 1}" height="${th + labelH - 1}" fill="none" stroke="#eeeaf5"/>`;
    out += t.svg.replace('<svg', `<svg x="${x}" y="${y}" width="${tw}" height="${th}"`).replace(/ xmlns="[^"]*"/, '');
    out += `<text x="${x + tw / 2}" y="${y + th + 14}" text-anchor="middle" font-family="Nunito, Inter, sans-serif" font-size="12" fill="#6b6280">${esc(t.label)}</text>`;
  });
  return out + '</svg>';
}
