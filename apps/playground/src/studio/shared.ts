/**
 * Shared helpers for the Home / Studio / Gallery pages.
 *
 * Clips are authored in parallel and appear over time, so everything here
 * looks clips up lazily and degrades gracefully when a name is missing.
 */
import { clipSeconds, type Clip, type MascotOptions } from '@openmascot/core';
import { characters, clipCategories } from '@openmascot/characters';

export const echo = characters.echo;

/** All clips available to Echo (shared library + Echo-only clips). */
export function allClips(): Record<string, Clip> {
  return echo.clips ?? {};
}

export function getClip(name: string): Clip | undefined {
  return allClips()[name];
}

export function hasClip(name: string): boolean {
  return !!allClips()[name];
}

/** Clip names grouped by category, in a friendly order. */
export const CATEGORY_ORDER = ['idle', 'emotion', 'gesture', 'dance', 'pose', 'locomotion', 'fidget', 'other'];

export function groupedClips(): [string, string[]][] {
  const cats = clipCategories(allClips());
  const keys = Object.keys(cats).sort((a, b) => {
    const ia = CATEGORY_ORDER.indexOf(a);
    const ib = CATEGORY_ORDER.indexOf(b);
    return (ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib) || a.localeCompare(b);
  });
  return keys.map((k) => [k, cats[k].slice().sort()]);
}

/** Clip length in seconds at a given tempo. */
export function seconds(clip: Clip, bpm?: number) {
  return clipSeconds(clip, clip.units === 'beats' ? bpm : undefined);
}

export const isBeats = (clip?: Clip) => clip?.units === 'beats';

/** Expression names that best match an emote/pose clip name (used for "coming soon" fallbacks). */
export function expressionFor(clipName: string): string | undefined {
  const base = clipName.replace(/^emote-/, '');
  const map: Record<string, string> = { sing: 'singing', 'in-love': 'inlove' };
  const e = map[base] ?? base;
  return echo.expressions[e] ? e : undefined;
}

export const pretty = (name: string) => name.replace(/^(emote|dance|fidget)-/, '').replace(/-/g, ' ');

/* ------------------------------------------------------------------ */
/* Demo clips used by the landing page (passed as a `library`).        */
/* ------------------------------------------------------------------ */

export const DEMO_CLIPS: Record<string, Clip> = {
  'demo-spin': {
    name: 'demo-spin',
    description: 'Full pseudo-3D turn: root.yaw 0 → 360 with anticipation and a hop.',
    duration: 2.6,
    loop: true,
    bones: {
      root: {
        yaw: [[0, 0, 'cubicInOut'], [0.35, -18, 'cubicInOut'], [1.35, 360], [2.6, 360]],
        y: [[0, 0], [0.45, 0, 'quadOut'], [0.85, -34, 'quadIn'], [1.3, 0], [2.6, 0]],
      },
    },
    params: {
      squash: [[0, 0], [0.3, 0.45], [0.5, -0.35], [1.3, 0.35], [1.55, 0], [2.6, 0]],
      flap: [[0, 0], [0.45, 0.9], [1.0, -0.4], [1.4, 0.3], [1.8, 0], [2.6, 0]],
    },
    suppress: { look: true },
  },
  'demo-bop': {
    name: 'demo-bop',
    description: 'Simple 4-beat bop (beat-synced).',
    units: 'beats',
    bpm: 120,
    duration: 4,
    loop: true,
    bones: {
      root: { y: [[0, 0, 'quadOut'], [0.5, -16, 'quadIn'], [1, 0, 'quadOut'], [1.5, -16, 'quadIn'], [2, 0, 'quadOut'], [2.5, -16, 'quadIn'], [3, 0, 'quadOut'], [3.5, -16, 'quadIn'], [4, 0]] },
      head: { rot: [[0, 0], [1, 6], [2, 0], [3, -6], [4, 0]] },
    },
    params: {
      squash: [[0, 0.35], [0.5, -0.2], [1, 0.35], [1.5, -0.2], [2, 0.35], [2.5, -0.2], [3, 0.35], [3.5, -0.2], [4, 0.35]],
      lean: [[0, 0], [1, 0.5], [2, 0], [3, -0.5], [4, 0]],
      flap: [[0, -0.2], [0.5, 0.8], [1, -0.2], [1.5, 0.8], [2, -0.2], [2.5, 0.8], [3, -0.2], [3.5, 0.8], [4, -0.2]],
    },
    expression: [[0, 'happy']],
  },
  'demo-springs': {
    name: 'demo-springs',
    description: 'Snappy side-steps: ears, tuft and wings lag behind and overshoot.',
    duration: 2,
    loop: true,
    bones: {
      root: { x: [[0, 0, 'backOut'], [0.18, -34], [0.75, -34, 'backOut'], [0.93, 34], [1.5, 34, 'backOut'], [1.7, 0], [2, 0]] },
      body: { rot: [[0, 0, 'backOut'], [0.18, -8], [0.5, 0, 'backOut'], [0.75, 0], [0.93, 8], [1.25, 0], [1.5, 0], [1.7, -4], [2, 0]] },
    },
    params: { squash: [[0, 0], [0.12, -0.3], [0.3, 0.2], [0.5, 0], [0.87, -0.3], [1.05, 0.2], [1.25, 0], [2, 0]] },
  },
};

export const DEMO_OPTIONS: MascotOptions = { library: DEMO_CLIPS };

/* ------------------------------------------------------------------ */

/** Download a string as a file. */
export function download(name: string, content: string, type = 'image/svg+xml') {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    const ok = document.execCommand('copy');
    ta.remove();
    return ok;
  }
}

/** Query params from the hash route (`#/studio?clip=fly`). */
export function hashParams(): URLSearchParams {
  return new URLSearchParams(location.hash.split('?')[1] ?? '');
}
