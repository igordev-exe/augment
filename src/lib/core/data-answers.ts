import { LIBRARY, LIB_BY_ID, LIB_MUSCLES } from "../../data/library";
import { EXTENDED, EXT_BY_ID, libraryMuscles, libraryName } from "../../data/library-extended";
import { dayById, exById, MUSCLE_LABEL, programDays, shortName } from "../../data/program";
import type { BodyEntry, MuscleId, Session, Settings } from "../../data/types";
import { addDays, mondayOf, shortDate, weekdayName } from "../dates";
import { WEEK_RULES, weekFor } from "../mesocycle";
import { rankProgress } from "../profile";
import { entryE1rm, formatWeight, historyOf, recordsOf, summarizeSets, type ExerciseHistoryItem } from "../progression";
import { weeklyReport } from "../report";
import { planAhead } from "../schedule";
import { weeklyVolume } from "../sessions";
import { fatiguePct, goalStatus, hoursToReady, muscleStatus, weekStreaks, weightTrend } from "../visual";
import { stem } from "./answers";
import { detectMuscle, hasAny, norm } from "./intents";
import { activeConstraints, EMPTY_OPERATOR_MEMORY, type EquipmentKind, type OperatorMemory } from "./operator";

// AUG.CORE — respostas montadas com os dados da pessoa (treinador sem chave). Cada uma é um modelo de frase em cima
// das funções que o app já usa nas telas; sem dado suficiente, a resposta diz o que falta, nunca um número inventado.
// 1RM sempre pela régua do projeto (`entryE1rm`/`recordsOf`), nunca `e1rm` direto.

export interface AnswerData {
  sessions: Session[];
  settings: Settings;
  today: string;
  bodyLog: BodyEntry[];
  memory?: OperatorMemory;
  /** Relógio para a recuperação (testes passam um fixo). */
  now?: number;
}

export type DataKind =
  | "recorde"
  | "ultima"
  | "trocar"
  | "como-faz"
  | "trabalha"
  | "proximo"
  | "semana"
  | "pronto"
  | "volume"
  | "peso"
  | "minha-semana"
  | "sequencia";

/** Exercício reconhecido na pergunta: do programa ativo primeiro, depois da biblioteca. */
export interface ExerciseRef {
  libId: string;
  name: string;
  /** Id no programa ativo, quando o exercício está nele. */
  exId?: string;
}

export interface DataReply {
  kind: DataKind;
  text: string;
  route?: string;
  /** Entidade da resposta, para continuações ("e no agachamento?"). */
  exercise?: ExerciseRef;
  muscle?: MuscleId;
}

// ---------- Entidades ----------

const CONNECTORS = new Set("com na no nas nos de do da dos das em ou e a o ao com um uma para pra sem".split(" "));
/** Primeiras palavras que não identificam o movimento ("Barra fixa" fica pelo "fixa"). */
const WEAK_ANCHORS = new Set("barra bom para volta toque mesa caminhada body power push pull dead bent bottoms muscle hang leg".split(" "));

function nameTokens(name: string): string[] {
  return norm(name.replace(/\([^)]*\)/g, " "))
    .split(/[^a-z0-9]+/)
    .filter((w) => w.length > 1 && !CONNECTORS.has(w))
    .map(stem);
}

interface Candidate extends ExerciseRef {
  tokens: string[];
  bonus: number;
}

let catalog: Candidate[] | null = null;
function libraryCandidates(): Candidate[] {
  if (catalog) return catalog;
  const out: Candidate[] = [];
  for (const l of LIBRARY) out.push({ libId: l.id, name: l.name, tokens: nameTokens(l.name), bonus: 0.5 });
  for (const e of EXTENDED) {
    out.push({ libId: e.id, name: e.name, tokens: nameTokens(e.name), bonus: 0 });
    out.push({ libId: e.id, name: e.name, tokens: nameTokens(e.en), bonus: 0 });
  }
  return (catalog = out);
}

function programCandidates(): Candidate[] {
  return programDays().flatMap((d) =>
    d.exercises.flatMap((ex) => [
      { libId: ex.lib, name: shortName(ex), exId: ex.id, tokens: nameTokens(shortName(ex)), bonus: 1.5 },
      ...(LIB_BY_ID[ex.lib]
        ? [{ libId: ex.lib, name: shortName(ex), exId: ex.id, tokens: nameTokens(LIB_BY_ID[ex.lib].name), bonus: 1.5 }]
        : []),
    ]),
  );
}

