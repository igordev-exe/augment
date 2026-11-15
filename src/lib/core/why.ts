import { EXERCISE_EVIDENCE, PRINCIPLES, type EvidenceLevel } from "../../data/science";
import { MUSCLE_LABEL, exOf, programDays } from "../../data/program";
import { libraryMuscles } from "../../data/library-extended";
import type { MuscleId } from "../../data/types";
import { addDays, mondayOf, shortDate } from "../dates";
import { isLowDay, setsFor, weekFor, WEEK_RULES } from "../mesocycle";
import { E1RM_MAX_REPS, entryE1rm, formatWeight, regressionOf, stallOf, workSets } from "../progression";
import { rankProgress } from "../profile";
import { fatiguePct, hoursToReady, muscleStatus, weekStreaks, weightTrend } from "../visual";
import { detectExercise, detectMuscleWord, historyFor, type AnswerData, type DataCard, type ExerciseRef } from "./data-answers";
import { norm } from "./intents";

// AUG.CORE — bloco C do chat potente: "por quê". Cada explicação sai de uma função que o app já usa; nada de causa
// sem dado. Formato fixo: uma frase de conclusão; até 3 fatores, cada um com o número da pessoa, do mais pesado para
// o mais leve; uma linha "o que fazer" com um princípio do Guia. Fator que é só suspeita diz "provável".

export interface ReasonReply {
  text: string;
  topic: string;
  principle?: string;
  level?: EvidenceLevel;
  route?: string;
  routeLabel?: string;
  chips?: string[];
  card?: DataCard;
  exercise?: ExerciseRef;
  muscle?: MuscleId;
}

export interface ReasonCtx {
  exercise?: ExerciseRef;
  muscle?: MuscleId;
}

const WHY = /(^| )(por que|porque|pq|por qual motivo|qual o motivo|qual a razao|como assim|motivo)( |$)/;

const levelOf = (id: string) => PRINCIPLES.find((p) => p.id === id)?.nivel;

function compose(head: string, factors: string[], todo: string, principle: string): Pick<ReasonReply, "text" | "principle" | "level"> {
  const list = factors.slice(0, 3).map((f, i) => `${i + 1}. ${f}`);
  return {
    text: [head, ...(list.length ? [list.join("\n")] : []), `**O que fazer:** ${todo}`].join("\n\n"),
    principle,
    level: levelOf(principle),
  };
}

const done = (d: AnswerData) => d.sessions.filter((s) => s.status === "done" && s.date <= d.today);
const muscleName = (m: MuscleId) => MUSCLE_LABEL[m].toLowerCase();

/** Exercício da pergunta ou do assunto. */
function exerciseIn(text: string, ctx: ReasonCtx): ExerciseRef | undefined {
  return detectExercise(text) ?? ctx.exercise;
}

// ---------- Estagnação e regressão ----------

