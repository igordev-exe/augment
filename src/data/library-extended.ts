import { useEffect, useState } from "react";
import { LIB_BY_ID, LIB_MUSCLES } from "./library";
import { MUSCLE_LABEL } from "./program";
import RAW from "./library-extended.json";
import type { LibraryEntry, MuscleId } from "./types";

// Biblioteca ampliada: ~550 exercícios de força do free-exercise-db (domínio público), importados por
// scripts/import-exercise-db.py. Nome e passo a passo ficam em inglês (como no banco original); músculos e equipamento
// já vêm no formato do app. O índice carrega com o app; o passo a passo só quando um exercício é aberto.
// Imagens: baixadas do repositório na primeira vez e guardadas em cache pelo service worker (vite.config.ts).

export interface ExtendedEntry {
  /** "db-<id original>": não colide com a biblioteca curada. */
  id: string;
  /** Id no free-exercise-db (pasta das imagens). */
  src: string;
  name: string;
  compound: boolean;
  equip: string;
  level: string;
  muscles: MuscleId[];
  synergists: MuscleId[];
  images: number;
}

export const EXTENDED = RAW as ExtendedEntry[];
export const EXT_BY_ID: Record<string, ExtendedEntry> = Object.fromEntries(EXTENDED.map((e) => [e.id, e]));

export const EQUIP_LABEL: Record<string, string> = {
  barra: "Barra",
  halteres: "Halteres",
  polia: "Polia",
  maquina: "Máquina",
  corporal: "Peso corporal",
  kettlebell: "Kettlebell",
  elastico: "Elástico",
  "barra-w": "Barra W",
  "medicine-ball": "Medicine ball",
  bola: "Bola suíça",
  rolo: "Rolo",
  outro: "Outro",
};

export const LEVEL_LABEL: Record<string, string> = { beginner: "iniciante", intermediate: "intermediário", expert: "avançado" };

const IMG_BASE = "https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises";

export function extendedImages(id: string): string[] {
  const e = EXT_BY_ID[id];
  if (!e) return [];
  return Array.from({ length: Math.min(2, e.images) }, (_, i) => `${IMG_BASE}/${e.src}/${i}.jpg`);
}

/** Músculos de qualquer exercício da biblioteca (curada ou ampliada). */
export function libraryMuscles(libId: string): MuscleId[] {
  return LIB_MUSCLES[libId] ?? EXT_BY_ID[libId]?.muscles ?? [];
}

/** Nome de qualquer exercício da biblioteca. */
export function libraryName(libId: string): string | undefined {
  return LIB_BY_ID[libId]?.name ?? EXT_BY_ID[libId]?.name;
}

let instructions: Promise<Record<string, string[]>> | null = null;

/** Passo a passo (em inglês) de um exercício da biblioteca ampliada. Carrega o arquivo na primeira vez. */
export function loadInstructions(id: string): Promise<string[]> {
  instructions ??= import("./library-instructions.json").then((m) => m.default as Record<string, string[]>);
  return instructions.then((all) => all[id] ?? []).catch(() => []);
}

/** Ficha da biblioteca ampliada no formato da curada (o passo a passo entra depois, por `useLibraryEntry`). */
export function extendedAsLibrary(e: ExtendedEntry, steps: string[] = []): LibraryEntry {
  return {
    id: e.id,
    name: e.name,
    primary: e.muscles.map((m) => MUSCLE_LABEL[m]).join(", "),
    equipment: EQUIP_LABEL[e.equip] ?? "Outro",
    setup: [],
    execution: steps,
    errors: [],
    why: "",
    videoPt: e.name,
    videoEn: e.name,
  };
}

/** Ficha de qualquer exercício: a curada na hora; a ampliada com o passo a passo assim que carregar. */
export function useLibraryEntry(libId: string): LibraryEntry | undefined {
  const curated = LIB_BY_ID[libId];
  const ext = curated ? undefined : EXT_BY_ID[libId];
  const [steps, setSteps] = useState<string[]>([]);
  useEffect(() => {
    if (!ext) return;
    let alive = true;
    loadInstructions(ext.id).then((s) => alive && setSteps(s));
    return () => {
      alive = false;
    };
  }, [ext]);
  if (curated) return curated;
  return ext ? extendedAsLibrary(ext, steps) : undefined;
}
