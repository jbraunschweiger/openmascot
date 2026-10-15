# The OpenMascot rig format (annotated SVG)

An OpenMascot character is **one plain SVG file** whose groups carry a few
`data-om-*` attributes. The file previews correctly in any browser, Figma,
or Inkscape — the annotations only tell the engine *how the drawing moves*.

This is deliberately simple so that humans **and AI models** can author
characters: draw the mascot as layered SVG groups, then annotate pivots and
depths. No proprietary editor is required.

```xml
<svg xmlns="http://www.w3.org/2000/svg" viewBox="-200 -290 400 310"
     data-om-character="echo">
  <g data-om-bone="shadow" data-om-shadow="">
    <ellipse cx="0" cy="0" rx="70" ry="9" fill="#000" opacity=".08"/>
  </g>
  <g data-om-bone="root" data-om-pivot="0 0">
    <g data-om-bone="body" data-om-pivot="0 -80">
      <g data-om-bone="wing-l" data-om-pivot="-45 -100" data-om-z="-20"
         data-om-surface="flat" data-om-spring="90 9" data-om-tip="-150 -90"> … </g>
      <path d="…body shape…" fill="#634c91"/>          <!-- body's own art, depth 0 -->
      <g data-om-bone="head" data-om-pivot="0 -140" data-om-z="4"> … </g>
    </g>
  </g>
</svg>
```

## Coordinate system

* Units are SVG user units. **`(0, 0)` is the ground point directly under the
  character's centre** (where the shadow sits). `y` grows downward as usual
  in SVG, so the character lives at negative `y`.
* The root `<svg>` **must** have a `viewBox` that frames the character in its
  rest pose. Renderers add padding around it for effects.
* All pivots / tips are given in **absolute character coordinates of the rest
  pose** (the numbers you would read off the drawing), never relative.

## Bones — `data-om-bone="name"`

Any `<g>` with `data-om-bone` is a **bone**: a node the animation system can
transform. Bones nest; a bone's transform applies to everything inside it.

| attribute | meaning | default |
|---|---|---|
| `data-om-bone="name"` | Bone name. Animations address bones by name. The same name may appear in several **variants of one slot** (e.g. a `pupil-l` inside each eye variant); all instances receive the same pose. | — |
| `data-om-pivot="x y"` | Rotation / scale origin (absolute coordinates). | parent pivot |
| `data-om-z="n"` | Depth of the pivot **relative to the parent pivot**, positive = toward the viewer. Drives pseudo‑3D parallax, sibling layering and perspective. | `0` |
| `data-om-surface` | How the bone reacts to 3D rotation (see below): `volume`, `flat`, `face`, `back`. | `volume` |
| `data-om-normal="yaw pitch"` | Direction (degrees) the surface faces at rest. An eye on the left of a round head faces slightly left, e.g. `-25 0`. | `0 0` |
| `data-om-spring="stiffness damping"` | Secondary motion: the bone's rotation lags/overshoots when its parent accelerates (ears, hair tufts, wings, antennae). | none |
| `data-om-tip="x y"` | Centre of mass used by the spring (usually the far tip of the ear/wing). | pivot + (0, −30) |
| `data-om-shadow` | Marks the ground shadow bone (must be **outside** `root`). The runtime scales/fades it with the root's height. | — |

### Layering (z-order)

Within a bone, its **own art** (direct children that are not bones, slots, or
layers) sits at depth `0`. Child bones, slots, and layers are drawn sorted by
their *projected* depth, so a wing with `data-om-z="-20"` is drawn behind the
body, and swaps in front of it when the body spins 180°. Ties keep document
order. **Keep document order consistent with z** so the raw file previews the
same as the engine renders it.

`<g data-om-layer="" data-om-z="n">` groups static art so it can take part in
depth sorting without being an animatable bone (e.g. a body front highlight).

### Surfaces — how pseudo-3D works

Bones may rotate in 3D through the `yaw` (turn left/right) and `pitch` (nod)
channels. A rotated bone **moves its children's pivots in 3D** (a head turning
right slides the eyes and snout right and the ears left — parallax) and
re-sorts them by depth. Then each child's *surface* decides how its flat art
is distorted:

| surface | behaviour | use for |
|---|---|---|
| `volume` | Never foreshortened, never hidden. Looks the same from all sides. | round heads/bodies, feet |
| `flat` | Scaled by `cos(angle)` on each axis — becomes a sliver edge-on and **mirrors** when seen from behind. | wings, ears, fins, tufts |
| `face` | Mildly foreshortened, **fades out when facing away** (back-face culling). | eyes, snout, mouth, belly patch, blush |
| `back` | Like `face`, but only visible from **behind** (normal + 180°). | back markings, wing-joint details |

With just these four rules a front-view drawing can spin 360°, look around,
and nod convincingly — the classic flat-vector "2.5D" trick.

## Slots & variants — swappable art

```xml
<g data-om-slot="eye-l">
  <g data-om-variant="open"> … <g data-om-bone="pupil-l" …/> … </g>
  <g data-om-variant="happy" display="none"> … </g>
  <g data-om-variant="heart" display="none"> … </g>
</g>
```

* A **slot** shows exactly one **variant** at a time. The first variant (or the
  one marked `data-om-default=""`) is the default.
* Give non-default variants `display="none"` so the raw file previews
  correctly; the engine manages visibility itself.
* A slot is not transformable; wrap it in a bone (e.g. `eye-l`) if it should
  move. Slots take part in depth sorting with `data-om-z` like layers.

Expressions (defined in the character's TypeScript meta) are just named maps
`slot → variant`, e.g. `love = { "eye-l": "heart", "eye-r": "heart", mouth: "open" }`.

## Standard bone & slot names

Animations are portable between characters that share names. Use these where
they make sense (`-l` / `-r` = **screen** left / right):

| bones | |
|---|---|
| `root` | whole character (jumps, spins, travel) |
| `body` | torso; parent of head and limbs |
| `head` | head; parent of facial features and ears |
| `ear-l`, `ear-r`, `tuft` | spring-driven appendages |
| `eye-l`, `eye-r` | eye containers (blink scales these vertically) |
| `pupil-l`, `pupil-r` | pupils (look-at moves these) |
| `nose`, `mouth`, `belly` | face / body features |
| `wing-l`, `wing-r` *(or `arm-l`, `arm-r`)* | forelimbs |
| `foot-l`, `foot-r` | feet |
| `shadow` | ground shadow (outside `root`) |

| slots | typical variants |
|---|---|
| `eye-l`, `eye-r` | `open`, `happy`, `closed`, `heart`, `half`, `angry`, `sad`, `surprised`, `dizzy` |
| `mouth` | `default`, `smile`, `open`, `tongue`, `o`, `frown`, `grin` |
| `wing-l`, `wing-r` | `spread`, `folded` |
| `blush` | `off`, `on` |

## Validation

`pnpm openmascot validate path/to/character.svg` checks the annotations
(duplicate bone names outside slots, missing pivots, inconsistent layer order,
unknown surfaces…) and prints the bone tree.
