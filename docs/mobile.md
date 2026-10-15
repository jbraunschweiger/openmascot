# Mobile: React Native and native players

OpenMascot is web-first, but the engine was designed so that mobile is a
**new renderer, not a port**. This page describes what is already
mobile-ready, the plan for React Native, and longer-term native options.

## What is already mobile-ready

| piece | status | why |
|---|---|---|
| `@openmascot/core` | ✅ runs as-is | no DOM, no `DOMParser`, no Node APIs, zero dependencies; plain ES2022 |
| Rig compile | ✅ | own tiny XML parser (`xml.ts`), works in Hermes/JSC |
| Character data | ✅ | the SVG is embedded as a string module (`art.generated.ts`); no asset loader needed |
| Clips, params, expressions | ✅ | plain JSON-serialisable data (except optional `fn` hooks) |
| `Mascot` runtime | ✅ | deterministic, frame-rate independent, `update(dt)` driven |
| Effects | ✅ | analytic particles; markup is plain SVG elements (`path`, `circle`, `ellipse`, `rect`, `g`) |
| `Frame` output | ✅ | per-bone 2D affine matrices, opacities, visible slot variants and draw order — exactly what a retained-mode SVG tree needs |
| `@openmascot/web`, `@openmascot/react` | ❌ web only | use `document`, `requestAnimationFrame`, `IntersectionObserver` |

## Plan: `@openmascot/react-native`

A renderer over [`react-native-svg`](https://github.com/software-mansion/react-native-svg)
that draws the same `Frame` data the DOM renderer does.

```
                     ┌───────────────── shared ─────────────────┐
 CharacterDef ──────▶│ compileRig → Mascot.update(dt) → Frame   │
                     └──────────────────────────────────────────┘
                                │ MascotFrame
           ┌────────────────────┴───────────────────┐
   web: DomRenderer                       native: <RNMascot>
   (setAttribute on <g>)                  (react-native-svg <G> tree,
                                           transforms via Reanimated
                                           shared values / setNativeProps)
```

### Design

1. **Static tree, built once.** Convert the compiled `Rig` into a
   `react-native-svg` element tree once: each bone/layer/slot-variant becomes a
   `<G>`, and each `ArtNode`'s pre-serialised markup is converted to
   components (`<Path>`, `<Circle>`, `<Ellipse>`, `<Rect>`, `<Polygon>`,
   gradients in `<Defs>`). This conversion can reuse `parseXml` and a small
   element-name → component map; anything unsupported is reported at build
   time. Alternatively, `SvgXml` can render each art node's markup.
2. **Per-frame updates without React re-renders.** Drive each bone `<G>`'s
   `matrix` and `opacity` from the solved frame:
   - simplest: `ref.setNativeProps({ matrix, opacity })` on every bone group
     from a `requestAnimationFrame` loop (mirrors `DomRenderer`'s diffing:
     only changed values are written);
   - smoother: run `Mascot.update` on the JS thread and push matrices into
     Reanimated shared values consumed by `useAnimatedProps` on each `<G>`.
3. **Slots** toggle `display`/`opacity` of variant groups, exactly like the
   DOM renderer.
4. **Draw order.** `Frame.order` lists, per container, the child order when it
   differs from document order. React Native SVG has no `appendChild`, so the
   container re-renders its children array in the new order — orders only
   change at depth crossings (a few times per spin), so a React state update
   there is cheap.
5. **Particles** are a keyed list of `<G transform opacity>` wrappers around
   the converted particle markup; spawn/expiry are React state updates, motion
   is per-frame props.
6. **Lifecycle.** Pause on `AppState` background, honour
   `AccessibilityInfo.isReduceMotionEnabled()` (→ `alive: false`), accept a
   `seed` for deterministic behaviour.

### Proposed API (mirrors `@openmascot/react`)

```tsx
import { Mascot } from '@openmascot/react-native';
import { echo } from '@openmascot/characters';

<Mascot ref={ref} character={echo} animation="idle" expression="happy" style={{ width: 200, height: 200 }} />
ref.current?.play('emote-celebrate');
ref.current?.emit('confetti');
```

Same props (`animation`, `animationKey`, `expression`, `bpm`, `speed`,
`fade`, `holdLastFrame`, `look`, `paused`, `padding`, `options`, `onEvent`)
and the same `MascotHandle`. Pointer tracking becomes optional touch tracking.

### Milestones

1. Prototype: `SvgXml` per art node + `setNativeProps` matrices; Echo idle at 60 fps on a mid-range Android device.
2. Markup → component conversion for the SVG subset used by characters and effects; build-time warnings for unsupported features.
3. Reanimated driver; benchmark against the `setNativeProps` path.
4. Particles, slot swaps, draw-order changes; parity tests that compare
   the RN tree's transforms with `renderSvg` for the same seed and time.
5. Publish `@openmascot/react-native`; Expo example app.

### Authoring constraints that keep characters mobile-friendly

- Stick to basic shapes, paths, solid fills, simple linear/radial gradients.
- Avoid filters (`feGaussianBlur`, drop shadows), masks, CSS in `<style>`,
  `<text>` with fonts (draw glyphs as paths — the built-in effects already do).
- Keep node counts modest (Echo: 30 bone instances and ~110 shapes).

## Later: native players via export

For apps that can't run JavaScript in the render path, or that already ship a
native animation runtime:

| target | approach | trade-offs |
|---|---|---|
| **Lottie** | bake clips to Lottie JSON: each bone → a shape layer with transform keyframes sampled from the solver (e.g. at 30–60 fps), slots → opacity-switched layers, depth changes → layer re-ordering via duplicated layers or opacity swaps | plays everywhere (iOS/Android/web); loses interactivity (look-at, live blending, random blinks) — bake an idle with pre-rolled blinks |
| **Rive** | export the rig as bones/groups with keyed transforms, slots as solos, params as state-machine inputs | keeps some interactivity (state machine), richer runtime; more complex exporter |
| **Sprite sheets / video** | `renderSvg` + resvg (already used by the CLI) to PNG frames → sprite sheet, APNG, WebM/HEVC with alpha | simplest, works anywhere; largest files, no interactivity |

Determinism makes all of these straightforward: the exporter steps a seeded
`Mascot` at a fixed rate and records frames — the same technique the frame
sheets use today.