/**
 * Exercício citado na pergunta. A primeira palavra do nome (o movimento: supino, rosca, remada…) tem de aparecer; as
 * outras desempatam. Programa ativo ganha da biblioteca; nome mais curto ganha no empate ("supino" → o supino mais
 * simples, não a variação mais longa).
 */
export function detectExercise(text: string): ExerciseRef | undefined {
  const q = new Set(
    norm(text)
      .split(/[^a-z0-9]+/)
      .filter((w) => w.length > 1)
      .map(stem),
  );
  let best: { c: Candidate; score: number } | undefined;
  for (const c of [...programCandidates(), ...libraryCandidates()]) {
    if (!c.tokens.length) continue;
    const anchorAt = WEAK_ANCHORS.has(c.tokens[0]) && c.tokens.length > 1 ? 1 : 0;
    const others = c.tokens.filter((t, i) => i !== anchorAt && q.has(t)).length;
    // Sem o movimento, só vale com 2+ palavras do nome ("terra romeno" → "Levantamento terra romeno").
    if (!q.has(c.tokens[anchorAt]) && others < 2) continue;
    const score = (q.has(c.tokens[anchorAt]) ? 2 : 1) + others + c.bonus - c.tokens.length * 0.1;
    if (!best || score > best.score) best = { c, score };
  }
  if (!best) return undefined;
  const { libId, name, exId } = best.c;
  return { libId, name: exId ? name : (libraryName(libId) ?? name), exId };
}

const EXTRA_MUSCLES: { muscle: MuscleId; words: string[] }[] = [
  { muscle: "quadriceps", words: ["perna", "pernas"] },
  { muscle: "abdomen", words: ["abdomen", "abdominal", "barriga", "abs", "core"] },
  { muscle: "trapezio", words: ["trapezio"] },
  { muscle: "antebraco", words: ["antebraco", "antebracos"] },
  { muscle: "biceps", words: ["braco", "bracos"] },
];

export function detectMuscleWord(text: string): MuscleId | undefined {
  const t = norm(text);
  // Antebraço antes do detector das intenções (lá, "antebraço" é queixa de cotovelo e vira bíceps).
  for (const m of EXTRA_MUSCLES) if (hasAny(t, m.words)) return m.muscle;
  return detectMuscle(t);
}

// ---------- Que pergunta é ----------

const PATTERNS: { kind: DataKind; re: RegExp; needs?: "exercise" | "muscle" }[] = [
  { kind: "trocar", re: /\b(troco|trocar|troca|substitu\w*|alternativa\w*|no lugar d[oa]|em vez d[oa]|parecido com)\b/, needs: "exercise" },
  {
    kind: "como-faz",
    re: /\b(como (se )?(faz|faco|fazer|executa|executar|e feito)|execucao|executar|postura|tecnica|passo a passo)\b/,
    needs: "exercise",
  },
  { kind: "trabalha", re: /\b(trabalha|trabalham|que musculo|quais musculos|ativa|pega mais|serve pra|serve para)\b/, needs: "exercise" },
  {
    kind: "recorde",
    re: /\b(recorde|recordes|1rm|rm|pr|prs|melhor marca|meu maximo|minha maxima|carga maxima|mais pesado|quanto (eu )?(pego|levanto|aguento|empurro|puxo))\b/,
  },
  {
    kind: "ultima",
    re: /\b(ultima vez|ultimo treino|ultimos treinos|evolucao|evolui|evoluindo|historico|progresso|como (ta|esta|anda))\b/,
    needs: "exercise",
  },
  {
    kind: "semana",
    re: /\b(em que semana|qual semana|que semana (eu )?(to|estou)|semana do (ciclo|meso|mesociclo)|semana atual|qual fase)\b/,
  },
  {
    kind: "minha-semana",
    re: /\b(minha semana|semana passada|resumo da semana|relatorio|como (foi|ta|esta|vai) (a |minha )?semana|como fui)\b/,
  },
  {
    kind: "proximo",
    re: /\b(proximo treino|proximos treinos|proximo dia|treino de (hoje|amanha)|qual (o )?treino|que treino|o que (eu )?treino|quando (eu )?treino|quando (e|eh) (o )?(treino|dia))\b/,
  },
  { kind: "pronto", re: /\b(recuperad\w*|pronto|pronta|descansad\w*|fadiga|cansad\w*|posso treinar .*(hoje|agora|ja))\b/, needs: "muscle" },
  {
    kind: "volume",
    re: /\b(quantas series|series de|volume)\b.*\b(fiz|eu|essa semana|esta semana|nessa semana|ja)\b|\b(fiz|eu|ja) .*\bseries\b/,
    needs: "muscle",
  },
  {
    kind: "peso",
    re: /\b(meu peso|peso atual|quanto (eu )?peso|(to|estou) (emagrecendo|engordando|perdendo|ganhando)|minha meta|meta de peso|tendencia do peso|minha balanca)\b/,
  },
  {
    kind: "sequencia",
    re: /\b(sequencia|streak|semanas seguidas|posto|patente|rank|ranking|meu nivel|quantos treinos (eu )?(fiz|tenho|ja))\b/,
  },
];

