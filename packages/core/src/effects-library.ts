/**
 * Built-in effects. All particle art is flat and outline-free (small white
 * gloss highlights only) and drawn centred on (0, 0) in character units, sized
 * against a typical mascot head ~150 units wide (Echo's head anchor sits at
 * about (0,-150) in character space; its eyes at (±43,-125)).
 *
 * Every effect is analytic (a pure function of particle age) and uses only
 * `ctx.random`, so it is deterministic for a given seed.
 *
 * Common params (where they make sense):
 * - `count`    number of particles
 * - `color`    main colour (CSS colour string)
 * - `spread`   placement radius / width in character units
 * - `size`     size multiplier (default 1)
 * - `side`     -1 (character's left on screen) or 1 (right); 0 = both where supported
 * - `duration` lifetime / hold time in seconds
 */
import type { EffectDef, EffectRegistry, ParticleSpec, ParticleState } from './effects';
import { fadeEnvelope, num, popEnvelope, str } from './effects';

/* ------------------------------------------------------------------ */
/* Shapes                                                              */
/* ------------------------------------------------------------------ */

const gloss = (cx: number, cy: number, rx: number, ry: number, rot = -35, op = 0.5) =>
  `<ellipse cx="${cx}" cy="${cy}" rx="${rx}" ry="${ry}" transform="rotate(${rot} ${cx} ${cy})" fill="#fff" opacity="${op}"/>`;

/** Particle art, drawn at its natural size (≈ the size seen in the reference art). */
export const SHAPES = {
  /** Plump heart, ~40 wide × 35 tall. */
  heart: (c: string) =>
    `<path d="M0 16C-8.5 10.4-20 2-20-8C-20-15-14.8-19.6-9.2-19.6-5.2-19.6-1.9-17.4 0-14 1.9-17.4 5.2-19.6 9.2-19.6 14.8-19.6 20-15 20-8 20 2 8.5 10.4 0 16Z" fill="${c}"/>` +
    gloss(-10.5, -10.5, 4.4, 2.7, -40, 0.5),
  /** Four-point sparkle with concave sides, 40 tall. */
  sparkle: (c: string) =>
    `<path d="M0-20C1.5-8.2 3.4-3.4 20 0 3.4 3.4 1.5 8.2 0 20-1.5 8.2-3.4 3.4-20 0-3.4-3.4-1.5-8.2 0-20Z" fill="${c}"/>`,
  /** Eighth note, ~40 tall. */
  note: (c: string) =>
    `<g fill="${c}"><ellipse cx="-5" cy="12" rx="9" ry="7" transform="rotate(-22 -5 12)"/><rect x="0.6" y="-21" width="4.6" height="33" rx="2.3"/><path d="M2.9-21.2C11-18.8 17.5-13.4 15.6-3.2 13.6-8.4 9-10 2.9-10.2Z"/></g>` +
    gloss(-8, 9.5, 3, 1.7, -22, 0.45),
  /** Two beamed eighth notes, ~42 wide × 40 tall. */
  beamNote: (c: string) =>
    `<g fill="${c}"><ellipse cx="-13" cy="13" rx="8.2" ry="6.4" transform="rotate(-22 -13 13)"/><ellipse cx="11" cy="8.5" rx="8.2" ry="6.4" transform="rotate(-22 11 8.5)"/><rect x="-9.4" y="-16" width="4.3" height="29" rx="2.15"/><rect x="14.6" y="-20.5" width="4.3" height="29" rx="2.15"/><path d="M-9.4-17.6 18.9-23V-15.2L-9.4-9.8Z"/></g>` +
    gloss(-16, 10.5, 2.8, 1.6, -22, 0.45) +
    gloss(8, 6, 2.8, 1.6, -22, 0.45),
  /** Tear / sweat drop, point up, 18 wide × 24 tall. */
  drop: (c: string) =>
    `<path d="M0-14C3.6-8 9-2.6 9 3.6A9 9 0 0 1-9 3.6C-9-2.6-3.6-8 0-14Z" fill="${c}"/>` + gloss(-3.4, 3.6, 2, 3.3, 20, 0.6),
  /** Rounded stroke (excitement line), centred, vertical. */
  line: (c: string, len = 26, w = 8) => `<rect x="${-w / 2}" y="${-len / 2}" width="${w}" height="${len}" rx="${w / 2}" fill="${c}"/>`,
  /** Soft five-point star with rounded tips, ~40 across. */
  star: (c: string) =>
    `<path d="M0-18.5 5.4-7.4 17.6-5.7 8.8 2.8 10.9 15 0 9.2-10.9 15-8.8 2.8-17.6-5.7-5.4-7.4Z" fill="${c}" stroke="${c}" stroke-width="4" stroke-linejoin="round"/>` +
    gloss(-5.2, -4.4, 3, 1.8, -30, 0.5),
  z: (c: string) =>
    `<path d="M-8.5-9H8.5L-8.5 9H8.5" fill="none" stroke="${c}" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"/>`,
  question: (c: string) =>
    `<path d="M-9.5-13C-9.5-21 -4-24.5 0.8-24.5 7.2-24.5 11-20 11-14.6 11-6.8 1.2-6 1.2 2.6" fill="none" stroke="${c}" stroke-width="7" stroke-linecap="round" stroke-linejoin="round"/><circle cx="1.2" cy="15" r="4.4" fill="${c}"/>`,
  exclaim: (c: string) =>
    `<path d="M-4.6-24.5H4.6L3.2 4.5H-3.2Z" fill="${c}" stroke="${c}" stroke-width="3" stroke-linejoin="round"/><circle cx="0" cy="14.5" r="4.8" fill="${c}"/>`,
  /** Dust puff: two-tone round cloud, r ≈ 14. */
  puff: (c: string, hi = '#f4f1f9') => `<circle r="14" fill="${c}"/><circle cx="-4" cy="-4.5" r="7.5" fill="${hi}" opacity=".7"/>`,
  confetti: (c: string, kind: number) =>
    kind === 0
      ? `<rect x="-6.5" y="-3.4" width="13" height="6.8" rx="1.6" fill="${c}"/>`
      : kind === 1
        ? `<circle r="4.6" fill="${c}"/>`
        : kind === 2
          ? `<path d="M0-6 5.6 4H-5.6Z" fill="${c}" stroke="${c}" stroke-width="2" stroke-linejoin="round"/>`
          : `<path d="M-8 0C-5-4-2-4 0 0S5 4 8 0" fill="none" stroke="${c}" stroke-width="3.6" stroke-linecap="round"/>`,
  /** Comic anger vein (four bent brackets), ~34 across. */
  anger: (c: string) =>
    `<g fill="none" stroke="${c}" stroke-width="5.6" stroke-linecap="round" stroke-linejoin="round">` +
    [0, 90, 180, 270].map((r) => `<path d="M4-16C4-9 6-4.5 16-4.5" transform="rotate(${r})"/>`).join('') +
    `</g>`,
  /** Green check badge, r = 24. */
  check: (c: string) =>
    `<circle r="24" fill="${c}"/><path d="M-10.5 0.5-3.2 8 11.5-7.5" fill="none" stroke="#fff" stroke-width="6.4" stroke-linecap="round" stroke-linejoin="round"/>` +
    gloss(-11, -12.5, 5.5, 3, -35, 0.35),
  /** "+10" drawn with strokes (no fonts), ~56 wide. */
  xp: (c: string, shade: string) => {
    const glyphs = `<path d="M-25 0H-9M-17-8V8M0-9 6.5-13V13"/><ellipse cx="20.5" cy="0" rx="7.5" ry="12.5"/>`;
    return (
      `<g fill="none" stroke-linecap="round" stroke-linejoin="round" stroke-width="6.4">` +
      `<g stroke="${shade}" transform="translate(0 3)">${glyphs}</g><g stroke="${c}">${glyphs}</g></g>`
    );
  },
  /** Typing / thinking bubble with three dots (dots are separate particles). */
  bubble: (c: string) =>
    `<path d="M-44-6C-44-26-26-38 0-38S44-26 44-6 26 26 0 26C-6 26-11 25.4-16 24.2-20.5 29-27 32.5-35 33-31 29.6-29 25.8-28.4 20.6-38.4 15-44 5.4-44-6Z" fill="${c}"/>` +
    gloss(-26, -22, 7, 3.6, -30, 0.55),
  /** A soft shine: tapered rays plus a radial glow, radius ≈ 150. */
  shine: (c: string, rays = 12) => {
    let s = `<defs><radialGradient id="om-fx-shine-glow"><stop offset="0" stop-color="${c}" stop-opacity=".75"/><stop offset=".45" stop-color="${c}" stop-opacity=".35"/><stop offset="1" stop-color="${c}" stop-opacity="0"/></radialGradient>`;
    s += `<radialGradient id="om-fx-shine-ray" cx="0" cy="0" r="150" gradientUnits="userSpaceOnUse"><stop offset=".25" stop-color="${c}" stop-opacity=".9"/><stop offset="1" stop-color="${c}" stop-opacity="0"/></radialGradient></defs>`;
    s += `<circle r="120" fill="url(#om-fx-shine-glow)"/><g fill="url(#om-fx-shine-ray)">`;
    for (let i = 0; i < rays; i++) {
      const a = (i / rays) * 360;
      const long = i % 2 === 0;
      const R = long ? 155 : 115;
      const w = long ? 13 : 9;
      s += `<path d="M0 0L${-w} ${-R}Q0 ${-R - w} ${w} ${-R}Z" transform="rotate(${a})"/>`;
    }
    return s + `</g>`;
  },
  /** Wind swoosh with a curl at the end, ~64 wide. */
  wind: (c: string) =>
    `<path d="M-34 6C-16 8 4 4 18-4 27-9 31-17 24-21 18-24.5 12-19 15.5-14" fill="none" stroke="${c}" stroke-width="6.5" stroke-linecap="round" stroke-linejoin="round"/>`,
  /** Speed streak, horizontal, centred. */
  streak: (c: string, len = 60, w = 6) => `<rect x="${-len / 2}" y="${-w / 2}" width="${len}" height="${w}" rx="${w / 2}" fill="${c}"/>`,
};

