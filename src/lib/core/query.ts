import { exOf, MUSCLE_LABEL, programDays, synergistsOf } from "../../data/program";
import type { MuscleId, ProgramDay, Session } from "../../data/types";
import { addDays, daysBetween, shortDate } from "../dates";
import { entryE1rm, formatWeight, toKg, workSets } from "../progression";
import { stem } from "./answers";
import {
  dataAnswer,
  detectExercise,
  detectMuscleWord,
  historyFor,
  matchData,
  type AnswerData,
  type DataCard,
  type DataContext,
  type DataKind,
  type DataReply,
  type ExerciseRef,
} from "./data-answers";
import { hasAny, norm } from "./intents";
import { clean, findPeriod, type Period } from "./readers";

// AUG.CORE — gramática de consultas aos dados. Em vez de um tipo por pergunta, quatro eixos que se combinam:
// métrica × alvo × período × conta. `parseQuery` lê os eixos, `runQuery` faz a conta com as mesmas funções das telas
// e os modelos de frase montam o texto e o cartão. Os 12 tipos de antes (data-answers.ts) viram casos desta
// gramática: quando a pergunta cabe num deles, a resposta é a dele. Sem dado, a resposta diz o que falta; nunca um
// número inventado. 1RM sempre pela régua do projeto (`entryE1rm`).

export type Metric = "carga" | "reps" | "1rm" | "volume" | "series" | "treinos" | "tempo" | "peso-corporal" | "sequencia";
export type Agg = "ultimo" | "melhor" | "media" | "total" | "tendencia" | "comparacao" | "quando" | "ranking";
export type Target =
  | { kind: "exercicio"; ex: ExerciseRef }
  | { kind: "musculo"; muscle: MuscleId }
  | { kind: "dia"; day: ProgramDay }
  | { kind: "tudo" };

export interface Query {
  metric: Metric;
  target: Target;
  period: Period;
  periodExplicit: boolean;
  agg: Agg;
}

const SINCE_ALWAYS: Period = { key: "sempre", from: "0000-01-01", to: "9999-12-31", label: "desde o começo" };

// ---------- Eixos ----------

/** Pergunta de conselho ("quantas séries devo fazer"): não é consulta aos dados, vai para as respostas prontas. */
const ADVICE =
  /\b(devo|deveria|ideal|recomendad\w*|recomenda|precis[ao]|tenho que|tem que|e normal|normal|o que e|pra crescer|para crescer|pra ganhar|para ganhar|por musculo|quanto descansar|vale a pena|e bom|faz mal|ajuda|funciona|melhor (fazer|horario|divisao|exercicio pra|exercicio para))\b/;
/** Sinal de que a pessoa fala dela mesma (e não de treino em geral). */
const SELF =
  /\b(meu|minha|meus|minhas|eu|fiz|treinei|peguei|pego|levanto|aguento|levantei|malhei|usei|subi|evolui|pesei|pesava|to|estou|ja|consegui|fui|bati|fechei|tenho feito|venho)\b/;

/** Abreviações de celular que a gramática precisa ler ("qto tempo", "qnts series"). */
function expand(t: string): string {
  return t
    .replace(/\b(qto|qnto|qnt|qt)\b/g, "quanto")
    .replace(/\b(qnts|qnt[ao]s|qts)\b/g, "quantas")
    .replace(/\bvc\b/g, "voce");
}

const MUSCLE_WORDS =
  /\b(peito|peitoral|costas|perna|pernas|biceps|triceps|ombro|ombros|gluteo|gluteos|panturrilha|panturrilhas|abdomen|abdominal|braco|bracos|trapezio|antebraco|quadriceps|posterior|coxa|dorsal)\b/g;
/** Palavras da pergunta que não podem virar nome de exercício ("mes" → "mesa flexora", "levantei" → "levantamento"). */
const GRAMMAR_WORDS =
  /\b(mes|meses|dia|dias|semana|semanas|ano|anos|ciclo|meso|hoje|ontem|media|medio|levantei|levantar|levanto|peso|pesos|pesava|carga|cargas|quanto|quantos|quantas|vezes|total|mais|menos|alto|alta|pesado|pesada|melhor|maior|recorde|maximo|ultima|ultimo|vez|tempo|horas|treino|treinos|treinei|fiz|faco|peguei|pego|evoluiu|subiu|caiu|meu|minha|eu|qual|que|quando|foi|no|na|de|do|da|em|o|a)\b/g;

