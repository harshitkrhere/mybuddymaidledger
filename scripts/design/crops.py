#!/usr/bin/env python3
"""Crop zoomed verification regions from the 2x render for targeted VLM inspection."""
from PIL import Image

RAW = "/home/z/my-project/scripts/design/raw2x.png"
im = Image.open(RAW)
assert im.size == (3072, 1920), im.size

# (name, left, top, right, bottom) in 1x coords -> x2 for the 2x bitmap
REGIONS = [
    ("crop-ledger", 30, 615, 960, 930),
    ("crop-chart",  30, 275, 960, 565),
    ("crop-cities", 975, 355, 1505, 880),
]
for name, l, t, r, b in REGIONS:
    im.crop((l * 2, t * 2, r * 2, b * 2)).save(f"/home/z/my-project/scripts/design/{name}.png")
    print("saved", name)
