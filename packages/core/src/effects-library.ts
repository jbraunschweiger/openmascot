/**
 * Built-in effects. All particle art is drawn centred on (0, 0) in character
 * units (a typical mascot head is ~180 units wide).
 *
 * Common params: `count`, `color`, `spread`, `size` (multiplier), `side` (-1/1).
 */
import type { EffectDef, EffectRegistry, ParticleSpec } from './effects';
import { fadeEnvelope, num, popEnvelope, str } from './effects';

export const SHAPES = {
  heart: (c: string) =>
    `<path d="M0 9.5C-4.6 6.3-12 1.2-12-5.2-12-9.4-8.9-12-5.6-12-3.2-12-1.2-10.6 0-8.6 1.2-10.6 3.2-12 5.6-12 8.9-12 12-9.4 12-5.2 12 1.2 4.6 6.3 0 9.5Z" fill="${c}"/>` +
    `<ellipse cx="-5.8" cy="-6.4" rx="2.6" ry="1.8" transform="rotate(-35 -5.8 -6.4)" fill="#fff" opacity=".45"/>`,
  sparkle: (c: string) =>
    `<path d="M0-13C1.2-4.6 4.6-1.2 13 0 4.6 1.2 1.2 4.6 0 13-1.2 4.6-4.6 1.2-13 0-4.6-1.2-1.2-4.6 0-13Z" fill="${c}"/>`,
  note: (c: string) =>
    `<g fill="${c}"><ellipse cx="-4" cy="7" rx="5.6" ry="4.3" transform="rotate(-22 -4 7)"/><rect x="0.4" y="-13" width="2.8" height="20" rx="1.4"/><path d="M1.8-13.2C6.5-11.6 10.6-8.6 9.6-2.4 8.4-5.6 5.4-6.6 1.8-6.8Z"/></g>`,
  beamNote: (c: string) =>
    `<g fill="${c}"><ellipse cx="-8.5" cy="8" rx="5" ry="3.9" transform="rotate(-22 -8.5 8)"/><ellipse cx="6.5" cy="5" rx="5" ry="3.9" transform="rotate(-22 6.5 5)"/><rect x="-5.3" y="-10" width="2.6" height="18" rx="1.3"/><rect x="9.7" y="-13" width="2.6" height="18" rx="1.3"/><path d="M-5.3-10.5 12.3-14V-9L-5.3-5.5Z"/></g>`,
  drop: (c: string) =>
    `<path d="M0-9C2.6-4.8 6.4-1 6.4 3A6.4 6.4 0 0 1-6.4 3C-6.4-1-2.6-4.8 0-9Z" fill="${c}"/><ellipse cx="-2.2" cy="2.4" rx="1.4" ry="2.2" fill="#fff" opacity=".6"/>`,
  line: (c: string, len = 16, w = 5) =>
    `<rect x="${-w / 2}" y="${-len / 2}" width="${w}" height="${len}" rx="${w / 2}" fill="${c}"/>`,
  star: (c: string) =>
    `<path d="M0-10 2.9-3.6 9.9-3.1 4.6 1.5 6.2 8.3 0 4.7-6.2 8.3-4.6 1.5-9.9-3.1-2.9-3.6Z" fill="${c}" stroke="${c}" stroke-width="2" stroke-linejoin="round"/>`,
  z: (c: string) =>
    `<path d="M-5.5-6H5.5L-5.5 6H5.5" fill="none" stroke="${c}" stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round"/>`,
  question: (c: string) =>
    `<g fill="none" stroke="${c}" stroke-width="4.2" stroke-linecap="round"><path d="M-6-8.5C-6-13.5-2.6-15.5 0.4-15.5 4.4-15.5 7-12.8 7-9.4 7-4.6 0.8-3.8 0.8 1.6"/></g><circle cx="0.8" cy="9.5" r="2.7" fill="${c}"/>`,
  exclaim: (c: string) =>
    `<rect x="-2.6" y="-16" width="5.2" height="18" rx="2.6" fill="${c}"/><circle cx="0" cy="8.6" r="3" fill="${c}"/>`,
  puff: (c: string) => `<circle r="10" fill="${c}"/>`,
  confetti: (c: string, round: boolean) =>
    round ? `<circle r="3.6" fill="${c}"/>` : `<rect x="-4" y="-2.2" width="8" height="4.4" rx="1" fill="${c}"/>`,
};

const PINKS = ['#ff4f8b', '#ff6b9a', '#ff5c8a'];
const CONFETTI = ['#ff4f8b', '#ffc21a', '#4fb3ff', '#7ed957', '#a77bff', '#ff8a3d'];