function detectMetric(t: string, hasExercise: boolean, hasMuscle: boolean): Metric | undefined {
  if (
    /\b(quanto tempo|quantas horas|quantos minutos|tempo (de|total|treinando|na academia|medio)|duracao|horas (de treino|treinando|na academia))\b/.test(
      t,
    )
  )
    return "tempo";
  if (/\b(meu peso|peso corporal|media de peso|peso medio|pesava|eu pesei|quanto (eu )?(peso|pesava|pesei)|balanca)\b/.test(t))
    return "peso-corporal";
  if (/\b(sequencia|streak|semanas seguidas)\b/.test(t)) return "sequencia";
  if (
    /\b(tonelagem|volume total|volume em kg|carga total|quant[oa]s? (kg|quilos|toneladas)( eu)? (levantei|ergui|movimentei|puxei|empurrei)|kg (no total|levantados)|total de (kg|quilos)|(kg|quilos) que (eu )?levantei)\b/.test(
      t,
    )
  )
    return "volume";
  if (/\bseries?\b/.test(t)) return "series";
  if (/\b(volume)\b/.test(t)) return "series";
  if (/\b(repeticoes|reps|repeticao)\b/.test(t)) return "reps";
  if (/\b(1rm|rm|forca|recorde|recordes|maximo|maxima|pr|prs)\b/.test(t)) return "1rm";
  if (hasExercise && /\b(pego|levanto|aguento)\b/.test(t)) return "1rm";
  if (/\b(treinos?|treinei|malhei|vezes|academia)\b/.test(t) && !hasExercise) return "treinos";
  if (hasMuscle && !hasExercise && /\b(quando|ultima vez|fiz)\b/.test(t)) return "treinos";
  if (
    hasExercise &&
    /\b(carga|peso|peguei|levantei|usei|fiz|subiu|caiu|evolu\w*|melhorou|progred\w*|pesado|kg|quilos|ta|esta|anda)\b/.test(t)
  )
    return "carga";
  return undefined;
}

function detectAgg(t: string, metric: Metric, target: "ex" | "outro"): Agg {
  if (/\b(compar\w*|em relacao|versus|vs|contra|do que (no|na|o|a|em)|que (no|na|o|a) (passad\w*|anterior))\b/.test(t)) return "comparacao";
  // "última vez que fiz crucifixo" pede a série; "última vez que treinei perna" pede a data.
  if (target === "ex" && /\bultima vez\b/.test(t) && !/\bquando\b/.test(t)) return "ultimo";
  if (
    /\b(quando foi|quando (eu )?(treinei|fiz|bati|peguei|malhei|levantei)|que dia (eu |foi )?(treinei|fiz|bati|foi)|ultima vez que|data do|foi quando)\b/.test(
      t,
    )
  )
    return "quando";
  if (/\b(subiu|subindo|evolu\w*|melhorou|melhorando|progred\w*|caiu|caindo|piorou|aumentou|diminuiu|crescendo|tendencia|mudou)\b/.test(t))
    return "tendencia";
  if (/\b(media|em media|medio)\b/.test(t)) return "media";
  if (/\b(melhor|maior|mais pesad\w*|mais alt[oa]|recorde|maximo|maxima|pr)\b/.test(t)) return "melhor";
  if (/\b(ultim[oa]s?|mais recente|da ultima vez)\b/.test(t)) return "ultimo";
  if (/\b(quant[oa]s|total|soma|somando)\b/.test(t)) return "total";
  if (metric === "1rm") return "melhor";
  if (metric === "series" || metric === "treinos" || metric === "tempo" || metric === "volume") return "total";
  return "ultimo";
}

function defaultPeriod(metric: Metric, agg: Agg, o: { today: string; mesoStart: string }): Period {
  const week = findPeriod("essa semana", o)!;
  if (agg === "quando" || agg === "melhor" || metric === "peso-corporal") return SINCE_ALWAYS;
  if (agg === "tendencia" || agg === "ranking")
    return findPeriod("esse ciclo", o) ?? { key: "ultimos", from: addDays(o.today, -55), to: o.today, label: "nas últimas 8 semanas" };
  if (agg === "comparacao") return week;
  if (metric === "series" || metric === "tempo" || metric === "volume") return week;
  if (metric === "treinos" && agg === "total") return week;
  return SINCE_ALWAYS;
}

/** Dia do programa pelo nome inteiro ("push a", "lower b"). */
function detectDay(t: string): ProgramDay | undefined {
  return programDays().find((d) => {
    const name = clean(d.name)
      .replace(/\([^)]*\)/g, " ")
      .replace(/\s+/g, " ")
      .trim();
    return name.length > 2 && new RegExp(`\\b${name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`).test(t);
  });
}

