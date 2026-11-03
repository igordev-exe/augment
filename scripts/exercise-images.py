# Gera public/exercises/<id-da-biblioteca>-{0,1}.webp a partir de uma cópia local do free-exercise-db (domínio público).
# Uso: python scripts/exercise-images.py <pasta do free-exercise-db> .
# O mapa biblioteca → exercício do dataset fica em src/data/exercise-images.json.
import json, pathlib, sys
from PIL import Image

src = pathlib.Path(sys.argv[1]).resolve() / "exercises"
root = pathlib.Path(sys.argv[2]).resolve()
mapping = json.loads((root / "src" / "data" / "exercise-images.json").read_text(encoding="utf-8"))
out = root / "public" / "exercises"
out.mkdir(parents=True, exist_ok=True)

total = 0
for lib_id, ds_id in mapping.items():
    for i in (0, 1):
        img = Image.open(src / ds_id / f"{i}.jpg").convert("RGB")
        img.thumbnail((480, 480))
        dest = out / f"{lib_id}-{i}.webp"
        img.save(dest, "WEBP", quality=70, method=6)
        total += dest.stat().st_size
print(f"{len(mapping) * 2} imagens, {total / 1024:.0f} KB")
