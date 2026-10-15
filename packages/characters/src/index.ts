/**
 * @openmascot/characters — ready-made characters and the shared clip library.
 */
export { echo, echoExpressions } from './echo';
export { library, clipCategories } from './library';
import { echo } from './echo';
import type { CharacterDef } from '@openmascot/core';

/** All bundled characters by id. */
export const characters: Record<string, CharacterDef> = { echo };