/** Exercício do programa por uma palavra que só ele tem ("extensora", "flexora", "crucifixo"). */
function looseExercise(t: string): ExerciseRef | undefined {
  const words = new Set(
    t
      .split(" ")
      .filter((w) => w.length >= 6)
      .map(stem),
  );
  let best: { ex: ExerciseRef; hits: number } | undefined;
  for (const d of programDays())
    for (const e of d.exercises) {
      const tokens = clean(e.name)
        .replace(/\([^)]*\)/g, " ")
        .split(/[^a-z]+/)
        .filter((w) => w.length >= 6)
        .map(stem);
      const hits = tokens.filter((w) => words.has(w)).length;
      if (hits && (!best || hits > best.hits))
        best = { ex: { libId: e.lib, name: e.name.replace(/\s*\(.*$/, "").replace(/^[A-Z]\d · /, ""), exId: e.id }, hits };
    }
  return best?.ex;
}

function findExercise(t: string, periodMatch: string | undefined, muscle: MuscleId | undefined): ExerciseRef | undefined {
  const base = (periodMatch ? t.replace(periodMatch, " ") : t).replace(/\bpor semana\b/g, " ");
  const bare = base.replace(GRAMMAR_WORDS, " ").replace(/\s+/g, " ").trim();
  if (!bare) return undefined;
  const full = detectExercise(bare);
  if (!muscle) return full ?? looseExercise(bare);
  // Com palavra de músculo, só vale exercício com mais do que ela ("panturrilha em pé" sim, "séries de peito" não).
  const noMuscle = bare.replace(MUSCLE_WORDS, " ").replace(/\s+/g, " ").trim();
  const strict = noMuscle ? (detectExercise(noMuscle) ?? looseExercise(noMuscle)) : undefined;
  if (strict) return strict;
  if (full) {
    const nameWords = new Set(
      clean(full.name)
        .split(/[^a-z]+/)
        .map(stem),
    );
    const hits = bare.split(" ").filter((w) => nameWords.has(stem(w))).length;
    if (hits >= 2) return full;
  }
  return undefined;
}

const RANKING =
  /\bqual (exercicio|musculo)\b.*\bmais\b|\bmais evolu\w*\b|\bo que mais (evoluiu|subiu|cresceu|melhorou)\b|\bexercicio mais\b/;

/** Lê os quatro eixos. Null quando não é pergunta sobre os dados da pessoa. */
export function parseQuery(text: string, d: Pick<AnswerData, "today" | "settings">, ctx: DataContext & QueryContext = {}): Query | null {
  const t = expand(
    clean(text)
      .replace(/[^a-z0-9,. ]/g, " ")
      .replace(/\s+/g, " ")
      .trim(),
  );
  if (!t || ADVICE.test(t)) return null;
  const o = { today: d.today, mesoStart: d.settings.mesoStart };
  const p = findPeriod(t.replace(/\bpor semana\b/g, " "), o);
  // "semana do ciclo" é a pergunta da semana (outro caso), não um período.
  const period = p && !/\bsemana do (ciclo|meso)/.test(t) ? p : undefined;
  const day = detectDay(t);
  const muscle = day ? undefined : detectMuscleWord(t);
  const ranking = RANKING.test(t);
  const exercise = day || ranking ? undefined : findExercise(t, p?.match, muscle);
  const cont = !!ctx.query && isContinuation(t);
  const metric: Metric | undefined = ranking
    ? /\bmusculo\b/.test(t)
      ? "series"
      : "1rm"
    : (detectMetric(t, !!exercise, !!muscle) ?? (cont ? ctx.query!.metric : undefined));
  if (!metric) return null;
  if (!SELF.test(t) && !period && !exercise && !ranking && !/\b(tonelagem|volume total|peso corporal)\b/.test(t) && !cont) return null;
  const agg: Agg = ranking ? "ranking" : detectAgg(p ? t.replace(p.match, " ") : t, metric, exercise ? "ex" : "outro");
  const target: Target = ranking
    ? { kind: "tudo" }
    : exercise
      ? { kind: "exercicio", ex: exercise }
      : day
        ? { kind: "dia", day }
        : muscle
          ? { kind: "musculo", muscle }
          : cont && !period
            ? ctx.query!.target
            : { kind: "tudo" };
  return {
    metric,
    target,
    agg,
    period: period ?? (cont && ctx.query!.periodExplicit ? ctx.query!.period : defaultPeriod(metric, agg, o)),
    periodExplicit: !!period || (cont && ctx.query!.periodExplicit),
  };
}

function isContinuation(t: string): boolean {
  const words = t.split(" ").filter(Boolean);
  return words.length <= 5 && (/^(e|e no|e na|e o|e a|e em|e de)\b/.test(t) || words.length <= 3);
}

// ---------- Contas ----------

