import { LIB_BY_ID } from "../../data/library";
import { dayById, MUSCLE_LABEL, shortName } from "../../data/program";
import type { MuscleId, ProgramExercise, Session, Settings, StopKind } from "../../data/types";
import { shortDate } from "../dates";
import { defaultRest, setsFor } from "../mesocycle";
import { formatWeight, type historyOf, suggestNext, workSets, type Suggestion } from "../progression";
import type { EquipmentKind, OperatorState } from "./operator";

export type HistoryItem = ReturnType<typeof historyOf>[number];

// AUG.CORE — Camada 3: Planejador Determinístico e Explicabilidade ("Por que 42,5 kg?").
// Gera adaptações efêmeras para a sessão de hoje (`SessionAdaptation`) sem jamais alterar o programa salvo (`ppl-v2`).

export interface DecisionFactor {
  tag: "historico" | "dupla-progressao" | "salto-grande" | "deload" | "fadiga-muscular" | "articular" | "descanso" | "corpo";
  label: string;
  detail: string;
}

export interface DecisionTrace {
  exId: string;
  libId: string;
  suggestion: Suggestion;
  /** Resumo de 1 linha para leitura rápida no HUD do treino. */
  summary: string;
  factors: DecisionFactor[];
  recommendedAlt?: string;
  confidence: number;
}

export interface ExerciseAdaptation {
  exId: string;
  libId: string;
  originalSets: number;
  adaptedSets: number;
  adaptedAlt?: string;
  adaptedStop?: StopKind;
  reasons: string[];
}

export interface SessionAdaptation {
  dayId: string;
  week: number;
  adapted: boolean;
  originalMinutes: number;
  estimatedMinutes: number;
  reasons: string[];
  exercises: Record<string, ExerciseAdaptation>;
}

/** Infere o tipo de equipamento principal a partir da biblioteca (`LIB_BY_ID[libId]?.equipment`) ou do nome do exercício/alternativa. */
export function inferEquipment(nameOrId: string, libId?: string): EquipmentKind {
  const libEquip = libId ? LIB_BY_ID[libId]?.equipment : undefined;
  const s = `${libEquip ?? ""} ${nameOrId}`
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
  if (s.includes("halter") || s.includes("kroc") || s.includes("kettlebell")) return "halteres";
  if (s.includes("cabo") || s.includes("polia") || s.includes("corda") || s.includes("cross")) return "cabo";
  if (
    s.includes("maquina") ||
    s.includes("hammer") ||
    s.includes("smith") ||
    s.includes("leg press") ||
    s.includes("hack") ||
    s.includes("cadeira") ||
    s.includes("mesa") ||
    s.includes("puxador") ||
    s.includes("voador") ||
    s.includes("peck") ||
    s.includes("graviton") ||
    s.includes("aparelho") ||
    s.includes("pendulo") ||
    s.includes("belt squat")
  ) {
    return "maquina";
  }
  if (
    s.includes("barra fixa") ||
    s.includes("paralela") ||
    s.includes("flexao") ||
    s.includes("peso do corpo") ||
    s.includes("prancha") ||
    s.includes("abdominal") ||
    s.includes("nordica")
  ) {
    return "peso-corporal";
  }
  return "barra";
}

/**
 * Explica de onde saiu a sugestão de carga e repetições de um exercício ("Por que 42,5 kg?"),
 * cruzando a regra de dupla progressão com o que o gêmeo digital aprendeu sobre a pessoa.
 */