const pick = <T,>(arr: T[], r: () => number) => arr[Math.floor(r() * arr.length) % arr.length];

/** Hearts drifting upward with a gentle sway (love / affection). */
const hearts: EffectDef = {
  name: 'hearts',
  description: 'Hearts float up and sway, then pop away.',
  defaultAnchor: 'head',
  spawn: ({ random, params, scale }) => {
    const count = num(params.count, 3);
    const spread = num(params.spread, 70) * scale;
    const size = num(params.size, 1) * scale;
    const out: ParticleSpec[] = [];
    for (let i = 0; i < count; i++) {
      const side = count === 1 ? 0 : (i / (count - 1)) * 2 - 1;
      const x0 = side * spread * 0.6 + (random() - 0.5) * 16 * scale;
      const s = size * (0.75 + random() * 0.55);
      const sway = (6 + random() * 8) * (random() < 0.5 ? -1 : 1);
      const rise = (70 + random() * 50) * scale;
      const color = str(params.color, pick(PINKS, random));
      out.push({
        markup: SHAPES.heart(color),
        delay: i * 0.12 + random() * 0.08,
        life: 1.3 + random() * 0.5,
        at: (u) => ({
          x: x0 + Math.sin(u * Math.PI * 2) * sway + side * u * 18 * scale,
          y: -u * rise,
          rot: Math.sin(u * Math.PI * 2 + 1) * 12 + side * 10,
          scale: s * popEnvelope(u, 0.16, 0.3),
          opacity: fadeEnvelope(u, 0.05, 0.25),
        }),
      });
    }
    return out;
  },
};

/** Twinkling four-point sparkles around the anchor (pride, success, magic). */
const sparkles: EffectDef = {
  name: 'sparkles',
  description: 'Four-point stars pop and twinkle around the anchor.',
  defaultAnchor: 'head',
  spawn: ({ random, params, scale }) => {
    const count = num(params.count, 4);
    const radius = num(params.spread, 110) * scale;
    const size = num(params.size, 1) * scale;
    const color = str(params.color, '#ffc21a');
    const out: ParticleSpec[] = [];
    for (let i = 0; i < count; i++) {
      const a = -Math.PI / 2 + ((i + 0.5) / count - 0.5) * Math.PI * 1.5 + (random() - 0.5) * 0.4;
      const r = radius * (0.75 + random() * 0.35);
      const x = Math.cos(a) * r;
      const y = Math.sin(a) * r * 0.8;
      const s = size * (0.55 + random() * 0.7);
      const tw = 2 + random() * 2;
      out.push({
        markup: SHAPES.sparkle(color),
        delay: i * 0.09 + random() * 0.1,
        life: 0.9 + random() * 0.5,
        at: (u, age) => ({
          x,
          y: y - u * 6 * scale,
          rot: u * 45,
          scale: s * popEnvelope(u, 0.22, 0.4) * (0.85 + 0.15 * Math.cos(age * tw * Math.PI * 2)),
        }),
      });
    }
    return out;
  },
};

/** Music notes rising diagonally with a swing (singing, dancing). */
const notes: EffectDef = {
  name: 'notes',
  description: 'Music notes float up and to the side, swinging.',
  defaultAnchor: 'head',
  spawn: ({ random, params, scale }) => {
    const count = num(params.count, 2);
    const side = num(params.side, 1);
    const size = num(params.size, 1) * scale;
    const color = str(params.color, '#4fb3ff');
    const out: ParticleSpec[] = [];
    for (let i = 0; i < count; i++) {
      const beam = (i + (random() < 0.5 ? 1 : 0)) % 2 === 1;
      const x0 = side * (70 + random() * 25) * scale;
      const y0 = (-30 - i * 22) * scale;
      const s = size * (0.9 + random() * 0.4);
      out.push({
        markup: beam ? SHAPES.beamNote(color) : SHAPES.note(color),
        delay: i * 0.25 + random() * 0.1,
        life: 1.5 + random() * 0.4,
        at: (u) => ({
          x: x0 + side * u * 50 * scale + Math.sin(u * Math.PI * 3) * 6 * scale,
          y: y0 - u * 70 * scale,
          rot: Math.sin(u * Math.PI * 3) * 14,
          scale: s * popEnvelope(u, 0.15, 0.3),
          opacity: fadeEnvelope(u, 0.05, 0.3),
        }),
      });
    }
    return out;
  },
};