const done = (d: AnswerData) => d.sessions.filter((s) => s.status === "done" && s.date <= d.today);
const inPeriod = (s: { date: string }, p: Period) => s.date >= p.from && s.date <= p.to;
const kg = (v: number) => `${formatWeight(Math.round(v * 2) / 2)} kg`;
const n1 = (v: number) => formatWeight(Math.round(v * 10) / 10);

/** Peso de uma série para o músculo: 1 direto, 0,5 sinergista (volume fracionado, como nas telas). */
function muscleWeight(e: Session["exercises"][number], m: MuscleId): number {
  const ex = exOf(e);
  if (!ex) return 0;
  if (ex.muscles.includes(m)) return 1;
  return synergistsOf(ex).includes(m) ? 0.5 : 0;
}

function entriesOf(s: Session, target: Target) {
  if (target.kind === "dia" && s.dayId !== target.day.id) return [];
  if (target.kind === "musculo") return s.exercises.filter((e) => muscleWeight(e, target.muscle) > 0);
  return s.exercises;
}

function sessionsOf(d: AnswerData, q: Query, p = q.period): Session[] {
  return done(d)
    .filter((s) => inPeriod(s, p))
    .filter((s) => {
      if (q.target.kind === "dia") return s.dayId === q.target.day.id;
      if (q.target.kind === "musculo") {
        const m = q.target.muscle;
        return s.exercises.some((e) => exOf(e)?.muscles.includes(m) && workSets(e).length > 0);
      }
      return true;
    })
    .sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : a.startedAt - b.startedAt));
}

function seriesIn(d: AnswerData, q: Query, p: Period): number {
  let n = 0;
  for (const s of done(d).filter((x) => inPeriod(x, p))) {
    for (const e of entriesOf(s, q.target)) {
      const sets = workSets(e).length;
      if (q.target.kind === "musculo") n += sets * muscleWeight(e, q.target.muscle);
      else n += sets;
    }
  }
  return n;
}

function volumeIn(d: AnswerData, q: Query, p: Period): number {
  let v = 0;
  for (const s of done(d).filter((x) => inPeriod(x, p)))
    for (const e of entriesOf(s, q.target)) for (const st of workSets(e)) v += toKg(st.weight!, e.unit) * st.reps!;
  return v;
}

function minutesOf(s: Session): number {
  return s.finishedAt ? Math.max(0, Math.round((s.finishedAt - s.startedAt) / 60000)) : 0;
}

function previous(p: Period): Period {
  const len = daysBetween(p.from, p.to) + 1;
  const to = addDays(p.from, -1);
  return {
    key: p.key,
    from: addDays(to, -(len - 1)),
    to,
    label: `no período anterior (${shortDate(addDays(to, -(len - 1)))} a ${shortDate(to)})`,
  };
}

/** Resultado da conta: texto pronto ou o que falta. `number` é o número principal (os testes conferem). */
export interface QueryResult {
  ok: boolean;
  text: string;
  card?: DataCard;
  route?: string;
  number?: number;
}

function fmtMin(m: number): string {
  const h = Math.floor(m / 60);
  const r = m % 60;
  return h ? `${h} h${r ? ` ${r} min` : ""}` : `${r} min`;
}

function targetLabel(t: Target): string {
  if (t.kind === "exercicio") return `**${t.ex.name}**`;
  if (t.kind === "musculo") return MUSCLE_LABEL[t.muscle].toLowerCase();
  if (t.kind === "dia") return `o ${t.day.name}`;
  return "tudo";
}

function cardOf(title: string, tag: string, cells: DataCard["cells"]): DataCard | undefined {
  const n = cells.length >= 4 ? 4 : cells.length >= 2 ? 2 : 0;
  return n ? { title, tag, cells: cells.slice(0, n) } : undefined;
}

/** Top-set (a mais pesada) e 1RM de cada treino de um exercício no período. */
function exerciseSeries(d: AnswerData, ex: ExerciseRef, p: Period) {
  return historyFor(d, ex)
    .filter((h) => inPeriod(h.session, p))
    .map((h) => {
      const sets = workSets(h.entry, false);
      const top = sets.reduce<(typeof sets)[number] | undefined>(
        (b, s) => (!b || s.weight! > b.weight! || (s.weight === b.weight && s.reps! > b.reps!) ? s : b),
        undefined,
      );
      return {
        date: h.session.date,
        unit: h.entry.unit,
        top,
        reps: sets.reduce((m, s) => Math.max(m, s.reps!), 0),
        rec: entryE1rm(h.entry, "recorde"),
        cmp: entryE1rm(h.entry, "comparacao"),
      };
    })
    .filter((x) => x.top);
}