export interface DataContext {
  lastKind?: DataKind;
  exercise?: ExerciseRef;
  muscle?: MuscleId;
}

/** Decide se a pergunta é sobre os dados da pessoa. Continuação curta ("e no agachamento?") herda o tipo anterior. */
export function matchData(text: string, ctx: DataContext = {}): { kind: DataKind; exercise?: ExerciseRef; muscle?: MuscleId } | null {
  const t = norm(text).replace(/[^a-z0-9\s]/g, " ");
  const exercise = detectExercise(t);
  const muscle = detectMuscleWord(t);
  for (const p of PATTERNS) {
    if (!p.re.test(t)) continue;
    if (p.needs === "exercise" && !exercise) continue;
    if (p.needs === "muscle" && !muscle) continue;
    return { kind: p.kind, exercise, muscle };
  }
  const words = t.split(/\s+/).filter(Boolean);
  const continuation = ctx.lastKind && words.length <= 5 && (/^(e|e no|e na|e o|e a)\b/.test(t) || words.length <= 3);
  if (continuation && ctx.lastKind) {
    const needsEx = ["recorde", "ultima", "trocar", "como-faz", "trabalha"].includes(ctx.lastKind);
    const needsMuscle = ["pronto", "volume"].includes(ctx.lastKind);
    if (needsEx && exercise) return { kind: ctx.lastKind, exercise, muscle };
    if (needsMuscle && muscle) return { kind: ctx.lastKind, exercise, muscle };
  }
  return null;
}

// ---------- Respostas ----------

const done = (d: AnswerData) => d.sessions.filter((s) => s.status === "done" && s.date <= d.today);
const kg = (v: number) => `${formatWeight(Math.round(v * 2) / 2)} kg`;

function historyFor(d: AnswerData, ex: ExerciseRef): ExerciseHistoryItem[] {
  if (ex.exId) {
    const own = historyOf(done(d), ex.exId, d.settings.swaps?.[ex.exId] || undefined);
    if (own.length) return own;
  }
  return historyOf(done(d), "__sem-id__", undefined, ex.libId);
}

function exerciseRoute(ex: ExerciseRef) {
  return `/exercicios/${ex.libId}`;
}

function recordeReply(d: AnswerData, ex?: ExerciseRef): DataReply {
  if (!ex) {
    return {
      kind: "recorde",
      text: 'De qual exercício? Pergunte, por exemplo, **"recorde no supino"**. A lista com todos os seus recordes está em Progresso.',
      route: "/progresso",
    };
  }
  const rec = recordsOf(historyFor(d, ex));
  if (!rec.sessions || !rec.bestE1rm) {
    return {
      kind: "recorde",
      exercise: ex,
      route: exerciseRoute(ex),
      text: `Ainda não tenho treino registrado de **${ex.name}**${rec.sessions ? " com séries que deem para estimar o máximo (até 15 repetições)" : ""}. Depois do primeiro, o recorde aparece aqui e na página do exercício.`,
    };
  }
  const b = rec.bestE1rm;
  const lines = [
    `**${ex.name}**: seu máximo estimado para 1 repetição é **${kg(b.value)}**, calculado da série de ${formatWeight(b.weight)} ${b.unit} × ${b.reps} em ${shortDate(b.date)}.`,
  ];
  const h = rec.heaviest;
  if (h && (h.weight !== b.weight || h.reps !== b.reps)) {
    lines.push(`A carga mais pesada que você já usou foi ${formatWeight(h.weight)} ${h.unit} × ${h.reps} (${shortDate(h.date)}).`);
  }
  lines.push(`São ${rec.sessions} ${rec.sessions === 1 ? "treino registrado" : "treinos registrados"} nesse exercício.`);
  return { kind: "recorde", exercise: ex, route: exerciseRoute(ex), text: lines.join(" ") };
}

