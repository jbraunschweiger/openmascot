# Contributing to OpenMascot

Thanks for helping! OpenMascot welcomes new characters, clips, effects,
renderers, bug fixes and docs. By participating you agree to the
[Code of Conduct](CODE_OF_CONDUCT.md).

## Setup

Requirements: **Node 22+** and **pnpm 10** (`corepack enable`).

```bash
git clone https://github.com/jbraunschweiger/openmascot
cd openmascot
pnpm install
pnpm check          # embed --check + typecheck + unit tests
pnpm dev            # playground at http://localhost:5173
```

## Repository layout

```
packages/core         engine (no DOM, no deps)          → docs/architecture.md
packages/web          DOM renderer, player, <open-mascot>
packages/react        <Mascot>
packages/characters   Echo + shared clip library        → docs/characters.md, docs/animation.md
packages/cli          validate / lint / render / framesheet
apps/playground       Vite + React playground
docs/                 documentation (start at docs/README.md)
scripts/              screenshot.mjs and other dev tools
```

## Workflow

1. **Open an issue first** for anything bigger than a small fix, so we can
   agree on the approach.
2. Branch from `main`.
3. Make the change, with tests (see [docs/testing.md](docs/testing.md)).
4. Run the checks:

   ```bash
   pnpm check
   pnpm openmascot lint echo
   ```

5. For anything visual (art, clips, effects, solver, renderers), **render
   frame sheets before and after** and attach them to the PR:

   ```bash
   pnpm framesheet echo <clip> --frames 12
   pnpm framesheet echo --sweep root.yaw --range 0,330
   pnpm framesheet echo --expressions
   ```

6. Open a pull request using the template. Keep PRs focused; update docs and
   `CHANGELOG.md` (under *Unreleased*) when behaviour changes.

## Conventions

- **TypeScript, strict.** ES modules, 2-space indent, single quotes, trailing
  commas (see `.editorconfig`). Prefer small pure functions; keep the core
  free of DOM and Node APIs.
- **Data over code.** Clips and characters are plain data; use procedural
  `fn` hooks only when keyframes can't express the motion.
- **Determinism.** Never use `Math.random()` in the core, clips or effects —
  use the provided `ctx.random`.
- **Portable clips.** Animate params (`lookX`, `flap`, `squash`, `lean`…) for
  *what* and standard bones (`root`, `head`, `body`…) for *where*. Give every
  clip a `description` and a `category`.
- **Generated files.** Never edit `art.generated.ts` by hand; edit the SVG and
  run `pnpm embed`.
- **Commit messages.** Imperative, concise subject (`Add sweat effect side
  param`), body explaining *why* when it isn't obvious.

## Adding things

| you want to add… | read | must pass |
|---|---|---|
| a character | [docs/characters.md](docs/characters.md) | validate (no warnings), lint, tests, sheet review |
| a clip | [docs/animation.md](docs/animation.md) | `pnpm openmascot lint echo`, `characters/test/library.test.ts`, a frame sheet |
| an effect | [docs/effects.md](docs/effects.md) | `core/test/effects.test.ts` (automatic), fx sheet |
| engine behaviour | [docs/architecture.md](docs/architecture.md) | new unit tests; sweep sheets for solver changes |

## Licensing

By contributing you agree that your contributions are licensed under the
[MIT licence](LICENSE). Only submit art you created or have the right to
release under MIT.
