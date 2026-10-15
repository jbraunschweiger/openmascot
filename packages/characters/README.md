# @openmascot/characters

Ready-made [OpenMascot](../../README.md) characters and the shared clip library.

```bash
npm install @openmascot/characters   # (0.1.0, not yet published)
```

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
