#!/usr/bin/env python3
"""Authoring source for packages/characters/src/riff/riff.svg (Riff the frog).

The SVG is the deliverable and may be edited by hand; this script exists so
that left/right parts stay exact mirrors. Every left-side shape is authored
once in absolute character coordinates and mirrored by negating x.

Proportions were measured from docs/reference/character-lineup.webp (top
right) at 0.82 character units per reference pixel, ground at y = 0.

    python3 packages/characters/scripts/riff-src.py   # rewrites riff.svg
"""
import math
import os
import re

OUT = os.path.join(os.path.dirname(__file__), "..", "src", "riff", "riff.svg")

# ---------------------------------------------------------------- palette
# sampled from the reference
C = dict(
    body="#8fd003",
    brow="#7bc301",
    ring="#a0d80a",
    crease="#76bf02",
    belly="#b1e02f",
    leg="#7bc101",
    leg_crease="#6cb000",
    nostril="#76bf02",
    smile="#5fa600",
    pupil="#414141",
    white="#fefefb",
    lid_line="#6aae00",
    heart="#ff5c8a",
    heart_hi="#ff9ab8",
    tear="#5cc2f2",
    tear_hi="#bfe8fb",
    mouth="#4a2235",
    tongue="#ff7fa3",
    tongue_dark="#e0567f",
    blush="#ff8fae",
    sac="#cdee6c",
    sac_hi="#e2f7a4",
    back="#7fc402",
    spot="#72b800",
    shadow="#1f3a10",
    pad="#3f9e3a",
    pad_hi="#56b84a",
    pad_vein="#368a32",
    flower="#ff8fb8",
    flower_in="#ffd1e2",
    flower_c="#ffd84a",
    fly="#3a3a46",
    fly_wing="#dff3ff",
)


# ---------------------------------------------------------------- helpers
def f(v):
    s = f"{v:.2f}".rstrip("0").rstrip(".")
    return "0" if s in ("-0", "") else s


def mirror(d):
    """Mirror an absolute path (M L C Q A Z only) across x = 0."""
    toks = re.findall(r"[MLCQAZ]|-?\d*\.?\d+", d)
    out, i, cmd = [], 0, None
    while i < len(toks):
        t = toks[i]
        if t in "MLCQAZ":
            cmd = t
            out.append(t)
            i += 1
            continue
        if cmd == "A":
            rx, ry, rot, large, sweep, x, y = toks[i:i + 7]
            out += [rx, ry, rot, large, str(1 - int(sweep)), f(-float(x)), y]
            i += 7
        else:
            out += [f(-float(toks[i])), toks[i + 1]]
            i += 2
    return " ".join(out)


def P(*segs):
    """Build a path string from tuples: ('M', x, y), ('C', x1,y1,x2,y2,x,y)..."""
    return " ".join(s[0] + " " + " ".join(f(v) for v in s[1:]) if len(s) > 1 else s[0] for s in segs)


def sym(top, segs):
    """Closed symmetric path. `top` = (0, y) start on the axis; `segs` are
    cubic segments (c1, c2, end) going down the LEFT side to the axis."""
    pts = [top] + [s[2] for s in segs]
    d = [("M", *top)]
    for c1, c2, e in segs:
        d.append(("C", *c1, *c2, *e))
    m = lambda p: (-p[0], p[1])
    for k in range(len(segs) - 1, -1, -1):
        c1, c2, _ = segs[k]
        d.append(("C", *m(c2), *m(c1), *m(pts[k])))
    d.append(("Z",))
    return P(*d)


def blob(cx, cy, rx, ry, k=0.5523):
    """Ellipse as a 4-segment cubic; k > .5523 gives a squarer 'squircle'."""
    return P(
        ("M", cx, cy - ry),
        ("C", cx + k * rx, cy - ry, cx + rx, cy - k * ry, cx + rx, cy),
        ("C", cx + rx, cy + k * ry, cx + k * rx, cy + ry, cx, cy + ry),
        ("C", cx - k * rx, cy + ry, cx - rx, cy + k * ry, cx - rx, cy),
        ("C", cx - rx, cy - k * ry, cx - k * rx, cy - ry, cx, cy - ry),
        ("Z",),
    )