function ultimaReply(d: AnswerData, ex: ExerciseRef): DataReply {
  const h = historyFor(d, ex);
  if (!h.length) {
    return { kind: "ultima", exercise: ex, route: exerciseRoute(ex), text: `Ainda não há treino registrado de **${ex.name}**.` };
  }
  const last = h.slice(-3).reverse();
  const lines = [
    `**${ex.name}**, últimos treinos:`,
    ...last.map(({ session, entry }) => `- ${shortDate(session.date)}: ${summarizeSets(entry)} ${entry.unit}`),
  ];
  const window = h.slice(-8);
  const first = entryE1rm(window[0].entry, "comparacao");
  const lastE = entryE1rm(window[window.length - 1].entry, "comparacao");
  if (window.length >= 3 && first && lastE) {
    const pct = Math.round(((lastE.value - first.value) / first.value) * 100);
    const since = shortDate(window[0].session.date);
    lines.push(
      pct > 1
        ? `Desde ${since}, sua força nesse exercício subiu cerca de **${pct}%**.`
        : pct < -1
          ? `Desde ${since}, a força caiu cerca de ${Math.abs(pct)}%. Sono, dieta e descanso entre séries são os primeiros suspeitos.`
          : `Desde ${since}, a força está estável. Se continuar assim por mais 3 treinos, o app sugere um ajuste.`,
    );
  }
  return { kind: "ultima", exercise: ex, route: exerciseRoute(ex), text: lines.join("\n") };
}

function equipKind(libId: string): EquipmentKind | undefined {
  const ext = EXT_BY_ID[libId];
  const raw = norm(ext?.equip ?? LIB_BY_ID[libId]?.equipment ?? "");
  if (raw.includes("halter")) return "halteres";
  if (raw.includes("corporal") || raw.includes("peso do corpo")) return "peso-corporal";
  if (raw.includes("cabo") || raw.includes("polia") || raw.includes("crossover")) return "cabo";
  if (raw.includes("maquina") || raw.includes("smith") || raw.includes("leg press")) return "maquina";
  if (raw.includes("barra")) return "barra";
  return undefined;
}

function trocarReply(d: AnswerData, ex: ExerciseRef): DataReply {
  const allowed = activeConstraints(d.memory ?? EMPTY_OPERATOR_MEMORY, d.today).flatMap((c) => (c.kind === "equipment" ? c.allowed : []));
  const curated = LIB_BY_ID[ex.libId]?.alternatives ?? [];
  let options: string[] = curated.slice(0, 3);
  if (!options.length || allowed.length) {
    const muscles = libraryMuscles(ex.libId);
    const compound = EXT_BY_ID[ex.libId]?.compound;
    const pool = [
      ...LIBRARY.filter((l) => l.id !== ex.libId && (LIB_MUSCLES[l.id] ?? [])[0] === muscles[0]).map((l) => ({
        id: l.id,
        name: l.name,
        compound: undefined,
      })),
      ...EXTENDED.filter((e) => e.id !== ex.libId && e.muscles[0] === muscles[0] && e.level !== "expert").map((e) => ({
        id: e.id,
        name: e.name,
        compound: e.compound,
      })),
    ].filter((o) => !allowed.length || allowed.includes(equipKind(o.id) as EquipmentKind));
    const sameKind = pool.filter((o) => compound == null || o.compound == null || o.compound === compound);
    const seen = new Set<string>();
    options = [...sameKind, ...pool]
      .filter((o) => {
        const k = equipKind(o.id) ?? o.id;
        if (seen.has(k)) return false; // um de cada equipamento, para dar escolha de verdade
        seen.add(k);
        return true;
      })
      .slice(0, 3)
      .map((o) => o.name);
  }
  if (!options.length) {
    return {
      kind: "trocar",
      exercise: ex,
      route: "/exercicios",
      text: `Não achei uma troca boa para **${ex.name}** na biblioteca. Procure pelo músculo em Exercícios.`,
    };
  }
  const muscle = libraryMuscles(ex.libId)[0];
  return {
    kind: "trocar",
    exercise: ex,
    route: exerciseRoute(ex),
    text: [
      `Trocas para **${ex.name}**${muscle ? `, que trabalham o mesmo músculo (${MUSCLE_LABEL[muscle].toLowerCase()})` : ""}${allowed.length ? ` com o equipamento que você tem (${allowed.join(", ")})` : ""}:`,
      ...options.map((o) => `- ${o}`),
      "Trocar só hoje: no treino, toque no exercício e escolha a alternativa. Trocar de vez: em Programas.",
    ].join("\n"),
  };
}

