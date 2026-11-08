import { exById, shortName } from "../data/program";
import type { BodyEntry, BodyGoal, ProgramExercise, Session, SessionExercise, SetEntry } from "../data/types";
import { addDays, daysBetween } from "./dates";
import { fatigueDeloadFor, isLowDay, rirRange, WEEK_RULES, type FatigueDeloadAlert } from "./mesocycle";
import { bestE1rm, formatWeight, historyOf, regressionOf, suggest, toKg, workSets, type ExerciseHistoryItem } from "./progression";

// Motor de decisões: regras fixas que acompanham o treino e o corpo e devolvem recados curtos ("nudges"),
// cada um ligado a um princípio da base científica (src/data/science.ts). Nada aqui chama a API nem grava dados.

export type NudgeTone = "warn" | "info" | "good";

export interface Nudge {
  /** Id da regra (ver ENGINE_RULES). */
  id: string;
  tone: NudgeTone;
  text: string;
  /** Id do princípio em PRINCIPLES que justifica o recado. */
  why: string;
  /** Vale um aviso na hora (toast), não só a linha no cartão. */
  toast?: boolean;
}

/** Tom do aviso na hora para cada tom de recado (good vira o verde de "ok"). */
export const NUDGE_TONE = { warn: "warn", info: "info", good: "ok" } as const;

/** Regras do motor, para o Guia e para o prompt do treinador. */
export const ENGINE_RULES: { id: string; quando: string; recado: string; why: string }[] = [
  {
    id: "menos-15",
    quando: "Uma série cai abaixo do piso da faixa.",
    recado: "A última série vai com 15% a menos.",
    why: "carga-pratica",
  },
  {
    id: "falha-composto",
    quando: "Um composto (falha técnica ou sobra 2) é marcado com 0 sobrando.",
    recado: "Pare 1 rep antes na próxima: a fadiga extra come as séries seguintes.",
    why: "rir-consenso",
  },
  {
    id: "falha-cedo",
    quando: "Sobrou menos que a meta da semana (ex.: falha num isolado na semana 1–2).",
    recado: "Segure: falhar cedo gasta recuperação que falta nas semanas 5–6.",
    why: "rir-consenso",
  },
  {
    id: "longe-da-falha",
    quando: "Sobraram 2+ reps além da meta da semana.",
    recado: "Vá mais perto na próxima série (vale passar do topo da faixa).",
    why: "rir-hipertrofia",
  },
  {
    id: "descanso-curto",
    quando: "O intervalo real ficou bem abaixo do da ficha e as reps caíram 2+.",
    recado: "Espere o descanso da ficha: descanso curto custa reps.",
    why: "descanso",
  },
  {
    id: "abaixo-do-normal",
    quando: "A 1ª série rende 2+ reps menos que a última vez com a mesma carga.",
    recado: "Dia abaixo do normal: mantenha a carga, sem intensificador, sem caçar recorde.",
    why: "autorregulacao",
  },
  {
    id: "recorde-reps",
    quando: "Uma série passa o recorde de reps naquela carga.",
    recado: "Recorde na hora.",
    why: "progressao",
  },
  {
    id: "meta-batida",
    quando: "O exercício termina com o teto da faixa batido.",
    recado: "Avisa a carga da próxima sessão.",
    why: "progressao",
  },
  {
    id: "intensificador",
    quando: "Falta só a última série de um exercício com intensificador liberado na cota da semana.",
    recado: "Lembra a técnica (drop set, rest-pause, myo-reps ou parciais) só nessa série.",
    why: "sistemas-avancados",
  },
  {
    id: "sobe-por-rir",
    quando: "Antes do treino: todas as séries da última vez sobraram 2+ reps além da meta.",
    recado: "Sobe a carga já, se a previsão na carga nova cabe na faixa.",
    why: "rir-hipertrofia",
  },
  {
    id: "ancora",
    quando: "Antes do treino: a 1ª série foi a mais pesada e as outras ~10–15% mais leves.",
    recado: "Progride pela série-âncora, não pela carga das séries leves.",
    why: "ancora",
  },
  {
    id: "queda-reps",
    quando: "Reps caindo com a mesma carga em 2 sessões seguidas (contando o que sobrou).",
    recado: "Sinal de fadiga: sono, proteína; em vários exercícios entra no alerta de deload.",
    why: "volume-cego",
  },
  {
    id: "fadiga",
    quando: "Semanas 3–6: dois sinais juntos (sono/energia ruins repetidos, articulação, reps caindo) ou 3+ exercícios regredindo.",
    recado: "Propõe antecipar o deload.",
    why: "volume-cego",
  },
  {
    id: "dose-minima",
    quando: "Semana fechada com músculo abaixo de 4 séries fracionadas.",
    recado: "Avisa no relatório.",
    why: "volume-dose",
  },
  {
    id: "descanso-semana",
    quando: "Na semana, o descanso real de um exercício ficou bem abaixo do da ficha.",
    recado: "Avisa no relatório.",
    why: "descanso",
  },
  {
    id: "ritmo-peso",
    quando: "2 semanas seguidas de média de peso fora da faixa da fase.",
    recado: "±130 kcal (4 colheres de arroz), respeitando o piso; ou 'não mexa' quando é recomposição.",
    why: "ritmo-perda",
  },
  {
    id: "volume-musculo",
    quando: "Fim do mesociclo: retorno de pump/volume/articulação e evolução por músculo.",
    recado: "Sugere +1 ou −1 série por exercício para o próximo mesociclo; um toque aplica (e desfaz), sem passar de 4 séries.",
    why: "feedback-volume",
  },
];

