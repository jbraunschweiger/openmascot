# OpenMascot documentation

| doc | read it when you want to… |
|---|---|
| [architecture.md](architecture.md) | understand the pipeline, the packages, data flow, determinism and performance |
| [rig-format.md](rig-format.md) | annotate an SVG so it can move (bones, pivots, z, surfaces, slots, springs) |
| [characters.md](characters.md) | **author a new character end to end** — a step-by-step recipe for humans and AI agents |
| [animation.md](animation.md) | write clips: keyframes, eases, params, expressions, beat-synced dances, runtime API |
| [pseudo-3d.md](pseudo-3d.md) | understand the 2.5D model and design art that turns well |
| [effects.md](effects.md) | use the built-in particle effects or write your own |
| [api.md](api.md) | look up the core / web / react API |
| [mobile.md](mobile.md) | see the React Native plan and what is already mobile-ready |
| [testing.md](testing.md) | run unit tests, render frame sheets and screenshots, review motion visually |

Project-level docs: [README](../README.md) · [CONTRIBUTING](../CONTRIBUTING.md) ·
[AGENTS](../AGENTS.md) (for AI coding agents) · [CHANGELOG](../CHANGELOG.md) ·
[Code of Conduct](../CODE_OF_CONDUCT.md).

## Vocabulary

| term | meaning |
|---|---|
| **rig** | the compiled character: a tree of bones, slots, layers and static art (`compileRig(svg)`) |
| **bone** | an SVG `<g data-om-bone>` that animation can transform; has a pivot, depth `z` and a surface type |
| **slot / variant** | a group showing exactly one of several art variants (eye shapes, mouths, wing poses) |
| **layer** | static art that takes part in depth sorting without being animatable |
| **channel** | an animatable property of a bone: `x y rot sx sy yaw pitch dz opacity` |
| **param** | a portable, character-independent control (`lookX`, `flap`, `squash`…) that drives bone channels |
| **expression** | a named slot → variant map (`happy`, `sad`…) |
| **clip** | an animation: keyframe tracks for bones and params, expression/slot steps, effect events |
| **pose** | the full animatable state at an instant (bones, params, slots, expression) |
| **frame** | the solved result a renderer draws: per-bone matrices and opacities, visible slots, draw order |
| **effect / particle** | short-lived decorative art (hearts, notes…) emitted around the character |
| **frame sheet** | a contact sheet PNG of many frames, used to review motion |

## Images in these docs

All images under [`images/`](images) are produced by the CLI from the real
engine (see [testing.md](testing.md#frame-sheets)), e.g.

```bash
pnpm framesheet echo --sweep root.yaw --range 0,330 --frames 12 --tile 150 --out docs/images/sweep-root-yaw.png
pnpm framesheet echo --expressions --tile 150 --out docs/images/expressions.png
```
