# AGENTS.md — instructions for AI coding agents

This file tells AI coding agents (Claude Code, Codex, Cursor, Copilot…) how to
work in this repository. Humans may find it useful too. The source code is
the ground truth; when this file and the code disagree, trust the code and
fix this file.

## What this project is

OpenMascot: an engine for rigged, animated SVG brand mascots. A character is
one annotated SVG + a TypeScript `CharacterDef`; animations are data
(`Clip`s); a DOM-free core produces `Frame`s that web (and later React
Native) renderers draw. Read [docs/architecture.md](docs/architecture.md)
first, then the doc for your task (index: [docs/README.md](docs/README.md)).

## Commands

| command | when |
|---|---|
| `pnpm install` | once (pnpm 10, Node 22+) |
| `pnpm check` | **before you finish any task**: `embed --check` + `typecheck` + `test` |
| `pnpm test` / `pnpm vitest run <path or -t name>` | unit tests |
| `pnpm typecheck` | `tsc --noEmit` over packages, tests and the playground |
| `pnpm embed` | after **any** edit to a character SVG (`--check` verifies) |
| `pnpm openmascot validate <char\|file.svg>` | after rig/SVG edits — must print `✓ no warnings` |
| `pnpm openmascot lint <char>` | after clip edits — must print `✓ N clips OK` |
| `pnpm openmascot list <char>` | discover clips, expressions, effects |
| `pnpm framesheet <char> <clip> …` | render a contact sheet to `out/sheets/` (see below) |
| `npx tsx packages/cli/src/fx-sheet.ts [effect…]` | effects review sheet |
| `pnpm dev` | playground on :5173 |
| `node scripts/screenshot.mjs <url> <out.png>` | screenshot the playground with the preinstalled Chromium |
| `pnpm --filter @openmascot/playground build` | build the playground (CI does this) |

`out/` is git-ignored scratch space for renders.

## The visual review loop (mandatory for visual changes)

Unit tests can't tell you whether an animation *looks* right. If you can read
images, use frame sheets as your eyes:

1. Make the change.
2. `pnpm check` and the relevant `validate` / `lint`.
3. Render the sheets that exercise the change:
   - a clip: `pnpm framesheet echo <clip> --frames 12` and `--from idle` for its transition;
     dances: add `--per-beat 2`;
   - rig/solver: `pnpm framesheet echo --sweep root.yaw --range 0,330`,
     `--sweep head.yaw --range -90,90 --frames 7`, `--param lookX --range -1,1`;
   - face art / expressions: `pnpm framesheet echo --expressions`;
   - effects: `npx tsx packages/cli/src/fx-sheet.ts <effect>`.
4. **Open the PNGs and look.** Check for parts popping in front/behind,
   detached limbs, pupils outside eyes, wrong expression variants, effects
   clipped at the tile edge, floaty timing, events on the wrong frame.
5. Iterate until it looks right; mention which sheets you reviewed in your
   summary / PR.

## Conventions

- TypeScript strict, ES modules, 2-space indent, single quotes. Match the
  surrounding style; keep comments for the non-obvious *why*.
- `packages/core` must stay **DOM-free and dependency-free** (it targets React
  Native too). No `document`, `window`, `DOMParser`, Node built-ins.
- **Determinism:** never `Math.random()` in core, clips or effects; use
  `ctx.random` / `rng(seed)`.
- Clips are data. Every clip has `description` and `category`
  (`idle fidget emotion gesture pose dance locomotion`). Use params for
  portable motion (`lookX lookY blink breathe squash flap lean`) and standard
  bone names (`root body head ear-l ear-r tuft wing-l wing-r foot-l foot-r`).
- Screen-left/right is `-l`/`-r`. `mirrorClip` relies on it.
- Effects draw markup centred on (0, 0), well-formed XML, no filters/fonts.
- Do not hand-edit `packages/characters/src/*/art.generated.ts`.
- Public API changes: update `docs/api.md` and `CHANGELOG.md` (*Unreleased*).
- Tests live in `packages/<pkg>/test/`; DOM tests start with
  `// @vitest-environment happy-dom`. New clips and effects are covered
  automatically by `characters/test/library.test.ts` and
  `core/test/effects.test.ts` — make them pass, don't special-case them.

## Ownership map

Know which area you are in; keep changes inside it unless the task says
otherwise, and report (rather than silently fix) problems you find elsewhere.

| area | paths | notes |
|---|---|---|
| Engine core | `packages/core/src/{xml,rig,solve,pose,clip,ease,mat,mascot,render-string,author,types}.ts` | behaviour changes need unit tests; solver changes need sweep sheets |
| Effects library | `packages/core/src/effects-library.ts` | one `EffectDef` per effect + `builtinEffects` registry; review with the fx sheet |
| Characters & art | `packages/characters/src/<id>/` (`<id>.svg`, `index.ts`, `clips.ts`), `packages/characters/scripts/` | SVG is the source of truth; `pnpm embed` after edits |
| Clip library | `packages/characters/src/library/*.ts` | portable clips only; character-specific clips go in `src/<id>/clips.ts` |
| Web runtime | `packages/web/src/` | keep per-frame DOM writes minimal |
| React bindings | `packages/react/src/` | |
| CLI & sheets | `packages/cli/src/` | |
| Playground | `apps/playground/src/` | |
| Tests | `packages/*/test/` | |
| Docs & meta | `docs/`, `README.md`, `packages/*/README.md`, `CONTRIBUTING.md`, `AGENTS.md`, `CHANGELOG.md` | `docs/images/` are generated by the CLI — regenerate rather than edit |
| CI | `.github/` | workflows: `ci.yml` (checks + sheets artifact), `pages.yml` (playground deploy) |

When several agents work in parallel, each should own a disjoint set of the
rows above. Shared files (`packages/core/src/types.ts`, `package.json`,
`pnpm-lock.yaml`) need extra care: make minimal, additive edits.

## Definition of done

- [ ] `pnpm check` passes (and `pnpm openmascot lint echo` for clip changes).
- [ ] New behaviour has tests; docs updated if behaviour or API changed.
- [ ] Visual changes reviewed with frame sheets (list them in your summary).
- [ ] No stray files outside `out/`; generated files regenerated, not hand-edited.
