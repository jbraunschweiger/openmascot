# Changelog

All notable changes to this project are documented here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and the project uses
[Semantic Versioning](https://semver.org/). All packages are versioned
together.

## [0.1.0] — Unreleased

First public version.

### Added

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

- Perspective no longer enlarges near parts (eyes, snout) in the rest pose.
- A clip's `shadow` factor now applies even when the root bone is at rest.
