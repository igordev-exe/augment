import { LIB_BY_ID } from "../../data/library";
import { dayById, MUSCLE_LABEL, programDays, shortName } from "../../data/program";
import type { MuscleId, ProgramExercise, Session, Settings } from "../../data/types";
import { addDays, weekdayName } from "../dates";
import { reentryFor, setsFor, weekFor } from "../mesocycle";
import { historyOf, increaseStep } from "../progression";
import { planAhead } from "../schedule";
import {
  EMPTY_OPERATOR_MEMORY,
  operatorState,
  type Constraint,
  type EquipmentKind,
  type OperatorMemory,
  type OperatorState,
} from "./operator";
import { explainLoad, findExerciseInDay, planDay } from "./planner";

// AUG.CORE — Camada 5: Intenções Guiadas do Chat (Tratadores 100% Determinísticos e Offline).
// Antes de chamar qualquer modelo na nuvem, interpreta os pedidos operacionais mais comuns em 0 ms.

export type IntentKind = "explicar_carga" | "tempo_curto" | "equipamento_restrito" | "dor_articular" | "faltei_treino" | "travou_exercicio";

export interface IntentMatch {
  kind: IntentKind;
  minutes?: number;
  equipment?: EquipmentKind[];
  muscle?: MuscleId;
  severity?: "leve" | "forte";
  exerciseQuery?: string;
}

export interface IntentProposal {
  /** Restrição temporária que só vai para o `OperatorMemory` se a pessoa confirmar no cartão. */
  constraint: Constraint;
  /** Texto do botão de confirmar. */
  confirmLabel: string;
}

export interface IntentResult {
  matched: boolean;
  intent?: IntentMatch;
  reply: string;
  /** Mudança proposta pela intenção. Nada é gravado sem confirmação (mesma regra das propostas do treinador). */
  proposal?: IntentProposal;
}

function norm(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();
}

const MUSCLE_KEYWORDS: { muscle: MuscleId; words: string[] }[] = [
  { muscle: "peito", words: ["peito", "peitoral"] },
  { muscle: "costas", words: ["costas", "dorsal", "lombar"] },
  { muscle: "deltAnterior", words: ["ombro", "deltoide", "ombro anterior", "deltoide anterior"] },
  { muscle: "deltLateral", words: ["ombro lateral", "deltoide lateral"] },
  { muscle: "deltPosterior", words: ["ombro posterior", "deltoide posterior"] },
  { muscle: "biceps", words: ["biceps", "cotovelo", "antebraco", "punho"] },
  { muscle: "triceps", words: ["triceps"] },
  { muscle: "quadriceps", words: ["joelho", "quadriceps", "coxa"] },
  { muscle: "posterior", words: ["posterior", "posterior de coxa", "isquiotibiais"] },
  { muscle: "gluteo", words: ["gluteo", "quadril"] },
  { muscle: "panturrilha", words: ["panturrilha", "tornozelo", "aquiles"] },
];

/** Palavras-chave da mais longa para a mais curta: "ombro lateral" tem que ganhar de "ombro". */
const MUSCLE_KEYWORDS_BY_LENGTH = MUSCLE_KEYWORDS.flatMap(({ muscle, words }) => words.map((word) => ({ word, muscle }))).sort(
  (a, b) => b.word.length - a.word.length,
);

/** Palavra ou expressão inteira no texto já normalizado (sem pegar "casa" dentro de "casaco"). */
function hasWord(t: string, phrase: string): boolean {
  const escaped = phrase.replace(/[.*+?^${}()|[\]\\]/g, "\\$&").replace(/\s+/g, "\\s+");
  return new RegExp(`(?:^|[^a-z0-9])${escaped}(?:$|[^a-z0-9])`).test(t);
}

function hasAny(t: string, phrases: string[]): boolean {
  return phrases.some((p) => hasWord(t, p));
}

export function detectMuscle(text: string): MuscleId | undefined {
  const t = norm(text);
  return MUSCLE_KEYWORDS_BY_LENGTH.find(({ word }) => hasWord(t, word))?.muscle;
}

function detectExerciseQuery(text: string): string | undefined {
  const t = norm(text);
  for (const d of programDays()) {
    for (const ex of d.exercises) {
      const cleanName = norm(shortName(ex));
      if (cleanName.length >= 4 && t.includes(cleanName)) return ex.id;
      const firstWord = cleanName.split(/\s+/)[0];
      if (firstWord && firstWord.length >= 5 && t.includes(firstWord)) return firstWord;
    }
  }
  return undefined;
}