def smooth(pts, closed=False):
    """Catmull-Rom through points -> cubic path."""
    n = len(pts)
    if closed:
        ext = [pts[-1]] + pts + [pts[0], pts[1]]
        d = [("M", *pts[0])]
        for i in range(1, n + 1):
            p0, p1, p2, p3 = ext[i - 1], ext[i], ext[i + 1], ext[i + 2]
            c1 = (p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6)
            c2 = (p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6)
            d.append(("C", *c1, *c2, *p2))
        d.append(("Z",))
        return P(*d)
    d = [("M", *pts[0])]
    for i in range(n - 1):
        p0 = pts[i - 1] if i > 0 else pts[0]
        p1, p2 = pts[i], pts[i + 1]
        p3 = pts[i + 2] if i + 2 < n else pts[-1]
        c1 = (p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6)
        c2 = (p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6)
        d.append(("C", *c1, *c2, *p2))
    return P(*d)


def path(d, fill, extra=""):
    return f'<path d="{d}" fill="{fill}"{extra}/>'


def stroke(d, color, w, extra=""):
    return (f'<path d="{d}" fill="none" stroke="{color}" stroke-width="{f(w)}" '
            f'stroke-linecap="round" stroke-linejoin="round"{extra}/>')


def ind(lines, n):
    pad = "  " * n
    return "\n".join(pad + l if l else l for l in lines)


def wrap(open_tag, lines):
    return [open_tag] + ["  " + l for l in lines] + ["</g>"]


def layer(lines, z):
    """Static art that depth-sorts above/below sibling bones."""
    return wrap(f'<g data-om-layer="" data-om-z="{z}">', lines)


def slot(name, variants, default, z=None):
    zs = f' data-om-z="{z}"' if z is not None else ""
    lines = [f'<g data-om-slot="{name}"{zs}>']
    for k, body in variants.items():
        hide = "" if k == default else ' display="none"'
        if not body:
            lines.append(f'  <g data-om-variant="{k}"{hide}/>')
            continue
        lines.append(f'  <g data-om-variant="{k}"{hide}>')
        lines.append(ind(body, 2))
        lines.append("  </g>")
    lines.append("</g>")
    return lines


def ellipse_pts(cx, cy, rx, ry, a0, a1, n=24, grow=None):
    """Points on an ellipse from angle a0 to a1 (degrees, SVG orientation:
    -90 = top). `grow(u)` optionally adds to both radii along the run."""
    out = []
    for i in range(n + 1):
        u = i / n
        a = math.radians(a0 + (a1 - a0) * u)
        g = grow(u) if grow else 0
        out.append((cx + (rx + g) * math.cos(a), cy + (ry + g) * math.sin(a)))
    return out


def poly(pts):
    return P(("M", *pts[0]), *[("L", *p) for p in pts[1:]], ("Z",))


# ================================================================ geometry
# All authored on the LEFT (screen-left, negative x) side.

# ---- head: a wide squircle; the eye domes (separate bones) sit on its top corners
HEAD = sym((0, -226), [
    ((-44, -226), (-108, -226), (-122, -186)),
    ((-126, -164), (-131, -140), (-130.5, -118)),
    ((-129, -94), (-102, -80), (-60, -78.5)),
    ((-32, -77.5), (-14, -77.5), (0, -77.5)),
])
# darker cap between the domes (the top of the head, recessed)
BROW = P(
    ("M", -40, -225),
    ("C", -20, -226.5, 20, -226.5, 40, -225),
    ("C", 40, -206, 22, -194, 0, -194),
    ("C", -22, -194, -40, -206, -40, -225),
    ("Z",),
)

