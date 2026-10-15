#!/usr/bin/env python3
"""Composite Echo previews (dev only): side-by-side + overlay vs reference,
and contact sheets of every variant. Run after preview-echo.mjs.

    python3 packages/characters/scripts/compose-echo.py <reference front.png>
"""
import os
import sys
from PIL import Image, ImageChops, ImageDraw

repo = os.path.abspath(os.path.join(os.path.dirname(__file__), "../../.."))
out = os.path.join(repo, "out/echo")
ref = Image.open(sys.argv[1]).convert("RGB")
me = Image.open(os.path.join(out, "front.png")).convert("RGB").resize(ref.size)

side = Image.new("RGB", (ref.width * 2, ref.height), "white")
side.paste(ref, (0, 0))
side.paste(me, (ref.width, 0))
side.save(os.path.join(out, "compare-side-by-side.png"))
Image.blend(ref, me, 0.5).save(os.path.join(out, "compare-overlay.png"))
diff = ImageChops.difference(ref, me).convert("L").point(lambda v: 255 - min(255, v * 3))
diff.save(os.path.join(out, "compare-diff.png"))


def sheet(names, prefix, cols, fname):
    ims = [(n, Image.open(os.path.join(out, f"{prefix}{n}.png")).convert("RGB")) for n in names]
    w, h = ims[0][1].size
    rows = (len(ims) + cols - 1) // cols
    s = Image.new("RGB", (w * cols, (h + 18) * rows), "white")
    d = ImageDraw.Draw(s)
    for i, (n, im) in enumerate(ims):
        x, y = (i % cols) * w, (i // cols) * (h + 18)
        s.paste(im, (x, y + 18))
        d.text((x + 6, y + 3), n, fill=(0, 0, 0))
    s.save(os.path.join(out, fname))


sheet(["open", "happy", "closed", "heart", "half", "angry", "sad", "surprised", "dizzy"],
      "sheet-eye-", 5, "sheet-eyes.png")
sheet(["default", "smile", "open", "tongue", "o", "frown", "grin"], "sheet-mouth-", 4, "sheet-mouths.png")
sheet(["excited", "love", "unimpressed", "playful", "inlove", "determined", "sad", "surprised", "dizzy"],
      "combo-", 3, "sheet-expressions.png")
print("ok")
