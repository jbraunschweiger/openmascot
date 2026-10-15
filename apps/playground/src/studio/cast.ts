/**
 * The cast: every character the playground can show, plus selection state.
 *
 * Everything is derived from the `characters` registry, so new characters
 * appear automatically. Per-character facts (rig bones, viewBox, avatar…) are
 * computed lazily and cached; a character whose SVG fails to compile yields
 * `null` info instead of throwing, so one bad character can't take a page down.
 */
import { useCallback, useEffect, useState } from 'react';
import { Mascot, renderSvg, type CharacterDef, type Clip, type Rig } from '@openmascot/core';
import { characters, library } from '@openmascot/characters';
import { devFakeCharacters } from './dev-fake';

/** Registered characters (registry order), plus dev-only stand-ins when the registry has a single one. */
export const CAST: CharacterDef[] = [...Object.values(characters), ...devFakeCharacters(characters)];

export const DEFAULT_ID = CAST.find((c) => c.id === 'echo')?.id ?? CAST[0].id;

export function getCharacter(id: string | null | undefined): CharacterDef | undefined {
  return id ? CAST.find((c) => c.id === id) : undefined;
}

/* ------------------------------------------------------------------ */
/* Clips & expressions                                                  */
/* ------------------------------------------------------------------ */

export const clipsOf = (c: CharacterDef): Record<string, Clip> => c.clips ?? {};
export const clipOf = (c: CharacterDef, name: string): Clip | undefined => clipsOf(c)[name];
export const hasClip = (c: CharacterDef, name: string) => !!clipOf(c, name);
export const hasExpression = (c: CharacterDef, name: string) => !!c.expressions?.[name];

/** True for names from the shared clip library (portable across the cast; a character may override one). */
export const isLibraryClip = (name: string) => !!library[name];

/** Character-specific clips (names that are not in the shared library). */
export function ownClips(c: CharacterDef): string[] {
  return Object.keys(clipsOf(c)).filter((n) => !isLibraryClip(n));
}

/** Expression names that best match an emote/pose clip name (used for "not available" stand-ins). */
export function expressionFor(c: CharacterDef, clipName: string): string | undefined {
  const base = clipName.replace(/^emote-/, '');
  const map: Record<string, string> = { sing: 'singing', 'in-love': 'inlove' };
  const e = map[base] ?? base;
  return hasExpression(c, e) ? e : undefined;
}

/* ------------------------------------------------------------------ */
/* Rig facts                                                            */
/* ------------------------------------------------------------------ */

export interface CastInfo {
  rig: Rig;
  /** Rig viewBox [x, y, w, h]. */
  vb: [number, number, number, number];
  bones: string[];
  slots: number;
  warnings: number;
}

const infoCache = new Map<string, CastInfo | null>();

/** Compiled-rig facts, or `null` if the character's SVG doesn't compile. */
export function castInfo(c: CharacterDef): CastInfo | null {
  if (infoCache.has(c.id)) return infoCache.get(c.id)!;
  let info: CastInfo | null = null;
  try {
    const m = new Mascot(c, { alive: false, initial: '__none__' });
    info = { rig: m.rig, vb: m.rig.viewBox, bones: Object.keys(m.rig.bonesByName), slots: m.rig.slots.length, warnings: m.warnings.length };
  } catch (e) {
    console.warn(`[playground] character "${c.id}" failed to compile:`, e);
  }
  infoCache.set(c.id, info);
  return info;
}

const FALLBACK_VB: [number, number, number, number] = [-212, -242, 424, 252];
export const viewBoxOf = (c: CharacterDef) => castInfo(c)?.vb ?? FALLBACK_VB;

/** Viewbox padded by [top, right, bottom, left]. */
export function paddedVb(c: CharacterDef, p: [number, number, number, number]): [number, number, number, number] {
  const v = viewBoxOf(c);
  return [v[0] - p[3], v[1] - p[0], v[2] + p[1] + p[3], v[3] + p[0] + p[2]];
}

