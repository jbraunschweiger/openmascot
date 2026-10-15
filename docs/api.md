# API reference

The source is the ground truth — every export has a doc comment. This page is
the map. Data shapes (`CharacterDef`, `Clip`, `Pose`, `Frame`, …) live in
`packages/core/src/types.ts`; see also [animation.md](animation.md) for clip
authoring and [rig-format.md](rig-format.md) for the SVG annotations.

- [`@openmascot/core`](#openmascotcore)
  - [Mascot (runtime)](#mascot) · [Rig](#rig) · [Clips & authoring](#clips--authoring) ·
    [Poses](#poses) · [Solver](#solver) · [Rendering to a string](#rendering-to-a-string) ·
    [Effects](#effects) · [Math & easing](#math--easing) · [XML](#xml)
- [`@openmascot/web`](#openmascotweb) — `MascotPlayer`, `DomRenderer`, `<open-mascot>`
- [`@openmascot/react`](#openmascotreact) — `<Mascot>`, `useMascotRef`
- [`@openmascot/characters`](#openmascotcharacters)
- [CLI](#cli)

---

## `@openmascot/core`

DOM-free, zero dependencies. Runs in browsers, Node, workers and React Native.

### `Mascot`

```ts
import { Mascot } from '@openmascot/core';
const m = new Mascot(character, options?);
```

**`MascotOptions`**

| option | default | |
|---|---|---|
| `library` | `{}` | shared clips; the character's own `clips` override same-named entries |
| `effects` | built-ins | extra/overriding effects, merged over `builtinEffects` |
| `seed` | `1` | RNG seed for blinks, glances, fidgets, effects, `ctx.random` |
| `alive` | `true` | autonomous life: breathing, blinks, glances, fidgets |
| `initial` | idle clip | clip to start with (a name that doesn't exist = no clip) |
| `initialOptions` | — | `PlayOptions` for the initial clip (e.g. `{ then: null, bpm: 100 }`) |
| `solve` | — | `{ focal?: number = 900, faceForeshorten?: number = 0.85 }`, see [pseudo-3d.md](pseudo-3d.md) |
| `effectScale` | `1` | size multiplier for all effects |
| `recolor` | — | `{ '#634c91': '#2a9d8f' }` colour substitutions (case-insensitive) |

**Members**

| member | |
|---|---|
| `update(dt): MascotFrame` | advance `dt` seconds (clamped to 0…0.25) and return the new frame |
| `current: MascotFrame` | last frame: `{ time, frame: Frame, particles: ParticleFrame[] }` |
| `play(nameOrClip, opts?): Promise<void>` | crossfade to a clip; resolves when a one-shot ends or the clip is replaced |
| `idle(fade = 0.35)` | play the idle clip |
| `playing: string \| undefined` | the clip currently dominating |
| `idleClip: string` | the idle clip name (`character.idle.clip ?? 'idle'`) |
| `setExpression(name \| null, duration?)` | expression override, optionally for `duration` seconds |
| `setParam(name, value \| null)` | force a param (e.g. `lookX`), `null` clears |
| `lookAt({ x, y } \| null)` | look direction, each axis −1…1; `null` resumes idle glancing |
| `lookAtPoint(x, y, range = 260)` | look toward a point in character coordinates |
| `emit(effect, { at?, params? })` | spawn an effect now ([effects.md](effects.md)) |
| `clearEffects()` | remove all particles |
| `blink()` | blink now |
| `setAlive(on)`, `isAlive` | toggle / read autonomous life |
| `setSpeed(speed)` | change the speed of the playing clip |
| `setTempo(bpm)` | retime the playing beat clip without restarting it (phase preserved) |
| `progress()` | `{ clip, time, duration, loop }` of the dominant clip (seconds), or `undefined` |
| `on(listener): () => void` | subscribe to `MascotEvent`s; returns an unsubscribe function |
| `time`, `rig`, `clips`, `effects`, `character`, `warnings` | read-only state (`warnings` = rig compile warnings) |

**`PlayOptions`**

| option | default | |
|---|---|---|
| `fade` | `clip.fadeIn ?? 0.25` | crossfade seconds (0 = cut) |
| `loop` | `clip.loop` | override looping |
| `speed` | `1` | playback speed multiplier |
| `bpm` | `clip.bpm ?? 120` | tempo for `units: 'beats'` clips |
| `then` | `clip.then ?? idle` | for one-shots (and loops with `repeat`): clip to continue with; `null` holds the last frame |
| `repeat` | `Infinity` | for loops: stop after N cycles |
| `offset` | `0` | start offset in seconds |

**`MascotEvent`**: `{ type: 'start' | 'end' | 'loop', clip }`,
`{ type: 'effect', clip, effect }`, `{ type: 'expression', expression }`.

**`Clip` fields** (see [animation.md](animation.md) for authoring):
`duration`, `units` (`'seconds' | 'beats'`), `bpm`, `loop`, `bones`, `params`,
`expression` (`[time, name][]`), `slots` (`{ slot: [time, variant][] }`, `''` =
no override), `events`, `fn` (procedural hook), `suppress` (`{ blink, breathe,
look, fidget }`), `fadeIn`, `then` (default follow-up, `null` = hold),
`shadow` (shadow opacity factor, e.g. `0` while hanging), `blinkMask`
(`false` = swap eye art without the masking blink), `name`, `description`,
`category`.

### Rig

| export | |
|---|---|
| `compileRig(svg, { recolor?, warnings? }): Rig` | compile annotated SVG; throws `RigError` on malformed annotations, pushes `RigWarning`s |
| `describeRig(rig): string` | pretty tree (used by `openmascot validate`) |
| `RigError`, `RigWarning`, `CompileOptions` | |
| `Rig` | `{ id, viewBox, defs, nodes, bones, bonesByName, slots, slotsByName, svgAttrs }` |
| `RigNode` | `BoneNode \| SlotNode \| LayerNode \| ArtNode` |

### Clips & authoring

| export | |
|---|---|
| `sampleClip(clip, t, ctx, out?)` | sample a clip at local time `t` (clip units) into a `Pose` |
| `sampleTrack(keys, t)` | sample one keyframe track (holds before first/after last key) |
| `secondsPerUnit(clip, bpm?)`, `clipSeconds(clip, bpm?)` | time units (`beats` → seconds) |
| `lintClip(clip, knownBones?, knownParams?): string[]` | problems: duration, malformed/unsorted/out-of-range keys, unknown eases/bones/params |
| `defineClip(clip)`, `defineClips(record)` | typed identity helpers (`defineClips` fills in `name`) |
| `keys(ease, [t, v], [t, v, ease?], …)` | keyframes sharing an ease |
| `cycle(duration, values, ease?, start?)` | evenly spaced looping keys back to the first value |
| `wave(duration, amplitude, { cycles, phase, offset, steps })` | sampled sine as linear keys |
| `mirrorClip(clip, name?)` | swap `-l`/`-r`, negate `x rot yaw`, `*X` params and `lean`; drops `fn` |
| `sequence(name, parts, opts?)` | concatenate clips; inserts rest keys and slot/expression resets so nothing leaks between parts |

### Poses

| export | |
|---|---|
| `emptyPose()`, `clonePose(p)` | |
| `blendPoses(a, b, w)` | linear blend; missing channels = rest; `rot`/`yaw` take the shortest way; slots/expression switch at `w ≥ 0.5` |
| `layerPose(base, add, weight = 1)` | additive layer: offsets add, `sx sy opacity` multiply |
| `setChannel`, `addChannel`, `addParam` | helpers for procedural `clip.fn` hooks |
| `resolvePose(character, rig, pose): ResolvedPose` | params → channels (clamped, drivers/curves), expression → full slot map |
| `piecewise(curve, x)`, `wrap180(deg)`, `MULTIPLICATIVE` | |

### Solver

| export | |
|---|---|
| `solve(rig, { channels, slots, extraRot? }, opts?, prev?): Frame` | the 2.5D solve ([pseudo-3d.md](pseudo-3d.md)) |
| `bonePosition(rig, frame, bone, offset?)` | world position of a bone's pivot (first instance) |
| `Frame` | `{ bones: SolvedBone[] (by bone instance), slots, order: Map<containerIndex, childOrder> }` |
| `SolvedBone` | `{ local, world, opacity, depth, yaw, pitch, rigid? }` — `local` is relative to the parent group |

### Rendering to a string

| export | |
|---|---|
| `renderSvg(rig, frame, opts?)` | standalone SVG markup. Options: `padding` (number or `[t, r, b, l]`), `viewBox`, `width`, `height`, `background`, `particles`, `xmlns` (default true), `attrs` |
| `renderParticles(particles)` | particle markup only |
| `paddedViewBox(rig, padding)` | |

### Effects

| export | |
|---|---|
| `builtinEffects` | the registry of built-in effects ([effects.md](effects.md)) |
| `EffectDef`, `EffectRegistry`, `EffectContext`, `ParticleSpec`, `ParticleState`, `Particle`, `ParticleFrame` | types |
| `rng(seed)` | mulberry32 PRNG in [0, 1) |
| `particleFrame(p, now, origin)`, `particleDone(p, now)` | evaluate a particle |
| `popEnvelope(u, in?, out?)`, `fadeEnvelope(u, in?, out?)`, `num(v, d)`, `str(v, d)`, `SHAPES` | helpers for writing effects |

### Math & easing

| export | |
|---|---|
| `Mat` = `[a, b, c, d, e, f]` | SVG `matrix()` order |
| `IDENTITY`, `mul(m, n)` (n first), `apply(m, x, y)`, `invert(m)`, `angleOf(m)`, `scaleOf(m)`, `isIdentity(m, eps?)`, `matToString(m)` | |
| `boneMatrix(tx, ty, px, py, rot, sx, sy)` | translate · T(p) · R · S · T(−p) |
| `EASES`, `resolveEase(ease)`, `cubicBezier(x1, y1, x2, y2)` | eases (`linear step in out inOut sine* quad* cubic* back* elasticOut bounceOut`) or `[x1, y1, x2, y2]` |
| `clamp`, `lerp`, `smoothstep` | |
| `CHANNELS`, `REST` | channel names and rest values |

### XML

`parseXml(src): XmlElement` (throws `XmlError` with a line number),
`serializeXml(node)`, `serializeAttrs(attrs)`, `escapeText(s)`,
`escapeAttr(s)`. A tiny SVG-sufficient parser so the core never needs
`DOMParser`.

---

## `@openmascot/web`

### `MascotPlayer`

```ts
import { MascotPlayer } from '@openmascot/web';
const player = new MascotPlayer(element, character, options?);
player.play('wave');
player.mascot.setExpression('happy', 2);
player.destroy();
```

`PlayerOptions` = `MascotOptions` + `DomRendererOptions` +:

| option | default | |
|---|---|---|
| `autoplay` | `true` | start the rAF loop |
| `lookAtPointer` | `false` | eyes/head follow the pointer anywhere on the page |
| `speed` | `1` | global playback speed (also a mutable property) |
| `respectReducedMotion` | `true` | with `prefers-reduced-motion: reduce`, `alive` defaults to false |

`seed` defaults to a random value in the player (pass one for reproducible
behaviour). Members: `mascot`, `renderer`, `element`, `speed`, `start()`,
`stop()`, `step(dt)` (manual advance, e.g. scrubbing with autoplay off),
`play(name, opts)`, `trackPointer(on)`, `clientToCharacter(x, y)`,
`destroy()`. The loop pauses while the element is off-screen or the tab is
hidden.

### `DomRenderer`

```ts
const r = new DomRenderer(rig, { padding: 40, title: 'Echo' });
host.appendChild(r.svg);
r.render(mascot.update(dt));   // MascotFrame (with particles) or a bare Frame
```

Builds the SVG once and then only writes changed attributes. `svg`,
`render(frame)`, `destroy()`.

### `<open-mascot>`

```ts
import { defineOpenMascot, registerCharacter } from '@openmascot/web';
defineOpenMascot({ characters: { echo }, tag: 'open-mascot' }); // idempotent
```

| attribute | |
|---|---|
| `character` | registered character id (default: the first registered) |
| `animation` | clip to play (changing it plays the new clip and holds one-shots) |
| `expression` | expression override |
| `bpm`, `speed`, `padding` | numbers |
| `look-at-pointer` | boolean |
| `paused` | boolean: stop/start the loop |

Methods: `play(name, opts?)`, `emit(effect, opts?)`, `setExpression(name, duration?)`,
`lookAt(target)`; property `player`. Events: `mascot:start`, `mascot:end`,
`mascot:loop`, `mascot:effect`, `mascot:expression` (`CustomEvent`, `detail`
= the `MascotEvent`).

---

## `@openmascot/react`

```tsx
import { Mascot, useMascotRef, type MascotHandle } from '@openmascot/react';

const ref = useMascotRef();
<Mascot ref={ref} character={echo} animation="dance-bop" bpm={110} lookAtPointer style={{ width: 240 }} />;
ref.current?.play('wave');
```

| prop | |
|---|---|
| `character` (required) | `CharacterDef`; changing it recreates the player |
| `animation` | clip to play; changing it crossfades. One-shots return to idle unless `holdLastFrame` |
| `animationKey` | change to re-trigger the same `animation` |
| `expression` | expression override (`null`/undefined = clip/neutral) |
| `bpm`, `speed`, `fade` | playback |
| `holdLastFrame` | one-shots hold their last frame |
| `lookAtPointer` / `look` | follow the pointer, or a fixed `{ x, y }` direction |
| `paused` | stop the loop |
| `padding` | character units around the rig (room for effects); recreates the player |
| `options` | extra `MascotOptions` (seed, recolor, library, effects…), read on mount |
| `onEvent` | `MascotEvent` callback |
| `className`, `style`, `title` | host `<div>` / accessible title |
| any other `<div>` attribute | forwarded to the host `<div>` (`id`, `aria-*`, `onClick`, …) |

`MascotHandle`: `play`, `emit`, `setExpression`, `lookAt`, `blink`, and
read-only `runtime` (the `Mascot`) and `player` (the `MascotPlayer`).

---

## `@openmascot/characters`

| export | |
|---|---|
| `echo`, `echoExpressions` | Echo the bat (`CharacterDef`) |
| `pip`, `pipExpressions` | Pip the bird |
| `riff`, `riffExpressions` | Riff the frog |
| `characters` | registry by id (used by the CLI and playground) |
| `library` | the shared clip library (idle, fidgets, emotions, gestures, dances) |
| `clipCategories(clips?)` | clip names grouped by `category` |

Subpath exports bundle only what you import:

```ts
import { echo } from '@openmascot/characters/echo';
import { pip } from '@openmascot/characters/pip';
import { riff } from '@openmascot/characters/riff';
import { library } from '@openmascot/characters/library';
```

All characters share the same expression names and map the standard params
(`lookX lookY blink breathe squash flap lean wingFold raiseL raiseR`), so the
shared library clips play on each of them. `CharacterDef.restParams` sets the
value of params a clip doesn't animate (e.g. `{ wingFold: 0.5 }` for relaxed
wings) and `CharacterDef.effectParams` sets per-character effect defaults (e.g.
where `tears` start).

---

## CLI

```
pnpm openmascot validate <character|file.svg>     # bone tree + warnings (rig, expressions, param drivers)
pnpm openmascot list [character]                  # clips by category, expressions, effects
pnpm openmascot lint [character]                  # every clip vs rig/params/expressions/effects (exit 1 on problems)
pnpm openmascot render <character> [--clip c] [--time s] [--expression e] [--width px] [--padding u] [--out x.svg|png]
pnpm openmascot framesheet <character> <clip> [--frames 12] [--cols 6] [--tile 220] [--from idle] [--hold s]
        [--bpm n] [--start s] [--duration s] [--per-beat n] [--warmup s] [--padding u] [--alive] [--out x.png]
pnpm openmascot framesheet <character> --expressions
pnpm openmascot framesheet <character> --sweep bone.channel [--range a,b] [--frames n]
pnpm openmascot framesheet <character> --param name [--range a,b]
```

`pnpm framesheet …` is a shortcut for `pnpm openmascot framesheet …`. Output
defaults to `out/sheets/<character>-<name>.png`. See [testing.md](testing.md).