function stallWhy(d: AnswerData, ex: ExerciseRef): ReasonReply {
  const hist = historyFor(d, ex);
  if (hist.length < 3)
    return {
      topic: "estagnacao",
      exercise: ex,
      text: `Ainda não dá para dizer: tenho ${hist.length} ${hist.length === 1 ? "treino" : "treinos"} de **${ex.name}**. Preciso de 3 para ver se travou.`,
    };
  const stall = stallOf(hist);
  const reg = regressionOf(hist);
  const main = exOf(hist[hist.length - 1].entry)?.muscles[0] ?? libraryMuscles(ex.libId)[0];
  const factors: string[] = [];
  if (stall?.easyRir) factors.push(`Sobrou 3 ou mais reps em todas as séries do último treino: falta esforço, não é cansaço.`);
  if (main) {
    const week = weekFor(d.settings.mesoStart, d.today);
    const st = muscleStatus(d.sessions, week, d.today, d.now ?? Date.now(), d.settings.setAdjust)[main];
    if (st && st.target > 0 && st.sets < st.target * 0.7)
      factors.push(`${MUSCLE_LABEL[main]}: ${formatWeight(st.sets)} de ${st.target} séries nesta semana (abaixo do que a ficha pede).`);
  }
  const last14 = done(d).filter((s) => s.date > addDays(d.today, -14));
  const low = last14.filter((s) => isLowDay(s.checkin)).length;
  if (low >= 2) factors.push(`${low} dos últimos ${last14.length} treinos começaram com sono ruim ou energia baixa no check-in.`);
  const freq = hist.filter((h) => h.session.date > addDays(d.today, -14)).length;
  if (freq <= 1) factors.push(`Só ${freq} ${freq === 1 ? "treino" : "treinos"} de ${ex.name} nas últimas 2 semanas.`);
  const trend = weightTrend(d.bodyLog.filter((b) => b.date <= d.today));
  if (trend && trend.spanDays >= 14 && trend.kgPerWeek <= -0.3)
    factors.push(
      `Provável: seu peso está caindo ${formatWeight(Math.abs(Math.round(trend.kgPerWeek * 10) / 10))} kg por semana, e em déficit a força sobe devagar.`,
    );

  if (!stall && !reg) {
    const trail = hist
      .slice(-3)
      .map((h) => {
        const ws = workSets(h.entry, false);
        return `${formatWeight(Math.max(...ws.map((s) => s.weight!)))}×${ws.map((s) => s.reps).join(",")}`;
      })
      .join(" → ");
    return {
      topic: "estagnacao",
      exercise: ex,
      ...compose(
        `Não vejo **${ex.name}** travado: as 3 últimas sessões foram ${trail}.`,
        factors,
        "seguir a progressão: bater o topo da faixa em todas as séries antes de subir a carga.",
        "progressao",
      ),
      route: `/exercicios/${ex.libId}`,
      routeLabel: `Abrir ${ex.name}`,
    };
  }
  const head = reg
    ? `**${ex.name}** está caindo: ${reg.trail.join(" → ")}.`
    : `**${ex.name}** travou em ${formatWeight(stall!.load)} nas últimas 3 sessões: ${stall!.trail.join(" → ")}.`;
  const todo = stall?.easyRir
    ? "chegar mais perto da falha (1 a 2 reps sobrando) antes de pensar em trocar o exercício."
    : reg
      ? "baixar 10% da carga por uma semana e subir de novo; se continuar caindo, um deload adiantado."
      : "manter a carga e somar 1 rep por série; se em 2 semanas nada mexer, trocar a variação.";
  return {
    topic: "estagnacao",
    exercise: ex,
    ...compose(
      head,
      factors.length ? factors : ["Nenhum outro sinal nos seus dados: carga, séries e check-in estão normais."],
      todo,
      reg ? "deload" : "progressao",
    ),
    route: `/exercicios/${ex.libId}`,
    routeLabel: `Abrir ${ex.name}`,
  };
}

// ---------- Cansaço e recuperação ----------

function fatigueWhy(d: AnswerData, muscle?: MuscleId): ReasonReply {
  const week = weekFor(d.settings.mesoStart, d.today);
  const st = muscleStatus(d.sessions, week, d.today, d.now ?? Date.now(), d.settings.setAdjust);
  const list = (muscle ? [muscle] : (Object.keys(st) as MuscleId[]))
    .map((m) => st[m])
    .filter((x) => x?.lastDate)
    .sort((a, b) => fatiguePct(b) - fatiguePct(a));
  const top = list[0];
  if (!top || fatiguePct(top) < 15)
    return {
      topic: "fadiga",
      muscle,
      text: muscle
        ? `Pelos seus treinos, ${muscleName(muscle)} já está recuperado. Se a sensação é outra, o sono e a comida pesam mais que o treino.`
        : "Pelos seus treinos nenhum músculo está cansado agora. Se a sensação é outra, o sono e a comida pesam mais que o treino.",
      principle: "sono",
      level: levelOf("sono"),
    };
  const m = top.muscle;
  const factors = [`Último treino de ${muscleName(m)}: ${shortDate(top.lastDate!)}, ${formatWeight(top.lastSets)} séries.`];
  if ((top.intensity ?? 1) >= 1.1) factors.push("Esse treino foi mais duro que o normal (falha, pump forte ou nota de treino pesado).");
  if (top.target > 0 && top.sets > top.target)
    factors.push(`Já são ${formatWeight(top.sets)} séries nesta semana, acima das ${top.target} da ficha.`);
  const lastS = done(d).sort((a, b) => (a.date < b.date ? 1 : -1))[0];
  if (lastS && isLowDay(lastS.checkin)) factors.push("No último check-in você marcou sono ruim ou energia baixa (provável).");
  const h = hoursToReady(top);
  return {
    topic: "fadiga",
    muscle: m,
    ...compose(
      `${MUSCLE_LABEL[m]} ainda está **${fatiguePct(top)}% cansado**${h ? `; fica pronto em cerca de ${h} h` : ""}.`,
      factors,
      h > 24 ? "treinar outro grupo hoje, ou o mesmo com uma série a menos." : "treinar normal; o resto da recuperação sai no aquecimento.",
      "frequencia",
    ),
    route: "/progresso",
    routeLabel: "Abrir o mapa de fadiga",
  };
}

