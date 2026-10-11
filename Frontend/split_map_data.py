#!/usr/bin/env python3
"""
Creates Frontend/js/map-data.js from your standalone Bangla map page.

Usage (run from the Frontend/ folder):
    python split_map_data.py path/to/standalone-map.html

The standalone page is the one starting with <html lang="bn"> and the
title "সোনালী ধানের বাংলাদেশ". The script copies every line from
`const CW = ...` through `const PH = ...;` into js/map-data.js
(the big base64 images + division data). Nothing else is copied;
the drawing logic is already in js/map.js.
"""
import sys, re, pathlib

if len(sys.argv) != 2:
    sys.exit(__doc__)

src = pathlib.Path(sys.argv[1]).read_text(encoding="utf-8")
lines = src.splitlines()

start = next((i for i, l in enumerate(lines) if l.lstrip().startswith("const CW")), None)
end = next((i for i, l in enumerate(lines) if re.match(r"\s*const PH\s*=", l)), None)

if start is None or end is None or end < start:
    sys.exit("Could not find `const CW` ... `const PH` in that file.")

out = pathlib.Path("js")
out.mkdir(exist_ok=True)
block = "\n".join(lines[start:end + 1]) + "\n"
(out / "map-data.js").write_text(
    "/* Generated from the standalone map page. Do not edit by hand. */\n" + block,
    encoding="utf-8")

checks = ["MASK_SRC", "SHADE_SRC", "FARMER_SRC", "DIVS", "PH"]
missing = [c for c in checks if f"const {c}" not in block]
print(f"Wrote js/map-data.js ({len(block)//1024} KB)")
print("Missing constants:", missing if missing else "none")