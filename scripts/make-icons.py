"""Renders the PWA icons from scripts/icon-master.png (the master). Run: python scripts/make-icons.py  (needs Pillow)

Master = the Plano logo tile, full-bleed square on cream. Content bbox in the master is
x116-874, y48-907; the maskable variant scales it into the 80% safe circle.
"""
from pathlib import Path
from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / 'public' / 'icons'
master = Image.open(Path(__file__).with_name('icon-master.png')).convert('RGB')
BG = master.getpixel((2, 2))
CX, CY, HALF_DIAG = 495, 477.5, 573  # content centre and half-diagonal, master px


def rounded(size):
    s = master.resize((size, size), Image.LANCZOS).convert('RGBA')
    mask = Image.new('L', (size * 4, size * 4), 0)
    ImageDraw.Draw(mask).rounded_rectangle([0, 0, size * 4 - 1, size * 4 - 1], radius=size * 4 * 116 // 512, fill=255)
    s.putalpha(mask.resize((size, size), Image.LANCZOS))
    return s


def maskable(size):
    k = size / 2 * 0.8 * 0.95 / HALF_DIAG  # content inside the safe circle, 5% spare
    m = master.resize((round(master.width * k),) * 2, Image.LANCZOS)
    canvas = Image.new('RGB', (size, size), BG)
    canvas.paste(m, (round(size / 2 - CX * k), round(size / 2 - CY * k)))
    return canvas


rounded(512).save(OUT / 'icon-512.png', optimize=True)
rounded(192).save(OUT / 'icon-192.png', optimize=True)
rounded(64).save(OUT / 'favicon.png', optimize=True)
# iOS applies its own mask and paints transparency black, so this one is an opaque square.
master.resize((180, 180), Image.LANCZOS).save(OUT / 'apple-touch-icon.png', optimize=True)
maskable(512).save(OUT / 'maskable-512.png', optimize=True)
