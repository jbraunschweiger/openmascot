# Animation in OpenMascot

Animation is layered, like in a game engine:

```
 clip tracks (crossfaded)            ← play('dance-spin'), one-shots return to idle
   + alive layers                    ← breathing, blinking, glances, fidgets, look-at
   + expression override             ← setExpression('happy')
   → params resolved to bones        ← lookX → head.yaw, pupils.x …
   → springs (secondary motion)      ← ears / tuft / wings lag & overshoot
   → 2.5D solve → frame              ← parallax, foreshortening, depth sort
   + effects (particles)             ← hearts, sparkles, notes …
```

## Clips

A clip is plain data (JSON-serialisable unless you use `fn`):

```ts
import { defineClip, keys, cycle } from '@openmascot/core';

export const cheer = defineClip({
  description: 'Jump with both wings up, sparkles at the top.',
  category: 'emotion',          // idle | fidget | emotion | gesture | pose | dance | locomotion
  duration: 1.2,                // seconds (or beats, see below)
  loop: false,
  bones: {
    root: { y: keys('quadOut', [0, 0], [0.15, 0], [0.45, -40], [0.75, 0, 'bounceOut']) },
    head: { rot: keys('sineInOut', [0, 0], [0.45, -6], [1.2, 0]) },
  },
  params: {
    squash: keys('sineInOut', [0, 0], [0.12, 0.5], [0.25, -0.4], [0.75, 0.4], [0.95, 0]),
    flap: keys('backOut', [0, 0], [0.3, 1], [0.8, 0.2], [1.2, 0]),
  },
  expression: [[0, 'excited'], [0.4, 'joyful']],   // step changes
  slots: { 'wing-l': [[0, 'spread']] },             // direct slot overrides (step)
  events: [{ t: 0.45, effect: 'sparkles', at: 'head', params: { count: 5 } }],
  suppress: { look: true },     // disable alive layers while dominant
  fadeIn: 0.15,                 // crossfade into this clip
});
```

### Keyframes

`[time, value]` or `[time, value, ease]`. The ease applies to the segment
**leaving** that key; the default is `sineInOut`. Before the first key the
first value holds; after the last key the last value holds.

Eases: `linear step in out inOut sineIn sineOut sineInOut quadIn quadOut
quadInOut cubicIn cubicOut cubicInOut backIn backOut backInOut elasticOut
bounceOut` or a cubic-bezier `[x1, y1, x2, y2]`.

Helpers (from `@openmascot/core`):

* `keys(ease, [t, v], [t, v, easeOverride], …)`
* `cycle(duration, [v0, v1, v2, …], ease?)` — evenly spaced looping keys that return to `v0`
* `wave(duration, amplitude, { cycles, phase, offset })` — sampled sine
* `mirrorClip(clip)` — swaps `-l`/`-r` and negates x / rot / yaw / `*X` params
* `sequence(name, [clipA, clipB, …])` — concatenate moves into a routine

### Channels (per bone)

| channel | unit | rest | notes |
|---|---|---|---|
| `x`, `y` | character units | 0 | in the parent's space; `y` negative = up |
| `rot` | degrees | 0 | clockwise; about the pivot |
| `sx`, `sy` | factor | 1 | about the pivot |
| `yaw` | degrees | 0 | **pseudo-3D turn** of the bone's subtree (+ = turn to screen‑right). 360 = full spin |
| `pitch` | degrees | 0 | pseudo-3D nod (+ = look down) |
| `dz` | units | 0 | dolly toward camera (bigger, sorts in front) |
| `opacity` | 0..1 | 1 | |

Bone values in a clip are **absolute** (relative to rest), and the clip's
values replace other clips' via crossfade. Params are added on top.

### Params (portable controls)

Characters map these standard params onto their bones, so clips that use
params work across characters. Echo implements:

| param | range | meaning |
|---|---|---|
| `lookX` | −1..1 | look left/right (head yaw, pupils lead) |
| `lookY` | −1..1 | look up(−)/down(+) |
| `blink` | 0..1 | eyelids |
| `breathe` | −1..1 | breathing (runtime drives this) |
| `squash` | −1..1 | + squash down / − stretch up, anchored at the feet |
| `flap` | −1.5..1.5 | wings: +1 both up, −1 both down/forward |
| `lean` | −1..1 | lean whole body ±12° |

Prefer params for "what" (look, flap, squash) and bone channels for "where"
(root travel, head tilt, spins).

### Beat-synced clips (dances)

```ts
{ units: 'beats', bpm: 120, duration: 8, loop: true, … }
```

Times are in beats. `mascot.play('dance-bop', { bpm: 96 })` retimes it to
any song.

## Runtime API

```ts
const m = new Mascot(echo);            // from @openmascot/core (DOM-free)
m.play('dance-spin', { fade: 0.3, bpm: 110, repeat: 2, then: 'idle' });
await m.play('emote-love');            // one-shot; returns to idle afterwards
m.setExpression('happy', 2);           // 2 s override
m.emit('confetti');
m.lookAt({ x: 0.5, y: -0.2 });         // or lookAtPoint(x, y) in character space
m.on((e) => console.log(e));           // start/end/loop/effect/expression
m.update(dt);                          // advance; returns { frame, particles }
```

Eye-art swaps (expression changes) are automatically hidden behind a quick
blink, like a 2D animator would do.

## Principles for good mascot motion

1. **Anticipation → action → follow-through.** Squash before a jump, stretch
   on the way up, squash on landing, settle with a small overshoot.
2. **Offset timing.** Head lags body by 1–3 frames; wings lag the body; ears
   and tuft are springs and lag automatically.
3. **Arcs.** Move `x` and `y` together so paths curve.
4. **Fake 3D.** Turn with `yaw` (parallax + face culling), lean in with `dz`
   and a little scale, nod with `pitch`. For spins, rotate `root.yaw` 0→360
   with an ease and add a squash/stretch.
5. **Hold the pose.** Readable key poses held for 0.15–0.4 s make emotions land.
6. **Effects punctuate.** Emit sparkles / hearts on the accent frame, not at t=0.

## Reviewing animation

```bash
pnpm framesheet echo cheer --frames 12            # contact sheet → out/sheets/
pnpm framesheet echo cheer --from idle            # include the transition from idle
pnpm framesheet echo --sweep root.yaw --range 0,360
pnpm framesheet echo --param lookX
pnpm framesheet echo --expressions
pnpm openmascot lint echo                         # every clip vs the rig
```
