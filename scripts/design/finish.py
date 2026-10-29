#!/usr/bin/env python3
"""Downscale the 2x render to exactly 1536x960 with high-quality Lanczos + light unsharp."""
from PIL import Image, ImageFilter

RAW = "/home/z/my-project/scripts/design/raw2x.png"
OUT = "/home/z/my-project/download/mybuddymaid-erp-dashboard.png"

im = Image.open(RAW).convert("RGB")
print("raw:", im.size)
if im.size != (3072, 1920):
    print("WARNING: unexpected raw size", im.size)
im = im.resize((1536, 960), Image.LANCZOS)
im = im.filter(ImageFilter.UnsharpMask(radius=1.1, percent=55, threshold=2))
im.save(OUT, optimize=True)
print("final:", OUT, im.size)
