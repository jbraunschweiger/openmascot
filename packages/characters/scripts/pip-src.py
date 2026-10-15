#!/usr/bin/env python3
"""Authoring source for packages/characters/src/pip/pip.svg (Pip the bird).

The SVG is the deliverable and may be edited by hand; this script exists so
that left/right parts stay exact mirrors. Every left-side shape is authored
once in absolute character coordinates and mirrored by negating x.

Proportions were measured from docs/reference/character-lineup.webp (Pip,
top middle) at 0.85 units per reference pixel, ground at y = 0.

    python3 packages/characters/scripts/pip-src.py   # rewrites pip.svg
    pnpm embed                                       # refreshes art.generated.ts
"""
import math
import os
import re

OUT = os.path.join(os.path.dirname(__file__), "..", "src", "pip", "pip.svg")

# ---------------------------------------------------------------- palette
# sampled from the reference
C = dict(
    body="#4aacf8",
    belly="#b4dcfc",
    wing="#1d8de6",
    wing_hi="#3a9ef0",
    back="#2f94e6",
    beak="#fdc93f",
    beak_hi="#ffdc72",
    beak_low="#fb9a06",
    foot="#fda707",
    pupil="#3b3a40",
    white="#fdfdfc",
    lid_line="#2a7cc4",
    heart="#ff5c8a",
    heart_hi="#ff9ab8",
    tear="#5cc2f2",
    tear_hi="#d6f1fd",
    mouth="#5a2a3a",
    tongue="#f07fae",
    blush="#ff7fae",
    shadow="#1d3550",
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
    return " ".join(s[0] + (" " + " ".join(f(v) for v in s[1:]) if len(s) > 1 else "") for s in segs)


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


def egg(cx, cy, rx, ry_top, ry_bot, k=0.5523):
    """Ellipse with different top/bottom radii (a soft egg)."""
    return P(
        ("M", cx, cy - ry_top),
        ("C", cx + k * rx, cy - ry_top, cx + rx, cy - k * ry_top, cx + rx, cy),
        ("C", cx + rx, cy + k * ry_bot, cx + k * rx, cy + ry_bot, cx, cy + ry_bot),
        ("C", cx - k * rx, cy + ry_bot, cx - rx, cy + k * ry_bot, cx - rx, cy),
        ("C", cx - rx, cy - k * ry_top, cx - k * rx, cy - ry_top, cx, cy - ry_top),
        ("Z",),
    )


def rot_pts(pts, cx, cy, deg):
    a = math.radians(deg)
    c, s = math.cos(a), math.sin(a)
    return [(cx + (x - cx) * c - (y - cy) * s, cy + (x - cx) * s + (y - cy) * c) for x, y in pts]


def smooth(pts, closed=False):
    """Catmull-Rom through points -> cubic path (optionally closed)."""
    n = len(pts)
    get = (lambda i: pts[i % n]) if closed else (lambda i: pts[min(max(i, 0), n - 1)])
    d = [("M", *pts[0])]
    for i in range(n if closed else n - 1):
        p0, p1, p2, p3 = get(i - 1), get(i), get(i + 1), get(i + 2)
        c1 = (p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6)
        c2 = (p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6)
        d.append(("C", *c1, *c2, *p2))
    if closed:
        d.append(("Z",))
    return P(*d)


def path(d, fill, extra=""):
    return f'<path d="{d}" fill="{fill}"{extra}/>'


def stroke(d, color, w, extra=""):
    return (f'<path d="{d}" fill="none" stroke="{color}" stroke-width="{f(w)}" '
            f'stroke-linecap="round" stroke-linejoin="round"{extra}/>')


def ind(lines, n):
    pad = "  " * n
    return "\n".join(pad + l if l else l for l in lines)


def layer(lines, z):
    return [f'<g data-om-layer="" data-om-z="{z}">'] + ["  " + l for l in lines] + ["</g>"]


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


def bone(attrs, children):
    return [f"<g {attrs}>"] + ["  " + l for l in children] + ["</g>"]


# ================================================================ geometry
# Body: one round blob (Pip has no neck); head pivot = centre of the ball.
BODY = egg(0, -119, 110, 110, 100)
# The head has no art of its own: Pip is one ball, the body egg is the whole
# silhouette and the face (eyes, beak, cheeks) and crest roll over it. The
# crest's base reaches 23 units into the egg so head lifts never detach it.

BELLY = egg(0, -51, 51, 33, 32, 0.6)

# feet: little rounded orange pads, tops tucked under the body
FOOT_L = P(
    ("M", -50, -26), ("L", -12, -26),
    ("C", -11, -12, -10.5, -6, -12, -3),
    ("C", -13.5, 0, -18, 0, -24, 0),
    ("L", -40, 0),
    ("C", -48, 0, -53, -2, -53, -9),
    ("C", -53, -15, -52, -21, -50, -26), ("Z",),
)
FOOT_TOE_L = P(("M", -42, -2.5), ("C", -40, -6, -37, -7.5, -33, -7.5))

# crest: one tall feather leaning right + a smaller one pointing right
CREST = smooth([
    (-20, -214), (-16, -240), (-6, -262), (8, -274), (20, -275), (27, -266),
    (25, -252), (21, -241),            # notch between the feathers
    (34, -247), (49, -249), (61, -245), (64, -238), (57, -229), (44, -219), (34, -210),
    (8, -206), (-14, -206),
], closed=True)

# tail: small fan of three feathers, hidden behind the body from the front;
# it sticks out behind in profile and shows on the back view.
def feather(cx, cy, length, width, deg):
    """Rounded feather hanging from (cx, cy), rotated by deg."""
    pts = [(0, 0), (width * 0.55, length * 0.25), (width * 0.5, length * 0.75), (0, length),
           (-width * 0.5, length * 0.75), (-width * 0.55, length * 0.25)]
    return smooth(rot_pts([(cx + x, cy + y) for x, y in pts], cx, cy, deg), closed=True)


TAIL = [feather(-6, -58, 34, 18, 28), feather(6, -58, 34, 18, -28), feather(0, -60, 38, 19, 0)]

# back of the head: darker cap, only seen from behind (surface "back")
HEAD_BACK = smooth([
    (0, -216), (36, -208), (62, -186), (74, -158), (66, -146), (54, -150), (44, -140),
    (30, -146), (16, -136), (0, -142), (-16, -136), (-30, -146), (-44, -140), (-54, -150),
    (-66, -146), (-74, -158), (-62, -186), (-36, -208),
], closed=True)

# ---- wings (left = screen-left). Pivot at the shoulder, hidden in the body.
WING_PIVOT = (-94, -96)
WING_TIP = (-104, -34)
WING = smooth(rot_pts([
    (-100, -108), (-112, -100), (-121, -84), (-124, -64), (-120, -44), (-110, -31),
    (-98, -28), (-88, -36), (-83, -54), (-84, -76), (-90, -96),
], -94, -96, 0), closed=True)
# a lighter covert band near the shoulder sells "feathers" when flapped
WING_HI = smooth([
    (-99, -103), (-110, -96), (-116, -84), (-116, -74), (-108, -76), (-98, -86), (-92, -98),
], closed=True)
# tucked tight against the body (sad, shy, sleepy…)
WING_FOLDED = smooth([
    (-98, -104), (-107, -96), (-113, -80), (-114, -62), (-110, -46), (-101, -36),
    (-92, -40), (-88, -58), (-89, -80), (-92, -98),
], closed=True)
# fanned flight feathers (fly, flutter): longer, with three scalloped tips
WING_FAN = smooth([
    (-98, -110), (-114, -104), (-128, -88), (-137, -64), (-140, -40), (-136, -22),
    (-128, -18), (-123, -26), (-117, -15), (-109, -14), (-105, -24), (-98, -16),
    (-90, -18), (-87, -34), (-85, -60), (-86, -84), (-90, -100),
], closed=True)
WING_FAN_HI = smooth([
    (-98, -104), (-114, -96), (-125, -80), (-128, -64), (-118, -66), (-106, -78), (-93, -96),
], closed=True)

# ---- face
EYE_C = (-57, -136)   # left eye centre
EYE_R = (30, 41)      # eye white radii
PUPIL_IN = 12         # pupils sit toward the beak
PUPIL_R = (15.5, 21.5)


# ================================================================ eyes
def eye_white(cx, cy, rx=EYE_R[0], ry=EYE_R[1]):
    return path(blob(cx, cy, rx, ry, 0.6), C["white"])


def pupil_bone(side, px, py, rx, ry, highlights):
    # Pivot on the eye's vertical centre line (see echo-src.py): a pivot
    # sideways of the eye centre would sink behind the white when yawed.
    ex = -EYE_C[0] if side == "r" else EYE_C[0]
    # surface "face" with the eye's normal: never sorts behind the white and
    # fades out together with it when the head turns away.
    nrm = 30 if side == "r" else -30
    lines = [f'<g data-om-bone="pupil-{side}" data-om-pivot="{f(ex)} {f(py)}" data-om-z="6" '
             f'data-om-surface="face" data-om-normal="{nrm} 0">',
             "  " + path(blob(px, py, rx, ry, 0.62), C["pupil"])]
    for dx, dy, r in highlights:
        lines.append("  " + f'<circle cx="{f(px + dx)}" cy="{f(py + dy)}" r="{f(r)}" fill="{C["white"]}"/>')
    lines.append("</g>")
    return lines


def lid(cx, cy, rx, ry, y_out, y_in, inner_sign):
    """Blue lid covering the top of an eye, cut along a straight edge from the
    outer side (y_out) to the inner side (y_in). The lid is the part of a
    slightly enlarged eye ellipse above that edge, so it never pokes out of
    the head like a rectangle would."""
    x_out, x_in = cx - inner_sign * rx, cx + inner_sign * rx
    line_y = lambda x: y_out + (y_in - y_out) * (x - x_out) / (x_in - x_out)
    ex, ey = rx + 3.5, ry + 3.5
    n = 96
    pts = [(cx + ex * math.cos(2 * math.pi * i / n), cy + ey * math.sin(2 * math.pi * i / n)) for i in range(n)]
    above = [y < line_y(x) for x, y in pts]
    poly = []
    for i in range(n):
        a, b = pts[i], pts[(i + 1) % n]
        if above[i]:
            poly.append(a)
        if above[i] != above[(i + 1) % n]:
            fa, fb = a[1] - line_y(a[0]), b[1] - line_y(b[0])
            t = fa / (fa - fb)
            poly.append((a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t))
    # rotate so the polygon starts just after the chord (keeps the path tidy)
    d = P(("M", *poly[0]), *[("L", *q) for q in poly[1:]], ("Z",))

    def edge(sign):
        t = 0.5 + sign * 0.5
        for _ in range(8):
            x = x_out + (x_in - x_out) * t
            y = line_y(x)
            w = rx * math.sqrt(max(0.0, 1 - ((y - cy) / ry) ** 2)) * 0.97
            x = cx + inner_sign * sign * w
            t = (x - x_out) / (x_in - x_out)
        x = x_out + (x_in - x_out) * t
        return x, line_y(x)

    (x0, y0), (x1, y1) = edge(-1), edge(1)
    line = stroke(P(("M", x0, y0), ("L", x1, y1)), C["lid_line"], 3.6)
    return layer([path(d, C["body"]), line], 8)


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


def spiral(cx, cy, turns=2.5, r0=2.0, r1=21.0, sign=1):
    pts = []
    n = 44
    for i in range(n + 1):
        t = i / n
        a = sign * t * turns * 2 * math.pi
        r = r0 + (r1 - r0) * t
        pts.append((round(cx + r * math.cos(a), 2), round(cy + r * math.sin(a) * 1.3, 2)))
    return smooth(pts)


def eye_variants(side):
    s = -1 if side == "l" else 1
    inner = -s
    cx, cy = s * -EYE_C[0], EYE_C[1]
    rx, ry = EYE_R
    pcx = cx + inner * PUPIL_IN
    V = {}
    hl = [(-11, -10.5, 7)]
    V["open"] = [eye_white(cx, cy)] + pupil_bone(side, pcx, cy + 2, *PUPIL_R, hl)
    V["happy"] = [stroke(P(("M", cx - 19, cy + 4), ("C", cx - 11, cy - 15, cx + 11, cy - 15, cx + 19, cy + 4)),
                         C["pupil"], 7)]
    V["closed"] = [stroke(P(("M", cx - 19, cy - 2), ("C", cx - 11, cy + 13, cx + 11, cy + 13, cx + 19, cy - 2)),
                          C["pupil"], 7)]
    hx = cx + inner * 1
    V["heart"] = [
        path(heart(hx, cy + 3, 1.9), C["heart"]),
        path(blob(hx - 16, cy - 13, 5, 3.8), C["heart_hi"], ' opacity=".9"'),
    ]
    V["half"] = ([eye_white(cx, cy)]
                 + pupil_bone(side, pcx, cy + 10, 15, 18, [])
                 + lid(cx, cy, rx, ry, cy - 6, cy - 6, inner))
    V["angry"] = ([eye_white(cx, cy)]
                  + pupil_bone(side, pcx, cy + 6, 15, 20, [(-8, -8, 5)])
                  + lid(cx, cy, rx, ry, cy - 32, cy - 8, inner))
    tear = P(
        ("M", cx - 22, cy + 24),
        ("C", cx - 13, cy + 30, cx + 13, cy + 30, cx + 22, cy + 24),
        ("C", cx + 20, cy + 36, cx + 10, cy + 42, cx, cy + 42),
        ("C", cx - 10, cy + 42, cx - 20, cy + 36, cx - 22, cy + 24),
        ("Z",),
    )
    V["sad"] = ([eye_white(cx, cy)]
                + pupil_bone(side, cx + inner * 5, cy, 21, 28, [(-8.5, -12, 7.5), (8, 11, 3.4)])
                + layer([path(tear, C["tear"]),
                         path(blob(cx - 9, cy + 33, 4.2, 2.4), C["tear_hi"])], 8))
    V["surprised"] = [eye_white(cx, cy - 1, rx + 2, ry + 2)] + pupil_bone(
        side, cx + inner * 3, cy - 1, 10, 13, [(-4.6, -6, 3.6)])
    V["dizzy"] = [eye_white(cx, cy), stroke(spiral(cx, cy, sign=inner), C["pupil"], 4.2)]
    return V


# ================================================================ beak
# The beak is the mouth: the `mouth` slot lives inside the `nose` (beak) bone
# so every variant protrudes in profile. Upper mandible: yellow dome with a
# soft highlight; lower mandible: darker orange bowl.
def upper(dy=0, w=1.0):
    y = lambda v: v + dy
    d = P(
        ("M", -25 * w, y(-108)),
        ("C", -26 * w, y(-122), -14 * w, y(-132), 0, y(-132)),
        ("C", 14 * w, y(-132), 26 * w, y(-122), 25 * w, y(-108)),
        ("C", 18 * w, y(-109.5), 9 * w, y(-106), 0, y(-104)),
        ("C", -9 * w, y(-106), -18 * w, y(-109.5), -25 * w, y(-108)),
        ("Z",),
    )
    return [path(d, C["beak"]), path(blob(-3, y(-124), 8.5 * w, 3.6), C["beak_hi"], ' opacity=".8"')]


def lower(dy=0, rx=19, ry=16):
    d = P(
        ("M", -rx, -108 + dy),
        ("C", -rx, -108 + dy + ry * 0.75, -rx * 0.55, -108 + dy + ry, 0, -108 + dy + ry),
        ("C", rx * 0.55, -108 + dy + ry, rx, -108 + dy + ry * 0.75, rx, -108 + dy),
        ("Z",),
    )
    return path(d, C["beak_low"])


def mouth_variants():
    V = {}
    V["default"] = [lower()] + upper()

    # smile: mandibles part in a grin-shaped dark crescent
    gap = P(("M", -20, -109), ("C", -12, -104, 12, -104, 20, -109),
            ("C", 15, -96, 7, -93, 0, -93), ("C", -7, -93, -15, -96, -20, -109), ("Z",))
    V["smile"] = [lower(3, 18, 15), path(gap, C["mouth"])] + upper()

    open_d = blob(0, -101, 16, 13)
    tongue = P(("M", -10, -93), ("C", -7, -100, 7, -100, 10, -93), ("C", 6, -89.5, -6, -89.5, -10, -93), ("Z",))
    V["open"] = [lower(13, 18, 15), path(open_d, C["mouth"]), path(tongue, C["tongue"])] + upper(-2)

    tongue_out = P(("M", 0, -99), ("C", 4, -99, 13, -97, 13, -86),
                   ("C", 13, -79, 9, -76, 5.5, -76), ("C", 1, -76, -2, -80, -2, -87), ("Z",))
    V["tongue"] = [lower(6, 18, 15), path(blob(0, -101, 12, 8), C["mouth"]), path(tongue_out, C["tongue"]),
                   stroke(P(("M", 6, -93), ("L", 6.5, -84)), "#d0548c", 1.8)] + upper()

    V["o"] = [lower(9, 15, 14), path(blob(0, -101, 8, 9), C["mouth"])] + upper(-1, 0.94)

    # frown: closed, lower mandible pulled in, upper corners droop
    fd = P(("M", -25, -104), ("C", -26, -120, -14, -132, 0, -132), ("C", 14, -132, 26, -120, 25, -104),
           ("C", 18, -110, 9, -110, 0, -108), ("C", -9, -110, -18, -110, -25, -104), ("Z",))
    V["frown"] = [lower(0, 16, 13), path(fd, C["beak"]),
                  path(blob(-3, -124, 8.5, 3.6), C["beak_hi"], ' opacity=".8"')]

    grin_d = P(("M", -24, -108), ("C", -12, -106, 12, -106, 24, -108),
               ("C", 22, -92, 12, -84, 0, -84), ("C", -12, -84, -22, -92, -24, -108), ("Z",))
    gtongue = P(("M", -11, -88), ("C", -6, -95, 6, -95, 11, -88), ("C", 6, -84.5, -6, -84.5, -11, -88), ("Z",))
    V["grin"] = [lower(16, 20, 15), path(grin_d, C["mouth"]), path(gtongue, C["tongue"])] + upper(-3, 1.04)
    return V


# ================================================================ assemble
def wing(side):
    m = (lambda d: d) if side == "l" else mirror
    s = -1 if side == "l" else 1
    px, py = WING_PIVOT
    tx, ty = WING_TIP
    variants = {
        "spread": [path(m(WING), C["wing"]), path(m(WING_HI), C["wing_hi"], ' opacity=".55"')],
        "folded": [path(m(WING_FOLDED), C["wing"])],
        "fan": [path(m(WING_FAN), C["wing"]), path(m(WING_FAN_HI), C["wing_hi"], ' opacity=".55"')],
    }
    attrs = (f'data-om-bone="wing-{side}" data-om-pivot="{f(-s * px)} {f(py)}" data-om-z="-14" '
             f'data-om-surface="flat" data-om-normal="{s * 45} 0" data-om-spring="90 9" '
             f'data-om-tip="{f(-s * tx)} {f(ty)}"')
    return bone(attrs, slot(f"wing-{side}", variants, "spread"))


def eye(side):
    s = -1 if side == "l" else 1
    cx = s * -EYE_C[0]
    attrs = (f'data-om-bone="eye-{side}" data-om-pivot="{f(cx)} {f(EYE_C[1])}" data-om-z="64" '
             f'data-om-surface="face" data-om-normal="{s * 30} 0"')
    return bone(attrs, slot(f"eye-{side}", eye_variants(side), "open"))


def foot(side):
    m = (lambda d: d) if side == "l" else mirror
    s = -1 if side == "l" else 1
    return bone(f'data-om-bone="foot-{side}" data-om-pivot="{s * 31} -16" data-om-z="-6"',
                [path(m(FOOT_L), C["foot"])])


def build():
    blush = {"off": [], "on": [
        path(blob(-66, -91, 13, 7), C["blush"], ' opacity=".5"'),
        path(blob(66, -91, 13, 7), C["blush"], ' opacity=".5"'),
    ]}
    # Depth: the head pivots at the centre of the ball (z 0), so turns and nods
    # roll the face over the sphere. It *sorts* just in front of the belly
    # (sort-z 53 > belly z 52) so a nodding beak never slips behind the belly.
    head = bone('data-om-bone="head" data-om-pivot="0 -122" data-om-z="0" data-om-sort-z="53"', (
        bone('data-om-bone="tuft" data-om-pivot="4 -214" data-om-z="-4" '
               'data-om-spring="160 9" data-om-tip="18 -270"',
               [path(CREST, C["body"])])
        + bone('data-om-bone="cheeks" data-om-pivot="0 -91" data-om-z="60" data-om-surface="face"',
               slot("blush", blush, "off"))
        + eye("l") + eye("r")
        + bone('data-om-bone="nose" data-om-pivot="0 -112" data-om-z="112" data-om-surface="feature" data-om-feature-min="0.65"',
               bone('data-om-bone="mouth" data-om-pivot="0 -104" data-om-z="1"',
                    slot("mouth", mouth_variants(), "default")))
    ))
    body = bone('data-om-bone="body" data-om-pivot="0 -60"', (
        bone('data-om-bone="tail" data-om-pivot="0 -44" data-om-z="-86" data-om-surface="feature" '
             'data-om-spring="120 8" data-om-tip="0 -24"',
             [path(TAIL[0], C["wing"]), path(TAIL[1], C["wing"]), path(TAIL[2], C["wing_hi"])])
        # back plumage: a darker cap only seen from behind (lives on the body so
        # it can sort in front of the egg when Pip turns around)
        + bone('data-om-bone="body-back" data-om-pivot="0 -170" data-om-z="-60" data-om-surface="back"',
               [path(HEAD_BACK, C["back"])])
        + wing("l") + wing("r")
        + foot("l") + foot("r")
        + [path(BODY, C["body"])]
        # The head sorts by its sort-z (53), just after the belly (z 52).
        + bone('data-om-bone="belly" data-om-pivot="0 -51" data-om-z="52" '
               'data-om-surface="face" data-om-normal="0 20"',
               [path(BELLY, C["belly"])])
        + head
    ))
    svg = (
        ['<svg xmlns="http://www.w3.org/2000/svg" viewBox="-150 -284 300 294" data-om-character="pip">',
         "  <title>Pip the bird</title>",
         '  <g data-om-bone="shadow" data-om-shadow="">',
         f'    <ellipse cx="0" cy="0" rx="86" ry="8" fill="{C["shadow"]}" opacity=".12"/>',
         "  </g>",
         '  <g data-om-bone="root" data-om-pivot="0 0">']
        + ["    " + l for l in body]
        + ["  </g>", "</svg>", ""]
    )
    return "\n".join(svg)


if __name__ == "__main__":
    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    with open(OUT, "w") as fh:
        fh.write(build())
    print("wrote", os.path.normpath(OUT))
