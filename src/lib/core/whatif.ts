import { MUSCLE_LABEL, MUSCLE_ORDER, programDays } from "../../data/program";
import { PRINCIPLES, SCIENCE } from "../../data/science";
import type { Settings } from "../../data/types";
import { addDays, daysBetween, longDate, shortDate } from "../dates";
import { weekFor } from "../mesocycle";
import { recommendTemplate } from "../onboarding";
import { entryE1rm, formatWeight, workSets } from "../progression";
import { planAhead } from "../schedule";
import { plannedVolume } from "../sessions";
import { weightTrend } from "../visual";
import { cardOf, detectExercise, historyFor, type AnswerData, type ExerciseRef } from "./data-answers";
import { norm } from "./intents";
import { personalEpley, predictFromPrevious } from "./live";
import { readNumber } from "./readers";
import type { ReasonCtx, ReasonReply } from "./why";
import type { CoreProposal } from "./undo";

// AUG.CORE — bloco C do chat potente: "e se". Simulação pura: não grava e não toca em `db.programs`. Quando a conta
// leva a uma mudança (dias de treino), ela sai como proposta, nunca sozinha. Previsão sai em faixa, com "se o ritmo
// continuar", e só com dado suficiente.

export interface WhatIfReply extends ReasonReply {
  proposal?: CoreProposal;
  /** Pedido que outra camada já sabe fazer ("monta um treino de 40 minutos" → a intenção de tempo curto). */
  redirect?: string;
}

const levelOf = (id: string) => PRINCIPLES.find((p) => p.id === id)?.nivel;
const kg = (v: number) => `${formatWeight(Math.round(v * 2) / 2)} kg`;

/** Dias da semana espalhados para N treinos (1 = segunda … 6 = sábado; 0 = domingo). */
const SPREAD: Record<number, number[]> = {
  2: [1, 4],
  3: [1, 3, 5],
  4: [1, 2, 4, 5],
  5: [1, 2, 3, 4, 5],
  6: [1, 2, 3, 4, 5, 6],
};

function daysWhatIf(d: AnswerData, n: number): WhatIfReply {
  const cur = d.settings.trainingDays.length;
  const week = Math.max(1, weekFor(d.settings.mesoStart, d.today) || 2);
  const days = programDays();
  const per = plannedVolume(week === 7 ? 2 : week, true, d.settings.setAdjust);
  // O programa roda pelos dias da ficha: em N dias por semana, cada dia da ficha cai N/P vezes.
  const scale = (k: number) => (days.length ? k / days.length : 1);
  const [lo] = SCIENCE.volume.efficient;
  const below = MUSCLE_ORDER.filter((m) => per[m] > 0 && per[m] * scale(n) < lo && per[m] * scale(cur) >= lo);
  const rec = recommendTemplate({ days: Math.max(3, n), level: "intermediario", focus: "geral" });
  const lines = [
    `Com **${n} dias** (hoje são ${cur}), o seu programa de ${days.length} dias passa a dar uma volta a cada ${Math.round((days.length / n) * 10) / 10} semanas.`,
    below.length
      ? `Ficariam abaixo de ${lo} séries por semana: ${below.map((m) => MUSCLE_LABEL[m].toLowerCase()).join(", ")}.`
      : `Nenhum músculo cairia abaixo de ${lo} séries por semana.`,
    n !== days.length ? `Para ${n} dias, o modelo que encaixa é **${rec.template.name}**${rec.note ? ` (${rec.note})` : ""}.` : "",
  ].filter(Boolean);
  const nextDays = SPREAD[Math.max(2, Math.min(6, n))];
  const proposal: CoreProposal | undefined =
    n !== cur && nextDays
      ? {
          source: "command",
          kind: "settings",
          patch: { trainingDays: nextDays } as Partial<Settings>,
          confirmLabel: `Treinar ${n} dias por semana`,
        }
      : undefined;
  return {
    topic: "dias",
    text: lines.join("\n\n"),
    proposal,
    principle: "frequencia",
    level: levelOf("frequencia"),
    route: "/programas",
    routeLabel: "Ver os modelos",
    card: cardOf("Simulação // dias", `${n} DIAS`, [
      { k: "Hoje", v: `${cur} dias` },
      { k: "Simulado", v: `${n} dias` },
      { k: "Abaixo da faixa", v: String(below.length), s: "músculos" },
      { k: "Volta na ficha", v: `${Math.round((days.length / n) * 10) / 10} sem` },
    ]),
  };
}