# ---- eye dome / eye
DOME_C = (-68, -170)
DOME_R = (55, 75)
EYE_C = (-68, -164.5)     # eye-white centre
WHITE_R = (32, 41.5)
RING_C = (-68, -165)
RING_R = (44.5, 54)
PUPIL_IN = 13             # pupils sit toward the face centre
PUPIL_R = (16.4, 23)

# ---- body (mostly hidden behind the head; shows between head and ground)
BODY = sym((0, -150), [
    ((-60, -150), (-106, -132), (-105, -98)),
    ((-104, -66), (-92, -34), (-86, -16)),
    ((-82, -5), (-72, -0.5), (-52, -0.5)),
    ((-30, -0.5), (-14, 0), (0, 0)),
])
BELLY = sym((0, -81), [
    ((-20, -81), (-38, -77), (-47, -67)),
    ((-55, -59), (-55.5, -40), (-51, -25)),
    ((-47.5, -14), (-40, -9.5), (-28, -9)),
    ((-16, -8.6), (-8, -8.6), (0, -8.6)),
])
BODY_BACK = sym((0, -128), [
    ((-40, -128), (-80, -112), (-82, -80)),
    ((-84, -50), (-70, -20), (0, -18)),
])
BACK_SPOTS = [(-34, -96, 11, 9), (30, -74, 9, 8), (-18, -52, 7, 6), (44, -110, 6, 5)]
HEAD_SPOTS = [(-30, -200, 10, 8), (22, -186, 13, 10), (-6, -160, 7, 6), (60, -150, 8, 7), (-62, -140, 7, 6)]

# ---- front leg ("arm"): pivot at the shoulder; the hand is foot-l
ARM_L = P(
    ("M", -84.5, -88),
    ("C", -84.5, -100, -58.5, -100, -58.5, -88),
    ("L", -50, -20),
    ("L", -91, -20),
    ("Z",),
)
HAND_PALM = blob(-69, -16, 21, 12)
HAND_TOES = [(-88.5, -7, 8.4), (-68.5, -5.8, 8.6), (-49, -8.6, 8)]

# ---- hind leg: thigh (leg-l) → shin (shin-l) → foot (hindfoot-l)
THIGH_L = smooth([
    (-122, -84), (-139, -78), (-146, -62), (-142, -46), (-130, -37),
    (-112, -36), (-98, -44), (-96, -62), (-104, -78),
], closed=True)
SHIN_L = smooth([
    (-128, -66), (-138, -52), (-134, -36), (-122, -24), (-108, -14),
    (-95, -14), (-89, -24), (-94, -38), (-106, -56), (-118, -68),
], closed=True)
SHIN_CREASE_L = P(
    ("M", -103, -54),
    ("C", -96, -46, -92, -38, -92, -30),
    ("C", -96, -36, -101, -42, -106, -48),
    ("C", -106, -51, -105, -53, -103, -54),
    ("Z",),
)
HINDFOOT_L = smooth([
    (-92, -22), (-112, -22), (-128, -20.5), (-137, -15), (-138, -8),
    (-133, -3), (-118, -3), (-100, -4), (-90, -8), (-87, -15),
], closed=True)
HINDTOE_L = [(-134, -6.5, 5), (-125, -3.8, 4.6)]

# ---- tongue (long frog tongue, drawn pointing screen-right from the mouth)
TONGUE_ROOT = (0, -121)
TONGUE_LEN = 169

# ---- fly (tongue-catch prop), rest position
FLY_C = (150, -199)


# ================================================================ eyes
def white(cx, cy, rx=WHITE_R[0], ry=WHITE_R[1]):
    return path(blob(cx, cy, rx, ry, 0.58), C["white"])