/** Identifica se o texto da pessoa corresponde a uma das 6 intenções operacionais determinísticas. */
export function matchIntent(rawText: string): IntentMatch | null {
  const t = norm(rawText);
  if (!t) return null;

  // 1. Dor articular / incômodo vem primeiro: segurança ganha de qualquer outra intenção na mesma frase.
  // "dor no ombro", "cotovelo incomodando", "joelho doendo", "estou com dor"
  // "sem dor", "nenhuma dor", "não doeu": é o contrário de queixa.
  const painDenied = hasAny(t, ["sem dor", "sem dores", "nenhuma dor", "nao doeu", "nao doi", "nao incomodou", "sem incomodo", "zero dor"]);
  if (
    !painDenied &&
    (/(?:^|[^a-z])dor(?:es)?(?:$|[^a-z])/.test(t) ||
      hasAny(t, ["doendo", "doi", "doeu", "incomodando", "incomodou", "incomodo", "machuquei", "lesionei"]))
  ) {
    const muscle = detectMuscle(t);
    const exerciseQuery = detectExerciseQuery(t);
    const severity: "leve" | "forte" = hasAny(t, ["forte", "muito", "aguda", "fina", "pontada"]) ? "forte" : "leve";
    if (muscle || exerciseQuery) {
      return { kind: "dor_articular", muscle, severity, exerciseQuery };
    }
  }

  // 2. Tempo curto: "só tenho 40 min", "treino rápido de 35 minutos". Precisa de um sinal de limite, não só de um número
  // ("descansei 90 min hoje" não é pedido de treino curto).
  const timeMatch = t.match(/\b(\d{2,3})\s*(?:min|mins|minutos)\b/);
  if (timeMatch && hasAny(t, ["tenho", "so tenho", "apenas", "rapido", "corrido", "corrida", "no maximo", "ate"])) {
    const minutes = Math.max(20, Math.min(90, Number(timeMatch[1])));
    return { kind: "tempo_curto", minutes };
  }

  // 3. Equipamento restrito: "só tenho halteres", "academia de hotel", "sem polia"
  const equipWords = ["halter", "halteres", "barra", "maquina", "maquinas", "polia", "cabo", "peso do corpo", "peso corporal"];
  if (hasAny(t, ["so tenho", "apenas", "somente", "hotel", "em casa", "sem"]) && hasAny(t, equipWords)) {
    const allowed: EquipmentKind[] = [];
    if (hasAny(t, ["halter", "halteres"])) allowed.push("halteres", "peso-corporal");
    if (hasWord(t, "barra") && !hasWord(t, "sem barra")) allowed.push("barra");
    if (hasAny(t, ["maquina", "maquinas"]) && !hasAny(t, ["sem maquina", "sem maquinas"])) allowed.push("maquina");
    if (hasAny(t, ["cabo", "polia"]) && !hasAny(t, ["sem polia", "sem cabo"])) allowed.push("cabo");
    if (hasAny(t, ["peso do corpo", "peso corporal"])) allowed.push("peso-corporal");
    if (allowed.length === 0) allowed.push("halteres", "peso-corporal");
    return { kind: "equipamento_restrito", equipment: Array.from(new Set(allowed)) };
  }

  // 4. Faltei / perdi treino
  if (hasAny(t, ["faltei", "perdi o treino", "perdi treino", "perdi dois treinos", "nao consegui treinar", "nao treinei"])) {
    return { kind: "faltei_treino" };
  }

  // 5. Travou / estagnou em um exercício
  if (hasAny(t, ["travei", "travou", "travado", "estagnou", "estagnado", "estaguei", "nao sobe"])) {
    return { kind: "travou_exercicio", exerciseQuery: detectExerciseQuery(t) };
  }

  // 6. Explicar carga ("por que 42,5 kg?", "explica a carga", "por que baixou o peso"). Um número solto não basta:
  // "por que treinar 5 dias?" é pergunta aberta e vai para o modelo.
  const asksWhy = hasAny(t, ["por que", "porque", "pq", "explica", "explique"]);
  const aboutLoad =
    hasAny(t, ["carga", "peso", "subiu", "baixou", "reduziu", "aumentou"]) || /\b\d+(?:[.,]\d+)?\s*(?:kg|lb|kilos?|quilos?)\b/.test(t);
  if (asksWhy && aboutLoad) {
    return { kind: "explicar_carga", exerciseQuery: detectExerciseQuery(t) };
  }

  return null;
}

function findTargetExercise(nextDayId: string, query?: string): ProgramExercise {
  if (query) {
    for (const d of programDays()) {
      const hit = d.exercises.find((e) => e.id === query || norm(shortName(e)).includes(norm(query)));
      if (hit) return hit;
    }
  }
  return findExerciseInDay(nextDayId, query);
}

/**
 * Executa o tratador determinístico para a intenção identificada, devolvendo a resposta imediata
 * e, quando aplicável, uma proposta de restrição que só é gravada se a pessoa confirmar.
 */
