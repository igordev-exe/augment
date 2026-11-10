"""Importa a biblioteca ampliada do free-exercise-db (domínio público, github.com/yuhonas/free-exercise-db).

Uso:  python -I scripts/import-exercise-db.py caminho/para/exercises.json

Gera dois arquivos em src/data/:
  - library-extended.json      índice compacto (carrega com o app): id, nome em português (`name`), nome original em
                               inglês (`en`), tipo, equipamento, nível, músculos
  - library-instructions.json  passo a passo em inglês (carrega só ao abrir um exercício)

Regras:
  - só categorias de força (strength, powerlifting);
  - músculos do banco viram os 14 do app; quem só treina pescoço, lombar ou adutor fica de fora;
  - ombro vira deltoide anterior, lateral ou posterior pelo nome do exercício;
  - sinergistas (0,5 série) só em compostos, a partir dos músculos secundários;
  - exercícios que já existem na biblioteca curada (src/data/exercise-images.json) não entram de novo;
  - o nome em português vem de scripts/exercise-names-pt.json (id original -> nome). Sem tradução, fica o inglês.
"""

import json
import os
import re
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATA = os.path.join(ROOT, "src", "data")

KEEP_CATEGORIES = {"strength", "powerlifting"}

MUSCLE = {
    "abdominals": "abdomen",
    "abductors": "gluteo",
    "biceps": "biceps",
    "calves": "panturrilha",
    "chest": "peito",
    "glutes": "gluteo",
    "hamstrings": "posterior",
    "lats": "costas",
    "middle back": "costas",
    "quadriceps": "quadriceps",
    "traps": "trapezio",
    "triceps": "triceps",
    "forearms": "antebraco",
    # sem equivalente no app: neck, lower back, adductors
}

EQUIP = {
    "barbell": "barra",
    "dumbbell": "halteres",
    "cable": "polia",
    "machine": "maquina",
    "body only": "corporal",
    "kettlebells": "kettlebell",
    "bands": "elastico",
    "e-z curl bar": "barra-w",
    "medicine ball": "medicine-ball",
    "exercise ball": "bola",
    "foam roll": "rolo",
    "other": "outro",
    None: "outro",
}

REAR = re.compile(r"rear|reverse fly|reverse flye|face pull|bent[- ]over.*(raise|fly|flye|lateral)|posterior", re.I)
SIDE = re.compile(r"lateral|side raise|side lateral|upright row|y-raise|lu raise", re.I)


def shoulder(name: str) -> str:
    if REAR.search(name):
        return "deltPosterior"
    if SIDE.search(name):
        return "deltLateral"
    return "deltAnterior"


def map_muscle(m: str, name: str):
    if m == "shoulders":
        return shoulder(name)
    return MUSCLE.get(m)


def main(path: str) -> None:
    data = json.load(open(path, encoding="utf-8"))
    curated = set(json.load(open(os.path.join(DATA, "exercise-images.json"), encoding="utf-8")).values())
    pt = json.load(open(os.path.join(ROOT, "scripts", "exercise-names-pt.json"), encoding="utf-8"))
    index = []
    instructions = {}
    for x in data:
        if x.get("category") not in KEEP_CATEGORIES:
            continue
        if not re.fullmatch(r"[A-Za-z0-9_\-]+", x["id"]) or x["id"] in curated:
            continue
        prim = []
        for m in x.get("primaryMuscles", []):
            mm = map_muscle(m, x["name"])
            if mm and mm not in prim:
                prim.append(mm)
        if not prim:
            continue
        compound = x.get("mechanic") == "compound"
        syn = []
        if compound:
            for m in x.get("secondaryMuscles", []):
                mm = map_muscle(m, x["name"])
                if mm and mm not in prim and mm not in syn:
                    syn.append(mm)
        images = [i for i in x.get("images", []) if re.fullmatch(r"[A-Za-z0-9_\-]+/\d+\.jpg", i)]
        index.append(
            {
                "id": "db-" + x["id"],
                "src": x["id"],
                "name": str(pt.get(x["id"]) or x["name"])[:80],
                "en": str(x["name"])[:80],
                "compound": compound,
                "equip": EQUIP.get(x.get("equipment"), "outro"),
                "level": x.get("level") or "intermediate",
                "muscles": prim,
                "synergists": syn,
                "images": len(images),
            }
        )
        steps = [str(s)[:600] for s in x.get("instructions", []) if isinstance(s, str) and s.strip()]
        if steps:
            instructions["db-" + x["id"]] = steps
    index.sort(key=lambda e: e["en"].lower())
    with open(os.path.join(DATA, "library-extended.json"), "w", encoding="utf-8", newline="\n") as f:
        json.dump(index, f, ensure_ascii=False, separators=(",", ":"))
    with open(os.path.join(DATA, "library-instructions.json"), "w", encoding="utf-8", newline="\n") as f:
        json.dump(instructions, f, ensure_ascii=False, separators=(",", ":"))
    print(f"{len(index)} exercícios no índice, {len(instructions)} com passo a passo")


if __name__ == "__main__":
    main(sys.argv[1])
