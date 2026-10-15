# @openmascot/characters

Ready-made [OpenMascot](../../README.md) characters and the shared clip library.

```bash
npm install @openmascot/characters
# or: pnpm add @openmascot/characters
# or: yarn add @openmascot/characters
```

Import one character from its subpath so the others stay out of your bundle:

```ts
import { echo } from '@openmascot/characters/echo';
import { library, clipCategories } from '@openmascot/characters/library';
```

| import | contents | min+gzip |
|---|---|---:|
| `@openmascot/characters/echo` | Echo (art, expressions, clips incl. the shared library) | 20.8 kB |
| `@openmascot/characters/pip` | Pip | 20.6 kB |
| `@openmascot/characters/riff` | Riff | 23.0 kB |
| `@openmascot/characters/library` | the shared clip library only | 12.3 kB |
| `@openmascot/characters` | everything, plus a `characters` record by id | sum of the above, shared library counted once |

Sizes include the 12.3 kB library, which bundlers share between characters.
The root import is convenient for pickers and galleries:

```ts
import { echo, library, clipCategories, characters } from '@openmascot/characters';

clipCategories(library);
// { idle: [...], fidget: [...], emotion: [...], gesture: [...], dance: [...] }
```

| character | |
|---|---|
| **Echo** (`echo`) | A cheerful purple bat who loves music. 16 expressions, wings that fold, spring ears and tuft, and Echo-only clips (`hang`, `cloak`, `fly`, `fly-side`, `takeoff`, `land`, `peek`, `wink`). |

![Echo's expressions](../../docs/images/expressions.png)

The **library** (`src/library/`) has idle loops, fidgets, emotions,
gestures and beat-synced dances. Clips address standard bone names and
portable params (`lookX`, `flap`, `squash`, …), so they work on any character
that follows the conventions in [docs/characters.md](../../docs/characters.md).

Layout:

```
src/echo/echo.svg            the annotated art (source of truth)
src/echo/art.generated.ts    embedded copy — regenerate with `pnpm embed`
src/echo/index.ts            CharacterDef: expressions, params, anchors, idle
src/echo/clips.ts            Echo-only clips
src/library/*.ts             shared clips
scripts/                     embed + Echo authoring/preview helpers
```

Adding a character: follow [docs/characters.md](../../docs/characters.md). MIT licensed (code and art).