const avatarCache = new Map<string, string | null>();

/** Static rest-pose render as a data URI (cached), or `null` if it can't be rendered. */
export function avatarUri(c: CharacterDef): string | null {
  if (avatarCache.has(c.id)) return avatarCache.get(c.id)!;
  let uri: string | null = null;
  try {
    const m = new Mascot(c, { alive: false, seed: 3 });
    m.update(0);
    const svg = renderSvg(m.rig, m.current.frame, { padding: 8 });
    uri = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
  } catch {
    uri = null;
  }
  avatarCache.set(c.id, uri);
  return uri;
}

/* ------------------------------------------------------------------ */
/* Presentation                                                         */
/* ------------------------------------------------------------------ */

const str = (v: unknown) => (typeof v === 'string' && v.trim() ? v : undefined);

/** Accent colour: `meta.tint`/`meta.color`, else a body-ish palette entry, else violet. */
export function tintOf(c: CharacterDef): string {
  const p = c.palette ?? {};
  return str(c.meta?.tint) ?? str(c.meta?.color) ?? p.body ?? p.primary ?? p.main ?? Object.values(p)[0] ?? '#6b4fd8';
}

export const descriptionOf = (c: CharacterDef) => str(c.meta?.description);
/** Short tagline for cards: `meta.tagline`, else the description's first sentence. */
export const taglineOf = (c: CharacterDef) => str(c.meta?.tagline) ?? descriptionOf(c)?.split(/(?<=[.!?])\s/)[0];

/* ------------------------------------------------------------------ */
/* Selection (URL `?char=` + localStorage)                              */
/* ------------------------------------------------------------------ */

const LS_KEY = 'openmascot.playground.char';
export const ALL = '*';

function lsGet(): string | null {
  try {
    return localStorage.getItem(LS_KEY);
  } catch {
    return null;
  }
}
function lsSet(v: string) {
  try {
    localStorage.setItem(LS_KEY, v);
  } catch {
    /* storage unavailable */
  }
}

/** Query params of the hash route (`#/studio?char=pip&clip=fly`). */
export function hashQuery(): URLSearchParams {
  return new URLSearchParams(location.hash.split('?')[1] ?? '');
}

/** Merge params into the hash query without adding a history entry (null deletes). */
export function setHashQuery(patch: Record<string, string | null | undefined>) {
  const [path] = (location.hash.replace(/^#/, '') || '/').split('?');
  const q = hashQuery();
  for (const [k, v] of Object.entries(patch)) {
    if (v == null || v === '') q.delete(k);
    else q.set(k, v);
  }
  const s = q.toString();
  history.replaceState(history.state, '', `#${path}${s ? `?${s}` : ''}`);
}

function readSelection(allowAll: boolean): string {
  const fromUrl = hashQuery().get('char');
  if (fromUrl && (getCharacter(fromUrl) || (allowAll && fromUrl === ALL))) return fromUrl;
  const saved = lsGet();
  if (saved && getCharacter(saved)) return saved;
  return DEFAULT_ID;
}

/**
 * Selected character id, persisted in the URL (`?char=`) and localStorage.
 * With `allowAll`, the value may be `ALL` ("all characters" comparison mode;
 * only kept in the URL so other pages still get a real character).
 */
export function useCharacterSelection(opts: { allowAll?: boolean } = {}) {
  const allowAll = !!opts.allowAll;
  const [id, setId] = useState(() => readSelection(allowAll));
  useEffect(() => {
    const on = () => setId(readSelection(allowAll));
    addEventListener('hashchange', on);
    return () => removeEventListener('hashchange', on);
  }, [allowAll]);
  const select = useCallback((next: string) => {
    setId(next);
    setHashQuery({ char: next });
    if (next !== ALL) lsSet(next);
  }, []);
  return [id, select] as const;
}