// ---------- Durante o treino ----------

/** Segundos que uma série costuma levar; o intervalo entre dois "feita" = descanso + a série seguinte. */
const SET_SECONDS = 35;

/** Descanso real estimado antes de cada série de trabalho feita (null quando não dá para saber). */
export function restsBefore(entry: SessionExercise): { set: SetEntry; rest: number | null }[] {
  const done = entry.sets.filter((s) => s.done && s.kind !== "warmup");
  return done.map((s, i) => {
    const prev = done[i - 1];
    if (!prev?.doneAt || !s.doneAt || s.doneAt <= prev.doneAt) return { set: s, rest: null };
    return { set: s, rest: Math.max(0, Math.round((s.doneAt - prev.doneAt) / 1000 - SET_SECONDS)) };
  });
}

/** Quais exercícios do dia podem usar intensificador hoje, pela cota da semana (os primeiros na ordem da ficha). */
export function intensifierPlan(exercises: ProgramExercise[], week: number, lowDay: boolean): Set<string> {
  const quota = lowDay ? 0 : (WEEK_RULES[week]?.intensifiers ?? 0);
  return new Set(
    exercises
      .filter((e) => e.intensifier)
      .slice(0, quota)
      .map((e) => e.id),
  );
}

export interface LiveInput {
  ex: ProgramExercise;
  entry: SessionExercise;
  week: number;
  lowDay: boolean;
  /** Sessões anteriores do exercício (mais antiga → mais nova), sem a de hoje. */
  history: ExerciseHistoryItem[];
  plannedSets: number;
  step: number;
  availableWeights?: number[];
  /** Intensificador liberado hoje para este exercício (cota da semana). */
  intensifier: boolean;
}

const TONE_ORDER: Record<NudgeTone, number> = { warn: 0, info: 1, good: 2 };

/**
 * Recados sobre o que acabou de acontecer no exercício (a última série feita e o estado do exercício).
 * Recalculado a cada mudança: aparece no cartão do exercício e, os marcados com `toast`, como aviso na hora.
 */