// ---------- Menos séries, deload ----------

function setsWhy(d: AnswerData): ReasonReply {
  const week = weekFor(d.settings.mesoStart, d.today);
  const rule = WEEK_RULES[week];
  const open = d.sessions.find((s) => s.status === "active");
  const factors: string[] = [];
  if (open?.lowDayTrim) factors.push("No check-in de hoje você marcou um dia de baixa e aceitou tirar 1 série dos isolados.");
  if (week === 7) factors.push("É a semana de deload: metade das séries, mesma carga, umas 4 reps sobrando.");
  if (week === 1) factors.push("Semana 1 é de entrada: os isolados começam com 1 série a menos.");
  const day = programDays()[0];
  const ex = day?.exercises.find((e) => e.up || e.iso);
  if (ex && week >= 1 && week <= 7)
    factors.push(
      `Exemplo: ${ex.name.replace(/\s*\(.*?\)/g, "")} pede ${setsFor(ex, week, d.settings.setAdjust?.[ex.id])} séries nesta semana (a ficha diz ${ex.sets}).`,
    );
  return {
    topic: "series",
    ...compose(
      week === 0
        ? "Seu programa é fixo: as séries são as da ficha toda semana."
        : `Semana ${week} do ciclo: **${rule.label}**. ${rule.summary}`,
      factors,
      week === 7
        ? "fazer o deload inteiro: é ele que deixa as próximas 6 semanas renderem."
        : "seguir as séries do dia; o ciclo sobe o volume nas semanas 4 a 6.",
      week === 7 ? "deload" : "periodizacao",
    ),
  };
}

// ---------- Recorde que não contou ----------

function recordWhy(d: AnswerData, ex: ExerciseRef): ReasonReply {
  const hist = historyFor(d, ex);
  const last = hist[hist.length - 1];
  if (!last) return { topic: "recorde", exercise: ex, text: `Não achei treino de **${ex.name}** para conferir.` };
  const sets = last.entry.sets.filter((s) => s.done && s.weight != null && s.reps);
  const factors: string[] = [];
  if (sets.some((s) => s.kind === "drop")) factors.push("Série de drop não conta para recorde (a carga caiu no meio).");
  if (sets.some((s) => s.kind === "work" && (s.reps ?? 0) > E1RM_MAX_REPS))
    factors.push(`Série com mais de ${E1RM_MAX_REPS} reps não conta: a conta do máximo fica imprecisa.`);
  const now = entryE1rm(last.entry, "recorde")?.value ?? 0;
  const best = Math.max(0, ...hist.slice(0, -1).map((h) => entryE1rm(h.entry, "recorde")?.value ?? 0));
  if (now && best >= now)
    factors.push(
      `O máximo estimado desse treino foi ${formatWeight(Math.round(now))} kg; o seu recorde é ${formatWeight(Math.round(best))} kg.`,
    );
  if (sets.some((s) => s.rir != null && s.rir > 0))
    factors.push("As reps que sobraram (RIR) não entram no recorde: ele vale o que você fez.");
  return {
    topic: "recorde",
    exercise: ex,
    ...compose(
      factors.length
        ? `O treino de ${shortDate(last.session.date)} em **${ex.name}** não bateu recorde pela régua do app.`
        : `O treino de ${shortDate(last.session.date)} em **${ex.name}** conta normal.`,
      factors,
      "comparar sempre pela mesma régua: carga × reps até 15, sem drop.",
      "carga-faixa",
    ),
    route: `/exercicios/${ex.libId}`,
    routeLabel: `Abrir ${ex.name}`,
  };
}

// ---------- Sequência e posto ----------

function streakWhy(d: AnswerData): ReasonReply {
  const target = d.settings.trainingDays.length;
  const { streak, longest } = weekStreaks(d.sessions, d.today, target, d.memory?.absences ?? []);
  const lastWeek = addDays(mondayOf(d.today), -7);
  const n = done(d).filter((s) => s.date >= lastWeek && s.date < mondayOf(d.today)).length;
  const factors = [`Semana passada: ${n} de ${target} treinos.`];
  if (longest > streak) factors.push(`Sua maior sequência foi de ${longest} semanas.`);
  factors.push("Semana com ausência declarada (doença, viagem) fica congelada: não zera nem soma.");
  return {
    topic: "sequencia",
    ...compose(
      n >= target
        ? `Sua sequência está em **${streak} semanas** e a semana passada contou.`
        : `A sequência conta semanas com a meta de ${target} treinos; a semana passada ficou em ${n}.`,
      factors,
      'se faltou por doença ou viagem, diga "fiquei doente" ou "viajei" e eu registro a ausência.',
      "frequencia",
    ),
  };
}