function runExercise(d: AnswerData, q: Query & { target: { kind: "exercicio" } }): QueryResult {
  const ex = q.target.ex;
  const route = `/exercicios/${ex.libId}`;
  const rows = exerciseSeries(d, ex, q.period);
  const where = q.periodExplicit ? ` ${q.period.label}` : "";
  if (!rows.length) return { ok: false, route, text: `Não há treino registrado de **${ex.name}**${where}.` };
  const last = rows[rows.length - 1];
  if (q.agg === "tendencia" || q.agg === "comparacao") {
    if (q.agg === "comparacao") {
      const prevRows = exerciseSeries(d, ex, previous(q.period));
      const a = Math.max(...rows.map((r) => r.cmp?.value ?? 0));
      const b = Math.max(0, ...prevRows.map((r) => r.cmp?.value ?? 0));
      if (!b || !a)
        return { ok: false, route, text: `Para comparar, preciso de treino de **${ex.name}** ${q.period.label} e no período anterior.` };
      const pct = Math.round(((a - b) / b) * 100);
      return {
        ok: true,
        route,
        number: pct,
        text: `**${ex.name}**: melhor força estimada ${q.period.label} **${kg(a)}**, contra ${kg(b)} ${previous(q.period).label}: ${pct > 0 ? `**+${pct}%**` : pct < 0 ? `**${pct}%**` : "igual"}.`,
      };
    }
    const vals = rows.filter((r) => r.cmp);
    if (vals.length < 2)
      return {
        ok: false,
        route,
        text: `Só há ${vals.length} treino de **${ex.name}**${where || ` ${q.period.label}`}: preciso de 2 ou mais para ver se subiu.`,
      };
    const a = vals[0].cmp!.value;
    const b = vals[vals.length - 1].cmp!.value;
    const pct = Math.round(((b - a) / a) * 100);
    return {
      ok: true,
      route,
      number: pct,
      text: `${pct > 1 ? "Subiu" : pct < -1 ? "Caiu" : "Ficou estável"}: **${ex.name}** ${q.period.label} foi de ${kg(a)} para **${kg(b)}** de força estimada (${pct > 0 ? "+" : ""}${pct}%, ${vals.length} treinos).`,
      card: cardOf("Telemetria // tendência", `${pct > 0 ? "+" : ""}${pct}%`, [
        { k: "Início", v: kg(a), s: shortDate(vals[0].date) },
        { k: "Agora", v: kg(b), s: shortDate(vals[vals.length - 1].date) },
      ]),
    };
  }
  if (q.metric === "1rm") {
    const withRec = rows.filter((r) => r.rec);
    if (!withRec.length)
      return { ok: false, route, text: `Sem série de **${ex.name}**${where} que dê para estimar o máximo (até 15 repetições).` };
    const pick = q.agg === "ultimo" ? withRec[withRec.length - 1] : withRec.reduce((b, r) => (r.rec!.value > b.rec!.value ? r : b));
    const verb = q.agg === "ultimo" ? "No último treino" : q.agg === "quando" ? "O melhor foi em" : "Melhor";
    return {
      ok: true,
      route,
      number: Math.round(pick.rec!.value * 2) / 2,
      text: `${verb}${q.agg === "quando" ? ` **${shortDate(pick.date)}**:` : ""} **${ex.name}**${where}: máximo estimado de **${kg(pick.rec!.value)}** (série de ${formatWeight(pick.rec!.set.weight!)} ${pick.unit} × ${pick.rec!.set.reps}, ${shortDate(pick.date)}).`,
    };
  }
  if (q.agg === "media") {
    const avg = rows.reduce((s, r) => s + toKg(r.top!.weight!, r.unit), 0) / rows.length;
    return {
      ok: true,
      route,
      number: Math.round(avg * 2) / 2,
      text: `Carga média da série mais pesada de **${ex.name}**${where || ` ${q.period.label}`}: **${kg(avg)}** em ${rows.length} treinos.`,
    };
  }
  if (q.agg === "total") {
    if (q.metric === "series" || q.metric === "volume") {
      const v = q.metric === "series" ? seriesIn(d, q, q.period) : volumeIn(d, q, q.period);
      return {
        ok: true,
        route,
        number: v,
        text:
          q.metric === "series"
            ? `Você fez **${n1(v)} séries** de ${targetLabel(q.target)} ${q.period.label}.`
            : `Você levantou **${kg(v)}** no total em ${targetLabel(q.target)} ${q.period.label}.`,
      };
    }
    return {
      ok: true,
      route,
      number: rows.length,
      text: `${rows.length} ${rows.length === 1 ? "treino" : "treinos"} de **${ex.name}** ${q.period.label}.`,
    };
  }
  if (q.agg === "melhor" || q.agg === "quando") {
    const best =
      q.metric === "reps"
        ? rows.reduce((b, r) => (r.reps > b.reps ? r : b))
        : rows.reduce((b, r) => (toKg(r.top!.weight!, r.unit) > toKg(b.top!.weight!, b.unit) ? r : b));
    if (q.metric === "reps")
      return {
        ok: true,
        route,
        number: best.reps,
        text: `Mais repetições numa série de **${ex.name}**${where}: **${best.reps}** (${shortDate(best.date)}).`,
      };
    return {
      ok: true,
      route,
      number: best.top!.weight!,
      text: `Carga mais pesada em **${ex.name}**${where}: **${formatWeight(best.top!.weight!)} ${best.unit} × ${best.top!.reps}**, em **${shortDate(best.date)}**.`,
    };
  }
  // último
  if (q.metric === "reps")
    return {
      ok: true,
      route,
      number: last.reps,
      text: `No último treino de **${ex.name}** (${shortDate(last.date)}), a melhor série teve **${last.reps} repetições**.`,
    };
  return {
    ok: true,
    route,
    number: last.top!.weight!,
    text: `Último treino de **${ex.name}**${where}: ${shortDate(last.date)}, série mais pesada de **${formatWeight(last.top!.weight!)} ${last.unit} × ${last.top!.reps}**.`,
  };
}