export function liveNudges(i: LiveInput): Nudge[] {
  const { ex, entry, week } = i;
  const [lo, hi] = ex.reps;
  const out: Nudge[] = [];
  const done = entry.sets.filter((s) => s.done && s.kind !== "warmup" && s.reps != null && s.weight != null);
  if (!done.length) return out;
  const latest = [...done].sort((a, b) => (a.doneAt ?? 0) - (b.doneAt ?? 0))[done.length - 1];
  const u = entry.unit === "lb" ? " lb" : " kg";
  const base = rirRange(ex.stop, week);
  const target: [number, number] = i.lowDay ? [Math.min(4, base[0] + 1), Math.min(4, base[1] + 1)] : base;
  const tLabel = target[0] === target[1] ? `${target[0]}` : `${target[0]}–${target[1]}`;

  // Esforço da última série (só quando o RIR foi marcado).
  if (latest.rir != null && week !== 7 && latest.kind === "work") {
    if (latest.rir === 0 && ex.stop !== "F") {
      out.push({
        id: "falha-composto",
        tone: "warn",
        text: "Composto foi à falha. A ficha pede pelo menos 1 sobrando: a fadiga extra come as próximas séries e não rende mais crescimento. Pare 1 rep antes na próxima.",
        why: "rir-consenso",
        toast: true,
      });
    } else if (latest.rir < target[0]) {
      out.push({
        id: "falha-cedo",
        tone: "info",
        text: `Sobrou ${latest.rir}, e a semana ${week} pede ${tLabel}. Segure um pouco: chegar na falha cedo no mesociclo gasta recuperação que vai faltar nas semanas 5–6.`,
        why: "rir-consenso",
      });
    } else if (latest.rir >= target[1] + 2) {
      const left = latest.rir >= 4 ? "4+" : String(latest.rir);
      out.push({
        id: "longe-da-falha",
        tone: "info",
        text:
          latest.reps! >= hi
            ? `Sobraram ${left} já no topo (${latest.reps} reps): a carga está leve hoje. Pode passar do topo nas próximas séries; a próxima sessão sobe.`
            : `Sobraram ${left}, e a meta é ${tLabel}. Série longe da falha estimula menos: na próxima, vá mais perto, mesmo que passe do número planejado.`,
        why: "rir-hipertrofia",
        toast: true,
      });
    }
  }

  // Descanso curto que custou reps (só entre séries de trabalho com o mesmo peso, fora de superset).
  if (!ex.superset && ex.rest[0] >= 60) {
    const rests = restsBefore(entry);
    const idx = rests.findIndex((r) => r.set.id === latest.id);
    const prev = idx > 0 ? rests[idx - 1].set : undefined;
    const rest = idx > 0 ? rests[idx].rest : null;
    if (
      prev &&
      rest != null &&
      rest < ex.rest[0] * 0.7 &&
      prev.weight != null &&
      latest.weight! >= prev.weight * 0.97 &&
      prev.reps! - latest.reps! >= 2
    ) {
      out.push({
        id: "descanso-curto",
        tone: "warn",
        text: `Descanso de ~${rest} s (ficha: ${ex.restLabel}) e as reps caíram de ${prev.reps} para ${latest.reps}. Descanso curto custa reps nas séries seguintes: espere o timer.`,
        why: "descanso",
        toast: true,
      });
    }
  }

  // 1ª série do dia vs. a 1ª da última vez com a mesma carga.
  const firstToday = done[0];
  const prevEntry = i.history[i.history.length - 1]?.entry;
  const prevFirst = prevEntry ? workSets(prevEntry, false)[0] : undefined;
  if (
    done.length === 1 &&
    firstToday.kind === "work" &&
    prevFirst &&
    prevEntry &&
    Math.abs(toKg(prevFirst.weight!, prevEntry.unit) - toKg(firstToday.weight!, entry.unit)) < 1e-6 &&
    firstToday.reps! + (firstToday.rir ?? 0) <= prevFirst.reps! + (prevFirst.rir ?? 0) - 2
  ) {
    out.push({
      id: "abaixo-do-normal",
      tone: "info",
      text: `1ª série ${prevFirst.reps! - firstToday.reps!} reps abaixo da última vez com ${formatWeight(firstToday.weight)}${u} (${prevFirst.reps} → ${firstToday.reps}). ${i.lowDay ? "Combina com o check-in. " : ""}Dia abaixo do normal acontece: mantenha a carga, sem intensificador, e não persiga recorde hoje.`,
      why: "autorregulacao",
    });
  }

  // Recorde de reps nessa carga, na hora.
  if (latest.kind === "work") {
    const kg = toKg(latest.weight!, entry.unit);
    let prior = 0;
    for (const h of i.history) {
      for (const s of workSets(h.entry)) if (Math.abs(toKg(s.weight!, h.entry.unit) - kg) < 1e-6) prior = Math.max(prior, s.reps!);
    }
    for (const s of done) if (s !== latest && Math.abs(toKg(s.weight!, entry.unit) - kg) < 1e-6) prior = Math.max(prior, s.reps!);
    if (prior > 0 && latest.reps! > prior) {
      out.push({
        id: "recorde-reps",
        tone: "good",
        text: `Recorde de reps com ${formatWeight(latest.weight)}${u}: ${latest.reps} (antes ${prior}).`,
        why: "progressao",
        toast: true,
      });
    }
  }

  const pending = entry.sets.filter((s) => s.kind !== "warmup" && !s.done);
  // Última série pela frente com intensificador liberado.
  if (i.intensifier && ex.intensifier && pending.length === 1 && week >= 3 && week <= 6) {
    out.push({
      id: "intensificador",
      tone: "info",
      text: `Última série: ${ex.intensifier.toLowerCase()}. Só nela, e só se a técnica estiver limpa.`,
      why: "sistemas-avancados",
      toast: true,
    });
  }

  // Exercício terminado com o teto batido: já diz a carga da próxima sessão.
  if (!pending.length && done.length >= Math.min(i.plannedSets, 2) && week !== 7) {
    const next = suggest(ex, entry, i.plannedSets, week, i.step, week, i.availableWeights);
    if (next.kind === "up" && next.weight != null) {
      out.push({
        id: "meta-batida",
        tone: "good",
        text: `Teto batido: na próxima sessão sobe para ${formatWeight(next.weight)}${u} (${next.detail.split(". ")[0].toLowerCase()}).`,
        why: "progressao",
        toast: true,
      });
    } else if (next.kind === "down" && done[0].reps! < lo) {
      out.push({
        id: "meta-batida",
        tone: "info",
        text: `1ª série abaixo de ${lo}: na próxima sessão o app sugere ~${formatWeight(next.weight)}${u}.`,
        why: "progressao",
      });
    }
  }

  return out.sort((a, b) => TONE_ORDER[a.tone] - TONE_ORDER[b.tone]);
}

