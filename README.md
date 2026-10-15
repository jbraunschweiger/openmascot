# OpenMascot

**An open-source engine for rigged, animated SVG brand mascots.** Draw your
character once as a layered SVG, annotate a few pivots, and get a lively,
Duolingo-style mascot that blinks, breathes, glances around, emotes, dances,
turns in pseudo-3D and throws hearts and confetti — in a few kilobytes, with
no proprietary editor and no video files.

**[▶ Live demo](https://jbraunschweiger.github.io/openmascot/)** —
[Studio](https://jbraunschweiger.github.io/openmascot/#/studio) ·
[Gallery](https://jbraunschweiger.github.io/openmascot/#/gallery) ·
[App showcase](https://jbraunschweiger.github.io/openmascot/#/app)

<p align="center">
  <img src="docs/images/hero.png" width="300" alt="Echo the bat waving">
</p>

<p align="center">
  <img src="docs/images/sweep-root-yaw.png" alt="Echo turning a full circle in pseudo-3D (frame sheet)">
</p>

<p align="center">
  <img src="docs/images/expressions.png" width="600" alt="Echo's sixteen expressions">
</p>

> Status: **0.1.0, unreleased.** The web runtime is usable today from this
> monorepo; npm packages and React Native support are on the roadmap.

## Why

Brand mascots that *react* — celebrating a streak, nodding at a right answer,
sulking at a wrong one — make products feel alive. Today that usually means a
Rive/Lottie pipeline, an animator, and a binary file per animation. OpenMascot
takes a different route:

- **The character is one plain SVG.** It previews in any browser, Figma or
  Inkscape. A handful of `data-om-*` attributes say how it moves.
- **Animations are plain data.** Clips are JSON-serialisable keyframes that
  address standard bone names and portable *params* (`lookX`, `flap`,
  `squash`…), so one library of emotions and dances works across characters.
- **Fake 3D for free.** A 2.5D solver turns a single front-view drawing into a
  character that can spin 360°, look around and nod, with parallax,
  foreshortening, back-face culling and depth sorting.
- **Built for humans _and_ AI agents.** Everything is text: SVG, TypeScript
  data, and a CLI that renders **frame sheets** (contact sheets of an
  animation) so a reviewer — or a multimodal model — can check motion at a
  glance.
- **Deterministic.** Same seed, same frames. Great for tests, sheets and video
  export.

## Features

- Annotated-SVG rig format: bones, pivots, depth, surfaces, swappable slots
  (eyes, mouths, wing poses), spring bones, ground shadow — see
  [docs/rig-format.md](docs/rig-format.md).
- Crossfaded clip playback with one-shots, loops, repeats, speed, beat-synced
  dances (`bpm`), and `then` chaining.
- "Alive" layers: breathing, randomised blinks (with double blinks), idle
  glances, idle fidgets, pointer/look-at tracking.
- Expressions with **blink-masked eye swaps** (the eyes change behind a blink,
  like a 2D animator would do it).
- Spring secondary motion for ears, tufts and wings.
- 20+ built-in particle effects (hearts, sparkles, notes, sweat, tears,
  confetti, zzz, speed lines…) that are analytic and deterministic — see
  [docs/effects.md](docs/effects.md).
- Renderers: live DOM renderer (minimal attribute diffing), `<open-mascot>`
  custom element, React `<Mascot>` component, and a string renderer for SSR,
  snapshots and frame sheets.
- A CLI to validate rigs, lint clips, render frames and build frame sheets.
- Echo the bat, a complete reference character with 60+ clips.

## Quick start

> Until the packages are on npm, clone the repo and use the workspace
> packages (`pnpm install`, then `pnpm dev` for the playground).

### React

```tsx
import { Mascot, useMascotRef } from '@openmascot/react';
import { echo } from '@openmascot/characters';

export function Buddy() {
  const ref = useMascotRef();
  return (
    <div>
      <Mascot ref={ref} character={echo} animation="idle" lookAtPointer style={{ width: 240 }} />
      <button onClick={() => ref.current?.play('emote-celebrate')}>Celebrate</button>
      <button onClick={() => ref.current?.emit('hearts')}>Love</button>
    </div>
  );
}
```

### Custom element (no framework)

```html
<open-mascot character="echo" animation="dance-bop" bpm="110" look-at-pointer style="width:240px"></open-mascot>

<script type="module">
  import { defineOpenMascot } from '@openmascot/web';
  import { echo } from '@openmascot/characters';
  defineOpenMascot({ characters: { echo } });

  const el = document.querySelector('open-mascot');
  el.addEventListener('mascot:end', (e) => console.log('finished', e.detail.clip));
  el.play('wave');
</script>
```

### Vanilla core (any renderer, Node, workers)

```ts
import { Mascot, renderSvg } from '@openmascot/core';
import { echo } from '@openmascot/characters';

const m = new Mascot(echo, { seed: 42 });
m.play('emote-love');
for (let i = 0; i < 30; i++) m.update(1 / 60); // advance half a second
const svg = renderSvg(m.rig, m.current.frame, { padding: 40, particles: m.current.particles });
```

In the browser, pair the core with `DomRenderer` (or just use
`MascotPlayer` from `@openmascot/web`, which owns the animation loop). See
[docs/api.md](docs/api.md).

## How it works

```
 echo.svg (annotated) ──compileRig──▶ Rig
                                       │
 clips + alive layers ──Mascot.update──▶ Pose ──resolvePose──▶ bone channels ──solve (2.5D)──▶ Frame
                                                                                                │
                                   DomRenderer · renderSvg · (React Native, planned) ◀──────────┘
```

Read [docs/architecture.md](docs/architecture.md) for the full pipeline and
[docs/pseudo-3d.md](docs/pseudo-3d.md) for the 2.5D model.

## Packages

| package | what it is |
|---|---|
| [`@openmascot/core`](packages/core) | DOM-free engine: XML parser, rig compiler, 2.5D solver, clips, poses, effects, runtime, string renderer, authoring helpers. Zero dependencies. |
| [`@openmascot/web`](packages/web) | Browser runtime: `DomRenderer`, `MascotPlayer` (rAF loop, visibility pausing, reduced motion, pointer tracking), `<open-mascot>` element. |
| [`@openmascot/react`](packages/react) | `<Mascot>` component and `useMascotRef()` imperative handle. |
| [`@openmascot/characters`](packages/characters) | Echo the bat and the shared clip library (idle, fidgets, emotions, gestures, dances). |
| [`@openmascot/cli`](packages/cli) | `openmascot validate / list / lint / render / framesheet`. |
| [`apps/playground`](apps/playground) | Vite + React playground: studio, gallery and an app showcase. |

## Scripts

Requires Node 22+ and pnpm 10.

| command | does |
|---|---|
| `pnpm install` | install the workspace |
| `pnpm dev` | run the playground at http://localhost:5173 |
| `pnpm test` | unit tests (Vitest) |
| `pnpm typecheck` | `tsc --noEmit` over all packages and tests |
| `pnpm embed` / `pnpm embed --check` | regenerate / verify `art.generated.ts` from each character SVG |
| `pnpm check` | `embed --check` + `typecheck` + `test` (what CI runs first) |
| `pnpm openmascot <cmd>` | the CLI (`validate`, `list`, `lint`, `render`, `framesheet`) |
| `pnpm framesheet echo <clip>` | contact sheet of a clip → `out/sheets/` |
| `pnpm build` | build packages and the playground |

## Documentation

Start at [docs/README.md](docs/README.md). Highlights:

- [Rig format](docs/rig-format.md) — how to annotate an SVG
- [Authoring a character](docs/characters.md) — step by step, written so an AI agent can follow it
- [Animation](docs/animation.md) — clips, params, expressions, dances
- [Pseudo-3D](docs/pseudo-3d.md) — how a flat drawing turns around
- [Effects](docs/effects.md) — built-in particles and custom effects
- [API reference](docs/api.md)
- [Mobile plan](docs/mobile.md) — React Native and native exports
- [Testing & visual review](docs/testing.md)

## Roadmap

- [x] Annotated-SVG rig format, compiler and validator
- [x] 2.5D solver (parallax, foreshortening, culling, depth sort, perspective)
- [x] Runtime: crossfades, alive layers, expressions, springs, effects
- [x] Web: DOM renderer, custom element, React component
- [x] CLI frame sheets for visual review; Echo the bat
- [ ] Publish packages to npm (0.1.0)
- [ ] React Native renderer over `react-native-svg` ([plan](docs/mobile.md))
- [ ] More characters, and a character template
- [ ] Lip-sync / talking mouth driven by audio amplitude or visemes
- [ ] Video / GIF / sprite-sheet export; Lottie export for native players
- [ ] Visual rig editor in the playground (pivot picking, live z-ordering)

## Contributing

Contributions are welcome — new characters, clips, effects, renderers, docs.
Please read [CONTRIBUTING.md](CONTRIBUTING.md) and our
[Code of Conduct](CODE_OF_CONDUCT.md). AI coding agents should start with
[AGENTS.md](AGENTS.md).

## Licence

[MIT](LICENSE) — code and the bundled Echo character art.