export function explainLoad(
  ex: ProgramExercise,
  hist: HistoryItem[],
  plannedSets: number,
  week: number,
  step: number,
  availableWeights?: number[],
  operator?: OperatorState,
): DecisionTrace {
  const suggestion = suggestNext(ex, hist, plannedSets, week, step, availableWeights);
  const libId = ex.lib || ex.id;
  const factors: DecisionFactor[] = [];
  const lastItem = hist[hist.length - 1];
  const lastEntry = lastItem?.entry;
  const lastWork = workSets(lastEntry, false);
  const unit = lastEntry?.unit === "lb" ? "lb" : "kg";

  if (lastItem && lastWork.length > 0) {
    const setsText = lastWork.map((s) => `${formatWeight(s.weight)}×${s.reps}`).join(", ");
    factors.push({
      tag: "historico",
      label: `Último treino (${shortDate(lastItem.session.date)})`,
      detail: `Séries feitas: ${setsText} ${unit}.`,
    });
  } else {
    factors.push({
      tag: "historico",
      label: "Sem histórico neste movimento",
      detail: `Escolha uma carga inicial para ficar entre ${ex.reps[0]} e ${ex.reps[1]} repetições na 1ª série.`,
    });
  }

  if (suggestion.kind === "deload") {
    factors.push({
      tag: "deload",
      label: "Semana de Deload",
      detail: "Mantém a carga de trabalho na barra, corta as séries pela metade e para ~4 repetições antes da falha.",
    });
  } else if (suggestion.kind === "up") {
    factors.push({
      tag: "dupla-progressao",
      label: `Subida de +${formatWeight(step)} ${unit}`,
      detail: suggestion.detail,
    });
  } else if (suggestion.kind === "down") {
    factors.push({
      tag: "dupla-progressao",
      label: "Redução de carga (~10%)",
      detail: suggestion.detail,
    });
  } else if (suggestion.kind === "same") {
    const isBigJump = suggestion.title.includes("salto grande");
    factors.push({
      tag: isBigJump ? "salto-grande" : "dupla-progressao",
      label: isBigJump ? "Proteção contra salto brusco de carga" : "Progressão de repetições na mesma carga",
      detail: suggestion.detail,
    });
  }

  // Fatores vindos do Gêmeo Digital (OperatorState)
  let recommendedAlt: string | undefined;
  const exTwin = operator?.exercises[libId];
  if (exTwin && exTwin.confidence >= 0.33 && exTwin.jointRisk >= 0.5) {
    const alts = LIB_BY_ID[libId]?.alternatives ?? [];
    recommendedAlt = alts[0];
    factors.push({
      tag: "articular",
      label: `Incomodou ${exTwin.jointComplaints} vezes nos últimos treinos`,
      detail: recommendedAlt
        ? `Se incomodar de novo, troque hoje por ${recommendedAlt}.`
        : "Se incomodar de novo, encurte o movimento e pare 2 repetições antes da falha.",
    });
  }

  if (operator && operator.behavior.restConfidence >= 0.5 && operator.behavior.restRatio < 0.65 && ex.rest[0] >= 90) {
    factors.push({
      tag: "descanso",
      label: "Você tem descansado pouco",
      detail: `Seus intervalos ficam em ${Math.round(operator.behavior.restRatio * 100)}% dos ${ex.restLabel} da ficha. Descansar o tempo cheio costuma render 1 ou 2 repetições a mais.`,
    });
  }

  const slowMuscle = ex.muscles.find(
    (m) => operator?.muscles[m] && operator.muscles[m].confidence >= 0.5 && operator.muscles[m].recoveryMultiplier >= 1.15,
  );
  if (slowMuscle && operator) {
    factors.push({
      tag: "fadiga-muscular",
      label: `${MUSCLE_LABEL[slowMuscle]} demora mais para se recuperar`,
      detail: `No seu histórico, ${MUSCLE_LABEL[slowMuscle].toLowerCase()} pede cerca de ${Math.round((operator.muscles[slowMuscle].recoveryMultiplier - 1) * 100)}% mais tempo que a média. Se a primeira série vier pesada, mantenha a carga em vez de subir.`,
    });
  }

  if (operator?.body.rapidLoss && ex.compound && suggestion.kind === "up") {
    factors.push({
      tag: "corpo",
      label: "Peso corporal caindo rápido",
      detail:
        "Com menos energia, a carga pode não subir como antes. Se a primeira série vier difícil, fique no peso atual: não é falta de progresso.",
    });
  }

  const summary = suggestion.weight != null ? `${suggestion.title}: ${suggestion.detail}` : `${suggestion.title}. ${suggestion.detail}`;

  const confidence = exTwin ? Math.max(0.4, exTwin.confidence) : hist.length > 0 ? 0.6 : 0.25;

  return {
    exId: ex.id,
    libId,
    suggestion,
    summary,
    factors,
    recommendedAlt,
    confidence,
  };
}

function estimateDurationMinutes(exercises: ProgramExercise[], setsMap: Record<string, number>, restMultiplier = 1): number {
  let sec = 0;
  for (const ex of exercises) {
    const n = setsMap[ex.id] ?? ex.sets;
    if (n <= 0) continue;
    const effRest = defaultRest(ex.rest) * Math.max(0.7, Math.min(1.25, restMultiplier));
    sec += n * (effRest + 40) + 85;
  }
  return Math.max(10, Math.round(sec / 60 / 5) * 5);
}

/**
 * Replaneja de forma efêmera o treino `dayId` para hoje considerando as restrições ativas (`OperatorMemory`)
 * e o perfil biomecânico (`OperatorState`), sem alterar o programa salvo no banco.
 */
