# Changelog

All notable changes to this project are documented here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and the project uses
[Semantic Versioning](https://semver.org/). All packages are versioned
together.

## [0.1.0] — Unreleased

First public version.

### Added

- **Characters**: Pip the bird and Riff the frog join Echo the bat. All three
  share expression names and the standard params, so the shared library
  plays on each; character-specific clips (Pip: hop, peck, chirp, fly, fluff,
  nap; Riff: croak, ribbit, leap, tongue-catch, lily-sit). The playground
  Studio and Gallery switch characters and compare a clip across the cast.
- **Rig format**: annotated SVG (`data-om-bone`, `-pivot`, `-z`, `-surface`,
  `-normal`, `-spring`, `-tip`, `-shadow`, `-slot`, `-variant`, `-default`,
  `-layer`, `-character`) with a compiler, validator warnings and
  `describeRig`. Dependency-free XML parser/serialiser.
- **2.5D solver**: yaw/pitch parallax, `volume` / `flat` / `face` / `back` /
  `feature` surfaces (foreshortening, mirroring, culling, edge-on fade),
  per-container depth sorting, weak perspective relative to the rest pose
  (the rest pose renders exactly like the source drawing).
- **Runtime (`Mascot`)**: crossfaded clip tracks, one-shots with `then`,
  loops with `repeat`, `speed`, beat-synced clips (`units: 'beats'`, `bpm`,
  `setTempo`), `setSpeed`, `progress`, clip events exactly once per loop;
  alive layers (breathing, blinks and double blinks, glances, fidgets,
  look-at); expressions with blink-masked eye swaps; spring secondary motion;
  shadow that follows the root; deterministic seeded randomness.
- **Clips**: keyframes with 19 named eases and cubic-bezier, params with
  linear and piecewise-curve drivers, expression/slot steps, procedural `fn`
  hooks, `suppress`, `fadeIn`, `then`, `shadow`, `blinkMask`; `lintClip`;
  authoring helpers `keys`, `cycle`, `wave`, `mirrorClip`, `sequence`,
  `defineClip(s)`.
- **Effects**: analytic, deterministic particle system and 20+ built-in
  effects (hearts, heart-burst, sparkles, stars, shine, notes, music-burst,
  sweat, tears, burst, anger, confetti, zzz, dizzy, puff, question, exclaim,
  bubble, check, xp, speed-lines, wind); custom effect registry.
- **Renderers**: `renderSvg` string renderer; `DomRenderer` with minimal
  attribute diffing; `MascotPlayer` (rAF loop, off-screen/hidden-tab pausing,
  reduced motion, pointer tracking); `<open-mascot>` custom element; React
  `<Mascot>` component and `useMascotRef`.
- **Characters**: Echo the bat (16 expressions, folding wings, spring ears
  and tuft, back details) and a shared clip library — idle, fidgets,
  emotions, gestures, 19 beat-synced dances — plus Echo-only poses and flight.
- **Rig features for multi-bone limbs and cleaner turns**:
  `data-om-sort-z` (sort depth separate from parallax `z`),
  `data-om-pin` (skin constraint: 1–3 rest points glued to other bones —
  membranes that stay attached to body and limb), `data-om-flat-min`
  (edge-on flat parts keep a thin opaque sliver instead of fading),
  `data-om-feature-min` (how narrow a `feature` gets in profile),
  `data-om-spring-limit` (per-bone spring angle limits; default ±55°).
- **Params**: `ParamDriver.input` (drive from a weighted sum of params, e.g.
  `{ wingFold: 1, raiseL: -1 }`), `CharacterDef.restParams` (values a clip
  pose starts from for params it doesn't animate — e.g. relaxed wings —
  without changing the rest drawing), `CharacterDef.effectParams`
  (per-character effect defaults merged under emission params). New portable
  params `wingFold` (0 spread … 0.5 relaxed … 1 tucked) and `raiseL`/`raiseR`
  (lift and open one wing) used throughout the clip library.
- **Echo's wings** are a bone chain (`wing-l` arm → `wing-hand-l` →
  `wing-tip-l`, pinned skins `wing-web-l`/`wing-flank-l`, anchor
  `wing-root-l`; mirrored for `-r`) that folds smoothly by bone motion: idle
  is relaxed, dances/emotes spread, sad/shy/unimpressed/cloak/hang/sleepy
  tuck. The `folded` wing slot variant is gone (slot kept with `spread`).
- **CLI**: `validate`, `list`, `lint`, `render`, `framesheet` (clips,
  transitions, expressions, sweeps, params, per-beat sampling) and an effects
  review sheet.
- **Playground** (Vite + React): studio, gallery and an app showcase.
- **Tests**: unit tests for every core module, Echo and every library clip,
  the DOM renderer, the player/custom element and the React component.
- **Docs**: architecture, rig format, character authoring guide, animation,
  pseudo-3D, effects, API reference, mobile plan, testing; AGENTS.md for AI
  coding agents.
- **CI**: checks, lint, playground build and frame-sheet artifacts on every
  push and pull request; GitHub Pages deployment of the playground.
- **npm packages**: `@openmascot/core`, `web`, `react`, `characters` and
  `cli` are built with tsup — ESM + CommonJS, `.d.ts` (types-first `exports`,
  checked with publint and are-the-types-wrong) and sourcemaps; `sideEffects:
  false`; `@openmascot/react` is marked `'use client'`. The CLI is a single
  bundled executable (`npx @openmascot/cli`), depending only on
  `@resvg/resvg-js`.
- **Per-character imports**: `@openmascot/characters/echo` (and `/pip`,
  `/riff`, `/library`) so apps bundle only the characters they use.
- **Release tooling**: Changesets (all packages versioned together), a
  release workflow that opens version PRs and publishes with npm provenance,
  `pnpm size`, and `pnpm smoke:pack`, which tests the packed tarballs in a
  fresh project (Node ESM/CJS, SSR, Vite + React, TypeScript bundler/node16,
  the CLI via npx, the custom element in Chromium) — also run in CI.

### Fixed

- Echo: the chest/body no longer pops over the chin when the body pitches
  or yaws (head and belly sort by `data-om-sort-z`), the membrane's lower
  edge stays on the flank in every wing pose and meets the hip with a soft
  concave scallop (never a straight, pointed sail edge), the spin no longer shows an
  X of membranes from behind or ghostly edge-on wings/ears, and the tuft
  and ears can't swing their base out of the head (limits + tucked roots).
- Children of foreshortened (`flat`/`face`/`feature`) bones were
  foreshortened twice when their parent turned (offsets now projected once).
- Children of a surface with a `normal` (pupils in a sideways-facing eye)
  sort by that surface's facing, so a visible eye never loses its pupil.
- The validator compares document order with `data-om-sort-z` when present.
- Perspective no longer enlarges near parts (eyes, snout) in the rest pose.
- A clip's `shadow` factor now applies even when the root bone is at rest.
