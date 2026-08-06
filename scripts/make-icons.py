"""Generate PWA icons. Vector-drawn, no font dependency, no third-party asset.
Glyph: a "V" (visite) whose right stroke continues as a vitals pulse line."""
from PIL import Image, ImageDraw

BG = (11, 15, 20)       # --bg dark, matches the shell
FG = (255, 255, 255)
ACCENT = (45, 212, 191)  # step-5 accent (tosca)


def draw_glyph(size: int, inset: float) -> Image.Image:
    img = Image.new("RGBA", (size, size), BG + (255,))
    d = ImageDraw.Draw(img)
    s = size
    m = s * inset                      # safe-zone margin
    w = max(2, int(s * 0.085))         # stroke width

    # "V"
    left = (m, m + (s - 2 * m) * 0.10)
    apex = (s / 2, s - m - (s - 2 * m) * 0.18)
    right = (s - m, m + (s - 2 * m) * 0.10)
    d.line([left, apex], fill=FG, width=w, joint="curve")
    d.line([apex, right], fill=FG, width=w, joint="curve")

    # pulse tick under the V
    y = s - m - (s - 2 * m) * 0.02
    d.line(
        [(m, y), (s * 0.36, y), (s * 0.44, y - (s - 2 * m) * 0.12),
         (s * 0.54, y + (s - 2 * m) * 0.06), (s * 0.62, y), (s - m, y)],
        fill=ACCENT, width=max(2, int(w * 0.55)), joint="curve",
    )
    return img


def save(path: str, size: int, inset: float) -> None:
    draw_glyph(size, inset).save(path, "PNG", optimize=True)
    print("wrote", path)


save("public/icons/icon-192.png", 192, 0.18)
save("public/icons/icon-512.png", 512, 0.18)
# Maskable: keep all content inside the inner 80% circle-safe zone.
save("public/icons/maskable-512.png", 512, 0.28)
save("public/icons/apple-touch-icon.png", 180, 0.18)