def pupil_bone(side, px, py, rx, ry, highlights):
    # Pivot on the eye's vertical centre line (see echo-src.py) so the pupil
    # never sorts behind the white when the head yaws.
    ex = -EYE_C[0] if side == "r" else EYE_C[0]
    lines = [f'<g data-om-bone="pupil-{side}" data-om-pivot="{f(ex)} {f(py)}" data-om-z="6">',
             "  " + path(blob(px, py, rx, ry, 0.6), C["pupil"])]
    for dx, dy, r in highlights:
        lines.append("  " + f'<circle cx="{f(px + dx)}" cy="{f(py + dy)}" r="{f(r)}" fill="{C["white"]}"/>')
    lines.append("</g>")
    return lines


def lid(cx, cy, y_out, y_in, inner, color=None):
    """Eyelid covering the top of the eye white above the chord from the
    outer edge (height y_out) to the inner edge (y_in), clipped exactly to
    the white so nothing spills onto the ring."""
    rx, ry = WHITE_R[0] + 0.8, WHITE_R[1] + 0.8
    # sample the white's outline, keep points above the chord
    pts = []
    n = 72
    chord = lambda x: y_out + (y_in - y_out) * ((x - (cx - inner * rx)) / (2 * inner * rx))
    for i in range(n + 1):
        a = math.radians(180 + 180 * i / n)  # left → top → right
        x, y = cx + rx * math.cos(a), cy + ry * math.sin(a)
        if y <= chord(x):
            pts.append((x, y))
    # close along the chord
    d = poly(pts)
    x0, x1 = pts[0][0], pts[-1][0]
    line = stroke(P(("M", x0 + 1.5 * (1 if x1 > x0 else -1), chord(x0)), ("L", x1 - 1.5 * (1 if x1 > x0 else -1), chord(x1))),
                  C["lid_line"], 3.4)
    return layer([path(d, color or C["ring"]), line], 8)


def heart(cx, cy, s):
    return P(
        ("M", cx, cy + 12 * s),
        ("C", cx - 4 * s, cy + 9 * s, cx - 16 * s, cy + 1 * s, cx - 16 * s, cy - 6 * s),
        ("C", cx - 16 * s, cy - 12.5 * s, cx - 11.5 * s, cy - 16 * s, cx - 7.5 * s, cy - 16 * s),
        ("C", cx - 4 * s, cy - 16 * s, cx - 1.5 * s, cy - 14 * s, cx, cy - 11 * s),
        ("C", cx + 1.5 * s, cy - 14 * s, cx + 4 * s, cy - 16 * s, cx + 7.5 * s, cy - 16 * s),
        ("C", cx + 11.5 * s, cy - 16 * s, cx + 16 * s, cy - 12.5 * s, cx + 16 * s, cy - 6 * s),
        ("C", cx + 16 * s, cy + 1 * s, cx + 4 * s, cy + 9 * s, cx, cy + 12 * s),
        ("Z",),
    )


def spiral(cx, cy, turns=2.4, r0=2.0, r1=22.0, sign=1):
    pts = []
    n = 44
    for i in range(n + 1):
        t = i / n
        a = sign * t * turns * 2 * math.pi
        r = r0 + (r1 - r0) * t
        pts.append((round(cx + r * math.cos(a), 2), round(cy + r * math.sin(a) * 1.25, 2)))
    return smooth(pts)