/** Sweat drops flicking off the side of the head (nervous, embarrassed, effort). */
const sweat: EffectDef = {
  name: 'sweat',
  description: 'One or two sweat drops flick off the side of the head.',
  defaultAnchor: 'head',
  follow: true,
  spawn: ({ random, params, scale }) => {
    const side = num(params.side, 1);
    const count = num(params.count, 2);
    const color = str(params.color, '#5cc8f5');
    const size = num(params.size, 1) * scale;
    const out: ParticleSpec[] = [];
    for (let i = 0; i < count; i++) {
      const x0 = side * (88 + i * 10) * scale;
      const y0 = (-48 + i * 22) * scale;
      const dir = side * (0.8 + random() * 0.4);
      out.push({
        markup: SHAPES.drop(color),
        delay: i * 0.12,
        life: 0.8,
        at: (u) => ({
          x: x0 + dir * u * 28 * scale,
          y: y0 - Math.sin(u * Math.PI) * 14 * scale + u * u * 18 * scale,
          rot: side * (30 + u * 50),
          scale: size * (0.8 - i * 0.15) * popEnvelope(u, 0.2, 0.35),
        }),
      });
    }
    return out;
  },
};

/** Tears welling and dripping from both eyes (sad). Anchor: `head`. */
const tears: EffectDef = {
  name: 'tears',
  description: 'Tears drip from both eyes and fall.',
  defaultAnchor: 'head',
  follow: true,
  spawn: ({ random, params, scale }) => {
    const color = str(params.color, '#5cc8f5');
    const count = num(params.count, 3);
    const eyeX = num(params.eyeX, 42) * scale;
    const eyeY = num(params.eyeY, 22) * scale;
    const out: ParticleSpec[] = [];
    for (let i = 0; i < count * 2; i++) {
      const side = i % 2 === 0 ? -1 : 1;
      const k = Math.floor(i / 2);
      out.push({
        markup: SHAPES.drop(color),
        delay: k * 0.45 + random() * 0.15,
        life: 0.9,
        at: (u) => ({
          x: side * eyeX + side * u * 6 * scale,
          y: eyeY + u * u * 70 * scale,
          scale: 0.7 * scale * popEnvelope(u, 0.25, 0.25),
          opacity: fadeEnvelope(u, 0.1, 0.3),
        }),
      });
    }
    return out;
  },
};

/** Short excitement strokes radiating from the top of the head (surprise, joy). */
const burst: EffectDef = {
  name: 'burst',
  description: 'Excitement lines flash outward around the top of the head.',
  defaultAnchor: 'head',
  follow: true,
  spawn: ({ params, scale }) => {
    const color = str(params.color, '#ffc21a');
    const radius = num(params.spread, 105) * scale;
    const angles = [-150, -125, -55, -30];
    return angles.map((deg, i) => {
      const a = (deg * Math.PI) / 180;
      const len = (i === 1 || i === 2 ? 20 : 15) * scale;
      return {
        markup: SHAPES.line(color, len, 5.2 * scale),
        delay: 0.02 * i,
        life: 0.55,
        at: (u: number) => {
          const r = radius + u * 18 * scale;
          return {
            x: Math.cos(a) * r,
            y: Math.sin(a) * r * 0.9 - 40 * scale,
            rot: deg + 90,
            sy: popEnvelope(u, 0.3, 0.45),
            opacity: fadeEnvelope(u, 0.05, 0.3),
          };
        },
      };
    });
  },
};

/** Confetti shower falling around the character (celebration). */
const confetti: EffectDef = {
  name: 'confetti',
  description: 'A burst of colourful confetti that tumbles down.',
  defaultAnchor: [0, -320],
  spawn: ({ random, params, scale }) => {
    const count = num(params.count, 26);
    const width = num(params.spread, 340) * scale;
    const out: ParticleSpec[] = [];
    for (let i = 0; i < count; i++) {
      const x0 = (random() - 0.5) * width;
      const vx = (random() - 0.5) * 80 * scale;
      const vy = (-120 - random() * 120) * scale;
      const spin = (random() - 0.5) * 900;
      const flip = 4 + random() * 6;
      const color = pick(CONFETTI, random);
      const round = random() < 0.3;
      out.push({
        markup: SHAPES.confetti(color, round),
        delay: random() * 0.25,
        life: 1.8 + random() * 0.8,
        behind: random() < 0.3,
        at: (u, age) => ({
          x: x0 + vx * age + Math.sin(age * 3 + i) * 10 * scale,
          y: vy * age + 0.5 * 340 * scale * age * age,
          rot: spin * age,
          sx: scale * Math.cos(age * flip),
          sy: scale,
          opacity: fadeEnvelope(u, 0.02, 0.2),
        }),
      });
    }
    return out;
  },
};

