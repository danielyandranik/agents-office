"""Regenerates the loft's material textures (brick, wood grain, concrete, rug, leather).

They are SVG noise filters inlined as data URIs, written into styles.css between the
/*TEXTURES*/ and /*END_TEXTURES*/ markers. Run: python3 tools/textures.py
"""
import random
import re
from pathlib import Path
from urllib.parse import quote

random.seed(7)


def uri(svg: str) -> str:
    svg = " ".join(svg.split())
    return 'url("data:image/svg+xml,' + quote(svg, safe=" =:/;,'()-.") + '")'


def hexc(r, g, b):
    return "#%02X%02X%02X" % (max(0, min(255, int(r))), max(0, min(255, int(g))), max(0, min(255, int(b))))


# ---------------------------------------------------------------- brick: 6 x 4 bricks, each one slightly different
bases = [(162, 83, 58), (174, 92, 64), (151, 73, 47), (168, 90, 61), (156, 78, 52), (138, 66, 44), (180, 104, 74)]
bricks = []
for row in range(4):
    y = row * 16 + 1
    off = -16 if row % 2 else 0
    for col in range(7):
        x = off + col * 32 + 1
        r, g, b = random.choice(bases)
        k = random.uniform(-14, 12)
        if random.random() < 0.12:  # an occasional burnt, darker brick
            k -= 26
        fill = hexc(r + k, g + k * 0.7, b + k * 0.55)
        bricks.append(f"<rect x='{x}' y='{y}' width='30' height='14' rx='1.2' fill='{fill}'/>")
        bricks.append(f"<rect x='{x}' y='{y}' width='30' height='1.6' fill='#fff' opacity='.13'/>")
        bricks.append(f"<rect x='{x}' y='{y + 11.8}' width='30' height='2.2' fill='#000' opacity='.2'/>")
        bricks.append(f"<rect x='{x + 28}' y='{y}' width='2' height='14' fill='#000' opacity='.1'/>")
        if random.random() < 0.35:  # a chip or a soot stain
            cx, cy = x + random.uniform(4, 26), y + random.uniform(3, 11)
            bricks.append(f"<ellipse cx='{cx:.1f}' cy='{cy:.1f}' rx='{random.uniform(2, 5):.1f}' ry='{random.uniform(1, 2.4):.1f}' fill='#000' opacity='{random.uniform(.08, .18):.2f}'/>")
brick = f"""<svg xmlns='http://www.w3.org/2000/svg' width='192' height='64'>
<filter id='n' x='0' y='0' width='1' height='1'><feTurbulence type='fractalNoise' baseFrequency='.7' numOctaves='2' stitchTiles='stitch'/><feColorMatrix values='0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 -1.3 .78'/></filter>
<rect width='192' height='64' fill='#000' opacity='.06'/>
{''.join(bricks)}
<rect width='192' height='64' filter='url(#n)' opacity='.55'/></svg>"""

# ---------------------------------------------------------------- wood grain (horizontal boards), transparent dark streaks
grain = """<svg xmlns='http://www.w3.org/2000/svg' width='360' height='90'>
<filter id='g' x='0' y='0' width='1' height='1'><feTurbulence type='fractalNoise' baseFrequency='.006 .32' numOctaves='3' seed='4' stitchTiles='stitch'/>
<feColorMatrix values='0 0 0 0 .22 0 0 0 0 .12 0 0 0 0 .05 1.5 0 0 0 -.56'/></filter>
<rect width='360' height='90' filter='url(#g)'/></svg>"""

# vertical boards (meeting-room floor)
grain_v = """<svg xmlns='http://www.w3.org/2000/svg' width='90' height='360'>
<filter id='g' x='0' y='0' width='1' height='1'><feTurbulence type='fractalNoise' baseFrequency='.32 .006' numOctaves='3' seed='9' stitchTiles='stitch'/>
<feColorMatrix values='0 0 0 0 .22 0 0 0 0 .12 0 0 0 0 .05 1 0 0 0 -.5'/></filter>
<rect width='90' height='360' filter='url(#g)'/></svg>"""

# ---------------------------------------------------------------- concrete: fine aggregate + soft stains
noise = """<svg xmlns='http://www.w3.org/2000/svg' width='220' height='220'>
<filter id='f' x='0' y='0' width='1' height='1'><feTurbulence type='fractalNoise' baseFrequency='.85' numOctaves='3' stitchTiles='stitch'/>
<feColorMatrix values='0 0 0 0 .2 0 0 0 0 .17 0 0 0 0 .14 0 0 0 -2.2 1.32'/></filter>
<filter id='l' x='0' y='0' width='1' height='1'><feTurbulence type='fractalNoise' baseFrequency='.85' numOctaves='2' seed='5' stitchTiles='stitch'/>
<feColorMatrix values='0 0 0 0 1 0 0 0 0 1 0 0 0 0 1 0 0 0 -2.4 1.36'/></filter>
<rect width='220' height='220' filter='url(#f)' opacity='.26'/><rect width='220' height='220' filter='url(#l)' opacity='.14'/></svg>"""

stains = """<svg xmlns='http://www.w3.org/2000/svg' width='620' height='620'>
<filter id='s' x='0' y='0' width='1' height='1'><feTurbulence type='fractalNoise' baseFrequency='.0045' numOctaves='4' seed='11' stitchTiles='stitch'/>
<feColorMatrix values='0 0 0 0 .18 0 0 0 0 .15 0 0 0 0 .12 0 0 0 -1.6 .92'/></filter>
<rect width='620' height='620' filter='url(#s)' opacity='.5'/></svg>"""

# ---------------------------------------------------------------- textiles
weave = """<svg xmlns='http://www.w3.org/2000/svg' width='120' height='120'>
<filter id='w' x='0' y='0' width='1' height='1'><feTurbulence type='fractalNoise' baseFrequency='.9 .25' numOctaves='2' stitchTiles='stitch'/>
<feColorMatrix values='0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 -1.6 1'/></filter>
<rect width='120' height='120' filter='url(#w)' opacity='.45'/></svg>"""

leather = """<svg xmlns='http://www.w3.org/2000/svg' width='160' height='160'>
<filter id='c' x='0' y='0' width='1' height='1'><feTurbulence type='turbulence' baseFrequency='.32' numOctaves='2' seed='2' stitchTiles='stitch'/>
<feColorMatrix values='0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 -1.4 .74'/></filter>
<rect width='160' height='160' filter='url(#c)' opacity='.28'/></svg>"""

css = "\n".join([
    f"  --tex-brick: {uri(brick)};",
    f"  --tex-grain: {uri(grain)};",
    f"  --tex-grain-v: {uri(grain_v)};",
    f"  --tex-noise: {uri(noise)};",
    f"  --tex-stains: {uri(stains)};",
    f"  --tex-weave: {uri(weave)};",
    f"  --tex-leather: {uri(leather)};",
])

styles = Path(__file__).resolve().parent.parent / "src" / "AgentOffice" / "wwwroot" / "styles.css"
text = styles.read_text(encoding="utf-8")
block = f"/*TEXTURES*/\n{css}\n  /*END_TEXTURES*/"
text, n = re.subn(r"/\*TEXTURES\*/.*?/\*END_TEXTURES\*/", lambda _: block, text, flags=re.S)
if n != 1:
    raise SystemExit("styles.css: /*TEXTURES*/ ... /*END_TEXTURES*/ markers not found")
styles.write_text(text, encoding="utf-8")
print(f"styles.css: {len(css) // 1024} KB of textures")