def eye_variants(side):
    s = -1 if side == "l" else 1
    inner = -s
    cx, cy = s * -EYE_C[0], EYE_C[1]
    rx, ry = WHITE_R
    pcx = cx + inner * PUPIL_IN
    hl = [(-8, -10.6, 8.2)]
    V = {}

    V["open"] = [white(cx, cy)] + pupil_bone(side, pcx, cy + 1, PUPIL_R[0], PUPIL_R[1], hl)

    # happy ^ on the light lid
    V["happy"] = [stroke(P(("M", cx - 19, cy + 6), ("C", cx - 11, cy - 14, cx + 11, cy - 14, cx + 19, cy + 6)),
                         C["pupil"], 7)]
    # closed (sleeping) - soft downward arc
    V["closed"] = [stroke(P(("M", cx - 19, cy - 3), ("C", cx - 11, cy + 13, cx + 11, cy + 13, cx + 19, cy - 3)),
                          C["pupil"], 7)]
    # heart
    hx = cx + inner * 1
    V["heart"] = [
        path(heart(hx, cy + 3, 2.05), C["heart"]),
        path(blob(hx - 17, cy - 14, 5.5, 4.2), C["heart_hi"], ' opacity=".9"'),
    ]
    # half (unimpressed): flat lid, pupil low
    V["half"] = ([white(cx, cy)]
                 + pupil_bone(side, pcx, cy + 12, 15, 19, [])
                 + lid(cx, cy, cy - 6, cy - 6, inner))
    # angry / determined: lid slants down toward the face centre
    V["angry"] = ([white(cx, cy)]
                  + pupil_bone(side, pcx, cy + 7, 15.5, 21, [(-7, -9, 6.2)])
                  + lid(cx, cy, cy - 34, cy - 8, inner))
    # sad: big glossy pupil, lid sloping down to the outside, tear welling
    tear = P(
        ("M", cx - 22, cy + 23),
        ("C", cx - 13, cy + 29, cx + 13, cy + 29, cx + 22, cy + 23),
        ("C", cx + 19, cy + 35, cx + 10, cy + 40.5, cx, cy + 40.5),
        ("C", cx - 10, cy + 40.5, cx - 19, cy + 35, cx - 22, cy + 23),
        ("Z",),
    )
    V["sad"] = ([white(cx, cy)]
                + pupil_bone(side, cx + inner * 6, cy + 2, 21, 27, [(-8, -11, 7.6), (8, 11, 3.4)])
                + lid(cx, cy, cy - 18, cy - 34, inner)
                + layer([path(tear, C["tear"]), path(blob(cx - 9, cy + 32, 4.2, 2.4), C["tear_hi"])], 9))
    # surprised: bigger white, small pupil
    V["surprised"] = [white(cx, cy - 1, rx + 2.5, ry + 2.5)] + pupil_bone(
        side, cx + inner * 3, cy - 1, 9.5, 13, [(-4.5, -6, 3.8)])
    # dizzy: spiral
    V["dizzy"] = [white(cx, cy), stroke(spiral(cx, cy, sign=inner), C["pupil"], 4.4)]
    return V


def crease(cx, cy):
    """Dark lid crease hugging the top of the ring."""
    rx, ry = RING_R
    outer = ellipse_pts(cx, cy, rx, ry, -142, -38, 26, grow=lambda u: 1 + 6.5 * math.sin(math.pi * u))
    inner_pts = ellipse_pts(cx, cy, rx - 0.5, ry - 0.5, -38, -142, 26)
    return smooth(outer + inner_pts, closed=True)


DOME_PIVOT_Y = -146
DOME_SPRING = 'data-om-spring="150 10"'


def dome(side):
    """The green bump the eye sits in. Volume, so it keeps the silhouette from
    every side (from behind Riff shows two bumps)."""
    s = -1 if side == "l" else 1
    dx = s * -DOME_C[0]
    return wrap(
        f'<g data-om-bone="dome-{side}" data-om-pivot="{f(dx)} {DOME_PIVOT_Y}" data-om-z="22" '
        f'{DOME_SPRING} data-om-tip="{f(dx)} -245">',
        [path(blob(dx, DOME_C[1], *DOME_R, 0.6), C["body"])],
    )


