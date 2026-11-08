import { MUSCLE_ORDER, exOf, synergistsOf } from "../data/program";
import { SCIENCE } from "../data/science";
import type { MuscleId, Session } from "../data/types";
import { addDays, mondayOf } from "./dates";
import { workSets } from "./progression";
import { plannedVolume } from "./sessions";

// Slots de volume (Fase 2 do design, estilo "implantes"): séries fracionadas da semana por músculo,
// com o que a ficha pede, a dose mínima (4) e o início da faixa eficiente (10).

export type SlotStatus = "sem-plano" | "abaixo-minimo" | "abaixo-meta" | "meta" | "acima";

export interface SlotSource {
  exId: string;
  sets: number;
  /** 1 = série direta; 0,5 = série indireta (sinergista). */
  weight: 1 | 0.5;
}

export interface MuscleSlots {
  muscle: MuscleId;
  /** Séries fracionadas feitas na semana. */
  done: number;
  /** Séries fracionadas que a ficha pede na semana. */
  planned: number;
  /** Séries diretas feitas (sem o 0,5 dos sinergistas). */
  direct: number;
  /** Quanto falta para a meta (arredondado para cima, 0 se bateu). */
  missing: number;
  status: SlotStatus;
  sources: SlotSource[];
}

/** Grupos do mapa: tronco à esquerda, pernas e core à direita. */
export const SLOT_COLUMNS: { title: string; muscles: MuscleId[] }[] = [
  { title: "Tronco", muscles: ["costas", "peito", "deltLateral", "deltAnterior", "deltPosterior", "trapezio", "biceps", "triceps"] },
  { title: "Pernas e core", muscles: ["quadriceps", "posterior", "gluteo", "panturrilha", "abdomen"] },
];

/** Volume fracionado da semana (seg–dom) que contém `today`, por músculo, contra o plano da semana do mesociclo. */
export function volumeSlots(sessions: Session[], today: string, week: number, adjust?: Record<string, number>): MuscleSlots[] {
  const start = mondayOf(today);
  const end = addDays(start, 7);
  const plan = plannedVolume(week, true, adjust);
  const inWeek = sessions.filter((s) => s.status === "done" && s.date >= start && s.date < end);

  const acc = new Map<MuscleId, { done: number; direct: number; sources: Map<string, SlotSource> }>();
  for (const m of MUSCLE_ORDER) acc.set(m, { done: 0, direct: 0, sources: new Map() });
  const add = (m: MuscleId, exId: string, sets: number, weight: 1 | 0.5) => {
    const a = acc.get(m)!;
    a.done += sets * weight;
    if (weight === 1) a.direct += sets;
    const cur = a.sources.get(exId);
    a.sources.set(exId, { exId, weight, sets: (cur?.sets ?? 0) + sets });
  };
  for (const s of inWeek) {
    for (const e of s.exercises) {
      const ex = exOf(e);
      const n = workSets(e).length;
      if (!ex || !n) continue;
      for (const m of ex.muscles) add(m, ex.id, n, 1);
      for (const m of synergistsOf(ex)) if (!ex.muscles.includes(m)) add(m, ex.id, n, SCIENCE.indirectSetWeight as 0.5);
    }
  }

  return MUSCLE_ORDER.map((m) => {
    const a = acc.get(m)!;
    const planned = plan[m];
    const done = a.done;
    let status: SlotStatus;
    if (!planned) status = "sem-plano";
    else if (done >= planned + 2) status = "acima";
    else if (done >= planned) status = "meta";
    else if (done < SCIENCE.volume.minEffective && planned >= SCIENCE.volume.minEffective) status = "abaixo-minimo";
    else status = "abaixo-meta";
    return {
      muscle: m,
      done,
      planned,
      direct: a.direct,
      missing: Math.max(0, Math.ceil(planned - done)),
      status,
      sources: [...a.sources.values()].sort((x, y) => y.weight - x.weight || y.sets - x.sets),
    };
  });
}

export type CellState = "full" | "half" | "empty" | "extra";

/** Casas de um músculo: uma por série fracionada, até o maior entre plano e feito. */
export function slotCells(m: Pick<MuscleSlots, "done" | "planned">): CellState[] {
  const n = Math.max(1, Math.ceil(Math.max(m.planned, m.done)));
  return Array.from({ length: n }, (_, i) => {
    if (m.done >= i + 1) return i + 1 > m.planned ? "extra" : "full";
    if (m.done > i) return "half";
    return "empty";
  });
}