function loadWhatIf(d: AnswerData, ex: ExerciseRef, delta: number | null, target: number | null): WhatIfReply {
  const hist = historyFor(d, ex);
  const last = hist[hist.length - 1];
  const sets = last ? workSets(last.entry, false) : [];
  const top = sets.reduce<(typeof sets)[number] | undefined>((b, s) => (!b || s.weight! > b.weight! ? s : b), undefined);
  if (!top) return { topic: "carga", exercise: ex, text: `Não tenho treino de **${ex.name}** para fazer a conta.` };
  const w = target ?? top.weight! + (delta ?? 0);
  const { k, samples } = personalEpley(hist);
  const reps = predictFromPrevious(top, w, 0, k);
  if (reps == null || reps < 1)
    return { topic: "carga", exercise: ex, text: `Com ${kg(w)} em **${ex.name}** a conta dá menos de 1 rep. Suba aos poucos.` };
  return {
    topic: "carga",
    exercise: ex,
    text: `Com **${kg(w)}** em **${ex.name}**, devem sair **${Math.max(1, reps - 1)} a ${reps + 1} reps** na primeira série. Hoje você faz ${formatWeight(top.weight!)}×${top.reps} (${shortDate(last.session.date)}).${samples >= 2 ? " A conta usa a sua curva de carga × reps." : ""}`,
    principle: "progressao",
    level: levelOf("progressao"),
    route: `/exercicios/${ex.libId}`,
    routeLabel: `Abrir ${ex.name}`,
  };
}

function goalWhatIf(d: AnswerData, ex: ExerciseRef, goal: number): WhatIfReply {
  const pts = historyFor(d, ex)
    .filter((h) => h.session.week !== 7)
    .map((h) => ({ date: h.session.date, v: entryE1rm(h.entry, "recorde")?.value }))
    .filter((p): p is { date: string; v: number } => p.v != null)
    .slice(-10);
  if (pts.length < 4)
    return { topic: "meta", exercise: ex, text: `Preciso de 4 treinos de **${ex.name}** para estimar o ritmo; tenho ${pts.length}.` };
  const xs = pts.map((p) => daysBetween(pts[0].date, p.date) / 7);
  const mx = xs.reduce((a, b) => a + b, 0) / xs.length;
  const my = pts.reduce((a, p) => a + p.v, 0) / pts.length;
  const slope = xs.reduce((a, x, i) => a + (x - mx) * (pts[i].v - my), 0) / (xs.reduce((a, x) => a + (x - mx) ** 2, 0) || 1);
  const now = Math.max(...pts.slice(-3).map((p) => p.v));
  if (now >= goal)
    return {
      topic: "meta",
      exercise: ex,
      text: `Seu máximo estimado em **${ex.name}** já é ${kg(now)}: a meta de ${kg(goal)} está batida.`,
    };
  if (slope <= 0.05)
    return {
      topic: "meta",
      exercise: ex,
      text: `No ritmo atual **${ex.name}** não chega a ${kg(goal)}: o máximo estimado está parado em ${kg(now)}. Pergunte "por que travei no ${ex.name.toLowerCase()}".`,
    };
  const weeks = (goal - now) / slope;
  const lo = Math.max(1, Math.round(weeks * 0.7));
  const hi = Math.round(weeks * 1.3) + 1;
  return {
    topic: "meta",
    exercise: ex,
    text: `Se o ritmo continuar (+${formatWeight(Math.round(slope * 10) / 10)} kg por semana no máximo estimado), **${ex.name}** chega a ${kg(goal)} em **${lo} a ${hi} semanas**, perto de ${longDate(addDays(d.today, Math.round(weeks * 7)))}. Hoje: ${kg(now)}.`,
    principle: "progressao",
    level: levelOf("progressao"),
    card: cardOf("Projeção // meta", `${lo}–${hi} SEM`, [
      { k: "Hoje", v: kg(now), s: "máximo estimado" },
      { k: "Meta", v: kg(goal) },
    ]),
  };
}

function skipWhatIf(d: AnswerData): WhatIfReply {
  const plan = planAhead(d.sessions, d.today, 10, d.settings.trainingDays);
  const tomorrow = addDays(d.today, 1);
  const i = plan.findIndex((p) => p.date === tomorrow);
  const day = (id: string) => programDays().find((x) => x.id === id)?.name ?? id;
  if (i < 0) return { topic: "faltar", text: "Amanhã já é dia de descanso: nada muda." };
  const next = plan[i + 1];
  return {
    topic: "faltar",
    text: `Amanhã seria **${day(plan[i].dayId)}**. Se faltar, a fila não pula: ele passa para ${next ? `**${shortDate(next.date)}**` : "o próximo dia de treino"} e os outros andam um dia. Nada se perde do programa.`,
    route: "/",
    routeLabel: "Ver a semana",
  };
}