/* ------------------------------------------------------------------ */
/* Palettes & helpers                                                  */
/* ------------------------------------------------------------------ */

const PINKS = ['#ff5c8a', '#ff4f84', '#ff6b98'];
const GOLD = '#ffc21a';
const BLUE = '#4fb3ff';
const CONFETTI = ['#ff5c8a', '#ffc21a', '#4fb3ff', '#58cc02', '#a77bff', '#ff8a3d'];

const pick = <T,>(arr: T[], r: () => number) => arr[Math.floor(r() * arr.length) % arr.length];
const clamp01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v);
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const easeOut = (t: number) => 1 - Math.pow(1 - clamp01(t), 3);
const easeOutQuint = (t: number) => 1 - Math.pow(1 - clamp01(t), 5);
/** Side param → -1, 1 or 0 (both). */
const sideOf = (v: unknown, d: number) => {
  const s = num(v, d);
  return s === 0 ? 0 : s < 0 ? -1 : 1;
};
const colorParam = (v: unknown): string | undefined => (typeof v === 'string' ? v : undefined);

/**
 * Pop scale for a particle that should appear with a springy overshoot and
 * leave quickly: snappy (≈0.12–0.18s) in-time regardless of total life.
 */
function popIn(age: number, life: number, inSec = 0.16, outSec = 0.25): number {
  const u = age / life;
  return popEnvelope(u, Math.min(0.45, inSec / life), Math.min(0.5, outSec / life));
}
/** Opacity that holds full and fades over the last `outSec` seconds. */
function fadeOut(age: number, life: number, outSec = 0.3, inSec = 0.04): number {
  return fadeEnvelope(age / life, Math.min(0.4, inSec / life), Math.min(0.6, outSec / life));
}

/* ------------------------------------------------------------------ */
/* Emotion effects                                                     */
/* ------------------------------------------------------------------ */

