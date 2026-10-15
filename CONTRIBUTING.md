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
scripts/              smoke-pack.mjs, size.mjs, screenshot.mjs and other tools
.changeset/           pending release notes (see Publishing)
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

## Publishing

The npm packages — `@openmascot/core`, `web`, `react`, `characters` and
`cli` — are released with [Changesets](https://changesets.dev) and always
share one version (a `fixed` group in `.changeset/config.json`).

**In your PR.** If the change affects users of a package, add a changeset:

```bash
pnpm changeset        # pick the package(s), patch/minor/major, write a summary
```

Commit the generated `.changeset/*.md` with your PR. Docs, tests, the
playground and CI changes don't need one.

**After merge.** The [Release workflow](.github/workflows/release.yml) runs on
every push to `main`:

1. While changesets are pending it opens (or updates) a **"Version packages"**
   PR that bumps the versions, writes each package's `CHANGELOG.md` and
   refreshes the lockfile (`pnpm version-packages`).
2. Merging that PR triggers `pnpm release`: `pnpm check`, `pnpm build`,
   `pnpm smoke:pack`, then `changeset publish`, which runs `pnpm publish` for
   every version not yet on npm (with [npm provenance](https://docs.npmjs.com/generating-provenance-statements)),
   pushes `@openmascot/<pkg>@x.y.z` tags and creates GitHub releases.

Publishing only happens when the `NPM_TOKEN` secret is configured. The first
release needs no changeset: the packages are already at `0.1.0` and not on
npm, so the first run with a token publishes them.

**How packages are built.** In the workspace, `exports` point at
`src/*.ts`, so Vite, Vitest, `tsx` and `tsc` use the sources directly — no
build needed for development. Each package's `publishConfig` swaps in the
`dist/` build when packing/publishing (pnpm applies it), and `workspace:^`
ranges become real version ranges. `prepack` runs `tsup` (configs in
`packages/*/tsup.config.ts`): ESM + CommonJS + `.d.ts` + sourcemaps for the
libraries, and a single bundled `dist/bin.js` for the CLI.

**Before releasing (or when touching packaging)**:

```bash
pnpm build            # dist/ for every package
pnpm size             # min+gzip per entry point (update the README tables if they move)
pnpm smoke:pack       # pack, publint, are-the-types-wrong, then install the tarballs
                      # in a fresh project: Node ESM/CJS, SSR, Vite+React,
                      # tsc (bundler/node16), CLI via npx, <open-mascot> in Chromium
```

CI runs the same smoke test on every PR and uploads the tarballs as an
artifact. `pnpm publish` in a package by hand runs a guard
(`scripts/prepublish-guard.mjs`) that does `pnpm release:verify` first.

**Adding a character** to `@openmascot/characters`: its `src/<id>/index.ts`
becomes an entry automatically; add `./<id>` to `exports` and `typesVersions`
in the package's `publishConfig` (and the dev `exports`). `pnpm smoke:pack`
fails if a built entry has no export or an export has no file.

## Licensing

By contributing you agree that your contributions are licensed under the
[MIT licence](LICENSE). Only submit art you created or have the right to
release under MIT.