export function planDay(
  dayId: string,
  week: number,
  settings: Settings,
  _sessions: Session[],
  operator?: OperatorState,
): SessionAdaptation {
  const day = dayById(dayId);
  const exercises: Record<string, ExerciseAdaptation> = {};
  const setsMap: Record<string, number> = {};
  const origSetsMap: Record<string, number> = {};
  const reasons: string[] = [];

  for (const ex of day.exercises) {
    const baseSets = setsFor(ex, week, settings.setAdjust?.[ex.id]);
    origSetsMap[ex.id] = baseSets;
    setsMap[ex.id] = baseSets;
    exercises[ex.id] = {
      exId: ex.id,
      libId: ex.lib,
      originalSets: baseSets,
      adaptedSets: baseSets,
      reasons: [],
    };
  }

  const restMult = operator && operator.behavior.restConfidence >= 0.5 ? operator.behavior.restRatio : 1;
  const originalMinutes = estimateDurationMinutes(day.exercises, origSetsMap, restMult);

  const constraints = operator?.activeConstraints ?? [];
  const equipConstraint = constraints.find((c) => c.kind === "equipment");
  const painConstraints = constraints.filter((c) => c.kind === "pain");
  const scheduleConstraint = constraints.find((c) => c.kind === "schedule" && c.reduceVolume);
  const timeConstraint = constraints.find((c) => c.kind === "time-cap");

  // 1. Adaptação por equipamento disponível
  if (equipConstraint && equipConstraint.kind === "equipment") {
    const allowed = new Set<EquipmentKind>(equipConstraint.allowed);
    let swappedCount = 0;
    for (const ex of day.exercises) {
      const currentName = settings.swaps?.[ex.id] ?? ex.name;
      const needed = inferEquipment(currentName, settings.swaps?.[ex.id] ? undefined : ex.lib);
      if (allowed.has(needed)) continue;
      const alts = LIB_BY_ID[ex.lib]?.alternatives ?? [];
      const match = alts.find((alt) => allowed.has(inferEquipment(alt)));
      if (match) {
        exercises[ex.id].adaptedAlt = match;
        exercises[ex.id].reasons.push(`Equipamento (${equipConstraint.allowed.join("/")}): trocado hoje por ${match}.`);
        swappedCount += 1;
      }
    }
    if (swappedCount > 0) {
      reasons.push(
        `${swappedCount} ${swappedCount === 1 ? "exercício adaptado" : "exercícios adaptados"} para ${equipConstraint.allowed.join(", ")}.`,
      );
    }
  }

  // 2. Proteção articular (restrição ativa de dor ou jointRisk alto no gêmeo)
  for (const ex of day.exercises) {
    const adapt = exercises[ex.id];
    const painMatch = painConstraints.find(
      (c) => c.kind === "pain" && ((c.libId && c.libId === ex.lib) || (c.muscle && ex.muscles.includes(c.muscle))),
    );
    const twinRisk = operator?.exercises[ex.lib];
    const hasHighTwinRisk = twinRisk && twinRisk.confidence >= 0.5 && twinRisk.jointRisk >= 0.5;

    if (painMatch && painMatch.kind === "pain") {
      const alts = LIB_BY_ID[ex.lib]?.alternatives ?? [];
      if (!adapt.adaptedAlt && !settings.swaps?.[ex.id] && alts.length > 0) {
        adapt.adaptedAlt = alts[0];
      }
      if (ex.stop === "F") adapt.adaptedStop = "T";
      // Piso: 2 séries nos compostos, 1 nos isolados (mesmo com dor forte, o estímulo mínimo fica).
      if (painMatch.severity === "forte" && adapt.adaptedSets > (ex.compound ? 2 : 1)) {
        adapt.adaptedSets -= 1;
        setsMap[ex.id] = adapt.adaptedSets;
      }
      const msg = `Proteção articular (${painMatch.severity}): ${adapt.adaptedAlt ? `variante ${adapt.adaptedAlt}` : "amplitude controlada"} e parada antes da falha.`;
      adapt.reasons.push(msg);
      if (!reasons.includes(msg)) reasons.push(msg);
    } else if (hasHighTwinRisk) {
      const alts = LIB_BY_ID[ex.lib]?.alternatives ?? [];
      if (!adapt.adaptedAlt && !settings.swaps?.[ex.id] && alts.length > 0) {
        adapt.adaptedAlt = alts[0];
        if (ex.stop === "F") adapt.adaptedStop = "T";
        const msg = `${shortName(ex)}: desconforto recorrente (${twinRisk.jointComplaints}×); sugerida variante ${alts[0]}.`;
        adapt.reasons.push(msg);
        if (!reasons.includes(msg)) reasons.push(msg);
      }
    }
  }

  // 3. Redução de volume por rotina pesada ("semana de prova" / estresse)
  if (scheduleConstraint && scheduleConstraint.kind === "schedule") {
    let cutSets = 0;
    for (const ex of day.exercises) {
      const floor = ex.compound ? 2 : 1;
      const adapt = exercises[ex.id];
      if (adapt.adaptedSets > floor) {
        adapt.adaptedSets -= 1;
        setsMap[ex.id] = adapt.adaptedSets;
        adapt.reasons.push(`−1 série (${scheduleConstraint.note}): preserva carga na barra com menor fadiga.`);
        cutSets += 1;
      }
    }
    if (cutSets > 0) {
      reasons.push(`${scheduleConstraint.note}: −${cutSets} ${cutSets === 1 ? "série" : "séries"} mantendo as cargas de trabalho.`);
    }
  }

  // 4. Teto de tempo ("só tenho 40 min hoje"): enxuga primeiro os isolados do fim para o começo, depois compostos secundários
  if (timeConstraint && timeConstraint.kind === "time-cap") {
    const cap = timeConstraint.minutes;
    let currentEst = estimateDurationMinutes(day.exercises, setsMap, restMult);
    let trimmed = 0;

    // Passo A: corta séries de isolados de trás para frente até o mínimo de 1 série
    const revIsolations = [...day.exercises].reverse().filter((e) => !e.compound);
    let changed = true;
    while (currentEst > cap && changed) {
      changed = false;
      for (const ex of revIsolations) {
        if (currentEst <= cap) break;
        const adapt = exercises[ex.id];
        if (adapt.adaptedSets > 1) {
          adapt.adaptedSets -= 1;
          setsMap[ex.id] = adapt.adaptedSets;
          trimmed += 1;
          changed = true;
          currentEst = estimateDurationMinutes(day.exercises, setsMap, restMult);
        }
      }
    }

    // Passo B: se ainda passar do teto, corta 1 série dos compostos (piso de 2 séries)
    if (currentEst > cap) {
      const revCompounds = [...day.exercises].reverse().filter((e) => e.compound);
      for (const ex of revCompounds) {
        if (currentEst <= cap) break;
        const adapt = exercises[ex.id];
        if (adapt.adaptedSets > 2) {
          adapt.adaptedSets -= 1;
          setsMap[ex.id] = adapt.adaptedSets;
          trimmed += 1;
          currentEst = estimateDurationMinutes(day.exercises, setsMap, restMult);
        }
      }
    }

    if (trimmed > 0) {
      for (const ex of day.exercises) {
        const adapt = exercises[ex.id];
        if (adapt.adaptedSets < adapt.originalSets && !adapt.reasons.some((r) => r.includes("teto de tempo"))) {
          adapt.reasons.push(`Ajustado para ${adapt.adaptedSets} série(s) (teto de tempo de ${cap} min).`);
        }
      }
      reasons.push(`Modo ${cap} min: −${trimmed} ${trimmed === 1 ? "série" : "séries"} nos exercícios finais para caber no horário.`);
    }
  }

  const estimatedMinutes = estimateDurationMinutes(day.exercises, setsMap, restMult);
  const adapted = Object.values(exercises).some((e) => e.adaptedSets !== e.originalSets || e.adaptedAlt != null || e.adaptedStop != null);

  return {
    dayId,
    week,
    adapted,
    originalMinutes,
    estimatedMinutes,
    reasons,
    exercises,
  };
}

/** Verifica se uma entrada da sessão pertence a um músculo específico. */
export function touchesMuscle(ex: ProgramExercise | undefined, muscle: MuscleId): boolean {
  return !!ex && ex.muscles.includes(muscle);
}

/** Resolve o exercício para explicação pelo id do programa ou trecho do nome. */
export function findExerciseInDay(dayId: string, query?: string): ProgramExercise {
  const day = dayById(dayId);
  if (!query || !query.trim()) return day.exercises[0];
  const q = query
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
  return (
    day.exercises.find((e) => {
      const name = e.name
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "");
      return e.id.toLowerCase().includes(q) || e.lib.toLowerCase().includes(q) || name.includes(q);
    }) ?? day.exercises[0]
  );
}