/** Hearts drifting upward with a gentle sway (love / affection). */
const hearts: EffectDef = {
  name: 'hearts',
  description: 'Big pink hearts pop in around the top of the head, float up with a sway and pop away (love, affection). Params: count, color, spread, size.',
  defaultAnchor: 'head',
  spawn: ({ random, params, scale }) => {
    const count = Math.max(1, Math.round(num(params.count, 3)));
    const spread = num(params.spread, 100) * scale;
    const size = num(params.size, 1) * scale;
    // size tiers like the reference: one big, one medium, one small, repeat
    const tiers = [1.3, 1.0, 0.68];
    const out: ParticleSpec[] = [];
    for (let i = 0; i < count; i++) {
      const t = count === 1 ? 0.5 : i / (count - 1);
      const a = lerp(-155, -25, t) * (Math.PI / 180) + (random() - 0.5) * 0.25;
      const r = spread * (0.85 + random() * 0.3);
      const x0 = Math.cos(a) * r;
      const y0 = Math.sin(a) * r * 0.75 - 10 * scale;
      const s = size * tiers[(i * 2 + (count > 3 ? Math.floor(random() * 3) : 0)) % 3] * (0.92 + random() * 0.16);
      const sway = (5 + random() * 6) * scale * (random() < 0.5 ? -1 : 1);
      const rise = (55 + random() * 35) * scale;
      const tilt = Math.cos(a) * 16;
      const life = 1.5 + random() * 0.5;
      const color = str(params.color, pick(PINKS, random));
      out.push({
        markup: SHAPES.heart(color),
        delay: [0, 0.16, 0.08][i % 3] + Math.floor(i / 3) * 0.24 + random() * 0.05,
        life,
        at: (u, age) => {
          const beat = 1 + 0.06 * Math.sin(age * 11) * Math.min(1, age * 3);
          return {
            x: x0 + Math.sin(age * 4.2) * sway + Math.cos(a) * u * 14 * scale,
            y: y0 - easeOut(u * 1.1) * rise * 0.6 - u * rise * 0.4,
            rot: tilt + Math.sin(age * 4.2 + 1) * 9,
            scale: s * popIn(age, life, 0.18, 0.3) * beat,
            opacity: fadeOut(age, life, 0.2),
          };
        },
      });
    }
    return out;
  },
};

/** A ring of small hearts popping outward (big love moment). */
const heartBurst: EffectDef = {
  name: 'heart-burst',
  description: 'A ring of small hearts bursts outward from the anchor and fades (big love moment, "liked!"). Params: count, color, spread, size.',
  defaultAnchor: 'head',
  spawn: ({ random, params, scale }) => {
    const count = Math.max(3, Math.round(num(params.count, 8)));
    const radius = num(params.spread, 150) * scale;
    const size = num(params.size, 1) * scale;
    const out: ParticleSpec[] = [];
    const phase = random() * Math.PI * 2;
    for (let i = 0; i < count; i++) {
      const a = phase + (i / count) * Math.PI * 2 + (random() - 0.5) * 0.2;
      const r = radius * (0.85 + random() * 0.25);
      const s = size * (0.55 + random() * 0.2);
      const life = 0.85 + random() * 0.2;
      const spin = (random() - 0.5) * 50;
      out.push({
        markup: SHAPES.heart(str(params.color, pick(PINKS, random))),
        delay: random() * 0.04,
        life,
        at: (u, age) => {
          const d = easeOutQuint(age / 0.7) * r;
          return {
            x: Math.cos(a) * d,
            y: Math.sin(a) * d * 0.85 + u * u * 14 * scale,
            rot: Math.cos(a) * 25 + spin * u,
            scale: s * popIn(age, life, 0.14, 0.4),
            opacity: fadeOut(age, life, 0.35),
          };
        },
      });
    }
    // a centre heart that thumps
    out.push({
      markup: SHAPES.heart(str(params.color, PINKS[0])),
      life: 0.55,
      at: (u, age) => ({ x: 0, y: -4 * scale, scale: size * 0.9 * popIn(age, 0.55, 0.12, 0.3), opacity: fadeOut(age, 0.55, 0.2) }),
    });
    return out;
  },
};

/** Twinkling four-point sparkles around the anchor (pride, success, magic). */
const sparkles: EffectDef = {
  name: 'sparkles',
  description: 'Gold four-point sparkles of varied sizes pop and twinkle around the head (pride, success, magic). Params: count, color, spread, size.',
  defaultAnchor: 'head',
  spawn: ({ random, params, scale }) => {
    const count = Math.max(1, Math.round(num(params.count, 4)));
    const radius = num(params.spread, 130) * scale;
    const size = num(params.size, 1) * scale;
    const color = str(params.color, GOLD);
    // reference composition (relative to the head anchor, spread 130): big above,
    // medium left, medium right + small right
    const layout: [number, number, number][] = [
      [0.12, -1.0, 1.05],
      [-0.92, -0.5, 0.8],
      [0.94, -0.42, 1.0],
      [1.16, -0.16, 0.6],
      [-0.6, -0.95, 0.55],
      [-1.12, -0.12, 0.5],
      [0.55, -1.02, 0.6],
    ];
    const out: ParticleSpec[] = [];
    for (let i = 0; i < count; i++) {
      let px: number;
      let py: number;
      let ps: number;
      if (i < layout.length) [px, py, ps] = layout[i];
      else {
        const a = -Math.PI * (0.05 + random() * 0.9);
        px = Math.cos(a) * 1.1;
        py = Math.sin(a) * 0.95;
        ps = 0.45 + random() * 0.5;
      }
      const x = px * radius + (random() - 0.5) * 12 * scale;
      const y = py * radius + (random() - 0.5) * 12 * scale;
      const s = size * ps * 1.12 * (0.9 + random() * 0.2);
      const tw = 5 + random() * 4;
      const life = 1.1 + random() * 0.45;
      const ph = random() * 6;
      out.push({
        markup: SHAPES.sparkle(color),
        delay: [0, 0.1, 0.05, 0.16, 0.22, 0.12, 0.28][i % 7] + random() * 0.04,
        life,
        at: (u, age) => ({
          x,
          y: y - u * 8 * scale,
          rot: Math.sin(age * 3 + ph) * 12,
          scale: s * popIn(age, life, 0.18, 0.28) * (0.88 + 0.12 * Math.cos(age * tw + ph)),
        }),
      });
    }
    return out;
  },
};

