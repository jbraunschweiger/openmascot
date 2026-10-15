/**
 * @openmascot/characters — ready-made characters and the shared clip library.
 *
 * Import a single character from its subpath (`@openmascot/characters/echo`)
 * to avoid bundling the others.
 */
export { echo, echoExpressions } from './echo';
export { pip, pipExpressions } from './pip';
export { riff, riffExpressions } from './riff';
export { library, clipCategories } from './library';
import { echo } from './echo';
import { pip } from './pip';
import { riff } from './riff';
import type { CharacterDef } from '@openmascot/core';

/** All bundled characters by id. */
export const characters: Record<string, CharacterDef> = { echo, pip, riff };
