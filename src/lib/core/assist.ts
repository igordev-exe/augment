import { MUSCLE_LABEL, programDays, shortName } from "../../data/program";
import type { MuscleId } from "../../data/types";
import { PRINCIPLES } from "../../data/science";
import { mondayOf, shortDate } from "../dates";
import { weekFor } from "../mesocycle";
import { entryE1rm, formatWeight, regressionOf, stallOf, workSets } from "../progression";
import { planAhead } from "../schedule";
import { muscleStatus } from "../visual";
import { cardOf, historyFor, type AnswerData, type DataCard, type ExerciseRef } from "./data-answers";
import { norm } from "./intents";
import { operatorBrief, operatorState } from "./operator";
import type { Query } from "./query";

// AUG.CORE — blocos C e E do chat potente: o que deixa o chat esperto sem saber mais coisas. Resumo sob pedido
// ("como estou?"), de onde saiu o número ("como você chegou nisso?"), o que o chat sabe fazer, os botões que saem do
// estado da pessoa e o "Aliás" (uma linha de alerta de verdade, no máximo uma por resposta e uma vez por dia).

const done = (d: AnswerData) => d.sessions.filter((s) => s.status === "done" && s.date <= d.today);

// ---------- Resumo ----------

const SUMMARY =
  /^(resumo|me (da|de) um resumo|faz um resumo|como (eu )?(estou|to|tô)( indo)?|como (anda|vai) (meu|o) treino|me atualiza|status|situacao|como (foi|ta|esta) (a|minha) semana ate agora)$/;