export function handleIntent(
  rawText: string,
  input: {
    sessions: Session[];
    settings: Settings;
    today: string;
    memory?: OperatorMemory;
    operator?: OperatorState;
  },
): IntentResult {
  const intent = matchIntent(rawText);
  if (!intent) return { matched: false, reply: "" };

  const { sessions, settings, today } = input;
  const memory = input.memory ?? EMPTY_OPERATOR_MEMORY;
  const done = sessions.filter((s) => s.status === "done");
  const week = weekFor(settings.mesoStart, today);
  const ahead = planAhead(sessions, today, 7, settings.trainingDays);
  const nextDayId = ahead[0]?.dayId ?? programDays()[0].id;
  const nextDay = dayById(nextDayId);
  const op = input.operator ?? operatorState(sessions, [], settings, memory, today);

  if (intent.kind === "explicar_carga") {
    const ex = findTargetExercise(nextDayId, intent.exerciseQuery);
    const activeAlt = settings.swaps?.[ex.id] || undefined;
    const hist = historyOf(done, ex.id, activeAlt);
    const lastEntry = hist[hist.length - 1]?.entry;
    const unit = settings.units[ex.id] ?? lastEntry?.unit ?? ex.defaultUnit ?? "kg";
    const step = increaseStep(ex, unit, settings.increments[ex.id]);
    const plannedSets = setsFor(ex, week, settings.setAdjust?.[ex.id]);
    const trace = explainLoad(ex, hist, plannedSets, week, step, settings.machineWeights?.[ex.id], op);
    const lines = [`**${shortName(ex)}** — ${trace.summary}`, ...trace.factors.map((f) => `- **${f.label}:** ${f.detail}`)];
    return { matched: true, intent, reply: lines.join("\n") };
  }

  if (intent.kind === "tempo_curto") {
    const minutes = intent.minutes ?? 40;
    const constraint: Constraint = {
      id: `time-cap-${today}`,
      kind: "time-cap",
      minutes,
      createdAt: today,
      expiresAt: today,
    };
    const nextMem: OperatorMemory = {
      ...memory,
      constraints: [...memory.constraints.filter((c) => c.kind !== "time-cap"), constraint],
    };
    const nextOp = operatorState(sessions, [], settings, nextMem, today);
    const adapted = planDay(nextDayId, week, settings, sessions, nextOp);
    const changed = nextDay.exercises
      .filter((e) => adapted.exercises[e.id].adaptedSets !== adapted.exercises[e.id].originalSets)
      .map((e) => `- **${shortName(e)}:** ${adapted.exercises[e.id].originalSets} → ${adapted.exercises[e.id].adaptedSets} séries`);
    if (!changed.length) {
      return {
        matched: true,
        intent,
        reply: `**${nextDay.name}** já cabe em ${minutes} min (~${adapted.originalMinutes} min estimados). Não precisa cortar nada.`,
      };
    }
    const lines = [
      `**Proposta: modo ${minutes} min para hoje (${nextDay.name}).** A duração estimada cai de ~${adapted.originalMinutes} min para **~${adapted.estimatedMinutes} min**.`,
      `Os compostos ficam como estão; saem séries do fim do treino:\n${changed.join("\n")}`,
      "Confirme abaixo para valer no treino de hoje. O programa salvo não muda.",
    ];
    return { matched: true, intent, reply: lines.join("\n\n"), proposal: { constraint, confirmLabel: `Usar modo ${minutes} min hoje` } };
  }

  if (intent.kind === "equipamento_restrito") {
    const allowed = intent.equipment ?? ["halteres", "peso-corporal"];
    const constraint: Constraint = {
      id: `equip-${today}`,
      kind: "equipment",
      allowed,
      createdAt: today,
      expiresAt: addDays(today, 2),
    };
    const nextMem: OperatorMemory = {
      ...memory,
      constraints: [...memory.constraints.filter((c) => c.kind !== "equipment"), constraint],
    };
    const nextOp = operatorState(sessions, [], settings, nextMem, today);
    const adapted = planDay(nextDayId, week, settings, sessions, nextOp);
    const swaps = nextDay.exercises
      .filter((e) => adapted.exercises[e.id].adaptedAlt)
      .map((e) => `- **${shortName(e)}** → ${adapted.exercises[e.id].adaptedAlt}`);
    if (!swaps.length) {
      return {
        matched: true,
        intent,
        reply: `Todos os exercícios de **${nextDay.name}** já funcionam com ${allowed.join(", ")}. Não precisa trocar nada.`,
      };
    }
    const lines = [
      `**Proposta: treinar só com ${allowed.join(", ")} até ${addDays(today, 2)} (${nextDay.name}).**`,
      `Trocas da biblioteca, só nesses dias:\n${swaps.join("\n")}`,
      "Confirme abaixo para valer. O programa salvo não muda.",
    ];
    return { matched: true, intent, reply: lines.join("\n\n"), proposal: { constraint, confirmLabel: "Usar essas trocas" } };
  }

  if (intent.kind === "dor_articular") {
    const ex = intent.exerciseQuery ? findTargetExercise(nextDayId, intent.exerciseQuery) : undefined;
    const muscle: MuscleId = intent.muscle ?? ex?.muscles[0] ?? "deltAnterior";
    const severity = intent.severity ?? "leve";
    const constraint: Constraint = {
      id: `pain-${muscle}-${today}`,
      kind: "pain",
      muscle,
      libId: ex?.lib,
      severity,
      createdAt: today,
      expiresAt: addDays(today, 5),
    };
    const candidates = nextDay.exercises.filter((e) => e.muscles.includes(muscle) || (ex && e.lib === ex.lib));
    const altLines = candidates.map((e) => {
      const alts = LIB_BY_ID[e.lib]?.alternatives ?? [];
      return `- **${shortName(e)}:** ${alts.length ? `trocar por **${alts[0]}** e parar 2 reps antes da falha` : "reduzir a amplitude e parar 2 reps antes da falha"}.`;
    });
    const lines = [
      `**Proposta: proteger ${MUSCLE_LABEL[muscle].toLowerCase()} (${severity}) pelos próximos 5 dias.**`,
      ...(altLines.length > 0
        ? altLines
        : [`- Não levar exercícios de **${MUSCLE_LABEL[muscle].toLowerCase()}** até a falha nos próximos 5 dias.`]),
      severity === "forte"
        ? "Se doer mesmo no aquecimento leve, pule o movimento hoje e procure avaliação profissional."
        : "Aqueça com 2 séries leves antes da carga de trabalho.",
      "Confirme abaixo para o app aplicar isso nos próximos treinos.",
    ];
    return { matched: true, intent, reply: lines.join("\n"), proposal: { constraint, confirmLabel: "Proteger nos próximos treinos" } };
  }

  if (intent.kind === "faltei_treino") {
    const reentry = reentryFor(
      done.map((s) => s.date),
      settings.mesoStart,
      today,
      settings.trainingDays,
    );
    const nextThree = ahead
      .slice(0, 3)
      .map((p) => `- **${weekdayName(p.date)} (${p.date}):** ${dayById(p.dayId).name}`)
      .join("\n");
    const lines = [
      `**A sequência nunca pula treino:** o treino que faltou não some, ele passa a ser o próximo da fila (**${nextDay.name}**).`,
      reentry
        ? reentry.kind === "restart"
          ? `Como passaram ${reentry.gapDays} dias sem registro, recomendo **recomeçar na Semana 1** pelo cartão na tela Hoje para readaptar tendões e evitar dor tardia forte.`
          : `Como a semana passada teve ${reentry.done}/${reentry.planned} treinos, vale **repetir a Semana ${reentry.week - 1}** antes de subir a intensidade.`
        : "Siga a fila normalmente nos seus próximos dias planejados:",
      nextThree,
    ];
    return { matched: true, intent, reply: lines.join("\n\n") };
  }

  // travou_exercicio
  const ex = findTargetExercise(nextDayId, intent.exerciseQuery);
  const twin = op.exercises[ex.lib];
  const alts = LIB_BY_ID[ex.lib]?.alternatives ?? [];
  const reasons: string[] = [];
  if (op.behavior.restConfidence >= 0.5 && op.behavior.restRatio < 0.65 && ex.rest[0] >= 90) {
    reasons.push(
      `- **Descanso curto:** você tem descansado cerca de ${Math.round(op.behavior.restRatio * 100)}% do que a ficha pede (${ex.restLabel}). Descansar o tempo cheio costuma render 1 ou 2 repetições a mais na hora.`,
    );
  }
  if (twin && twin.jointComplaints > 0) {
    reasons.push(
      `- **Incomodou ${twin.jointComplaints} vezes:** com desconforto, o corpo segura a força.${alts[0] ? ` Vale trocar por **${alts[0]}** neste ciclo.` : ""}`,
    );
  }
  reasons.push(
    `- **O que o app faz:** depois de 3 treinos sem a força subir, ele baixa a carga uns 10% para você voltar a ganhar repetições. Outra saída é trocar por **${alts[0] ?? "um exercício parecido"}** no fim da semana de descanso.`,
  );
  return {
    matched: true,
    intent,
    reply: [`**${shortName(ex)} travou. O que pode estar pesando:**`, ...reasons].join("\n"),
  };
}