/** Sleepy Zs drifting up (sleep). */
const zzz: EffectDef = {
  name: 'zzz',
  description: 'Z letters drift up and grow (sleeping).',
  defaultAnchor: 'head',
  spawn: ({ params, scale }) => {
    const color = str(params.color, '#8f7cc4');
    const count = num(params.count, 3);
    return Array.from({ length: count }, (_, i) => ({
      markup: SHAPES.z(color),
      delay: i * 0.55,
      life: 2,
      at: (u: number) => ({
        x: (60 + u * 50) * scale + Math.sin(u * 6) * 6 * scale,
        y: (-70 - u * 80) * scale,
        rot: -10 + Math.sin(u * 4) * 10,
        scale: scale * (0.7 + u * 0.8) * popEnvelope(u, 0.15, 0.3),
        opacity: fadeEnvelope(u, 0.1, 0.35),
      }),
    }));
  },
};

/** Stars orbiting above the head (dizzy). */
const dizzy: EffectDef = {
  name: 'dizzy',
  description: 'Little stars circle above the head (dizzy).',
  defaultAnchor: 'head',
  follow: true,
  spawn: ({ params, scale }) => {
    const color = str(params.color, '#ffc21a');
    const count = num(params.count, 3);
    const dur = num(params.duration, 2.2);
    return Array.from({ length: count }, (_, i) => ({
      markup: SHAPES.star(color),
      life: dur,
      at: (u: number, age: number) => {
        const a = age * 5 + (i / count) * Math.PI * 2;
        const depth = Math.sin(a);
        return {
          x: Math.cos(a) * 70 * scale,
          y: (-95 + depth * 12) * scale,
          scale: scale * (0.75 + depth * 0.2) * popEnvelope(u, 0.1, 0.15),
          rot: age * 120,
          opacity: 0.75 + depth * 0.25,
        };
      },
    }));
  },
};

/** Dust puffs at the feet (landing, stomping). */
const puff: EffectDef = {
  name: 'puff',
  description: 'Soft dust puffs spread from the ground.',
  defaultAnchor: [0, 0],
  spawn: ({ random, params, scale }) => {
    const color = str(params.color, '#e4def0');
    const count = num(params.count, 6);
    return Array.from({ length: count }, (_, i) => {
      const side = i % 2 === 0 ? -1 : 1;
      const k = Math.floor(i / 2);
      const dist = (40 + k * 26 + random() * 10) * scale;
      const s = (0.9 - k * 0.15 + random() * 0.2) * scale;
      return {
        markup: SHAPES.puff(color),
        life: 0.55 + random() * 0.15,
        behind: k > 0,
        at: (u: number) => ({
          x: side * (dist * 0.6 + u * dist * 0.6),
          y: -6 * scale - u * 12 * scale,
          scale: s * (0.6 + u * 0.7) * (1 - u * u),
          opacity: 1 - u,
        }),
      };
    });
  },
};

/** A bobbing question mark (confused, thinking). */
const question: EffectDef = {
  name: 'question',
  description: 'A question mark pops up beside the head.',
  defaultAnchor: 'head',
  follow: true,
  spawn: ({ params, scale }) => {
    const color = str(params.color, '#8f7cc4');
    const side = num(params.side, 1);
    return [
      {
        markup: SHAPES.question(color),
        life: num(params.duration, 1.6),
        at: (u: number, age: number) => ({
          x: side * 95 * scale,
          y: (-80 + Math.sin(age * 5) * 4) * scale,
          rot: side * (12 + Math.sin(age * 4) * 6),
          scale: 1.2 * scale * popEnvelope(u, 0.15, 0.2),
        }),
      },
    ];
  },
};

/** An exclamation mark (alert, surprise). */
const exclaim: EffectDef = {
  name: 'exclaim',
  description: 'An exclamation mark pops up above the head.',
  defaultAnchor: 'head',
  follow: true,
  spawn: ({ params, scale }) => {
    const color = str(params.color, '#ff8a3d');
    const side = num(params.side, 1);
    return [
      {
        markup: SHAPES.exclaim(color),
        life: num(params.duration, 1.1),
        at: (u: number) => ({
          x: side * 85 * scale,
          y: -105 * scale,
          rot: side * 14,
          scale: 1.3 * scale * popEnvelope(u, 0.15, 0.2),
        }),
      },
    ];
  },
};

export const builtinEffects: EffectRegistry = {
  hearts,
  sparkles,
  notes,
  sweat,
  tears,
  burst,
  confetti,
  zzz,
  dizzy,
  puff,
  question,
  exclaim,
};
