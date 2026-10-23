"""Draws the Plano icon (a "P" whose bowl holds an ECG pulse) and renders the PWA icons.
Run: python scripts/make-icons.py  (needs Pillow)

The mark is one bold glyph with no wordmark, so it stays legible at favicon size. Coordinates are
in a 1000-unit square; the content bbox is x290-730, y190-810, and the maskable variant scales it
into the 80% safe circle.
"""
import sys
from pathlib import Path
from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parent.parent
OUT = Path(sys.argv[1]) if len(sys.argv) > 1 else ROOT / 'public' / 'icons'  # optional output dir
BG, NAVY, RED = '#f2e9db', '#1b2a3f', '#c0392b'
CX, CY, HALF_DIAG = 510, 500, 386  # content centre and half-diagonal, master units
SS, MASTER_PX = 4, 1024


def draw_master():
    k = MASTER_PX * SS / 1000
    img = Image.new('RGB', (MASTER_PX * SS,) * 2, BG)
    d = ImageDraw.Draw(img)

    def box(x0, y0, x1, y1):
        return [x0 * k, y0 * k, x1 * k, y1 * k]

    d.rounded_rectangle(box(290, 190, 730, 600), radius=205 * k, fill=NAVY)  # bowl, right side round
    d.rectangle(box(290, 190, 500, 600), fill=NAVY)  # square off the left corners
    d.rectangle(box(290, 190, 400, 810), fill=NAVY)  # stem
    d.rounded_rectangle(box(400, 290, 620, 500), radius=105 * k, fill=BG)  # counter
    d.rectangle(box(400, 290, 525, 500), fill=BG)
    pulse = [(420, 395), (468, 395), (498, 328), (534, 462), (560, 395), (605, 395)]
    pts = [(x * k, y * k) for x, y in pulse]
    w = 34 * k
    d.line(pts, fill=RED, width=round(w), joint='curve')
    for x, y in (pts[0], pts[-1]):  # round caps
        d.ellipse([x - w / 2, y - w / 2, x + w / 2, y + w / 2], fill=RED)
    return img.resize((MASTER_PX, MASTER_PX), Image.LANCZOS)


master = draw_master()
UNIT = MASTER_PX / 1000  # master px per drawing unit


def rounded(size):
    s = master.resize((size, size), Image.LANCZOS).convert('RGBA')
    mask = Image.new('L', (size * 4, size * 4), 0)
    ImageDraw.Draw(mask).rounded_rectangle([0, 0, size * 4 - 1, size * 4 - 1], radius=size * 4 * 116 // 512, fill=255)
    s.putalpha(mask.resize((size, size), Image.LANCZOS))
    return s


def maskable(size):
    k = size / 2 * 0.8 * 0.95 / (HALF_DIAG * UNIT)  # content inside the safe circle, 5% spare
    m = master.resize((round(master.width * k),) * 2, Image.LANCZOS)
    canvas = Image.new('RGB', (size, size), BG)
    canvas.paste(m, (round(size / 2 - CX * UNIT * k), round(size / 2 - CY * UNIT * k)))
    return canvas


rounded(512).save(OUT / 'icon-512.png', optimize=True)
rounded(192).save(OUT / 'icon-192.png', optimize=True)
rounded(64).save(OUT / 'favicon.png', optimize=True)
# iOS applies its own mask and paints transparency black, so this one is an opaque square.
master.resize((180, 180), Image.LANCZOS).save(OUT / 'apple-touch-icon.png', optimize=True)
maskable(512).save(OUT / 'maskable-512.png', optimize=True)
