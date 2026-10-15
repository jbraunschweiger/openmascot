#!/usr/bin/env python3
"""Authoring source for packages/characters/src/echo/echo.svg (Echo the bat).

The SVG is the deliverable and may be edited by hand; this script exists so
that left/right parts stay exact mirrors. Every left-side shape is authored
once in absolute character coordinates and mirrored by negating x.

    python3 packages/characters/scripts/echo-src.py   # rewrites echo.svg
"""
import math
import os
import re

OUT = os.path.join(os.path.dirname(__file__), "..", "src", "echo", "echo.svg")

# ---------------------------------------------------------------- palette
C = dict(
    head="#634c91",
    body="#675196",
    belly="#7e62ae",
    snout="#e386ba",
    nostril="#ae508d",
    ear_in="#e180b5",
    rim="#6a529c",
    mem_dark="#513f75",
    mem_mid="#5d4789",
    foot="#513f77",
    pupil="#3a3640",
    white="#fdfdf9",
    lid_line="#4b3a72",
    heart="#ff5c8a",
    heart_hi="#ff9ab8",
    tear="#5cc2f2",
    tear_hi="#bfe8fb",
    mouth="#3b2346",
    tongue="#f07fae",
    tongue_dark="#d0548c",
    blush="#ff7fae",
    shadow="#2a1f40",
    back_dark="#5a4588",
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
    parts = []
    for s in segs:
        parts.append(s[0] + " " + " ".join(f(v) for v in s[1:]))
    return " ".join(parts)


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


def path(d, fill, extra=""):
    return f'<path d="{d}" fill="{fill}"{extra}/>'


def stroke(d, color, w, extra=""):
    return (f'<path d="{d}" fill="none" stroke="{color}" stroke-width="{f(w)}" '
            f'stroke-linecap="round" stroke-linejoin="round"{extra}/>')


def smooth(pts, closed=False):
    """Catmull-Rom through points -> cubic path."""
    n = len(pts)
    d = [("M", *pts[0])]
    for i in range(n - 1):
        p0 = pts[i - 1] if i > 0 else pts[0]
        p1, p2 = pts[i], pts[i + 1]
        p3 = pts[i + 2] if i + 2 < n else pts[-1]
        c1 = (p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6)
        c2 = (p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6)
        d.append(("C", *c1, *c2, *p2))
    return P(*d)


def ind(lines, n):
    pad = "  " * n
    return "\n".join(pad + l if l else l for l in lines)


# ================================================================ geometry
# All authored on the LEFT (screen-left, negative x) side.

# ---- body (torso blob; head overlaps its top)
BODY = sym((0, -130), [
    ((-40, -130), (-68, -110), (-67.5, -80)),
    ((-67, -48), (-38, -16), (0, -16)),
])

# ---- belly bib with 3 scallops (middle one lower)
BELLY = P(
    ("M", -29, -70.5),
    ("C", -12, -67.5, 12, -67.5, 29, -70.5),
    ("C", 29, -60, 25, -52, 18, -51),
    ("C", 15, -50.6, 13, -51, 11.5, -51.5),
    ("C", 11.5, -42, 6, -37.5, 0, -37.5),
    ("C", -6, -37.5, -11.5, -42, -11.5, -51.5),
    ("C", -13, -51, -15, -50.6, -18, -51),
    ("C", -25, -52, -29, -60, -29, -70.5),
    ("Z",),
)

# ---- feet
FOOT_L = P(
    ("M", -39, -34), ("L", -39, -15),
    ("C", -39, -6, -32, 0, -23, 0),
    ("C", -14, 0, -7, -6, -7, -15),
    ("L", -7, -34), ("Z",),
)

# ---- head
HEAD = sym((0, -193), [
    ((-44, -193), (-80, -172), (-83, -134)),
    ((-85, -110), (-77, -90), (-60, -80)),
    ((-44, -72.5), (-20, -71), (0, -71)),
])

EAR_L = P(
    ("M", -34, -160), ("L", -76, -146),
    ("C", -95, -163, -104, -194, -97, -218),
    ("C", -93, -232, -81, -238, -70, -232),
    ("C", -54, -222, -36, -205, -20, -182),
    ("Z",),
)
EAR_IN_L = P(
    ("M", -80, -216),
    ("C", -90, -206, -93, -180, -76, -160),
    ("C", -71, -169, -63, -178, -51, -184),
    ("C", -57, -196, -66, -208, -75, -215),
    ("C", -77, -216.5, -78.5, -217, -80, -216),
    ("Z",),
)

TUFT = P(
    ("M", -30, -184),
    ("C", -24, -204, -8, -219, 6, -220),
    ("C", 13, -220.5, 17, -216, 14, -212),
    ("C", 11, -208, 7, -204, 4, -200.5),
    ("C", 10, -202, 18, -202.5, 22, -199.5),
    ("C", 25.5, -196.5, 22, -192, 16, -190.5),
    ("C", 21, -190, 26, -189, 30, -185),
    ("L", 0, -170), ("Z",),
)

# ---- back-view details (surface "back": only seen from behind)
# little curl on the crown where the tuft grows
HEAD_BACK_CURL = P(
    ("M", -18, -178),
    ("C", -13, -191, 5, -195, 14, -187),
    ("C", 20, -181, 17, -171, 9, -170),
    ("C", 4, -169.5, 0, -173, 2, -177),
    ("C", -4, -180, -11, -179, -18, -178),
    ("Z",),
)
# darker back fur: an inset of the torso, so from behind Echo reads as
# "back" (no front features); the wings attach over its sides
BODY_BACK = sym((0, -122), [
    ((-30, -122), (-52, -102), (-52, -76)),
    ((-52, -48), (-32, -26), (0, -26)),
])

EYE_C = (-43, -128)      # left eye centre
EYE_R = (23.5, 30)       # eye white radii
PUPIL_C = (-36, -128)
PUPIL_R = (11, 17)

SNOUT = blob(0, -110.5, 23.5, 16, 0.58)
NOSTRIL_L = blob(-8.5, -110, 3.6, 5.6)

FANG_L = P(
    ("M", -26, -95.5),
    ("L", -12, -95.5),
    ("C", -11.4, -95.5, -11.1, -95, -11.4, -94.4),
    ("L", -17.6, -84.2),
    ("C", -18.3, -83.2, -19.7, -83.2, -20.4, -84.2),
    ("L", -26.6, -94.4),
    ("C", -26.9, -95, -26.6, -95.5, -26, -95.5),
    ("Z",),
)

# ---- wings (spread)
W_TOP = [  # from shoulder (inside body) along the top edge to the tip
    ("M", -64, -94),
    ("C", -70, -106, -77, -117, -84, -127),
    ("C", -97, -143, -112, -160, -124, -168.5),
    ("C", -133, -174.5, -143, -173, -150, -167),
    ("C", -177, -144, -196, -110, -202, -76),
    ("C", -203.5, -69, -200, -65.5, -195, -68.5),
]
W_SCALLOP1 = ("C", -184, -75.5, -176, -78.5, -166, -77.5)
W_SCALLOP1b = ("C", -148, -75, -132, -61, -123, -40)
W_POINT2 = ("C", -121.5, -36, -118, -35.5, -115.5, -38.5)
W_SCALLOP2 = ("C", -104, -46.5, -86, -48.5, -70, -44.5)
W_SCALLOP2b = ("C", -62, -42.5, -55, -39.5, -48, -36)
WING_OUT = P(*W_TOP, W_SCALLOP1, W_SCALLOP1b, W_POINT2, W_SCALLOP2,
             W_SCALLOP2b, ("L", -40, -60), ("Z",))
WING_MEM = P(  # mid-tone membrane: inside the rim, left of the inner panel
    ("M", -98, -112),
    ("C", -108, -124, -119, -139, -128, -150.5),
    ("C", -133, -156.5, -140, -157.5, -146, -151.5),
    ("C", -167, -130, -184, -104, -195.5, -70),
    ("C", -195.5, -69, -195.3, -68.6, -195, -68.5),
    W_SCALLOP1, W_SCALLOP1b, W_POINT2,
    ("C", -112, -66, -105, -96, -98, -112),
    ("Z",),
)
def reverse(start, segs):
    """Reverse a chain of cubic segments ('C', x1,y1,x2,y2,x,y) that starts at `start`."""
    pts = [start] + [(sg[5], sg[6]) for sg in segs]
    out = []
    for k in range(len(segs) - 1, -1, -1):
        sg = segs[k]
        out.append(("C", sg[3], sg[4], sg[1], sg[2], *pts[k]))
    return out


# lighter leading-edge rim (arm + top/outer edge) as a band, drawn on top of
# the membrane so an edge-on wing reads as the light arm bone
_RIM_IN_START = (-60, -84)
_RIM_IN = [
    ("C", -72, -95, -86, -104, -99, -116),
    ("C", -110, -127, -120, -141, -128, -150.5),
    ("C", -133, -156.5, -140, -157.5, -146, -151.5),
    ("C", -167, -130, -184, -104, -195.5, -70),
]
WING_RIM = P(*W_TOP, ("L", -195.5, -70), *reverse(_RIM_IN_START, _RIM_IN), ("Z",))

WING_PANEL_A = P(
    ("M", -195.5, -70),
    ("C", -184, -104, -167, -130, -146, -151.5),
    ("C", -140, -157.5, -133, -156.5, -128, -150.5),
    ("C", -121.5, -142, -118.5, -131, -118.5, -118),
    ("C", -118.5, -95, -120.5, -62, -121.8, -41),
    ("C", -131, -62, -149, -75.5, -166, -77.5),
    ("C", -176, -78.5, -184, -75.5, -195, -68.5),
    ("Z",),
)
WING_PANEL_C = P(
    ("M", -98, -112),
    ("C", -105, -96, -112, -66, -115.5, -38.5),
    W_SCALLOP2, W_SCALLOP2b,
    ("C", -53, -56, -57, -72, -64, -83),
    ("C", -73, -95, -86, -104, -98, -112),
    ("Z",),
)

# ---- wings (folded, cloak at the side of the body)
FOLD_OUT = P(
    ("M", -54, -118),
    ("C", -74, -120, -92, -104, -99, -78),
    ("C", -105, -55, -106, -28, -103, -4),
    ("C", -102.5, -1, -99.5, 0, -97.5, -2),
    ("C", -91, -9, -82, -11, -74, -6),
    ("C", -72.5, -5, -71, -5, -69.5, -6),
    ("C", -63, -12, -54, -13, -46, -8),
    ("L", -40, -60), ("Z",),
)
FOLD_MEM = P(
    ("M", -56, -108),
    ("C", -72, -106, -84, -94, -89, -76),
    ("C", -94, -56, -96, -30, -96.5, -4.5),
    ("C", -90, -9.5, -82, -11, -74, -6),
    ("C", -72.5, -5, -71, -5, -69.5, -6),
    ("C", -63, -12, -54, -13, -46, -8),
    ("L", -40, -60), ("Z",),
)
FOLD_RIM = P(
    ("M", -54, -118),
    ("C", -74, -120, -92, -104, -99, -78),
    ("C", -105, -55, -106, -28, -103, -4),
    ("C", -102.5, -1, -99.5, 0, -97.5, -2),
    ("L", -96.5, -4.5),
    *reverse((-56, -108), [
        ("C", -72, -106, -84, -94, -89, -76),
        ("C", -94, -56, -96, -30, -96.5, -4.5),
    ]),
    ("Z",),
)
FOLD_PANEL = P(
    ("M", -70, -98),
    ("C", -76, -72, -76, -36, -72.5, -6),
    ("C", -66, -11, -56, -13, -46, -8),
    ("L", -42, -60),
    ("C", -48, -78, -58, -92, -70, -98),
    ("Z",),
)


# ================================================================ eyes
def eye_white(cx, cy, rx=EYE_R[0], ry=EYE_R[1]):
    return path(blob(cx, cy, rx, ry, 0.6), C["white"])


def pupil_bone(side, px, py, rx, ry, highlights):
    # side: 'l'/'r'; highlights: list of (dx, dy, r)
    # Depth sorting uses the pivot's offset from the eye pivot: a pivot that is
    # sideways of the eye centre sinks behind the eye white when yawed. So the
    # pivot sits on the eye's vertical centre line (x = eye x), at pupil height,
    # with z 6 to stay in front of the white for any visible yaw.
    ex = -EYE_C[0] if side == "r" else EYE_C[0]
    lines = [f'<g data-om-bone="pupil-{side}" data-om-pivot="{f(ex)} {f(py)}" data-om-z="6">',
             "  " + path(blob(px, py, rx, ry, 0.62), C["pupil"])]
    for dx, dy, r in highlights:
        lines.append("  " + f'<circle cx="{f(px + dx)}" cy="{f(py + dy)}" r="{f(r)}" fill="{C["white"]}"/>')
    lines.append("</g>")
    return lines


def layer(lines, z):
    """Static art that depth-sorts above/below sibling bones."""
    return [f'<g data-om-layer="" data-om-z="{z}">'] + ["  " + l for l in lines] + ["</g>"]


def lid(cx, cy, rx, ry, y_out, y_in, inner_sign):
    """Purple lid covering the top of an eye; edge from outer (y_out) to inner (y_in)."""
    # generous margin: the lid is head-coloured and shifts with parallax
    x_out, x_in = cx - inner_sign * (rx + 7), cx + inner_sign * (rx + 7)
    top = cy - ry - 7
    d = P(("M", x_out, y_out), ("L", x_in, y_in), ("L", x_in, top), ("L", x_out, top), ("Z",))
    def edge(sign):
        # point where the lid edge meets the eye outline (approx., iterated)
        t = 0.5 + sign * 0.5
        for _ in range(6):
            y = y_out + (y_in - y_out) * t
            w = rx * math.sqrt(max(0.0, 1 - ((y - cy) / ry) ** 2)) * 0.96
            x = cx + inner_sign * sign * w
            t = (x - x_out) / (x_in - x_out)
        return x, y_out + (y_in - y_out) * t
    (x0, y0), (x1, y1) = edge(-1), edge(1)
    line = stroke(P(("M", x0, y0), ("L", x1, y1)), C["lid_line"], 3.2)
    return layer([path(d, C["head"]), line], 8)


def heart(cx, cy, s):
    d = P(
        ("M", cx, cy + 12 * s),
        ("C", cx - 4 * s, cy + 9 * s, cx - 16 * s, cy + 1 * s, cx - 16 * s, cy - 6 * s),
        ("C", cx - 16 * s, cy - 12.5 * s, cx - 11.5 * s, cy - 16 * s, cx - 7.5 * s, cy - 16 * s),
        ("C", cx - 4 * s, cy - 16 * s, cx - 1.5 * s, cy - 14 * s, cx, cy - 11 * s),
        ("C", cx + 1.5 * s, cy - 14 * s, cx + 4 * s, cy - 16 * s, cx + 7.5 * s, cy - 16 * s),
        ("C", cx + 11.5 * s, cy - 16 * s, cx + 16 * s, cy - 12.5 * s, cx + 16 * s, cy - 6 * s),
        ("C", cx + 16 * s, cy + 1 * s, cx + 4 * s, cy + 9 * s, cx, cy + 12 * s),
        ("Z",),
    )
    return d


def spiral(cx, cy, turns=2.4, r0=2.0, r1=17.0, sign=1):
    pts = []
    n = 40
    for i in range(n + 1):
        t = i / n
        a = sign * t * turns * 2 * math.pi
        r = r0 + (r1 - r0) * t
        pts.append((round(cx + r * math.cos(a), 2), round(cy + r * math.sin(a) * 1.15, 2)))
    return smooth(pts)


def eye_variants(side):
    s = -1 if side == "l" else 1           # x sign of this eye
    inner = -s                              # direction toward the face centre
    cx, cy = s * -EYE_C[0], EYE_C[1]        # EYE_C is the left eye
    rx, ry = EYE_R
    pcx = cx + inner * 7                    # pupils sit toward the snout
    V = {}

    # open (default)
    V["open"] = [eye_white(cx, cy)] + pupil_bone(
        side, pcx, cy, PUPIL_R[0], PUPIL_R[1], [(-6.5, -10.3, 5.6)])

    # happy ^ (closed, smiling)
    V["happy"] = [stroke(P(("M", cx - 15, cy + 2), ("C", cx - 9, cy - 13, cx + 9, cy - 13, cx + 15, cy + 2)),
                         C["pupil"], 6)]

    # closed (sleeping) - soft downward arc
    V["closed"] = [stroke(P(("M", cx - 15, cy - 2), ("C", cx - 9, cy + 10, cx + 9, cy + 10, cx + 15, cy - 2)),
                          C["pupil"], 6)]

    # heart
    hx = cx + inner * 1
    V["heart"] = [
        path(heart(hx, cy + 2, 1.55), C["heart"]),
        path(blob(hx - 13, cy - 11, 4.2, 3.2), C["heart_hi"], ' opacity=".9"'),
    ]

    # half (unimpressed): flat lid over the top, pupil lower
    V["half"] = ([eye_white(cx, cy)]
                 + pupil_bone(side, pcx, cy + 6, 11, 14, [])
                 + lid(cx, cy, rx, ry, cy - 6, cy - 6, inner))

    # angry / determined: lid slants down toward the centre
    V["angry"] = ([eye_white(cx, cy)]
                  + pupil_bone(side, pcx, cy + 4, 11.5, 15.5, [(-5.6, -7.5, 4.4)])
                  + lid(cx, cy, rx, ry, cy - 24, cy - 6, inner))

    # sad: big glossy pupil, two highlights, tear welling at the bottom
    tear = P(
        ("M", cx - 17, cy + 17),
        ("C", cx - 10, cy + 22, cx + 10, cy + 22, cx + 17, cy + 17),
        ("C", cx + 15, cy + 27, cx + 8, cy + 31.5, cx, cy + 31.5),
        ("C", cx - 8, cy + 31.5, cx - 15, cy + 27, cx - 17, cy + 17),
        ("Z",),
    )
    V["sad"] = ([eye_white(cx, cy)]
                + pupil_bone(side, cx + inner * 3, cy - 1, 16.5, 21, [(-6.5, -9, 6), (6, 8.5, 2.8)])
                + layer([path(tear, C["tear"]),
                         path(blob(cx - 7, cy + 24.5, 3.4, 2), C["tear_hi"])], 8))

    # surprised: bigger white, small pupil
    V["surprised"] = [eye_white(cx, cy - 1, rx + 1.5, ry + 1.5)] + pupil_bone(
        side, cx + inner * 2, cy - 1, 7.5, 10, [(-3.6, -5, 3)])

    # dizzy: spiral
    V["dizzy"] = [eye_white(cx, cy), stroke(spiral(cx, cy, sign=inner), C["pupil"], 3.6)]
    return V


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


# ================================================================ mouth
def fangs():
    return [path(FANG_L, C["white"]), path(mirror(FANG_L), C["white"])]


def fang_at(x, y, w=11, h=9):
    """Rounded fang hanging from (x, y)."""
    d = P(
        ("M", x - w / 2, y), ("L", x + w / 2, y),
        ("L", x + 1, y + h - 1.2),
        ("C", x + 0.5, y + h, x - 0.5, y + h, x - 1, y + h - 1.2),
        ("Z",),
    )
    return path(d, C["white"], ' stroke="#fdfdf9" stroke-width="1.2" stroke-linejoin="round"')


def mouth_variants():
    V = {}
    V["default"] = fangs()

    smile = P(("M", -21, -95), ("C", -13, -85, 13, -85, 21, -95))
    V["smile"] = [stroke(smile, C["mouth"], 3.6),
                  fang_at(-12.5, -90.5, 8.5, 7.5), fang_at(12.5, -90.5, 8.5, 7.5)]

    open_d = P(("M", -21, -96), ("C", -10, -94, 10, -94, 21, -96),
               ("C", 21, -82, 12, -72, 0, -72), ("C", -12, -72, -21, -82, -21, -96), ("Z",))
    tongue = P(("M", -12, -78.5), ("C", -9, -86, 9, -86, 12, -78.5),
               ("C", 8, -73.5, -8, -73.5, -12, -78.5), ("Z",))
    V["open"] = [path(open_d, C["mouth"]), path(tongue, C["tongue"]),
                 fang_at(-13.5, -95.3, 9, 8), fang_at(13.5, -95.3, 9, 8)]

    tongue_out = P(("M", -1, -91), ("C", 3, -91, 15, -90, 15, -80),
                   ("C", 15, -71, 9, -68, 5, -68), ("C", 0, -68, -3, -72, -3, -80), ("Z",))
    V["tongue"] = [stroke(P(("M", -18, -94), ("C", -8, -88, 8, -88, 20, -94)), C["mouth"], 3.6),
                   path(tongue_out, C["tongue"]),
                   stroke(P(("M", 6, -86), ("L", 6.5, -76)), C["tongue_dark"], 2),
                   fang_at(-11, -90.8, 8, 7)]

    V["o"] = [path(blob(0, -83.5, 6.5, 8), C["mouth"])]

    frown = P(("M", -18, -82), ("C", -15, -88, -10, -90, -5.5, -88.5),
              ("C", -2.5, -87.5, 2.5, -87.5, 5.5, -88.5),
              ("C", 10, -90, 15, -88, 18, -82))
    V["frown"] = [stroke(frown, C["mouth"], 3.4),
                  fang_at(-10, -95.3, 7.5, 6.5), fang_at(10, -95.3, 7.5, 6.5)]

    grin = P(("M", -31, -97), ("C", -14, -93, 14, -93, 31, -97),
             ("C", 27, -80, 14, -74, 0, -74), ("C", -14, -74, -27, -80, -31, -97), ("Z",))
    gtongue = P(("M", -11, -77), ("C", -6, -82, 6, -82, 11, -77), ("C", 6, -74.3, -6, -74.3, -11, -77), ("Z",))
    V["grin"] = [path(grin, C["mouth"]), path(gtongue, C["tongue"]),
                 fang_at(-17, -95.1, 10, 9), fang_at(17, -95.1, 10, 9)]
    return V


# ================================================================ assemble
# ================================================================ wing rig
# The spread wing above is the art; here it is cut into rigid pieces that a
# small bone chain can fold (docs/rig-format.md, "Wings"):
#
#   wing-l        shoulder S → wrist W: the arm (leading-edge rim)
#     wing-web-l    skin between arm and finger 5, pinned to arm + hand
#     wing-flank-l  skin between finger 5 and the flank, pinned to body + arm + hand
#     wing-hand-l   wrist W: finger 5 wedge of membrane
#       wing-tip-l    wrist W: leading finger + outer membrane (closes like a fan)
#
# All pieces meet along straight cuts through W, P2 (tip of finger 5), S and
# B (where the membrane meets the flank), and pinned skins map exactly onto
# those cuts, so the membrane never tears and its bottom stays on the body.
WS = (-63, -98)          # shoulder (wing-l pivot)
WW = (-137, -165)        # wrist (hand/tip pivot), centre of the rim band at the peak
WP2 = (-117.5, -39)      # tip of finger 5 (point between the two scallops)
WM = (-166, -77.5)       # trailing-edge point where the fan splits (finger 4)
WB = (-48, -36)          # membrane meets the flank (pinned to the body)
CAP_R = 8.6              # rim joint cap at the wrist


def sample(d, n=14):
    """Polyline of an absolute M/L/C/Z path."""
    toks = re.findall(r"[MLCZ]|-?\d*\.?\d+", d)
    pts, i, cur = [], 0, None
    while i < len(toks):
        t = toks[i]
        if t == "M":
            cur = (float(toks[i + 1]), float(toks[i + 2]))
            pts.append(cur)
            i += 3
        elif t == "L":
            cur = (float(toks[i + 1]), float(toks[i + 2]))
            pts.append(cur)
            i += 3
        elif t == "C":
            c1 = (float(toks[i + 1]), float(toks[i + 2]))
            c2 = (float(toks[i + 3]), float(toks[i + 4]))
            e = (float(toks[i + 5]), float(toks[i + 6]))
            for k in range(1, n + 1):
                u = k / n
                v = 1 - u
                pts.append((v * v * v * cur[0] + 3 * v * v * u * c1[0] + 3 * v * u * u * c2[0] + u * u * u * e[0],
                            v * v * v * cur[1] + 3 * v * v * u * c1[1] + 3 * v * u * u * c2[1] + u * u * u * e[1]))
            cur = e
            i += 7
        else:  # Z
            i += 1
    return pts


def clip_half(poly, a, b, keep_left=True):
    """Sutherland-Hodgman: keep the part of `poly` left (screen: cross >= 0) of a->b."""
    def side(p):
        v = (b[0] - a[0]) * (p[1] - a[1]) - (b[1] - a[1]) * (p[0] - a[0])
        return v if keep_left else -v
    out = []
    n = len(poly)
    for i in range(n):
        p, q = poly[i], poly[(i + 1) % n]
        sp, sq = side(p), side(q)
        if sp >= 0:
            out.append(p)
        if (sp >= 0) != (sq >= 0):
            t = sp / (sp - sq)
            out.append((p[0] + (q[0] - p[0]) * t, p[1] + (q[1] - p[1]) * t))
    return out


def clip_all(poly, cuts):
    for a, b, keep in cuts:
        if len(poly) < 3:
            return []
        poly = clip_half(poly, a, b, keep)
    return poly


def poly_d(poly):
    out, last = [], None
    for p in poly:
        q = (round(p[0], 1), round(p[1], 1))
        if q != last:
            out.append(q)
        last = q
    if len(out) < 3:
        return None
    return "M " + " L ".join(f"{f(x)} {f(y)}" for x, y in out) + " Z"


def toward(a, b, k):
    return (a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k)


def wing_pieces():
    """Left-wing art per bone: {piece: [(d, colour), ...]} in back-to-front order."""
    layers = [(WING_OUT, C["rim"]), (WING_MEM, C["mem_mid"]), (WING_PANEL_A, C["mem_dark"]),
              (WING_PANEL_C, C["mem_dark"]), (WING_RIM, C["rim"])]
    polys = [(sample(d), col) for d, col in layers]
    up = (WW[0], WW[1] - 400)
    far = lambda q, k=6: toward(WW, q, k)
    # sectors around the wrist (screen angles grow clockwise)
    tip = [(WW, far(WM), True), (up, WW, True)]                 # W->M ... up: leading finger
    hand = [(WW, far(WP2), True), (WW, far(WM), False)]          # finger 5 .. finger 4
    arm = [(up, WW, False), (WW, far(WP2), False)]               # up ... finger 5 (arm side)
    # arm-side membrane splits along S->P2 into the web (above) and flank (below);
    # both tuck under the rim (cut along S->W) and the flank under the body (S->B)
    web = arm + [(WS, WW, False), (WS, WP2, True)]
    flank = arm + [(WS, WP2, False), (toward(WS, WB, -0.2), toward(WB, WS, -2), False)]
    pieces = {}
    for name, cuts, which in (("tip", tip, None), ("hand", hand, None), ("web", web, "mem"),
                              ("flank", flank, "mem"), ("arm", arm, "rim")):
        out = []
        for i, (poly, col) in enumerate(polys):
            if which == "mem" and i == 4:
                continue  # the rim belongs to the arm bone
            if which == "rim" and i != 4:
                continue
            d = poly_d(clip_all(poly, cuts))
            if d:
                out.append((d, col))
        pieces[name] = out
    return pieces


def wing_root(side):
    """Art-less anchor where the membrane meets the flank: a body point at the
    wing's depth, so the pinned skin turns in 3D with the wing."""
    s = -1 if side == "l" else 1
    return [f'<g data-om-bone="wing-root-{side}" data-om-pivot="{f(-s * WB[0])} {f(WB[1])}" data-om-z="-20"/>']


def wing(side):
    m = (lambda d: d) if side == "l" else mirror
    s = -1 if side == "l" else 1
    X = lambda p: f"{f(-s * p[0])} {f(p[1])}"
    pcs = wing_pieces()
    cap = path(m(blob(WW[0], WW[1], CAP_R, CAP_R)), C["rim"])
    art = lambda k: ["  " + path(m(d), col) for d, col in pcs[k]]
    lines = [
        f'<g data-om-bone="wing-{side}" data-om-pivot="{X(WS)}" data-om-z="-20" data-om-surface="flat" '
        f'data-om-spring="90 9" data-om-tip="{s * 196} -72">',
        # pinned skins sort far behind the rest of the wing (they are the membrane)
        f'  <g data-om-bone="wing-flank-{side}" data-om-pivot="{X(WB)}" data-om-sort-z="-400" '
        f'data-om-pin="wing-root-{side} {X(WB)} wing-{side} {X(WS)} wing-hand-{side} {X(WP2)}">',
    ] + ["  " + l for l in art("flank")] + [
        "  </g>",
        f'  <g data-om-bone="wing-web-{side}" data-om-pivot="{X(WS)}" data-om-sort-z="-400" '
        f'data-om-pin="wing-{side} {X(WW)} wing-hand-{side} {X(WP2)}">',
    ] + ["  " + l for l in art("web")] + ["  </g>"] + art("arm") + ["  " + cap] + [
        f'  <g data-om-bone="wing-hand-{side}" data-om-pivot="{X(WW)}" data-om-surface="flat">',
    ] + ["  " + l for l in art("hand")] + [
        f'    <g data-om-bone="wing-tip-{side}" data-om-pivot="{X(WW)}" data-om-z="1" data-om-surface="flat">',
    ] + ["    " + l for l in slot(f"wing-{side}", {"spread": [x[2:] for x in art("tip")] + [cap]}, "spread")] + [
        "    </g>",
        "  </g>",
        "</g>",
    ]
    return lines


def eye(side):
    s = -1 if side == "l" else 1
    cx = s * 43
    head = (f'<g data-om-bone="eye-{side}" data-om-pivot="{cx} -128" data-om-z="40" '
            f'data-om-surface="face" data-om-normal="{s * 22} 0">')
    return [head] + ["  " + l for l in slot(f"eye-{side}", eye_variants(side), "open")] + ["</g>"]


def ear(side):
    m = (lambda d: d) if side == "l" else mirror
    s = -1 if side == "l" else 1
    return [
        f'<g data-om-bone="ear-{side}" data-om-pivot="{s * 52} -168" data-om-z="-6" '
        f'data-om-surface="flat" data-om-spring="140 10" data-om-tip="{s * 82} -232">',
        "  " + path(m(EAR_L), C["head"]),
        # pink inner only from the front: face surface culls when the ear turns away
        f'  <g data-om-bone="ear-{side}-inner" data-om-pivot="{s * 52} -168" data-om-z="2" data-om-surface="face">',
        "    " + path(m(EAR_IN_L), C["ear_in"]),
        "  </g>",
        "</g>",
    ]


def foot(side):
    m = (lambda d: d) if side == "l" else mirror
    s = -1 if side == "l" else 1
    return [
        f'<g data-om-bone="foot-{side}" data-om-pivot="{s * 23} -24" data-om-z="-6">',
        "  " + path(m(FOOT_L), C["foot"]),
        "</g>",
    ]


def build():
    blush = {"off": [], "on": [
        path(blob(-63, -100, 10, 5.5), C["blush"], ' opacity=".55"'),
        path(blob(63, -100, 10, 5.5), C["blush"], ' opacity=".55"'),
    ]}
    head = (
        ['<g data-om-bone="head" data-om-pivot="0 -140" data-om-z="4">']
        + ["  " + l for l in [
            '<g data-om-bone="head-back" data-om-pivot="0 -178" data-om-z="-30" data-om-surface="back">',
            "  " + path(HEAD_BACK_CURL, C["back_dark"]),
            "</g>"]]
        + ["  " + l for l in ear("l") + ear("r")]
        + ["  " + l for l in [
            '<g data-om-bone="tuft" data-om-pivot="0 -192" data-om-z="-2" data-om-surface="flat" '
            'data-om-spring="160 9" data-om-tip="10 -216">',
            "  " + path(TUFT, C["head"]),
            "</g>"]]
        + ["  " + path(HEAD, C["head"])]
        + ["  " + l for l in slot("blush", blush, "off", z=30)]
        + ["  " + l for l in eye("l") + eye("r")]
        + ["  " + l for l in
           ['<g data-om-bone="mouth" data-om-pivot="0 -88" data-om-z="45" data-om-surface="face">']
           + ["  " + x for x in slot("mouth", mouth_variants(), "default")]
           + ["</g>"]]
        + ["  " + l for l in [
            '<g data-om-bone="nose" data-om-pivot="0 -110" data-om-z="66" data-om-surface="feature">',
            "  " + path(SNOUT, C["snout"]),
            "  " + path(NOSTRIL_L, C["nostril"]),
            "  " + path(mirror(NOSTRIL_L), C["nostril"]),
            "</g>"]]
        + ["</g>"]
    )
    body = (
        ['<g data-om-bone="body" data-om-pivot="0 -75">']
        + ["  " + l for l in wing_root("l") + wing_root("r") + wing("l") + wing("r")]
        + ["  " + l for l in [
            '<g data-om-bone="body-back" data-om-pivot="0 -75" data-om-z="-12" data-om-surface="back">',
            "  " + path(BODY_BACK, C["back_dark"]),
            "</g>"]]
        + ["  " + l for l in foot("l") + foot("r")]
        + ["  " + path(BODY, C["body"])]
        + ["  " + l for l in head]
        + ["  " + l for l in [
            '<g data-om-bone="belly" data-om-pivot="0 -55" data-om-z="40" data-om-surface="face">',
            "  " + path(BELLY, C["belly"]),
            "</g>"]]
        + ["</g>"]
    )
    svg = (
        ['<svg xmlns="http://www.w3.org/2000/svg" viewBox="-212 -242 424 252" '
         'data-om-character="echo">',
         "  <title>Echo the bat</title>",
         '  <g data-om-bone="shadow" data-om-shadow="">',
         f'    <ellipse cx="0" cy="0" rx="72" ry="8" fill="{C["shadow"]}" opacity=".12"/>',
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