function comoFazReply(ex: ExerciseRef): DataReply {
  const lib = LIB_BY_ID[ex.libId];
  if (lib) {
    const lines = [`**${lib.name}**`, ...lib.execution.slice(0, 4).map((s) => `- ${s}`)];
    if (lib.errors[0]) lines.push(`Erro comum: ${lib.errors[0]}`);
    lines.push("Fotos e vídeo na página do exercício.");
    return { kind: "como-faz", exercise: ex, route: exerciseRoute(ex), text: lines.join("\n") };
  }
  const ext = EXT_BY_ID[ex.libId];
  const muscles = (ext?.muscles ?? []).map((m) => MUSCLE_LABEL[m].toLowerCase());
  return {
    kind: "como-faz",
    exercise: ex,
    route: exerciseRoute(ex),
    text: `**${ex.name}**${muscles.length ? ` trabalha ${muscles.join(" e ")}` : ""}. O passo a passo com fotos está na página do exercício. Comece leve, com 1 ou 2 séries de aquecimento, até o movimento ficar firme.`,
  };
}

function trabalhaReply(ex: ExerciseRef): DataReply {
  const main = libraryMuscles(ex.libId).map((m) => MUSCLE_LABEL[m].toLowerCase());
  const lib = LIB_BY_ID[ex.libId];
  const ext = EXT_BY_ID[ex.libId];
  const extra =
    (lib?.secondary ? lib.secondary.charAt(0).toLowerCase() + lib.secondary.slice(1) : undefined) ??
    (ext?.synergists.length ? ext.synergists.map((m) => MUSCLE_LABEL[m].toLowerCase()).join(", ") : "");
  return {
    kind: "trabalha",
    exercise: ex,
    route: exerciseRoute(ex),
    text: main.length
      ? `**${ex.name}** trabalha principalmente ${main.join(" e ")}${extra ? `; ajuda também: ${extra}` : ""}.`
      : `Não tenho os músculos de **${ex.name}** cadastrados. Veja a página do exercício.`,
  };
}

function proximoReply(d: AnswerData, muscle?: MuscleId): DataReply {
  const ahead = planAhead(d.sessions, d.today, 14, d.settings.trainingDays);
  if (!ahead.length) {
    return { kind: "proximo", route: "/ajustes", text: "Não há dias de treino marcados. Escolha os dias em Ajustes e eu monto a agenda." };
  }
  const when = (date: string) =>
    date === d.today ? "hoje" : date === addDays(d.today, 1) ? "amanhã" : `${weekdayName(date).toLowerCase()} (${shortDate(date)})`;
  if (muscle) {
    const hit = ahead.find((p) => dayById(p.dayId).exercises.some((e) => e.muscles.includes(muscle)));
    return {
      kind: "proximo",
      muscle,
      route: "/",
      text: hit
        ? `Você treina **${MUSCLE_LABEL[muscle].toLowerCase()}** de novo **${when(hit.date)}**, no ${dayById(hit.dayId).name}.`
        : `Nenhum dia do seu programa treina ${MUSCLE_LABEL[muscle].toLowerCase()} direto nas próximas 2 semanas.`,
    };
  }
  const lines = ahead.slice(0, 3).map((p) => `- **${when(p.date)}:** ${dayById(p.dayId).name}`);
  return { kind: "proximo", route: "/", text: ["Seus próximos treinos:", ...lines].join("\n") };
}