def eye(side):
    """Ring, crease and eye slot. A head-level `face` sibling of the dome (not
    its child) so it never sorts behind the head art when the head turns;
    it shares the dome's pivot, tip and spring, so both bob together."""
    s = -1 if side == "l" else 1
    m = (lambda d: d) if side == "l" else mirror
    ex = s * -EYE_C[0]
    return (
        [f'<g data-om-bone="eye-{side}" data-om-pivot="{f(ex)} {DOME_PIVOT_Y}" data-om-z="36" '
         f'data-om-surface="face" data-om-normal="{s * 20} -6" {DOME_SPRING} data-om-tip="{f(ex)} -245">',
         "  " + path(m(crease(*RING_C)), C["crease"]),
         "  " + path(blob(s * -RING_C[0], RING_C[1], *RING_R, 0.58), C["ring"])]
        + ["  " + l for l in slot(f"eye-{side}", eye_variants(side), "open")]
        + ["</g>"]
    )


# ================================================================ mouth
def mouth_variants():
    V = {}
    smile_ref = P(("M", -26, -124.5), ("C", -14, -115, 14, -115, 26, -124.5))
    V["default"] = [stroke(smile_ref, C["smile"], 5.8)]

    big = P(("M", -36, -128), ("C", -22, -110, 22, -110, 36, -128))
    V["smile"] = [stroke(big, C["smile"], 6),
                  stroke(P(("M", -40, -131.5), ("C", -38.5, -128.5, -36.5, -127, -34, -126)), C["smile"], 4.5),
                  stroke(P(("M", 40, -131.5), ("C", 38.5, -128.5, 36.5, -127, 34, -126)), C["smile"], 4.5)]

    open_d = P(("M", -38, -128), ("C", -18, -124, 18, -124, 38, -128),
               ("C", 36, -105, 18, -94, 0, -94), ("C", -18, -94, -36, -105, -38, -128), ("Z",))
    tongue = P(("M", -19, -100), ("C", -14, -110, 14, -110, 19, -100),
               ("C", 12, -94.5, -12, -94.5, -19, -100), ("Z",))
    V["open"] = [path(open_d, C["mouth"]), path(tongue, C["tongue"])]

    # a long frog tongue lolling out over the chin
    tongue_out = P(("M", -7, -121), ("C", 4, -122, 15, -118, 16, -104),
                   ("C", 17, -92, 14, -84, 6, -84), ("C", -3, -84, -5, -92, -6, -104),
                   ("C", -6.5, -110, -9, -116, -7, -121), ("Z",))
    V["tongue"] = [stroke(P(("M", -30, -126), ("C", -16, -114, 14, -114, 30, -126)), C["smile"], 5.8),
                   path(tongue_out, C["tongue"]),
                   stroke(P(("M", 6, -112), ("C", 6, -104, 6.5, -97, 6, -91)), C["tongue_dark"], 2.4)]

    V["o"] = [path(blob(0, -113, 12, 14), C["mouth"]),
              path(blob(0, -106, 7.5, 4.6), C["tongue"])]

    frown = P(("M", -24, -112), ("C", -14, -124, 14, -124, 24, -112))
    V["frown"] = [stroke(frown, C["smile"], 5.8)]

    flat = P(("M", -22, -120), ("C", -8, -121, 8, -121, 22, -120))
    V["flat"] = [stroke(flat, C["smile"], 5.8)]

    wavy = smooth([(-28, -118), (-17, -124), (-6, -117), (6, -124), (17, -117), (28, -123)])
    V["wavy"] = [stroke(wavy, C["smile"], 5.4)]

    grin = P(("M", -50, -131), ("C", -24, -125, 24, -125, 50, -131),
             ("C", 44, -100, 22, -88, 0, -88), ("C", -22, -88, -44, -100, -50, -131), ("Z",))
    gtongue = P(("M", -22, -95), ("C", -14, -106, 14, -106, 22, -95), ("C", 12, -88.5, -12, -88.5, -22, -95), ("Z",))
    V["grin"] = [path(grin, C["mouth"]), path(gtongue, C["tongue"])]
    return V


