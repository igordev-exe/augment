"""Gera o ícone e a tela de abertura do APK a partir dos ícones da PWA (public/).

Uso:  python scripts/android-assets.py

- mipmap-*/ic_launcher*.png: ícone clássico, redondo e a camada da frente do ícone adaptativo (Android 8+);
- drawable*/splash.png: fundo do app (#0c0e11) com o ícone no centro, nas mesmas medidas que o Capacitor gerou.
"""

import os

from PIL import Image, ImageDraw

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
RES = os.path.join(ROOT, "android", "app", "src", "main", "res")
BG = (12, 14, 17)

maskable = Image.open(os.path.join(ROOT, "public", "icon-512-maskable.png")).convert("RGBA")

LEGACY = {"mdpi": 48, "hdpi": 72, "xhdpi": 96, "xxhdpi": 144, "xxxhdpi": 192}
FOREGROUND = {"mdpi": 108, "hdpi": 162, "xhdpi": 216, "xxhdpi": 324, "xxxhdpi": 432}


def round_icon(size: int) -> Image.Image:
    im = maskable.resize((size, size), Image.LANCZOS)
    mask = Image.new("L", (size, size), 0)
    ImageDraw.Draw(mask).ellipse((0, 0, size - 1, size - 1), fill=255)
    out = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    out.paste(im, (0, 0), mask)
    return out


for d, size in LEGACY.items():
    folder = os.path.join(RES, f"mipmap-{d}")
    # O maskable tem margem de segurança: no ícone clássico o desenho fica um pouco maior.
    crop = maskable.crop((48, 48, 464, 464)).resize((size, size), Image.LANCZOS)
    crop.save(os.path.join(folder, "ic_launcher.png"))
    round_icon(size).save(os.path.join(folder, "ic_launcher_round.png"))
    maskable.resize((FOREGROUND[d], FOREGROUND[d]), Image.LANCZOS).save(os.path.join(folder, "ic_launcher_foreground.png"))

# Tela de abertura: só o bloco vermelho do ícone, centrado, sobre o fundo do app.
mark = maskable.crop((120, 96, 416, 416))
for dirpath, _dirs, files in os.walk(RES):
    if "splash.png" not in files:
        continue
    p = os.path.join(dirpath, "splash.png")
    w, h = Image.open(p).size
    side = int(min(w, h) * 0.28)
    m = mark.resize((side, int(side * mark.height / mark.width)), Image.LANCZOS)
    out = Image.new("RGB", (w, h), BG)
    out.paste(m, ((w - m.width) // 2, (h - m.height) // 2), m)
    out.save(p)

print("ícones e splash gerados em", RES)
