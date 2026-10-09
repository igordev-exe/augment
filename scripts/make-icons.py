# Gera os PNGs do ícone a partir de public/icon.svg (usa Playwright/Chromium).
import pathlib, sys
from playwright.sync_api import sync_playwright

root = pathlib.Path(sys.argv[1]).resolve()
svg = (root / "public" / "icon.svg").read_text()
# Maskable: encolhe a marca para caber na zona segura (80%).
maskable = svg.replace('<g id="mark">', '<g id="mark" transform="translate(51 51) scale(.8)">')
targets = [("icon-192.png", 192, svg), ("icon-512.png", 512, svg), ("apple-touch-icon.png", 180, svg), ("icon-512-maskable.png", 512, maskable)]
with sync_playwright() as p:
    b = p.chromium.launch()
    for name, size, src in targets:
        pg = b.new_page(viewport={"width": size, "height": size})
        sized = src.replace("<svg ", f'<svg width="{size}" height="{size}" ', 1)
        pg.set_content(f'<html><body style="margin:0;background:#0c0e11">{sized}</body></html>')
        pg.screenshot(path=str(root / "public" / name), clip={"x": 0, "y": 0, "width": size, "height": size})
        pg.close()
    b.close()
print("ok")
