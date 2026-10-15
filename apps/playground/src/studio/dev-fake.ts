/// <reference types="vite/client" />
/**
 * DEV-ONLY stand-in characters for building the multi-character UI before the
 * real cast (Pip, Riff…) lands in the registry.
 *
 * Active only in `vite dev` (never in builds) and only while the registry has a
 * single character. Remove this file (and its import in cast.ts) once the real
 * characters exist — or set DEV_FAKE_CHARACTERS to false.
 *
 * `#/…?devbroken=1` additionally registers a character with a broken SVG to
 * exercise the per-tile error boundaries.
 */
import type { CharacterDef } from '@openmascot/core';

export const DEV_FAKE_CHARACTERS = true;

/** Rotate the hue of every violet-ish colour in an SVG. */
function shiftViolets(svg: string, deg: number): string {
  return svg.replace(/#([0-9a-f]{6})\b/gi, (m, hex: string) => {
    const n = parseInt(hex, 16);
    const [r, g, b] = [(n >> 16) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    const l = (max + min) / 2;
    const d = max - min;
    if (d < 0.08) return m;
    const s = d / (1 - Math.abs(2 * l - 1));
    let h = max === r ? ((g - b) / d) % 6 : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
    h = (h * 60 + 360) % 360;
    if (h < 230 || h > 300) return m;
    h = (h + deg) % 360;
    const c = (1 - Math.abs(2 * l - 1)) * s;
    const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
    const o = l - c / 2;
    const [rr, gg, bb] = h < 60 ? [c, x, 0] : h < 120 ? [x, c, 0] : h < 180 ? [0, c, x] : h < 240 ? [0, x, c] : h < 300 ? [x, 0, c] : [c, 0, x];
    return '#' + [rr, gg, bb].map((v) => Math.round((v + o) * 255).toString(16).padStart(2, '0')).join('');
  });
}

export function devFakeCharacters(registry: Record<string, CharacterDef>): CharacterDef[] {
  if (!DEV_FAKE_CHARACTERS || !import.meta.env.DEV) return [];
  const list = Object.values(registry);
  if (list.length !== 1) return [];
  const base = list[0];
  const deg = 125;
  const clips = { ...(base.clips ?? {}) };
  // drop a few clips/expressions so the "not available" paths get exercised
  for (const n of ['hang', 'peek', 'emote-sad', 'emote-sing', 'dance-floss']) delete clips[n];
  const expressions = { ...base.expressions };
  delete expressions.dizzy;
  delete expressions.singing;
  const fake: CharacterDef = {
    ...base,
    id: 'dev-dusk',
    name: 'Dusk (dev)',
    svg: shiftViolets(base.svg, deg),
    clips,
    expressions,
    palette: Object.fromEntries(Object.entries(base.palette ?? {}).map(([k, v]) => [k, shiftViolets(v, deg)])),
    meta: { ...base.meta, description: `DEV-ONLY recoloured copy of ${base.name} with a few clips removed, for testing the multi-character playground.` },
  };
  const out = [fake];
  if (typeof location !== 'undefined' && /[?&]devbroken=1/.test(location.hash)) {
    out.push({ ...base, id: 'dev-broken', name: 'Broken (dev)', svg: '<svg><g data-om-bone="root"', meta: { description: 'DEV-ONLY character with a broken SVG.' } });
  }
  return out;
}