function rankWhy(d: AnswerData): ReasonReply {
  const n = done(d).length;
  const r = rankProgress(n);
  return {
    topic: "posto",
    text: r.next
      ? `O posto sobe por treinos concluídos. Você está em **${r.rank}** com ${n} treinos; faltam **${r.need}** para **${r.next}**.`
      : `Você está no último posto, **${r.rank}**, com ${n} treinos.`,
    route: "/perfil",
    routeLabel: "Abrir o perfil",
  };
}

// ---------- Por que esse exercício ----------

function exerciseWhy(ex: ExerciseRef): ReasonReply {
  const ev = EXERCISE_EVIDENCE[ex.libId];
  const p = ev ? PRINCIPLES.find((x) => x.id === ev.why) : undefined;
  const muscles = libraryMuscles(ex.libId).map(muscleName);
  const factors = [...(muscles.length ? [`Trabalha ${muscles.join(", ")}.`] : []), ...(ev && p ? [`${ev.tag}: ${p.texto}`] : [])];
  return {
    topic: "exercicio",
    exercise: ex,
    ...compose(
      `**${ex.name}** está no programa pelo músculo que trabalha${ev ? " e por um motivo do Guia" : ""}.`,
      factors,
      'manter enquanto a carga sobe; se travar 3 sessões seguidas, pergunte "por que travei".',
      p?.id ?? "equipamento",
    ),
    route: `/exercicios/${ex.libId}`,
    routeLabel: `Abrir ${ex.name}`,
  };
}

// ---------- Descanso maior ----------

function restWhy(): ReasonReply {
  return {
    topic: "descanso",
    ...compose(
      "O descanso acompanha a série que você acabou de fazer.",
      [
        "Depois de ir à falha, ou de perder 2 reps ou mais da série anterior, ele vai para o topo da faixa do exercício.",
        "No isolado com 3 ou mais reps sobrando, ele fica no piso da faixa.",
        "Nunca abaixo do mínimo da ficha nem mais de 30 s acima do topo; o motivo aparece no rótulo do timer.",
      ],
      "usar o tempo inteiro nos compostos: descanso curto custa reps nas séries seguintes.",
      "descanso",
    ),
  };
}

/** "Por quê" com os dados da pessoa, ou null quando a pergunta não é dessas. `bare` = "por quê?" sozinho. */
export function whyAnswer(text: string, d: AnswerData, ctx: ReasonCtx = {}): ReasonReply | null {
  const t = ` ${norm(text)
    .replace(/[^a-z0-9 ]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()} `;
  if (!WHY.test(t.trim())) return null;
  const bare = /^ (por que|porque|pq|como assim|por qual motivo|motivo) $/.test(t);
  const ex = exerciseIn(text, ctx);
  const muscle = detectMuscleWord(text) ?? (bare ? ctx.muscle : undefined);
  if (/ (estagn|trav|nao sobe|nao evolu|nao progrid|parei de evoluir|nao cresce|regredi|cai|caiu|piorei|nao passo)/.test(t) && ex)
    return stallWhy(d, ex);
  if (/ (recorde|pr) /.test(t) && / (nao|sem) /.test(t) && ex) return recordWhy(d, ex);
  if (/ (cansad|fadiga|nao recuper|dolorid|moid|exaust)/.test(t) && (muscle || / (meu|minha|eu|to|estou) /.test(t)))
    return fatigueWhy(d, muscle);
  if (/ (menos series|poucas series|series diminu|tirou uma serie|tirou series|deload|metade das series)/.test(t)) return setsWhy(d);
  if (/ (sequencia|streak|ofensiva)/.test(t)) return streakWhy(d);
  if (/ (posto|patente|rank|nivel) /.test(t) && / (nao sub|sobe|subiu)/.test(t)) return rankWhy(d);
  if (/ descanso /.test(t) && / (maior|mais longo|aumentou|menor|diferente|mudou)/.test(t)) return restWhy();
  if (ex && / (esse exercicio|no programa|na ficha|no meu treino|faco|tenho que fazer)/.test(t)) return exerciseWhy(ex);
  // "Por quê?" logo depois de uma resposta sobre um exercício ou músculo.
  if (bare && ctx.exercise) return stallWhy(d, ctx.exercise);
  if (bare && ctx.muscle) return fatigueWhy(d, ctx.muscle);
  return null;
}