/** Five-point stars for success. */
const stars: EffectDef = {
  name: 'stars',
  description: 'Gold five-point stars pop out around the character with a spin and settle, then shrink away (success, level up). Params: count, color, spread, size.',
  defaultAnchor: 'head',
  spawn: ({ random, params, scale }) => {
    const count = Math.max(1, Math.round(num(params.count, 5)));
    const radius = num(params.spread, 140) * scale;
    const size = num(params.size, 1) * scale;
    const out: ParticleSpec[] = [];
    for (let i = 0; i < count; i++) {
      const t = count === 1 ? 0.5 : i / (count - 1);
      const a = lerp(-170, -10, t) * (Math.PI / 180) + (random() - 0.5) * 0.2;
      const r = radius * (i % 2 === 0 ? 1 : 0.82) * (0.95 + random() * 0.15);
      const s = size * (i % 2 === 0 ? 0.95 : 0.65) * (0.9 + random() * 0.2);
      const spin = (random() < 0.5 ? -1 : 1) * (140 + random() * 80);
      const life = 1.2 + random() * 0.3;
      const color = str(params.color, i % 3 === 1 ? '#ffd84d' : GOLD);
      out.push({
        markup: SHAPES.star(color),
        delay: i * 0.05 + random() * 0.04,
        life,
        at: (u, age) => {
          const k = easeOutQuint(age / 0.45);
          return {
            x: Math.cos(a) * r * (0.35 + 0.65 * k),
            y: Math.sin(a) * r * 0.85 * (0.35 + 0.65 * k) + u * u * 10 * scale,
            rot: spin * (1 - Math.pow(1 - clamp01(age / 0.6), 3)) + Math.sin(age * 5) * 6,
            scale: s * popIn(age, life, 0.2, 0.3),
          };
        },
      });
    }
    return out;
  },
};

/** Music notes rising diagonally with a swing (singing, dancing). */
const notes: EffectDef = {
  name: 'notes',
  description: 'Light-blue eighth and beamed notes rise beside the head, swinging (singing, humming, dancing). Params: count, color, side, size.',
  defaultAnchor: 'head',
  spawn: ({ random, params, scale }) => {
    const count = Math.max(1, Math.round(num(params.count, 2)));
    const side = sideOf(params.side, 1) || 1;
    const size = num(params.size, 1) * scale;
    const color = str(params.color, BLUE);
    const out: ParticleSpec[] = [];
    for (let i = 0; i < count; i++) {
      const beam = i % 2 === 1;
      const x0 = side * (100 + (i % 2) * 34 + random() * 10) * scale;
      const y0 = (-92 + (i % 2) * 36 - Math.floor(i / 2) * 10) * scale;
      const s = size * (beam ? 0.95 : 0.9) * (0.92 + random() * 0.16);
      const life = 1.6 + random() * 0.4;
      const ph = random() * 6;
      out.push({
        markup: beam ? SHAPES.beamNote(color) : SHAPES.note(color),
        delay: i * 0.22 + random() * 0.06,
        life,
        at: (u, age) => ({
          x: x0 + side * u * 40 * scale + Math.sin(age * 5 + ph) * 5 * scale,
          y: y0 - u * 60 * scale,
          rot: side * 6 + Math.sin(age * 6 + ph) * 13,
          scale: s * popIn(age, life, 0.18, 0.3),
          opacity: fadeOut(age, life, 0.3),
        }),
      });
    }
    return out;
  },
};

/** Several notes radiating out (song completion). */
const musicBurst: EffectDef = {
  name: 'music-burst',
  description: 'A fan of music notes bursts out around the head and drifts away (song completed, big musical moment). Params: count, color, spread, size.',
  defaultAnchor: 'head',
  spawn: ({ random, params, scale }) => {
    const count = Math.max(2, Math.round(num(params.count, 6)));
    const radius = num(params.spread, 150) * scale;
    const size = num(params.size, 1) * scale;
    const palette = colorParam(params.color) ? [colorParam(params.color)!] : [BLUE, '#8f7cc4', BLUE, '#ff5c8a'];
    const out: ParticleSpec[] = [];
    for (let i = 0; i < count; i++) {
      const t = i / (count - 1);
      const a = lerp(-175, -5, t) * (Math.PI / 180) + (random() - 0.5) * 0.15;
      const r = radius * (0.9 + random() * 0.25);
      const s = size * (0.75 + random() * 0.3);
      const life = 1.3 + random() * 0.3;
      const ph = random() * 6;
      const color = palette[i % palette.length];
      out.push({
        markup: i % 2 ? SHAPES.beamNote(color) : SHAPES.note(color),
        delay: Math.abs(t - 0.5) * 0.12 + random() * 0.04,
        life,
        at: (u, age) => {
          const k = easeOutQuint(age / 0.6);
          return {
            x: Math.cos(a) * r * (0.3 + 0.7 * k) + Math.sin(age * 6 + ph) * 4 * scale,
            y: Math.sin(a) * r * 0.85 * (0.3 + 0.7 * k) - u * 30 * scale,
            rot: Math.cos(a) * 18 + Math.sin(age * 7 + ph) * 12,
            scale: s * popIn(age, life, 0.16, 0.3),
            opacity: fadeOut(age, life, 0.3),
          };
        },
      });
    }
    return out;
  },
};

/** Sweat drops flicking off the side of the head (nervous, embarrassed, effort). */
const sweat: EffectDef = {
  name: 'sweat',
  description: 'Two light-blue sweat drops flick off the side of the head and fall (nervous, embarrassed, effort). Params: count, color, side, size.',
  defaultAnchor: 'head',
  follow: true,
  spawn: ({ random, params, scale }) => {
    const side = sideOf(params.side, 1) || 1;
    const count = Math.max(1, Math.round(num(params.count, 2)));
    const color = str(params.color, '#5cc8f5');
    const size = num(params.size, 1) * scale;
    const out: ParticleSpec[] = [];
    for (let i = 0; i < count; i++) {
      const x0 = side * (100 + i * 16) * scale;
      const y0 = (-46 + i * 30) * scale;
      const vx = side * (34 + random() * 14) * scale;
      const life = 0.9 + random() * 0.15;
      const s = size * (i === 0 ? 1.2 : 0.9) * (0.92 + random() * 0.16);
      out.push({
        markup: SHAPES.drop(color),
        delay: i * 0.1,
        life,
        at: (u, age) => {
          const t = Math.max(0, age - 0.12);
          return {
            x: x0 + vx * t,
            y: y0 - 26 * scale * t + 90 * scale * t * t,
            // tail points back toward the head, tipping downward as it falls
            rot: -side * 55 + side * clamp01(t / 0.6) * 70,
            scale: s * popIn(age, life, 0.14, 0.25),
            opacity: fadeOut(age, life, 0.25),
          };
        },
      });
    }
    return out;
  },
};