// ---------- Entre sessões ----------

/** Nomes dos exercícios com reps caindo na mesma carga, entre os treinados nos últimos 10 dias. */
export function regressingExercises(sessions: Session[], today: string): string[] {
  const done = sessions.filter((s) => s.status === "done" && s.date <= today);
  const recentIds = new Set(
    done.filter((s) => s.date >= addDays(today, -10)).flatMap((s) => s.exercises.filter((e) => workSets(e).length).map((e) => e.exId)),
  );
  const out: string[] = [];
  for (const id of recentIds) {
    const ex = exById(id);
    if (ex && regressionOf(historyOf(done, id))) out.push(shortName(ex));
  }
  return out;
}

/** Alerta de fadiga com a queda de reps calculada pelo motor. */
export function fatigueAlert(sessions: Session[], mesoStart: string, today: string, dismissed?: string): FatigueDeloadAlert | null {
  return fatigueDeloadFor(sessions, mesoStart, today, dismissed, regressingExercises(sessions, today));
}

/** Tendência de força nas últimas semanas: exercícios com 1RM estimado (com RIR) subindo, caindo ou parado. */
export function strengthTrend(sessions: Session[], today: string, days = 21): { up: number; down: number; flat: number } {
  const done = sessions.filter((s) => s.status === "done" && s.date <= today && s.date > addDays(today, -days) && s.week !== 7);
  const ids = new Set(done.flatMap((s) => s.exercises.filter((e) => workSets(e).length).map((e) => e.exId)));
  const r = { up: 0, down: 0, flat: 0 };
  for (const id of ids) {
    const h = historyOf(done, id);
    if (h.length < 2) continue;
    const a = bestE1rm(h[0].entry);
    const b = bestE1rm(h[h.length - 1].entry);
    if (b > a * 1.01) r.up += 1;
    else if (b < a * 0.99) r.down += 1;
    else r.flat += 1;
  }
  return r;
}

// ---------- Peso corporal (Plano Alimentar v2) ----------

/** Plano alimentar atual: ajustes em kcal e piso. */
export const DIET = {
  stepKcal: 130,
  stepFood: "4 colheres de sopa de arroz (~100 g)",
  floorKcal: 2100,
  /** % do peso por semana. perder: alvo 0,4–0,7%; lento < 0,32%; rápido > 0,85% (~0,3 e ~0,8 kg/semana a 94 kg). */
  lose: { slow: 0.32, fast: 0.85 },
  gain: { slow: 0.2, fast: 0.6, stepKcal: 150 },
  keep: { drift: 0.3 },
} as const;