function weightWhatIf(d: AnswerData, weeks: number): WhatIfReply {
  const t = weightTrend(d.bodyLog.filter((b) => b.date <= d.today));
  if (!t || t.spanDays < 14) return { topic: "peso", text: "Preciso de 2 semanas de pesagens para projetar o peso." };
  const mid = t.current + t.kgPerWeek * weeks;
  const spread = Math.max(0.5, Math.abs(t.kgPerWeek * weeks) * 0.5);
  return {
    topic: "peso",
    text: `Se o ritmo continuar (${t.kgPerWeek >= 0 ? "+" : ""}${formatWeight(Math.round(t.kgPerWeek * 100) / 100)} kg por semana), em ${weeks} semanas você estaria entre **${kg(mid - spread)} e ${kg(mid + spread)}**. Hoje: ${kg(t.current)}.`,
    principle: "ritmo-perda",
    level: levelOf("ritmo-perda"),
    route: "/progresso",
    routeLabel: "Abrir a biometria",
  };
}

/** "E se" com os dados da pessoa, ou null. */
export function whatIfAnswer(text: string, d: AnswerData, ctx: ReasonCtx = {}): WhatIfReply | null {
  const t = norm(text)
    .replace(/[^a-z0-9,. ]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  const hypo = /^(e se|se eu|e caso|caso eu|e quando eu|imagina se|supondo que)\b/.test(t);
  // "Monta um treino de 40 minutos": a intenção de tempo curto já planeja o dia.
  const mins = t.match(/\b(monta|montar|faz|faca|quero|me da|gera|cria)\b.*\btreino\b.*\b(\d{2,3}) ?(min|mins|minutos)\b/);
  if (mins) return { topic: "tempo", text: "", redirect: `tenho so ${mins[2]} minutos hoje` };
  // Dias por semana.
  const days = t.match(
    /\b(treinar|treino|treine|treinasse|for|fosse|ir|malhar)\b.*?\b(so |apenas |somente )?(\d|dois|duas|tres|quatro|cinco|seis)\s*(dias|vezes)\b/,
  );
  if (hypo && days) {
    const n = readNumber(days[3]);
    if (n && n >= 1 && n <= 7) return daysWhatIf(d, Math.min(6, Math.max(2, n)));
  }
  // Meta de carga: "quanto falta para 100 kg no supino", "quando chego a 100 kg no supino".
  const goal = t.match(
    /\b(quanto falta|quanto tempo|quando (eu )?(chego|vou chegar|vou bater|bato))\b.*?\b(\d{2,3}(?:[.,]\d)?) ?(kg|quilos)?\b/,
  );
  const ex = detectExercise(text) ?? ctx.exercise;
  if (goal && ex && !/\bdeload\b/.test(t)) return goalWhatIf(d, ex, Number(goal[4].replace(",", ".")));
  // Carga a mais: "e se eu colocar 5 kg a mais no supino", "e se eu fizer 90 kg no supino".
  if (hypo && ex) {
    const more = t.match(/\b(\d{1,3}(?:[.,]\d)?) ?(kg|quilos)? (a mais|mais)\b/) ?? t.match(/\bmais (\d{1,3}(?:[.,]\d)?) ?(kg|quilos)\b/);
    if (more) return loadWhatIf(d, ex, Number(more[1].replace(",", ".")), null);
    const abs = t.match(
      /\b(colocar|botar|por|fizer|usar|pegar|subir para|subir pra|for para|for pra) (\d{2,3}(?:[.,]\d)?) ?(kg|quilos)?\b/,
    );
    if (abs) return loadWhatIf(d, ex, null, Number(abs[2].replace(",", ".")));
  }
  if (hypo && /\b(faltar|nao for|nao treinar|pular o treino|matar o treino)\b/.test(t) && /\b(amanha)\b/.test(t)) return skipWhatIf(d);
  if (hypo && /\b(pular|nao fizer|sem) (o )?deload\b/.test(t)) {
    const p = PRINCIPLES.find((x) => x.id === "deload");
    return {
      topic: "deload",
      text: `O app não pula o deload sozinho: a semana 7 vem depois de 6 de carga. ${p ? p.texto : ""} Se você está bem, dá para fazer um deload mais leve, mas sem ele o cansaço acumulado costuma travar o ciclo seguinte.`,
      principle: "deload",
      level: levelOf("deload"),
    };
  }
  const wt = t.match(
    /\bquanto (vou|eu vou|vou estar|estarei) (pesar|pesando)\b.*?\b(\d{1,2}|um|uma|dois|duas|tres|quatro|seis) (semanas|semana|meses|mes)\b/,
  );
  if (wt) {
    const n = readNumber(wt[3]) ?? 1;
    return weightWhatIf(d, /mes/.test(wt[4]) ? Math.round(n * 4.3) : n);
  }
  return null;
}
