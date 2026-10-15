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
| `data-om-surface` | How the bone reacts to 3D rotation (see below): `volume`, `flat`, `face`, `back`, `feature`. | `volume` |
| `data-om-normal="yaw pitch"` | Direction (degrees) the surface faces at rest. An eye on the left of a round head faces slightly left, e.g. `-25 0`. | `0 0` |
| `data-om-spring="stiffness damping"` | Secondary motion: the bone's rotation lags/overshoots when its parent accelerates (ears, hair tufts, wings, antennae). | none |
| `data-om-tip="x y"` | Centre of mass used by the spring (usually the far tip of the ear/wing). | pivot + (0, −30) |
| `data-om-spring-limit="min max"` | Limits (degrees, + = clockwise, in the bone's own unmirrored sense) for the spring's extra rotation. When the spring reaches a limit it rests against it instead of winding past. Use it so a tuft/ear never swings its base out of the head. | `-55 55` |
| `data-om-bleed="w"` | Gives every solidly filled shape in this bone **and its subtree** a stroke of its own fill colour, `w` units wide (round joins), so pieces that abut along cut lines overlap by `w/2` and anti-aliasing can't open hairline seams between them in any renderer. Shapes that already have a stroke, `fill="none"`, gradient fills or `fill-opacity` are left alone; a child bone can switch it off with `0`. The outline grows by `w/2` (use ~1 unit). | none |
| `data-om-shadow` | Marks the ground shadow bone (must be **outside** `root`). The runtime scales/fades it with the root's height. | — |
| `data-om-sort-z="n"` | Depth used **only for sorting** among siblings, in place of `z` (rotated like `z`, with the same pivot lever). Parallax and perspective still use `z`. Use it when the pivot's depth isn't the depth of the surface that overlaps the neighbours — e.g. Echo's head (`z 4`, `sort-z 60`: the chin overhangs the chest) and belly (`z 40`, `sort-z 10`). Document order is validated against it. | `z` |
| `data-om-flat-min="f"` | `flat` only: minimum \|foreshortening\| (0..1). Edge-on, the art keeps this fraction of its width and stays opaque, instead of fading out — a wing or ear seen edge-on still reads as a thin shape. | none (fade) |
| `data-om-feature-min="f"` | `feature` only: how narrow the feature may foreshorten in profile (0..1). | `0.4` |
| `data-om-pin="bone x y [bone2 x2 y2 [bone3 x3 y3]]"` | **Skin constraint.** Rest points of this bone's art (absolute coordinates) are glued to wherever the named bones' current transforms carry those same rest points. 1 pin: rotate + stretch about the pivot toward it. 2 pins: exact affine map of the triangle (pivot, pin 1, pin 2). 3 pins: exact affine of the triangle of pins (the pivot then only follows). Pinned bones are solved after the rest of the tree, in document order; they may not pin to their own subtree. Use it for membranes, cloth or skin between two moving parts — pieces that share an edge between the same two pinned points never tear. | none |

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
| `feature` | Foreshortened like `face` but **never culled**; sorted by depth so the parent's art occludes it once it turns away. Sticks out in profile. | snouts, beaks, noses, horns |

With just these five surface types a front-view drawing can spin 360°, look around,
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
| `wing-l`, `wing-r` *(or `arm-l`, `arm-r`)* | forelimbs; for a jointed wing this is the **arm** (shoulder pivot), the root of the wing chain |
| `wing-hand-l`, `wing-hand-r` | wing child at the wrist: inner fingers / membrane wedge |
| `wing-tip-l`, `wing-tip-r` | child of the hand at the wrist: leading finger + outer membrane (closes over the hand like a fan) |
| `wing-web-l`, `wing-web-r` / `wing-flank-l`, `wing-flank-r` / `wing-pit-l`, `wing-pit-r` | pinned skins (membrane between forearm and finger / below it down to the hip scallop / the armpit between shoulder, elbow and hip) |
| `wing-shoulder-l`, `wing-shoulder-r` | shoulder disc around the wing pivot, behind the rest of the wing: fills the corner between jaw, body and arm |
| `wing-root-l`, `wing-root-r` | art-less anchor on the flank (at the wing's depth) that the flank skin is pinned to |
| `foot-l`, `foot-r` | feet |
| `shadow` | ground shadow (outside `root`) |

| slots | typical variants |
|---|---|
| `eye-l`, `eye-r` | `open`, `happy`, `closed`, `heart`, `half`, `angry`, `sad`, `surprised`, `dizzy` |
| `mouth` | `default`, `smile`, `open`, `tongue`, `o`, `frown`, `grin` |
| `wing-l`, `wing-r` | `spread`, `folded` (Echo keeps only `spread`: it folds by bones, see below) |
| `blush` | `off`, `on` |

## Wings: a foldable bone chain (Echo)

A single flat wing bone can only flap. Echo's wing is a small chain that
folds **by bone motion**, driven by the portable `wingFold` param (0 spread,
0.5 relaxed, 1 tucked) and `raiseL`/`raiseR`:

```
body
 ├─ wing-root-l      anchor on the flank at the wing's depth (no art)
 └─ wing-l           arm: shoulder → wrist, the light leading-edge rim (flat, spring)
     ├─ wing-shoulder-l disc around the shoulder pivot, sorted behind everything (face)
     ├─ wing-pit-l     armpit skin: pinned to wing-l (shoulder, elbow) + wing-root-l (hip)
     ├─ wing-flank-l   skin below elbow→finger tip, down to the inner scallop: pinned to
     │                 wing-l (elbow) + wing-root-l (hip) + wing-hand-l (finger tip)
     ├─ wing-web-l     skin between forearm and finger 5: pinned to wing-l (elbow, wrist)
     │                 + wing-hand-l (finger tip)
     └─ wing-hand-l    wrist pivot: finger-5 membrane wedge
         └─ wing-tip-l   wrist pivot: leading finger + outer membrane
```

The spread drawing is cut into these pieces along straight lines through the
wrist, the finger tip between the scallops and the flank, so neighbouring
pieces share edges between the same pinned points and never tear. Folding
shortens/turns the arm (scale + a little `yaw` so the folded wing faces
sideways and reads in profile), swings the fingers down and closes the tip
over the hand like a fan; the pinned skins follow, and the flank skin keeps
the membrane's lower edge on the body at every angle. The flank's third pin
is the **elbow**, not a body point: its apex travels with the wing, so the
inner trailing edge (finger tip → hip) keeps the soft concave scallop of the
drawing whether the wing rises, flaps or folds — a body-fixed apex lets the
affine map flatten it into a straight, pointed "sail" edge. Cut skins so the
edge you care about sits far from the line between two of the pins.

The three skins (pit, flank, web) share pinned edges (elbow→hip,
elbow→finger tip), so they tile the membrane without gaps in every pose; the
armpit skin is pinned to the shoulder itself, so the membrane never swings
off the body side when the wing drops. A shoulder disc centred on the wing
pivot (rotation-invariant, hidden behind head and body at rest) fills the
concave corner between jaw, body and arm when the wing is raised or lowered.
The wing root carries `data-om-bleed="1"`, so the panel cuts never show as
hairlines. The generator
(`packages/characters/scripts/echo-src.py`) shows the cutting; the drivers
are in `packages/characters/src/echo/index.ts`.

## Validation

`pnpm openmascot validate path/to/character.svg` checks the annotations
(duplicate bone names outside slots, unannotated groups around bones, inconsistent layer order,
unknown surfaces…) and prints the bone tree.