function weekAvg(entries: BodyEntry[], from: string, to: string): number | null {
  const v = entries.filter((e) => e.weightKg && e.date > from && e.date <= to).map((e) => e.weightKg!);
  return v.length >= 2 ? v.reduce((a, b) => a + b, 0) / v.length : null;
}

/**
 * A tabela "Ajustes e monitoramento" do plano alimentar como regra: compara as médias de peso das
 * últimas 3 semanas (2 variações seguidas), a cintura e a tendência de força.
 */
export function bodyAdvice(entries: BodyEntry[], goal: BodyGoal | undefined, sessions: Session[], today: string): Nudge[] {
  if (!goal) return [];
  const pts = entries.filter((e) => e.weightKg).sort((a, b) => a.date.localeCompare(b.date));
  if (!pts.length) return [];
  if (daysBetween(pts[0].date, today) < 14) {
    return [
      {
        id: "ritmo-peso",
        tone: "info",
        text: "Primeiras 2 semanas de registro: a queda rápida é água. Pese todo dia de manhã; o ajuste começa quando houver 2 semanas de médias.",
        why: "ritmo-perda",
      },
    ];
  }
  const w0 = weekAvg(pts, addDays(today, -7), today);
  const w1 = weekAvg(pts, addDays(today, -14), addDays(today, -7));
  const w2 = weekAvg(pts, addDays(today, -21), addDays(today, -14));
  if (w0 == null || w1 == null || w2 == null) {
    return [
      {
        id: "ritmo-peso",
        tone: "info",
        text: "Faltam pesagens (2+ por semana nas últimas 3 semanas) para comparar médias. A regra só mexe na dieta com 2 semanas seguidas fora da faixa.",
        why: "ritmo-perda",
      },
    ];
  }
  // Variação semanal em % do peso (negativo = perdendo).
  const d = [((w0 - w1) / w1) * 100, ((w1 - w2) / w2) * 100];
  const kg = (w0 - w1).toFixed(2).replace(".", ",");
  const out: Nudge[] = [];

  const waist = entries.filter((e) => e.waistCm).sort((a, b) => a.date.localeCompare(b.date));
  const waistLast = waist[waist.length - 1];
  const waistOld = [...waist].reverse().find((e) => waistLast && daysBetween(e.date, waistLast.date) >= 14);
  const waistDown = !!waistLast && !!waistOld && waistLast.waistCm! <= waistOld.waistCm! - 1;
  const strength = strengthTrend(sessions, today);
  const lowDays = sessions.filter((s) => s.status === "done" && s.date > addDays(today, -14) && isLowDay(s.checkin)).length;

  if (goal.mode === "perder") {
    const loss = d.map((x) => -x);
    const slow = loss.every((x) => x < DIET.lose.slow);
    const fast = loss.every((x) => x > DIET.lose.fast);
    if (slow && waistDown && strength.up > strength.down) {
      out.push({
        id: "ritmo-peso",
        tone: "good",
        text: "Peso quase parado, cintura caindo e cargas subindo: é recomposição acontecendo. Não mexa.",
        why: "recomposicao",
      });
    } else if (slow) {
      out.push({
        id: "ritmo-peso",
        tone: "warn",
        text: `Perdendo menos de ~0,3 kg por semana há 2 semanas (média ${kg} kg na última). Tire ~${DIET.stepKcal} kcal: ${DIET.stepFood}, do almoço ou do jantar. Se já estiver no piso de ${DIET.floorKcal.toLocaleString("pt-BR")} kcal, não corte comida: some 2–3 mil passos por dia ou 1 cardio zona 2.`,
        why: "ritmo-perda",
      });
    } else if (fast) {
      out.push({
        id: "ritmo-peso",
        tone: "warn",
        text: `Perdendo mais de ~0,8 kg por semana há 2 semanas (média ${kg} kg na última). Acrescente ~${DIET.stepKcal} kcal (${DIET.stepFood}): mais rápido que isso custa massa magra.`,
        why: "ritmo-perda",
      });
    } else if (loss.every((x) => x >= DIET.lose.slow && x <= DIET.lose.fast)) {
      out.push({
        id: "ritmo-peso",
        tone: "good",
        text: `Ritmo dentro da faixa há 2 semanas (média ${kg} kg na última). Não mexa em nada.`,
        why: "ritmo-perda",
      });
    } else {
      out.push({
        id: "ritmo-peso",
        tone: "info",
        text: "Uma semana dentro da faixa e outra fora. A regra pede 2 semanas seguidas antes de mexer: espere mais uma.",
        why: "ritmo-perda",
      });
    }
  } else if (goal.mode === "ganhar") {
    if (d.every((x) => x < DIET.gain.slow)) {
      out.push({
        id: "ritmo-peso",
        tone: "warn",
        text: `Ganhando menos de ~0,25% por semana há 2 semanas. Acrescente ~${DIET.gain.stepKcal} kcal (carboidrato em torno do treino).`,
        why: "ritmo-perda",
      });
    } else if (d.every((x) => x > DIET.gain.fast)) {
      out.push({
        id: "ritmo-peso",
        tone: "warn",
        text: `Ganhando mais de ~0,5% por semana há 2 semanas: boa parte vira gordura. Tire ~${DIET.gain.stepKcal} kcal.`,
        why: "ritmo-perda",
      });
    }
  } else if (d.every((x) => Math.abs(x) > DIET.keep.drift) && Math.sign(d[0]) === Math.sign(d[1])) {
    out.push({
      id: "ritmo-peso",
      tone: "info",
      text: `Em manutenção, mas o peso ${d[0] > 0 ? "subiu" : "caiu"} 2 semanas seguidas. ${d[0] > 0 ? "Tire" : "Acrescente"} ~${DIET.stepKcal} kcal.`,
      why: "ritmo-perda",
    });
  }

  if (strength.down >= 3 && strength.down > strength.up && lowDays >= 2) {
    out.push({
      id: "ritmo-peso",
      tone: "warn",
      text: `Cargas caindo em ${strength.down} exercícios e ${lowDays} check-ins de sono ruim/energia baixa em 2 semanas. Confira sono (7–9 h) e proteína (~2,3 g/kg). Se persistir: +10 g de gordura no lugar de carboidrato e 1 semana em manutenção junto do deload.`,
      why: "sono",
    });
  }
  return out;
}