/** Tears welling and dripping from both eyes (sad). Anchor: `head`. */
const tears: EffectDef = {
  name: 'tears',
  description: 'Tears well up at the bottom of both eyes and roll down the cheeks (sad, crying). Params: count (per eye), color, size, eyeX/eyeY (eye centre relative to the anchor), duration.',
  defaultAnchor: 'head',
  follow: true,
  spawn: ({ random, params, scale }) => {
    const color = str(params.color, '#4fa8ff');
    const count = Math.max(1, Math.round(num(params.count, 3)));
    const eyeX = num(params.eyeX, 43) * scale;
    const eyeY = num(params.eyeY, 25) * scale;
    const size = num(params.size, 1) * scale;
    const every = 0.5;
    const total = num(params.duration, count * every + 0.6);
    const out: ParticleSpec[] = [];
    for (const side of [-1, 1]) {
      // pooled tear along the lower lid
      out.push({
        markup: `<path d="M-15-1.5C-9 3-3 4.2 0 4.2S9 3 15-1.5C14 4.5 8 8.6 0 8.6S-14 4.5-15-1.5Z" fill="${color}"/>`,
        life: total,
        at: (u, age) => ({
          x: side * (eyeX + 1 * scale),
          y: eyeY + 16 * scale,
          sx: size * popIn(age, total, 0.25, 0.3),
          sy: size * popIn(age, total, 0.25, 0.3) * (1 + 0.12 * Math.sin(age * 9)),
          opacity: fadeOut(age, total, 0.3) * 0.95,
        }),
      });
      for (let k = 0; k < count; k++) {
        const life = 0.95 + random() * 0.15;
        const wobble = (random() - 0.5) * 6 * scale;
        const xs = side * (eyeX + (8 + random() * 6) * scale);
        out.push({
          markup: SHAPES.drop(color),
          delay: 0.15 + k * every + random() * 0.12 + (side > 0 ? 0.12 : 0),
          life,
          at: (u, age) => {
            const well = clamp01(age / 0.22);
            const t = Math.max(0, age - 0.22);
            return {
              x: xs + side * t * 10 * scale + wobble * t,
              y: eyeY + 20 * scale + 34 * scale * t + 120 * scale * t * t,
              sx: size * 0.82 * easeOut(well),
              sy: size * 0.82 * (0.4 + 0.6 * easeOut(well)) * (1 + clamp01(t * 3) * 0.12),
              opacity: fadeOut(age, life, 0.3),
            };
          },
        });
      }
    }
    return out;
  },
};

/** Short excitement strokes radiating from beside the ears (surprise, joy). */
const burst: EffectDef = {
  name: 'burst',
  description: 'Two pairs of short, thick yellow excitement strokes flash out above the ears (surprise, excitement, "aha!"). Params: color, spread, size, side (0 = both).',
  defaultAnchor: 'head',
  follow: true,
  spawn: ({ params, scale }) => {
    const color = str(params.color, GOLD);
    const k = (num(params.spread, 100) / 100) * scale;
    const size = num(params.size, 1) * scale;
    const only = sideOf(params.side, 0);
    const life = num(params.duration, 0.7);
    // [x, y, angle-from-horizontal (deg, pointing outward), length]
    const layout: [number, number, number, number][] = [
      [104, -96, -58, 28],
      [126, -62, -18, 25],
    ];
    const out: ParticleSpec[] = [];
    for (const side of [-1, 1]) {
      if (only && side !== only) continue;
      layout.forEach(([x, y, deg, len], i) => {
        const a = (deg * Math.PI) / 180;
        const dx = Math.cos(a) * side;
        const dy = Math.sin(a);
        out.push({
          markup: SHAPES.line(color, len, 8.5),
          delay: i * 0.04,
          life,
          at: (u, age) => {
            const push = easeOutQuint(age / 0.25) * 14 * k - 14 * k;
            const grow = popIn(age, life, 0.14, 0.2);
            const pulse = age < 0.45 ? 1 : 1 + 0.08 * Math.sin((age - 0.45) * 20);
            return {
              x: side * x * k + dx * push,
              y: y * k + dy * push,
              rot: side * (90 + deg),
              sx: size * Math.min(1, grow * 1.2),
              sy: size * grow * pulse,
              opacity: fadeOut(age, life, 0.15),
            };
          },
        });
      });
    }
    return out;
  },
};

/** Comic anger vein (grumpy). */
const anger: EffectDef = {
  name: 'anger',
  description: 'A red comic anger-vein mark throbs at the upper corner of the head (grumpy, annoyed). Params: color, side, size, duration.',
  defaultAnchor: 'head',
  follow: true,
  spawn: ({ params, scale }) => {
    const color = str(params.color, '#ff4b4b');
    const side = sideOf(params.side, 1) || 1;
    const size = num(params.size, 1) * scale;
    const life = num(params.duration, 1.4);
    return [
      {
        markup: SHAPES.anger(color),
        life,
        at: (u, age) => {
          const throb = 1 + 0.16 * Math.max(0, Math.sin(age * 15)) * clamp01(age / 0.2);
          return {
            x: side * 76 * scale,
            y: -56 * scale,
            rot: side * 12,
            scale: size * 1.45 * popIn(age, life, 0.16, 0.2) * throb,
          };
        },
      },
    ];
  },
};