function semanaReply(d: AnswerData): DataReply {
  const w = weekFor(d.settings.mesoStart, d.today);
  const r = WEEK_RULES[w];
  if (w === 0) return { kind: "semana", route: "/", text: `Seu programa é fixo: ${r.summary}` };
  const next = w < 7 ? WEEK_RULES[w + 1] : WEEK_RULES[1];
  return {
    kind: "semana",
    route: "/relatorio",
    text: [
      `Você está na **semana ${w} de 7** (${r.label}). ${r.summary}`,
      `- **Compostos:** ${r.compounds}`,
      `- **Isolados:** ${r.isolations}`,
      w < 7 ? `Semana que vem: ${next.label}.` : "Depois desta, começa um ciclo novo na semana 1.",
    ].join("\n"),
  };
}

function prontoReply(d: AnswerData, muscle: MuscleId): DataReply {
  const w = weekFor(d.settings.mesoStart, d.today);
  const st = muscleStatus(d.sessions, w, d.today, d.now ?? Date.now(), d.settings.setAdjust)[muscle];
  const label = MUSCLE_LABEL[muscle].toLowerCase();
  if (!st?.lastDate) {
    return { kind: "pronto", muscle, route: "/progresso", text: `Não há treino recente de **${label}**: está descansado e pronto.` };
  }
  const pct = fatiguePct(st);
  const hours = hoursToReady(st);
  const lastLine = `Último treino em ${shortDate(st.lastDate)}, com ${st.lastSets} ${st.lastSets === 1 ? "série" : "séries"}.`;
  const text =
    pct <= 20
      ? `**${MUSCLE_LABEL[muscle]}** está pronto para treinar (${100 - pct}% recuperado). ${lastLine}`
      : pct <= 50
        ? `**${MUSCLE_LABEL[muscle]}** está quase lá (${100 - pct}% recuperado). Dá para treinar, talvez com 1 ou 2 repetições a menos. ${lastLine}`
        : `**${MUSCLE_LABEL[muscle]}** ainda está se recuperando (${100 - pct}%). Faltam cerca de ${hours} h. Se puder, treine outro músculo hoje. ${lastLine}`;
  return { kind: "pronto", muscle, route: "/progresso", text };
}

function volumeReply(d: AnswerData, muscle: MuscleId): DataReply {
  const vol = weeklyVolume(done(d), d.today, true)[muscle] ?? 0;
  const w = weekFor(d.settings.mesoStart, d.today);
  const st = muscleStatus(d.sessions, w, d.today, d.now ?? Date.now(), d.settings.setAdjust)[muscle];
  const n = Math.round(vol * 2) / 2;
  const target = st?.target ? ` A ficha pede cerca de ${st.target} nesta semana.` : "";
  return {
    kind: "volume",
    muscle,
    route: "/progresso",
    text: `Nesta semana (desde ${shortDate(mondayOf(d.today))}) você fez **${formatWeight(n)} séries** de ${MUSCLE_LABEL[muscle].toLowerCase()}, contando meia série para quando ele só ajuda.${target}`,
  };
}

function pesoReply(d: AnswerData): DataReply {
  const trend = weightTrend(d.bodyLog);
  if (!trend) {
    return {
      kind: "peso",
      route: "/progresso",
      text: "Ainda não há peso registrado. Anote o peso em Progresso, algumas vezes por semana, e eu mostro a tendência.",
    };
  }
  const dir = Math.abs(trend.kgPerWeek) < 0.1 ? "estável" : trend.kgPerWeek > 0 ? "subindo" : "caindo";
  const lines = [
    `Seu peso está em **${formatWeight(trend.current)} kg** (${shortDate(trend.currentDate)}) e ${dir === "estável" ? "está **estável**" : `vem **${dir}** cerca de ${formatWeight(Math.abs(Math.round(trend.kgPerWeek * 10) / 10))} kg por semana`}.`,
  ];
  if (trend.spanDays < 14) lines.push("Ainda são poucos dias de registro: a tendência fica confiável depois de umas 2 semanas.");
  const goal = goalStatus(trend, d.settings.bodyGoal);
  if (goal) {
    if (goal.reached) lines.push("Você chegou na meta de peso.");
    else if (goal.pace === "no-ritmo")
      lines.push(`Está no ritmo da sua meta${goal.etaWeeks ? `, umas ${goal.etaWeeks} semanas para chegar` : ""}.`);
    else if (goal.pace === "rapido") lines.push("Está indo mais rápido que o ritmo da meta.");
    else if (goal.pace === "devagar") lines.push("Está mais devagar que o ritmo da meta.");
    else if (goal.pace === "contrario") lines.push("O peso está indo para o lado contrário da meta.");
  }
  return { kind: "peso", route: "/progresso", text: lines.join(" ") };
}

