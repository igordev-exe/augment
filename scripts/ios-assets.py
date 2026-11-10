"""Gera o ícone e a tela de abertura do app iOS a partir de um PNG 1024x1024 do ícone.

Uso:  python scripts/ios-assets.py <icone-1024.png>

O PNG sai de public/icon.svg renderizado em 1024 px (qualquer navegador: abrir o SVG e salvar a imagem em 1024x1024).
- AppIcon-512@2x.png: ícone único de 1024 px (o Xcode gera os outros tamanhos), sem transparência;
- splash-2732x2732*.png: fundo do app (#0c0e11) com o ícone no centro.
"""

import os
import sys

from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
ASSETS = os.path.join(ROOT, "ios", "App", "App", "Assets.xcassets")
BG = (12, 14, 17)

src = Image.open(sys.argv[1]).convert("RGB")
if src.size != (1024, 1024):
    src = src.resize((1024, 1024), Image.LANCZOS)
src.save(os.path.join(ASSETS, "AppIcon.appiconset", "AppIcon-512@2x.png"))

splash = Image.new("RGB", (2732, 2732), BG)
logo = src.resize((720, 720), Image.LANCZOS)
splash.paste(logo, ((2732 - 720) // 2, (2732 - 720) // 2))
for name in ("splash-2732x2732.png", "splash-2732x2732-1.png", "splash-2732x2732-2.png"):
    splash.save(os.path.join(ASSETS, "Splash.imageset", name), optimize=True)
print("Ícone e splash do iOS gerados.")
