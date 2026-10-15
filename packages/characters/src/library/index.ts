/**
 * The shared clip library. Clips only address standard bone names and params
 * (see docs/animation.md), so they work on any character that follows the
 * standard rig conventions.
 */
import type { Clip } from '@openmascot/core';
import { idleClips } from './idle';
import { emotionsClips } from './emotions';
import { gesturesClips } from './gestures';
import { dancesClips } from './dances';

export const library: Record<string, Clip> = {
  ...idleClips,
  ...emotionsClips,
  ...gesturesClips,
  ...dancesClips,
};

/** Clip names grouped by category, for pickers and docs. */
export function clipCategories(clips: Record<string, Clip> = library): Record<string, string[]> {
  const out: Record<string, string[]> = {};
  for (const [name, c] of Object.entries(clips)) (out[c.category ?? 'other'] ??= []).push(name);
  return out;
}
