import type { BodyEntry, Session, Settings } from "../data/types";
import { addDays, daysBetween, mondayOf } from "./dates";
import { isLowDay, weekFor } from "./mesocycle";
import { strengthTrend } from "./engine";
import { plannedVolume, weeklyVolume } from "./sessions";
import { GOAL_LABEL, goalStatus, weightTrend } from "./visual";

// Atributos do operador (Fase 2 do design, estilo "árvore de atributos"): cinco números de 0 a 100, todos
// tirados dos registros. Nível = valor ÷ 5 (0–20). Sem dados suficientes, o atributo fica sem nível.

export type AttributeId = "forca" | "volume" | "consistencia" | "recuperacao" | "composicao";

export interface Attribute {
  id: AttributeId;
  name: string;
  /** 0–100, ou null sem dados. */
  value: number | null;
  /** 0–20, ou null sem dados. */
  level: number | null;
  /** Os números por trás do valor, numa linha. */
  summary: string;
  /** O que faz o atributo subir. */
  how: string;
  /** Princípio da base científica (src/data/science.ts). */
  why: string;
}

const lvl = (v: number | null) => (v == null ? null : Math.round(v / 5));
const clamp = (v: number) => Math.max(0, Math.min(100, Math.round(v)));

export function attributes(input: { sessions: Session[]; bodyLog: BodyEntry[]; settings: Settings; today: string }): {
  list: Attribute[];
  /** Média dos atributos com dados, em nível 0–20. */
  index: number | null;
} {
  const { sessions, bodyLog, settings, today } = input;
  const done = sessions.filter((s) => s.status === "done" && s.date <= today);
  const monday = mondayOf(today);

  // Força: exercícios com 1RM estimado subindo nas últimas 4 semanas (estável conta metade).
  const st = strengthTrend(sessions, today, 28);
  const stTotal = st.up + st.down + st.flat;
  const forca: Attribute = {
    id: "forca",
    name: "Força",
    value: stTotal ? clamp((100 * (st.up + 0.5 * st.flat)) / stTotal) : null,
    level: null,
    summary: stTotal
      ? `${st.up} subindo · ${st.flat} estáveis · ${st.down} caindo (1RM estimado, 4 semanas)`
      : "Precisa de 2 sessões do mesmo exercício nas últimas 4 semanas.",
    how: "Bater o teto da faixa em todas as séries e subir a carga: a dupla progressão faz o resto.",
    why: "progressao",
  };

  // Volume: semana passada (fechada), séries fracionadas feitas contra o plano de cada músculo.
  const lastWeek = addDays(monday, -7);
  const lwSessions = done.filter((s) => s.date >= lastWeek && s.date < monday);
  const lwWeek = lwSessions[0]?.week ?? weekFor(settings.mesoStart, lastWeek);
  const vol = weeklyVolume(lwSessions, lastWeek, true);
  const plan = plannedVolume(lwWeek, true, settings.setAdjust);
  const ms = (Object.keys(plan) as (keyof typeof plan)[]).filter((m) => plan[m] > 0);
  const ratio = ms.map((m) => Math.min(1, vol[m] / plan[m]));
  const atMeta = ms.filter((m) => vol[m] >= plan[m]).length;
  const volume: Attribute = {
    id: "volume",
    name: "Volume",
    value: done.length ? clamp((100 * ratio.reduce((a, b) => a + b, 0)) / Math.max(1, ms.length)) : null,
    level: null,
    summary: `${atMeta}/${ms.length} músculos na meta da semana passada (séries fracionadas)`,
    how: "Fazer todas as séries da ficha. Nenhum músculo abaixo de 4 séries fracionadas na semana.",
    why: "volume-dose",
  };

  // Consistência: treinos feitos nas 4 semanas fechadas anteriores contra os dias de treino.
  const from = addDays(monday, -28);
  const last4 = done.filter((s) => s.date >= from && s.date < monday).length;
  const planned4 = settings.trainingDays.length * 4;
  const consistencia: Attribute = {
    id: "consistencia",
    name: "Consistência",
    value: done.length ? clamp((100 * last4) / Math.max(1, planned4)) : null,
    level: null,
    summary: `${last4}/${planned4} treinos nas últimas 4 semanas`,
    how: "Cumprir os dias da agenda. Dia perdido não pula treino: empurra a sequência.",
    why: "frequencia",
  };

  // Recuperação: check-ins dos últimos 14 dias sem sono ruim/energia baixa/dor forte; queixa articular desconta.
  const recent = done.filter((s) => daysBetween(s.date, today) < 14);
  const checked = recent.filter((s) => s.checkin && !s.checkin.skipped);
  const good = checked.filter((s) => !isLowDay(s.checkin) && s.checkin!.pain !== "forte").length;
  const joints = recent.reduce((n, s) => n + s.exercises.filter((e) => e.feedback?.joint === "incomodou").length, 0);
  const recuperacao: Attribute = {
    id: "recuperacao",
    name: "Recuperação",
    value: checked.length ? clamp((100 * good) / checked.length - joints * 10) : null,
    level: null,
    summary: checked.length
      ? `${good}/${checked.length} check-ins bons · ${joints} ${joints === 1 ? "queixa articular" : "queixas articulares"} (14 dias)`
      : "Responda o check-in antes do treino para medir.",
    how: "Dormir 7–9 h, comer a proteína do plano e trocar o exercício que incomoda a articulação.",
    why: "sono",
  };

  // Composição: ritmo do peso contra a meta da fase; cintura caindo soma.
  const goal = settings.bodyGoal;
  const trend = weightTrend(bodyLog);
  const gs = goalStatus(trend, goal);
  const waist = bodyLog.filter((e) => e.waistCm && daysBetween(e.date, today) <= 28).sort((a, b) => a.date.localeCompare(b.date));
  const waistDown = waist.length >= 2 && waist[waist.length - 1].waistCm! <= waist[0].waistCm! - 1;
  const paceScore: Record<string, number> = { "no-ritmo": 90, devagar: 60, rapido: 50, contrario: 20 };
  const compValue = !gs || gs.pace === "sem-dados" ? null : gs.reached ? 100 : clamp(paceScore[gs.pace] + (waistDown ? 10 : 0));
  const composicao: Attribute = {
    id: "composicao",
    name: "Composição",
    value: compValue,
    level: null,
    summary:
      compValue == null
        ? goal
          ? "Pese 2× por semana para medir o ritmo."
          : "Defina a meta de peso em Biometria."
        : `${trend!.kgPerWeek >= 0 ? "+" : ""}${trend!.kgPerWeek.toFixed(2).replace(".", ",")} kg/sem · meta: ${GOAL_LABEL[goal!.mode].toLowerCase()}${waistDown ? " · cintura caindo" : ""}`,
    how: "Ficar na faixa de ritmo da fase (0,4–0,6 kg por semana na recomposição) com proteína alta.",
    why: "ritmo-perda",
  };

  const list = [forca, volume, consistencia, recuperacao, composicao].map((a) => ({ ...a, level: lvl(a.value) }));
  const vals = list.map((a) => a.value).filter((v): v is number => v != null);
  return { list, index: vals.length ? Math.round(vals.reduce((a, b) => a + b, 0) / vals.length / 5) : null };
}