function minhaSemanaReply(d: AnswerData, text: string): DataReply {
  const last = /passad/.test(norm(text));
  const start = last ? addDays(mondayOf(d.today), -7) : mondayOf(d.today);
  const r = weeklyReport(d.sessions, start, d.settings.mesoStart, d.settings.trainingDays, d.today, d.settings.setAdjust);
  const label = last ? "Semana passada" : "Nesta semana";
  if (!r.done) {
    return {
      kind: "minha-semana",
      route: `/relatorio`,
      text: `${label} não há treino registrado ainda${last ? "" : `. Eram ${r.planned} planejados`}.`,
    };
  }
  const lines = [`${label}: **${r.done} de ${r.planned} treinos** feitos.`];
  if (r.prs.length)
    lines.push(
      `- **${r.prs.length} ${r.prs.length === 1 ? "recorde" : "recordes"}**: ${r.prs
        .slice(0, 3)
        .map((p) => p.text)
        .join("; ")}.`,
    );
  if (r.stalls.length)
    lines.push(
      `- **Travados:** ${r.stalls
        .map((s) => shortName(exById(s.exId)))
        .filter(Boolean)
        .slice(0, 3)
        .join(", ")}.`,
    );
  if (r.belowMinimum.length) lines.push(`- **Pouco volume:** ${r.belowMinimum.map((m) => MUSCLE_LABEL[m].toLowerCase()).join(", ")}.`);
  if (r.rir.logged) lines.push(`- Esforço na meta em ${r.rir.inTarget} de ${r.rir.logged} exercícios.`);
  lines.push("O relatório completo está em Relatório.");
  return { kind: "minha-semana", route: `/relatorio`, text: lines.join("\n") };
}

function sequenciaReply(d: AnswerData): DataReply {
  const finished = done(d);
  const target = Math.max(1, d.settings.trainingDays.length);
  const { streak, longest } = weekStreaks(finished, d.today, target, d.memory?.absences ?? []);
  const rank = rankProgress(finished.length);
  const lines = [
    `Você tem **${finished.length} ${finished.length === 1 ? "treino" : "treinos"}** registrados e está no posto **${rank.rank}**${rank.next ? `; faltam ${rank.need} para ${rank.next}` : ""}.`,
    streak
      ? `Sequência atual: **${streak} ${streak === 1 ? "semana" : "semanas"}** cumprindo a meta de ${target} treinos (recorde: ${longest}).`
      : `A sequência de semanas está zerada${longest ? ` (seu recorde é ${longest})` : ""}: feche ${target} treinos nesta semana para começar.`,
  ];
  return { kind: "sequencia", route: "/progresso", text: lines.join(" ") };
}

/** Responde uma pergunta sobre os dados da pessoa, ou null se ela não for desse tipo. */
export function dataAnswer(text: string, data: AnswerData, ctx: DataContext = {}): DataReply | null {
  const m = matchData(text, ctx);
  if (!m) return null;
  const { kind, exercise, muscle } = m;
  switch (kind) {
    case "recorde":
      return recordeReply(data, exercise);
    case "ultima":
      return ultimaReply(data, exercise!);
    case "trocar":
      return trocarReply(data, exercise!);
    case "como-faz":
      return comoFazReply(exercise!);
    case "trabalha":
      return trabalhaReply(exercise!);
    case "proximo":
      return proximoReply(data, muscle);
    case "semana":
      return semanaReply(data);
    case "pronto":
      return prontoReply(data, muscle!);
    case "volume":
      return volumeReply(data, muscle!);
    case "peso":
      return pesoReply(data);
    case "minha-semana":
      return minhaSemanaReply(data, text);
    case "sequencia":
      return sequenciaReply(data);
  }
}

/** Peso mais recente da pessoa, se houver. */
export function latestWeight(bodyLog: BodyEntry[]): number | null {
  return weightTrend(bodyLog)?.current ?? null;
}