/** Sleepy Zs drifting up (sleep). */
const zzz: EffectDef = {
  name: 'zzz',
  description: 'Purple Z letters drift up and away from the head, growing as they go (sleeping). Params: count, color, side, size.',
  defaultAnchor: 'head',
  spawn: ({ params, scale }) => {
    const color = str(params.color, '#8f7cc4');
    const count = Math.max(1, Math.round(num(params.count, 3)));
    const side = sideOf(params.side, 1) || 1;
    const size = num(params.size, 1) * scale;
    return Array.from({ length: count }, (_, i) => ({
      markup: SHAPES.z(color),
      delay: i * 0.6,
      life: 2.1,
      at: (u: number, age: number) => ({
        x: side * (100 + u * 60) * scale + Math.sin(age * 3) * 8 * scale,
        y: (-62 - u * 100) * scale,
        rot: side * (-12 + Math.sin(age * 2.5) * 12),
        scale: size * (1.1 + u * 0.9) * popIn(age, 2.1, 0.2, 0.4),
        opacity: fadeOut(age, 2.1, 0.6),
      }),
    }));
  },
};

/** Stars orbiting above the head (dizzy). */
const dizzy: EffectDef = {
  name: 'dizzy',
  description: 'Little gold stars circle above the head on a tilted orbit (dizzy, dazed). Params: count, color, spread, size, duration.',
  defaultAnchor: 'head',
  follow: true,
  spawn: ({ params, scale }) => {
    const color = str(params.color, GOLD);
    const count = Math.max(1, Math.round(num(params.count, 3)));
    const dur = num(params.duration, 2.2);
    const radius = num(params.spread, 80) * scale;
    const size = num(params.size, 1) * scale;
    return Array.from({ length: count }, (_, i) => ({
      markup: SHAPES.star(color),
      life: dur,
      at: (u: number, age: number) => {
        const a = age * 5 + (i / count) * Math.PI * 2;
        const depth = Math.sin(a);
        return {
          x: Math.cos(a) * radius,
          y: (-88 + depth * 16) * scale + Math.cos(a) * 8 * scale,
          scale: size * (0.72 + depth * 0.16) * popIn(age, dur, 0.18, 0.2),
          rot: age * 160,
          opacity: 0.8 + depth * 0.2,
        };
      },
    }));
  },
};

/** A bobbing question mark (confused, thinking). */
const question: EffectDef = {
  name: 'question',
  description: 'A purple question mark pops up beside the head and bobs (confused, curious). Params: color, side, size, duration.',
  defaultAnchor: 'head',
  follow: true,
  spawn: ({ params, scale }) => {
    const color = str(params.color, '#8f7cc4');
    const side = sideOf(params.side, 1) || 1;
    const size = num(params.size, 1) * scale;
    const life = num(params.duration, 1.6);
    return [
      {
        markup: SHAPES.question(color),
        life,
        at: (u: number, age: number) => ({
          x: side * 108 * scale,
          y: (-92 + Math.sin(age * 5) * 4) * scale,
          rot: side * (14 + Math.sin(age * 4) * 7),
          scale: size * 1.15 * popIn(age, life, 0.18, 0.2),
        }),
      },
    ];
  },
};

/** An exclamation mark (alert, surprise). */
const exclaim: EffectDef = {
  name: 'exclaim',
  description: 'An orange exclamation mark jolts up beside the head with a quick shake (alert, surprise). Params: color, side, size, duration.',
  defaultAnchor: 'head',
  follow: true,
  spawn: ({ params, scale }) => {
    const color = str(params.color, '#ff8a3d');
    const side = sideOf(params.side, 1) || 1;
    const size = num(params.size, 1) * scale;
    const life = num(params.duration, 1.1);
    return [
      {
        markup: SHAPES.exclaim(color),
        life,
        at: (u: number, age: number) => {
          const shake = Math.sin(age * 40) * Math.max(0, 1 - age / 0.35);
          return {
            x: side * 102 * scale + shake * 3 * scale,
            y: -100 * scale - easeOut(age / 0.2) * 8 * scale,
            rot: side * 14 + shake * 10,
            scale: size * 1.2 * popIn(age, life, 0.14, 0.2),
          };
        },
      },
    ];
  },
};

/** Thinking / typing bubble with three bouncing dots. */
const bubble: EffectDef = {
  name: 'bubble',
  description: 'A round speech bubble pops up beside the head with three dots bouncing in sequence (thinking, typing…). Params: color (bubble), dotColor, side, size, duration.',
  defaultAnchor: 'head',
  follow: true,
  spawn: ({ params, scale }) => {
    const color = str(params.color, '#e9e2f7');
    const dot = str(params.dotColor, '#8f7cc4');
    const side = sideOf(params.side, 1) || 1;
    const size = num(params.size, 1.1) * scale;
    const life = num(params.duration, 2.4);
    const bx = side * 128 * scale;
    const by = -102 * scale;
    const bob = (age: number) => Math.sin(age * 3) * 3 * scale;
    const out: ParticleSpec[] = [
      {
        markup: SHAPES.bubble(color),
        life,
        at: (u, age) => ({
          x: bx,
          y: by + bob(age),
          sx: side * size * popIn(age, life, 0.2, 0.22),
          sy: size * popIn(age, life, 0.2, 0.22),
        }),
      },
    ];
    for (let i = 0; i < 3; i++) {
      out.push({
        markup: `<circle r="6" fill="${dot}"/>`,
        delay: 0.12 + i * 0.05,
        life: life - 0.12 - i * 0.05,
        at: (u, age) => {
          const ph = (age * 2.4 - i * 0.18) % 1;
          const hop = ph < 0.35 ? Math.sin((ph / 0.35) * Math.PI) : 0;
          const l = life - 0.12 - i * 0.05;
          return {
            x: bx + (i - 1) * 21 * size,
            y: by - 6 * size + bob(age + 0.12 + i * 0.05) - hop * 8 * size,
            scale: size * popIn(age, l, 0.14, 0.18) * (1 + hop * 0.12),
            opacity: 0.75 + hop * 0.25,
          };
        },
      });
    }
    return out;
  },
};

