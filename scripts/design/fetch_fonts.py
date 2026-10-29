#!/usr/bin/env python3
"""Fetch Google Fonts (woff2, latin subsets) for the MyBuddyMaid design + emit fonts.css."""
import re, os, urllib.request

UA = "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
BASE = "/home/z/my-project/scripts/design"
FDIR = os.path.join(BASE, "fonts")
os.makedirs(FDIR, exist_ok=True)

FAMILIES = [
    ("Fraunces",
     "https://fonts.googleapis.com/css2?family=Fraunces:ital,opsz,wght@0,9..144,300..900;1,9..144,300..900&display=swap"),
    ("Archivo",
     "https://fonts.googleapis.com/css2?family=Archivo:ital,wght@0,400..800;1,400..700&display=swap"),
    ("IBM Plex Mono",
     "https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:ital,wght@0,400;0,500;0,600;1,400&display=swap"),
]

def fetch(url):
    req = urllib.request.Request(url, headers={"User-Agent": UA})
    return urllib.request.urlopen(req, timeout=25).read()

css_out, n = [], 0
for fam, url in FAMILIES:
    try:
        css = fetch(url).decode("utf-8")
    except Exception as e:
        print(f"FAIL css {fam}: {e}")
        continue
    blocks = re.findall(r"/\*\s*([a-z0-9-]+)\s*\*/\s*(@font-face\s*\{[^}]*?\})", css)
    for subset, block in blocks:
        if subset not in ("latin", "latin-ext"):
            continue
        m = re.search(r"url\((https://[^)]+\.woff2)\)", block)
        if not m:
            continue
        wurl = m.group(1)
        style = re.search(r"font-style:\s*(\w+)", block).group(1)
        weight = re.search(r"font-weight:\s*([\d ]+?);", block).group(1).strip().replace(" ", "_")
        urange = re.search(r"unicode-range:\s*([^;]+);", block).group(1).strip()
        n += 1
        fname = f"{fam.replace(' ', '')}-{style}-{weight}-{subset}-{n}.woff2"
        try:
            data = fetch(wurl)
        except Exception as e:
            print(f"FAIL font {fam} {style} {weight} {subset}: {e}")
            continue
        with open(os.path.join(FDIR, fname), "wb") as f:
            f.write(data)
        local = block.replace(wurl, f"fonts/{fname}")
        css_out.append(f"/* {fam} {style} {weight} {subset} */\n{local}")
        print(f"ok  {fam:15s} {style:7s} {weight:7s} {subset:9s} {len(data)//1024:4d} KB")

with open(os.path.join(BASE, "fonts.css"), "w") as f:
    f.write("\n".join(css_out) + "\n")
print(f"\nfonts.css written: {len(css_out)} faces")

# --- glyph coverage check: Indian Rupee (U+20B9), minus (U+2212), times (U+00D7) ---
try:
    from fontTools.ttLib import TTFont
    def covers(path, cp):
        try:
            f = TTFont(path)
            for t in f["cmap"].tables:
                if t.isUnicode() and cp in t.cmap:
                    return True
            return False
        except Exception:
            return None
    print("\n--- glyph coverage (rupee/minus/times) ---")
    for fn in sorted(os.listdir(FDIR)):
        p = os.path.join(FDIR, fn)
        print(f"{fn[:52]:52s}  \u20b9:{covers(p,0x20B9)}  -:{covers(p,0x2212)}  x:{covers(p,0x00D7)}")
except Exception as e:
    print("fontTools check skipped:", e)
