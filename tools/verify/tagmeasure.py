"""Lê as capturas do tagcheck e mede a folga (px CSS) entre a etiqueta e o primeiro pixel do capacete na mesma altura."""
import json
import sys

from PIL import Image

d = sys.argv[1]
MIN_GAP = float(sys.argv[2]) if len(sys.argv) > 2 else 16
rows = json.load(open(f"{d}/boxes.json", encoding="utf-8"))
fails = 0
for r in rows:
    im = Image.open(f"{d}/{r['file']}").convert("RGB")
    px = im.load()
    k = r["dpr"]
    x0 = int(r["right"] * k) + 2
    x1 = int((r["cardRight"] - 14) * k)  # antes da faixa listrada da direita
    best = None
    for y in range(int(r["top"] * k), int(r["bottom"] * k)):
        for x in range(x0, x1):
            R, G, B = px[x, y]
            # fundo do card é vermelho (R alto, G e B baixos); capacete é cinza/preto/branco
            red_bg = R > 110 and G < 90 and B < 90 and R - G > 70
            blue_bg = B > 90 and R < 80 and B - R > 45  # semana de deload: card azul-aço
            if not (red_bg or blue_bg):
                gap = (x - x0) / k
                best = gap if best is None else min(best, gap)
                break
    gap = best if best is not None else 999
    ok = gap >= MIN_GAP
    fails += not ok
    print(f"{r['w']:>4}px  {r['tag']:<17} folga {gap:6.1f}px  ({gap / r['cardW'] * 100:4.1f}% do card)  {'OK' if ok else 'FALHA'}")
print("falhas:", fails)