/** Green check badge (correct answer). */
const check: EffectDef = {
  name: 'check',
  description: 'A green check-mark badge pops in above the head with a spin and a ring of tiny rays, floats and fades (correct answer!). Params: color, side, size, duration.',
  defaultAnchor: 'head',
  follow: true,
  spawn: ({ params, scale }) => {
    const color = str(params.color, '#58cc02');
    const side = sideOf(params.side, 1);
    const size = num(params.size, 1) * scale;
    const life = num(params.duration, 1.5);
    const cx = side * 112 * scale;
    const cy = (side ? -96 : -130) * scale;
    const out: ParticleSpec[] = [
      {
        markup: SHAPES.check(color),
        life,
        at: (u, age) => ({
          x: cx,
          y: cy - u * 14 * scale,
          rot: -25 * Math.pow(1 - clamp01(age / 0.35), 3) * (side || 1) + Math.sin(age * 4) * 3,
          scale: size * 1.1 * popIn(age, life, 0.22, 0.25),
          opacity: fadeOut(age, life, 0.2),
        }),
      },
    ];
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2 + Math.PI / 8;
      out.push({
        markup: SHAPES.line(color, 11, 5),
        delay: 0.08,
        life: 0.42,
        at: (u, age) => {
          const r = (38 + easeOut(u) * 16) * size;
          return {
            x: cx + Math.cos(a) * r,
            y: cy + Math.sin(a) * r,
            rot: (a * 180) / Math.PI + 90,
            sy: size * (1 - u * 0.7),
            sx: size,
            opacity: 1 - u * u,
          };
        },
      });
    }
    return out;
  },
};

/** "+10" XP spark. */
const xp: EffectDef = {
  name: 'xp',
  description: 'A gold "+10" (drawn with strokes, no fonts) pops up above the head with two sparkles and rises away (XP gained). Params: color, side, size, duration.',
  defaultAnchor: 'head',
  follow: false,
  spawn: ({ params, scale }) => {
    const color = str(params.color, GOLD);
    const shade = str(params.shade, '#e39600');
    const side = sideOf(params.side, 0);
    const size = num(params.size, 1) * scale;
    const life = num(params.duration, 1.4);
    const cx = side * 100 * scale;
    const cy = -112 * scale;
    const out: ParticleSpec[] = [
      {
        markup: SHAPES.xp(color, shade),
        life,
        at: (u, age) => ({
          x: cx,
          y: cy - easeOut(age / 0.3) * 16 * scale - u * 36 * scale,
          rot: Math.sin(age * 6) * 3,
          scale: size * 1.25 * popIn(age, life, 0.2, 0.25),
          opacity: fadeOut(age, life, 0.3),
        }),
      },
    ];
    const sp: [number, number, number, number][] = [
      [40, -22, 0.5, 0.1],
      [-38, 14, 0.34, 0.18],
    ];
    for (const [dx, dy, s, d] of sp) {
      out.push({
        markup: SHAPES.sparkle(color),
        delay: d,
        life: 0.8,
        at: (u, age) => ({
          x: cx + dx * size,
          y: cy + dy * size - 16 * scale - u * 26 * scale,
          rot: u * 40,
          scale: size * s * popIn(age, 0.8, 0.15, 0.3),
        }),
      });
    }
    return out;
  },
};

/* ------------------------------------------------------------------ */
/* Celebration / ambience                                              */
/* ------------------------------------------------------------------ */

/** Confetti burst: shoots up from around the character and tumbles down. */
const confetti: EffectDef = {
  name: 'confetti',
  description: 'Colourful confetti (strips, dots, triangles, squiggles) bursts up from around the character, then flutters and tumbles down (celebration). Params: count, color, spread, size.',
  defaultAnchor: [0, -110],
  spawn: ({ random, params, scale }) => {
    const count = Math.max(1, Math.round(num(params.count, 40)));
    const width = num(params.spread, 1) * scale;
    const size = num(params.size, 1) * scale;
    const fixed = colorParam(params.color);
    const out: ParticleSpec[] = [];
    const k = 3; // drag
    const vt = 170 * scale; // terminal fall speed
    for (let i = 0; i < count; i++) {
      // fan of launch directions from straight up to ~65° either side
      const fan = (i / Math.max(1, count - 1)) * 2 - 1 + (random() - 0.5) * 0.15;
      const x0 = fan * 70 * scale;
      const y0 = (-random() * 40) * scale;
      const vx = (fan * 820 + (random() - 0.5) * 160) * scale * width;
      const vy = -(420 + random() * 420) * scale;
      const spin = (random() - 0.5) * 900;
      const flip = 7 + random() * 8;
      const color = fixed ?? CONFETTI[i % CONFETTI.length];
      const kind = random() < 0.55 ? 0 : Math.floor(random() * 3) + 1;
      const s = size * (1.1 + random() * 0.4);
      const flutter = (8 + random() * 10) * scale;
      const ph = random() * 6;
      const life = 2.1 + random() * 0.8;
      out.push({
        markup: SHAPES.confetti(color, kind),
        delay: random() * 0.06,
        life,
        behind: random() < 0.25,
        at: (u, age): ParticleState => {
          const e = 1 - Math.exp(-k * age);
          return {
            x: x0 + (vx * e) / k + Math.sin(age * 5 + ph) * flutter * clamp01(age * 1.5),
            y: y0 + vt * age + ((vy - vt) * e) / k,
            rot: spin * age,
            sx: s * Math.cos(age * flip + ph),
            sy: s * popIn(age, life, 0.08, 0.3),
            opacity: fadeOut(age, life, 0.4),
          };
        },
      });
    }
    return out;
  },
};

/** Soft radial shine behind the character. */
const shine: EffectDef = {
  name: 'shine',
  description: 'A soft golden glow with slowly turning rays blooms behind the character (reveal, triumph, special moment). Params: color, size, duration, count (rays).',
  defaultAnchor: [0, -125],
  spawn: ({ params, scale }) => {
    const color = str(params.color, '#ffd84d');
    const size = num(params.size, 1) * scale;
    const life = num(params.duration, 1.8);
    const rays = Math.max(6, Math.round(num(params.count, 14)));
    return [
      {
        markup: SHAPES.shine(color, rays),
        behind: true,
        life,
        at: (u, age) => ({
          x: 0,
          y: 0,
          rot: age * 22,
          scale: size * 1.25 * popIn(age, life, 0.3, 0.45) * (1 + 0.03 * Math.sin(age * 6)),
          opacity: fadeOut(age, life, 0.5, 0.1),
        }),
      },
    ];
  },
};