function runRanking(d: AnswerData, q: Query): QueryResult {
  if (q.metric === "series") {
    const by = new Map<MuscleId, number>();
    for (const s of done(d).filter((x) => inPeriod(x, q.period)))
      for (const e of s.exercises) {
        const ex = exOf(e);
        if (!ex) continue;
        for (const m of ex.muscles) by.set(m, (by.get(m) ?? 0) + workSets(e).length);
      }
    const top = [...by.entries()].sort((a, b) => b[1] - a[1]).slice(0, 3);
    if (!top.length) return { ok: false, text: `Não há treino ${q.period.label}.` };
    return {
      ok: true,
      number: top[0][1],
      text: `Músculos com mais séries ${q.period.label}:\n${top.map(([m, n]) => `- ${MUSCLE_LABEL[m]}: ${n}`).join("\n")}`,
      route: "/progresso",
    };
  }
  // Exercícios que mais evoluíram: força estimada do primeiro ao último treino do período.
  const seen = new Map<string, ExerciseRef>();
  for (const s of done(d).filter((x) => inPeriod(x, q.period)))
    for (const e of s.exercises) {
      const ex = exOf(e);
      if (ex && !seen.has(ex.lib)) seen.set(ex.lib, { libId: ex.lib, name: ex.name.replace(/\s*\(.*$/, ""), exId: ex.id });
    }
  const rows = [...seen.values()]
    .map((ex) => {
      const r = exerciseSeries(d, ex, q.period).filter((x) => x.cmp);
      if (r.length < 2) return null;
      return { ex, pct: Math.round(((r[r.length - 1].cmp!.value - r[0].cmp!.value) / r[0].cmp!.value) * 100), n: r.length };
    })
    .filter((x): x is { ex: ExerciseRef; pct: number; n: number } => !!x)
    .sort((a, b) => b.pct - a.pct);
  const down = rows;
  if (!down.length) return { ok: false, text: `Preciso de pelo menos 2 treinos do mesmo exercício ${q.period.label} para comparar.` };
  const top = down.slice(0, 3);
  return {
    ok: true,
    number: top[0].pct,
    route: "/progresso",
    text: `O que mais evoluiu ${q.period.label} (força estimada, do primeiro ao último treino):\n${top.map((r) => `- **${r.ex.name}**: ${r.pct > 0 ? "+" : ""}${r.pct}% (${r.n} treinos)`).join("\n")}`,
  };
}

export function runQuery(q: Query, d: AnswerData): QueryResult {
  if (q.agg === "ranking") return runRanking(d, q);
  if (
    q.target.kind === "exercicio" &&
    (q.metric === "carga" ||
      q.metric === "reps" ||
      q.metric === "1rm" ||
      q.agg === "tendencia" ||
      q.agg === "comparacao" ||
      q.agg === "media" ||
      q.agg === "quando" ||
      q.agg === "melhor" ||
      q.agg === "ultimo" ||
      q.metric === "series" ||
      q.metric === "volume")
  )
    return runExercise(d, q as Query & { target: { kind: "exercicio" } });

  const label = targetLabel(q.target);
  const on = q.target.kind === "tudo" ? "" : q.target.kind === "dia" ? ` de ${q.target.day.name}` : ` de ${label}`;
  switch (q.metric) {
    case "series":
    case "volume": {
      const f = q.metric === "series" ? seriesIn : volumeIn;
      const v = f(d, q, q.period);
      const show = (x: number) => (q.metric === "series" ? `${n1(x)} séries` : kg(x));
      const note = q.metric === "series" && q.target.kind === "musculo" ? " Conta meia série quando ele só ajuda." : "";
      if (q.agg === "comparacao" || q.agg === "tendencia") {
        const prev = previous(q.period);
        const b = f(d, q, prev);
        return {
          ok: true,
          number: v,
          route: "/progresso",
          text: `${q.period.label[0].toUpperCase()}${q.period.label.slice(1)}: **${show(v)}**${on}; ${prev.label}: ${show(b)}.${note}`,
          card: cardOf("Telemetria // comparação", q.metric === "series" ? "SÉRIES" : "VOLUME", [
            { k: "Agora", v: show(v), s: q.period.label },
            { k: "Antes", v: show(b), s: `${shortDate(prev.from)}–${shortDate(prev.to)}` },
          ]),
        };
      }
      if (!v) return { ok: false, route: "/progresso", text: `Nenhuma série${on} registrada ${q.period.label}.` };
      return {
        ok: true,
        number: v,
        route: "/progresso",
        text: `${q.period.label[0].toUpperCase()}${q.period.label.slice(1)} você fez **${show(v)}**${on}.${note}`,
      };
    }
    case "treinos": {
      const list = sessionsOf(d, q);
      if (q.agg === "quando" || q.agg === "ultimo") {
        const last = list[list.length - 1];
        if (!last) return { ok: false, text: `Não achei treino${on} ${q.period.label}.` };
        const ago = daysBetween(last.date, d.today);
        return {
          ok: true,
          number: ago,
          route: "/historico",
          text: `A última vez que você treinou${on} foi **${shortDate(last.date)}** (${ago === 0 ? "hoje" : ago === 1 ? "ontem" : `há ${ago} dias`}), no ${last.day?.name ?? "treino"}.`,
        };
      }
      if (q.agg === "melhor") {
        const best = list.reduce<{ s: Session; v: number } | undefined>((b, s) => {
          const v = s.exercises.reduce((acc, e) => acc + workSets(e).reduce((x, st) => x + toKg(st.weight!, e.unit) * st.reps!, 0), 0);
          return !b || v > b.v ? { s, v } : b;
        }, undefined);
        if (!best) return { ok: false, text: `Não há treino ${q.period.label}.` };
        return {
          ok: true,
          number: Math.round(best.v),
          route: "/historico",
          text: `Seu treino com mais carga levantada ${q.period.label}: **${shortDate(best.s.date)}**, ${best.s.day?.name ?? "treino"}, com **${kg(best.v)}** no total.`,
        };
      }
      if (q.agg === "comparacao" || q.agg === "tendencia") {
        const b = sessionsOf(d, q, previous(q.period)).length;
        return {
          ok: true,
          number: list.length,
          route: "/historico",
          text: `${list.length} ${list.length === 1 ? "treino" : "treinos"}${on} ${q.period.label}, contra ${b} ${previous(q.period).label}.`,
        };
      }
      if (q.agg === "media") {
        const weeks = Math.max(1, (daysBetween(list[0]?.date ?? d.today, d.today) + 1) / 7);
        return {
          ok: true,
          number: Math.round((list.length / weeks) * 10) / 10,
          text: `Em média **${n1(list.length / weeks)} treinos por semana**${on} ${q.period.label}.`,
        };
      }
      return {
        ok: true,
        number: list.length,
        route: "/historico",
        text: `Você fez **${list.length} ${list.length === 1 ? "treino" : "treinos"}**${on} ${q.period.label}.`,
      };
    }
    case "tempo": {
      const list = sessionsOf(d, q).filter((s) => minutesOf(s) > 0);
      if (!list.length) return { ok: false, text: `Não há treino com horário de início e fim ${q.period.label}.` };
      const total = list.reduce((s, x) => s + minutesOf(x), 0);
      if (q.agg === "media" || q.agg === "ultimo") {
        const v = q.agg === "media" ? Math.round(total / list.length) : minutesOf(list[list.length - 1]);
        return {
          ok: true,
          number: v,
          text:
            q.agg === "media"
              ? `Seus treinos${on} duram em média **${fmtMin(v)}** ${q.period.label} (${list.length} treinos).`
              : `O último treino${on} durou **${fmtMin(v)}** (${shortDate(list[list.length - 1].date)}).`,
        };
      }
      return {
        ok: true,
        number: total,
        text: `Você treinou **${fmtMin(total)}**${on} ${q.period.label}, em ${list.length} ${list.length === 1 ? "treino" : "treinos"} (média de ${fmtMin(Math.round(total / list.length))}).`,
        card: cardOf("Telemetria // tempo", "DURAÇÃO", [
          { k: "Total", v: fmtMin(total), s: q.period.label },
          { k: "Por treino", v: fmtMin(Math.round(total / list.length)), s: `${list.length} treinos` },
        ]),
      };
    }
    case "peso-corporal": {
      const log = d.bodyLog.filter((b) => b.weightKg != null && inPeriod(b, q.period)).sort((a, b) => (a.date < b.date ? -1 : 1));
      if (!log.length) return { ok: false, route: "/progresso", text: `Não há peso registrado ${q.period.label}.` };
      if (q.agg === "media") {
        const avg = log.reduce((s, b) => s + b.weightKg!, 0) / log.length;
        return {
          ok: true,
          number: Math.round(avg * 10) / 10,
          route: "/progresso",
          text: `Seu peso médio ${q.period.label}: **${n1(avg)} kg** (${log.length} registros).`,
        };
      }
      if (q.agg === "tendencia" || q.agg === "comparacao") {
        if (log.length < 2) return { ok: false, route: "/progresso", text: `Só há um registro de peso ${q.period.label}.` };
        const diff = log[log.length - 1].weightKg! - log[0].weightKg!;
        return {
          ok: true,
          number: Math.round(diff * 10) / 10,
          route: "/progresso",
          text: `${q.period.label[0].toUpperCase()}${q.period.label.slice(1)} seu peso foi de ${n1(log[0].weightKg!)} para **${n1(log[log.length - 1].weightKg!)} kg** (${diff > 0 ? "+" : ""}${n1(diff)} kg).`,
        };
      }
      const last = log[log.length - 1];
      return {
        ok: true,
        number: last.weightKg,
        route: "/progresso",
        text: `Último peso registrado${q.periodExplicit ? ` ${q.period.label}` : ""}: **${n1(last.weightKg!)} kg** (${shortDate(last.date)}).`,
      };
    }
    default:
      return { ok: false, text: `Para ${label}, pergunte por um exercício: **meu melhor no supino esse mês**.` };
  }
}

// ---------- Caminho único das perguntas sobre dados ----------

/** Estado curto da conversa para a gramática (último eixo usado). */
export interface QueryContext {
  query?: Query;
}

/** Caso antigo que responde a mesma pergunta (os 12 tipos de antes). */
function legacyCase(q: Query, kind: DataKind): boolean {
  if (q.periodExplicit && q.period.key !== "semana" && q.period.key !== "sempre") return false;
  if (q.periodExplicit && q.period.key === "semana" && kind !== "volume" && kind !== "minha-semana") return false;
  switch (kind) {
    case "recorde":
      return q.metric === "1rm" && (q.agg === "melhor" || q.agg === "total") && q.target.kind === "exercicio";
    case "ultima":
      return q.target.kind === "exercicio" && (q.agg === "ultimo" || q.agg === "tendencia") && !q.periodExplicit;
    case "volume":
      return q.metric === "series" && q.target.kind === "musculo" && q.agg === "total" && q.period.key === "semana";
    case "peso":
      return q.metric === "peso-corporal" && (q.agg === "ultimo" || q.agg === "tendencia") && !q.periodExplicit;
    case "sequencia":
      return q.metric === "sequencia" || (q.metric === "treinos" && q.agg === "total" && !q.periodExplicit);
    default:
      return true;
  }
}

export interface DataAnswerOut extends DataReply {
  query?: Query;
}

/**
 * Resposta sobre os dados: a gramática decide os eixos; quando um dos 12 casos antigos cobre os mesmos eixos, a
 * resposta é a dele (mesmo texto e cartão de antes); senão, `runQuery`.
 */
export function queryAnswer(text: string, data: AnswerData, ctx: DataContext & QueryContext = {}): DataAnswerOut | null {
  const legacy = matchData(text, ctx);
  const q = parseQuery(text, data, ctx);
  if (legacy && (!q || legacyCase(q, legacy.kind))) {
    const r = dataAnswer(text, data, ctx);
    return r ? { ...r, query: q ?? undefined } : null;
  }
  if (!q) return null;
  if (q.metric === "sequencia") {
    const r = dataAnswer("minha sequencia", data, ctx);
    return r ? { ...r, query: q } : null;
  }
  const r = runQuery(q, data);
  return {
    kind: "ultima",
    text: r.text,
    route: r.route,
    card: r.card,
    exercise: q.target.kind === "exercicio" ? q.target.ex : undefined,
    muscle: q.target.kind === "musculo" ? q.target.muscle : undefined,
    query: q,
  };
}

/** Palavras que só existem para não confundir o detector com a pergunta de conselho (para os testes). */
export function isAdvice(text: string): boolean {
  return ADVICE.test(clean(text)) || hasAny(norm(text), ["devo fazer"]);
}