// ---------- Fim do mesociclo: séries por músculo ----------

export interface VolumeAdvice {
  exId: string;
  change: 1 | -1;
  reason: string;
}

/**
 * Para cada exercício do ciclo, cruza o retorno ("como bateu") com a evolução do 1RM estimado:
 * leve/pump fraco e subindo → +1 série (até 4); pesado, articulação ou caindo → −1 série (mínimo 2).
 */
export function volumeAdvice(
  cycle: Session[],
  deltaE1rmPct: Record<string, number>,
  plannedSets: (exId: string) => number,
): VolumeAdvice[] {
  const out: VolumeAdvice[] = [];
  const ids = new Set(cycle.flatMap((s) => s.exercises.filter((e) => workSets(e).length).map((e) => e.exId)));
  for (const id of ids) {
    const fbs = cycle.flatMap((s) => s.exercises.filter((e) => e.exId === id && e.feedback && !e.feedback.skipped).map((e) => e.feedback!));
    if (fbs.length < 3) continue;
    const leve = fbs.filter((f) => f.volume === "leve").length;
    const pesado = fbs.filter((f) => f.volume === "pesado").length;
    const fraco = fbs.filter((f) => f.pump === "fraco").length;
    const joint = fbs.filter((f) => f.joint === "incomodou").length;
    const delta = deltaE1rmPct[id] ?? 0;
    const sets = plannedSets(id);
    if ((joint >= 2 || (pesado >= 2 && pesado > leve) || delta <= -3) && sets > 2) {
      const why =
        joint >= 2
          ? `articulação incomodou ${joint}×`
          : pesado >= 2 && pesado > leve
            ? `volume "pesado" em ${pesado} de ${fbs.length}`
            : `1RM estimado ${delta}%`;
      out.push({ exId: id, change: -1, reason: why });
    } else if ((leve >= 2 && leve > pesado) || (fraco >= 2 && fraco >= fbs.length / 2)) {
      if (delta >= 0 && joint === 0 && sets < 4) {
        out.push({
          exId: id,
          change: 1,
          reason:
            leve >= 2
              ? `volume "leve" em ${leve} de ${fbs.length} e 1RM +${delta}%`
              : `pump fraco em ${fraco} de ${fbs.length} e 1RM +${delta}%`,
        });
      }
    }
  }
  return out;
}