export function summaryAnswer(text: string, d: AnswerData): { text: string; card?: DataCard; route: string } | null {
  const t = norm(text)
    .replace(/[^a-z ]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (!SUMMARY.test(t)) return null;
  const monday = mondayOf(d.today);
  const week = done(d).filter((s) => s.date >= monday);
  const target = d.settings.trainingDays.length;
  const sets = week.reduce((n, s) => n + s.exercises.reduce((m, e) => m + workSets(e).length, 0), 0);
  const next = planAhead(d.sessions, d.today, 7, d.settings.trainingDays)[0];
  const nextDay = next && programDays().find((x) => x.id === next.dayId);
  const brief = operatorBrief(operatorState(d.sessions, d.bodyLog, d.settings, d.memory, d.today));
  const stalled = programDays()
    .flatMap((day) => day.exercises)
    .filter((ex) => {
      const h = historyFor(d, { libId: ex.lib, name: shortName(ex), exId: ex.id });
      return !!stallOf(h) || !!regressionOf(h);
    })
    .map((ex) => shortName(ex));
  const lines = [
    `Semana: **${week.length} de ${target} treinos**, ${sets} séries de trabalho.`,
    nextDay ? `Próximo: **${nextDay.name}**, ${next.date === d.today ? "hoje" : shortDate(next.date)}.` : "",
    !brief.silent ? `${brief.headline}${brief.detail ? ` ${brief.detail}` : ""}` : "",
    stalled.length
      ? `Parado há 3 sessões: ${stalled.slice(0, 3).join(", ")}${stalled.length > 3 ? ` e mais ${stalled.length - 3}` : ""}.`
      : "Nenhum exercício travado.",
  ].filter(Boolean);
  return {
    text: lines.join("\n\n"),
    route: "/relatorio",
    card: cardOf("Telemetria // resumo", `SEM ${weekFor(d.settings.mesoStart, d.today) || "-"}`, [
      { k: "Treinos", v: `${week.length}/${target}`, s: "nesta semana" },
      { k: "Séries", v: String(sets), s: "de trabalho" },
      { k: "Travados", v: String(stalled.length), s: "exercícios" },
      { k: "Próximo", v: nextDay ? nextDay.code : "—", s: next ? shortDate(next.date) : "" },
    ]),
  };
}

// ---------- De onde saiu o número ----------

const TRACE =
  /^(como (voce|vc) (chegou|calculou|fez a conta|achou) (nisso|isso|esse numero)|de onde (saiu|veio|vem) (isso|esse numero|essa conta)|como (foi|e) (feita )?(essa|a) conta|mostra a conta|qual a conta)$/;

const RULE: Record<string, string> = {
  series: "conto as séries de trabalho marcadas (aquecimento não entra); série de músculo ajudante vale meia",
  "1rm": "uso a régua do recorde: carga × reps até 15, sem drop e sem somar as reps que sobraram",
  carga: "pego a maior carga das séries de trabalho de cada treino",
  reps: "pego as reps das séries de trabalho",
  volume: "somo carga × reps das séries de trabalho, em kg",
  treinos: "conto os treinos concluídos",
  tempo: "somo o tempo de cada treino concluído, do início ao fim",
  "peso-corporal": "uso as pesagens registradas em Progresso",
  sequencia: "conto as semanas seguidas com a meta de treinos cumprida",
};

export function traceAnswer(text: string, d: AnswerData, q: Query | undefined): string | null {
  const t = norm(text)
    .replace(/[^a-z ]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (!TRACE.test(t)) return null;
  if (!q)
    return "A última resposta não tinha conta com os seus dados. Pergunte algo como **quantas séries de peito fiz este mês** e depois **de onde saiu esse número**.";
  const inP = done(d).filter((s) => s.date >= q.period.from && s.date <= q.period.to);
  const target =
    q.target.kind === "exercicio"
      ? `de **${q.target.ex.name}**`
      : q.target.kind === "musculo"
        ? `de **${MUSCLE_LABEL[q.target.muscle].toLowerCase()}**`
        : q.target.kind === "dia"
          ? `do dia **${q.target.day.name}**`
          : "de todos os exercícios";
  return [
    `Para essa resposta eu olhei ${inP.length} ${inP.length === 1 ? "treino concluído" : "treinos concluídos"} ${q.period.label} (${shortDate(q.period.from < "1000" ? (inP[0]?.date ?? d.today) : q.period.from)} a ${shortDate(q.period.to > d.today ? d.today : q.period.to)}), ${target}.`,
    `Regra: ${RULE[q.metric] ?? "uso os seus registros"}.`,
    "Tudo vem do que está salvo no aparelho; nada é estimado de fora.",
  ].join("\n\n");
}

// ---------- O que o chat sabe fazer ----------

const CAPS =
  /^(o que (voce|vc) (sabe|consegue|pode) fazer|o que (da|posso) (pra|para) (fazer|pedir|perguntar)|como (eu )?(peco|pergunto|uso (o chat|voce))|ajuda|help|comandos|quais (os )?comandos)$/;

export function capabilitiesAnswer(text: string): { text: string; chips: string[] } | null {
  const t = norm(text)
    .replace(/[^a-z ]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (!CAPS.test(t)) return null;
  const ex = programDays()[0]?.exercises[0];
  const name = ex ? shortName(ex).toLowerCase() : "supino";
  const groups = [
    `**No treino:** "anota 8 com 80", "80x8 e descanso de 90", "qual a próxima série", "troca o ${name} hoje", "desfaz".`,
    `**Seus números:** "recorde no ${name}", "quantas séries de peito fiz em outubro", "e de costas?", "meu ${name} subiu esse mês?".`,
    `**Por quê e e se:** "por que travei no ${name}", "por que estou cansado", "e se eu treinar 3 dias", "quanto falta para 100 kg no ${name}".`,
    `**Contas e atalhos:** "anilhas pra 80", "70% de 140", "1rm de 100 por 5", "abre o histórico", "muda pra libras".`,
    `**Conhecimento:** proteína, descanso, séries por músculo, o que é RIR e os ${PRINCIPLES.length} princípios do Guia.`,
    `Também guardo o que você me contar ("não gosto de agachamento") e aprendo quando você toca numa sugestão. Nada muda sem você confirmar.`,
  ];
  return { text: groups.join("\n\n"), chips: ["Como estou?", `Por que travei no ${name}?`, "E se eu treinar 3 dias?"] };
}

// ---------- Botões que saem do estado ----------

/** Próximo número redondo acima do máximo estimado, quando está perto (até 10%). */
function nextRound(v: number): number | null {
  const step = v >= 100 ? 10 : 5;
  const goal = Math.ceil((v + 0.01) / step) * step;
  return goal - v <= v * 0.1 ? goal : null;
}

export function stateChips(d: AnswerData, ex: ExerciseRef | undefined, muscle: MuscleId | undefined, asked: string): string[] {
  const out: string[] = [];
  if (ex) {
    const h = historyFor(d, ex);
    const n = ex.name.replace(/\s*\(.*?\)/g, "").toLowerCase();
    if (stallOf(h) || regressionOf(h)) out.push(`Por que travei no ${n}?`);
    const best = Math.max(0, ...h.map((x) => entryE1rm(x.entry, "recorde")?.value ?? 0));
    const goal = best ? nextRound(best) : null;
    if (goal) out.push(`Quanto falta para ${goal} kg no ${n}?`);
  }
  if (muscle) {
    const week = weekFor(d.settings.mesoStart, d.today);
    const st = muscleStatus(d.sessions, week, d.today, d.now ?? Date.now(), d.settings.setAdjust)[muscle];
    if (st && st.target > 0 && st.sets < st.target) out.push(`Exercícios para ${MUSCLE_LABEL[muscle].toLowerCase()}`);
  }
  if (weekFor(d.settings.mesoStart, d.today) === 6) out.push("O que muda no deload?");
  // Resposta sobre um exercício ou músculo sem alerta: o "Por quê?" explica o número (estagnação, cansaço).
  if ((ex || muscle) && !out.some((c) => c.startsWith("Por que"))) out.push("Por quê?");
  const a = norm(asked);
  return out.filter((c) => norm(c) !== a).slice(0, 3);
}

// ---------- Aliás ----------

/** Uma linha de alerta de verdade sobre o exercício ou músculo da resposta. `seen` = chaves já ditas hoje. */
export function asideFor(d: AnswerData, ex: ExerciseRef | undefined, seen: Record<string, string>): { key: string; text: string } | null {
  if (!ex) return null;
  const key = `stall:${ex.libId}`;
  if (seen[key] === d.today) return null;
  const h = historyFor(d, ex);
  const reg = regressionOf(h);
  const stall = reg ? null : stallOf(h);
  if (!reg && !stall) return null;
  const n = ex.name.replace(/\s*\(.*?\)/g, "");
  return {
    key,
    text: reg
      ? `**Aliás:** ${n} caiu nas últimas 3 sessões (${reg.trail.join(" → ")}).`
      : `**Aliás:** ${n} está parado em ${formatWeight(stall!.load)} há 3 sessões.`,
  };
}