def tongue_variants():
    x0, y0 = TONGUE_ROOT
    L = TONGUE_LEN
    body = P(("M", x0 - 2, y0 - 5.5), ("L", x0 + L - 10, y0 - 6.5), ("L", x0 + L - 10, y0 + 6.5),
             ("L", x0 - 2, y0 + 5.5), ("Z",))
    tip = blob(x0 + L - 4, y0, 12, 11)
    groove = stroke(P(("M", x0 + 10, y0), ("L", x0 + L - 22, y0)), C["tongue_dark"], 2.2, ' opacity=".7"')
    out = [path(body, C["tongue"]), groove, path(tip, C["tongue"])]
    return {"off": [], "out": out, "caught": out + fly_art(x0 + L - 2, y0 - 2, 0.9)}


def fly_art(cx, cy, s=1.0):
    return [
        path(blob(cx - 5 * s, cy - 8 * s, 7 * s, 4.6 * s), C["fly_wing"], ' opacity=".95"'),
        path(blob(cx + 5 * s, cy - 8.5 * s, 7 * s, 4.6 * s), C["fly_wing"], ' opacity=".95"'),
        path(blob(cx, cy, 7.5 * s, 6 * s), C["fly"]),
        f'<circle cx="{f(cx + 4 * s)}" cy="{f(cy - 1.5 * s)}" r="{f(2 * s)}" fill="{C["white"]}"/>',
    ]


# ================================================================ assemble
def arm(side):
    m = (lambda d: d) if side == "l" else mirror
    s = -1 if side == "l" else 1
    hand = [
        f'<g data-om-bone="foot-{side}" data-om-pivot="{s * 69} -18" data-om-z="2">',
        "  " + path(m(HAND_PALM), C["body"]),
    ] + ["  " + f'<circle cx="{f(s * -x)}" cy="{f(y)}" r="{f(r)}" fill="{C["body"]}"/>' for x, y, r in HAND_TOES] + ["</g>"]
    return wrap(
        f'<g data-om-bone="arm-{side}" data-om-pivot="{f(s * 71.5)} -86" data-om-z="26">',
        [path(m(ARM_L), C["body"])] + hand,
    )


def hind_leg(side):
    m = (lambda d: d) if side == "l" else mirror
    s = -1 if side == "l" else 1
    foot = [
        f'<g data-om-bone="hindfoot-{side}" data-om-pivot="{s * 98} -14" data-om-z="2">',
        "  " + path(m(HINDFOOT_L), C["leg"]),
    ] + ["  " + f'<circle cx="{f(s * -x)}" cy="{f(y)}" r="{f(r)}" fill="{C["leg"]}"/>' for x, y, r in HINDTOE_L] + ["</g>"]
    shin = wrap(
        f'<g data-om-bone="shin-{side}" data-om-pivot="{s * 124} -62" data-om-z="2">',
        [path(m(SHIN_L), C["leg"]), path(m(SHIN_CREASE_L), C["leg_crease"])] + foot,
    )
    return wrap(
        f'<g data-om-bone="leg-{side}" data-om-pivot="{s * 104} -58" data-om-z="-14">',
        [path(m(THIGH_L), C["leg"])] + shin,
    )


def spots(lst, color):
    return [path(blob(x, y, rx, ry), color) for x, y, rx, ry in lst]