/** Motion streaks for fast moves / spins. */
const speedLines: EffectDef = {
  name: 'speed-lines',
  description: 'Horizontal motion streaks zip out from the trailing side of the character in quick waves (dashes, fast moves, spins). Params: side (side the streaks trail on: -1 left, 1 right, 0 both), count (per wave), color, size, spread, duration.',
  defaultAnchor: 'body',
  follow: true,
  spawn: ({ random, params, scale }) => {
    const side = sideOf(params.side, -1);
    const count = Math.max(1, Math.round(num(params.count, 4)));
    const color = str(params.color, '#b9add6');
    const size = num(params.size, 1) * scale;
    const spread = num(params.spread, 150) * scale;
    const duration = num(params.duration, 0.6);
    const waves = Math.max(1, Math.round(duration / 0.2));
    const out: ParticleSpec[] = [];
    const sides = side === 0 ? [-1, 1] : [side];
    for (const sd of sides) {
      for (let w = 0; w < waves; w++) {
        for (let i = 0; i < count; i++) {
          const t = count === 1 ? 0.5 : (i + (w % 2) * 0.5) / count;
          const y = lerp(-spread * 0.55, spread * 0.45, t) + (random() - 0.5) * 14 * scale;
          const len = (55 + random() * 55) * size * (1 - Math.abs(t - 0.45) * 0.7);
          const x0 = sd * (120 + random() * 40) * scale;
          const life = 0.36 + random() * 0.12;
          const thick = 0.8 + random() * 0.45;
          out.push({
            markup: SHAPES.streak(color, 60, 7),
            delay: w * 0.2 + random() * 0.1,
            life,
            at: (u) => ({
              x: x0 + sd * (easeOut(u) * 80 * scale + (len / 2) * u),
              y,
              sx: (len / 60) * Math.sin(Math.PI * Math.min(1, u * 1.1)) + 0.05,
              sy: size * thick * (1 - u * 0.4),
              opacity: 1 - u * u,
            }),
          });
        }
      }
    }
    return out;
  },
};

/** Wind swooshes for wing flaps. */
const wind: EffectDef = {
  name: 'wind',
  description: 'Curly wind swooshes peel off the wing tips and sweep outward-down (wing flaps, take-off, gusts). Params: side (0 both, -1/1 one wing), count (per side), color, size.',
  defaultAnchor: 'body',
  spawn: ({ random, params, scale }) => {
    const side = sideOf(params.side, 0);
    const count = Math.max(1, Math.round(num(params.count, 2)));
    const color = str(params.color, '#9fcdf2');
    const size = num(params.size, 1) * scale;
    const out: ParticleSpec[] = [];
    const sides = side === 0 ? [-1, 1] : [side];
    for (const sd of sides) {
      for (let i = 0; i < count; i++) {
        const x0 = sd * (172 + i * 16 + random() * 10) * scale;
        const y0 = (-2 + i * 40 + random() * 8) * scale;
        const life = 0.65 + random() * 0.15;
        const s = size * (1 - i * 0.18);
        out.push({
          markup: SHAPES.wind(color),
          delay: i * 0.07 + random() * 0.03,
          life,
          at: (u) => {
            const k = easeOut(u);
            return {
              x: x0 + sd * k * 50 * scale,
              y: y0 + k * 28 * scale,
              rot: sd * (18 + k * 12),
              // mirror for the left side so the curl trails outward
              sx: -sd * s * (0.35 + 0.65 * easeOut(u * 2.2)),
              sy: s * (1 - u * 0.25),
              opacity: fadeEnvelope(u, 0.08, 0.45),
            };
          },
        });
      }
    }
    return out;
  },
};

/** Dust puffs at the feet (landing, stomping). */
const puff: EffectDef = {
  name: 'puff',
  description: 'Chunky dust clouds billow out sideways from the feet and dissolve (landing, stomping, dashing off). Params: count, color, spread, size, side (0 both).',
  defaultAnchor: [0, 0],
  spawn: ({ random, params, scale }) => {
    const color = str(params.color, '#cfc6df');
    const hi = str(params.highlight, '#f1edf7');
    const count = Math.max(1, Math.round(num(params.count, 8)));
    const spread = num(params.spread, 100) * scale;
    const size = num(params.size, 1) * scale;
    const only = sideOf(params.side, 0);
    return Array.from({ length: count }, (_, i) => {
      const side = only || (i % 2 === 0 ? -1 : 1);
      const k = only ? i : Math.floor(i / 2);
      const n = only ? count : Math.ceil(count / 2);
      const t = n <= 1 ? 0 : k / (n - 1);
      const dist = spread * (0.3 + t * 0.7 + random() * 0.1);
      const s = size * (1.6 - t * 0.6 + random() * 0.2);
      const lift = (8 + t * 22 + random() * 6) * scale;
      const life = 0.6 + random() * 0.2 + t * 0.1;
      return {
        markup: SHAPES.puff(color, hi),
        delay: t * 0.05,
        life,
        behind: k % 3 === 2,
        at: (u: number, age: number) => {
          const e = easeOutQuint(u * 1.2);
          return {
            x: side * (30 * scale + e * dist),
            y: -10 * scale - e * lift,
            scale: s * (0.55 + e * 0.55) * (1 - Math.pow(u, 4) * 0.45) * popIn(age, life, 0.08, 0.05),
            opacity: u < 0.4 ? 1 : 1 - ((u - 0.4) / 0.6) ** 1.5,
          };
        },
      };
    });
  },
};

export const builtinEffects: EffectRegistry = {
  hearts,
  'heart-burst': heartBurst,
  sparkles,
  stars,
  shine,
  notes,
  'music-burst': musicBurst,
  sweat,
  tears,
  burst,
  anger,
  confetti,
  zzz,
  dizzy,
  puff,
  question,
  exclaim,
  bubble,
  check,
  xp,
  'speed-lines': speedLines,
  wind,
};