def build():
    blush = {"off": [], "on": [
        path(blob(-104, -118, 14, 7.5), C["blush"], ' opacity=".6"'),
        path(blob(104, -118, 14, 7.5), C["blush"], ' opacity=".6"'),
    ]}
    head = wrap('<g data-om-bone="head" data-om-pivot="0 -92" data-om-z="6">', (
        wrap('<g data-om-bone="head-back" data-om-pivot="0 -175" data-om-z="-40" data-om-surface="back">',
             spots(HEAD_SPOTS, C["spot"]))
        + [path(HEAD, C["body"]), path(BROW, C["brow"])]
        + dome("l") + dome("r") + eye("l") + eye("r")
        + slot("blush", blush, "off", z=40)
        + wrap('<g data-om-bone="nose" data-om-pivot="0 -140" data-om-z="48" data-om-surface="face">',
               [path(blob(-13.5, -140, 3.9, 3.9), C["nostril"]),
                path(blob(13.5, -140, 3.9, 3.9), C["nostril"])])
        + wrap('<g data-om-bone="mouth" data-om-pivot="0 -121" data-om-z="50" data-om-surface="face">',
               slot("mouth", mouth_variants(), "default"))
        + wrap(f'<g data-om-bone="tongue" data-om-pivot="{f(TONGUE_ROOT[0])} {f(TONGUE_ROOT[1])}" '
               'data-om-z="52" data-om-surface="feature">',
               slot("tongue", tongue_variants(), "off"))
    ))
    throat = wrap('<g data-om-bone="throat" data-om-pivot="0 -110" data-om-z="34" data-om-surface="face">',
                  slot("throat", {"off": [], "on": [
                      path(blob(0, -90, 41, 29), C["sac"]),
                      path(blob(-14, -101, 13, 6.5), C["sac_hi"], ' opacity=".9"'),
                  ]}, "off"))
    body = wrap('<g data-om-bone="body" data-om-pivot="0 -60">', (
        hind_leg("l") + hind_leg("r")
        + wrap('<g data-om-bone="body-back" data-om-pivot="0 -70" data-om-z="-12" data-om-surface="back">',
               [path(BODY_BACK, C["back"])] + spots(BACK_SPOTS, C["spot"]))
        + [path(BODY, C["body"])]
        + head
        + wrap('<g data-om-bone="belly" data-om-pivot="0 -45" data-om-z="20" data-om-surface="face">',
               [path(BELLY, C["belly"])])
        + arm("l") + arm("r")
        + throat
    ))
    pad = {"off": [], "on": [
        path(blob(0, 3, 158, 21), C["pad_vein"]),
        path(P(("M", 0, 3), ("L", 40, -17.2), ("C", 90, -16, 150, -8, 158, 2),
               ("C", 160, 16, 90, 24, 0, 24), ("C", -90, 24, -158, 16, -158, 3),
               ("C", -158, -10, -90, -18, 0, -18), ("L", 18, -18), ("Z",)), C["pad"]),
        path(blob(-40, -4, 70, 9), C["pad_hi"], ' opacity=".55"'),
        # a little water lily on the far side
        path(blob(142, -6, 9, 13), C["flower"]),
        path(blob(131, -2, 9, 7), C["flower"]),
        path(blob(153, -2, 9, 7), C["flower"]),
        path(blob(142, -4, 5, 8), C["flower_in"]),
        f'<circle cx="142" cy="-3" r="3" fill="{C["flower_c"]}"/>',
    ]}
    fly = wrap(f'<g data-om-bone="fly" data-om-pivot="{f(FLY_C[0])} {f(FLY_C[1])}" data-om-z="80">',
               slot("fly", {"off": [], "on": fly_art(*FLY_C)}, "off"))
    root = wrap('<g data-om-bone="root" data-om-pivot="0 0">', (
        wrap('<g data-om-bone="lilypad" data-om-pivot="0 4" data-om-z="-60" data-om-surface="flat">',
             slot("lilypad", pad, "off"))
        + body
        + fly
    ))
    svg = (
        ['<svg xmlns="http://www.w3.org/2000/svg" viewBox="-165 -256 330 266" data-om-character="riff">',
         "  <title>Riff the frog</title>",
         '  <g data-om-bone="shadow" data-om-shadow="">',
         f'    <ellipse cx="0" cy="0" rx="138" ry="8" fill="{C["shadow"]}" opacity=".12"/>',
         "  </g>"]
        + ["  " + l for l in root]
        + ["</svg>", ""]
    )
    return "\n".join(svg)


if __name__ == "__main__":
    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    with open(OUT, "w") as fh:
        fh.write(build())
    print("wrote", os.path.normpath(OUT))
