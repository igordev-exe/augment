import { GLOSSARY, type GlossaryTerm } from "../../data/glossary";
import { applyTaste } from "./notes";
import { LIBRARY, LIB_BY_ID, LIB_MUSCLES } from "../../data/library";
import { EQUIP_LABEL, EXT_BY_ID, libraryName } from "../../data/library-extended";
import { MUSCLE_LABEL, programDays, shortName } from "../../data/program";
import { EXERCISE_EVIDENCE, PRINCIPLES, SCIENCE, type EvidenceLevel, type Principle } from "../../data/science";
import type { MuscleId } from "../../data/types";
import { weekFor } from "../mesocycle";
import { formatWeight } from "../progression";
import { plannedVolume } from "../sessions";
import { stem } from "./answers";
import { detectExercise, detectMuscleWord, type AnswerData, type ExerciseRef } from "./data-answers";
import { clean } from "./readers";
import { prepare, templateSet, type FieldReader } from "./templates";

// AUG.CORE — respostas geradas em tempo de execução, a partir dos dados do app (não escritas à mão): o glossário,
// as perguntas por exercício e por músculo (biblioteca, SCIENCE e o programa ativo) e uma resposta por princípio do
// Guia. Cresce com os dados: exercício novo na biblioteca já tem resposta.

export interface GeneratedReply {
  kind: "glossario" | "biblioteca" | "principio";
  id: string;
  text: string;
  level?: EvidenceLevel;
  principle?: string;
  route?: string;
  chips?: string[];
}

// ---------- Glossário ----------

let termIndex: Map<string, GlossaryTerm> | null = null;
function terms(): Map<string, GlossaryTerm> {
  if (termIndex) return termIndex;
  termIndex = new Map();
  for (const g of GLOSSARY) for (const t of g.terms) termIndex.set(clean(t), g);
  return termIndex;
}

function readTerm(raw: string): GlossaryTerm | undefined {
  const t = clean(raw).replace(/^(o|a|os|as|um|uma|esse|essa|isso de|esse tal de|essa tal de|tal de|tal|o tal do|a tal da)\s+/, "");
  return terms().get(t) ?? terms().get(t.replace(/s$/, ""));
}

const GLOSS = templateSet(
  [
    {
      id: "def",
      templates: [
        "[me explica|explica|explique] [o] (que|oq|oque|q) (e|eh|é|significa|quer dizer|seria|sao) [o|a|um|uma|esse|essa] {termo}",
        "{termo} (e|eh|é|significa|quer dizer|seria) [o] (que|oq|oque|q)",
        "(significado|definicao|conceito) de {termo}",
        "(me explica|explica|explique|define|defina) [o|a] {termo}",
        "(que|qual) [e] [a] diferenca de {termo}",
        "[o] {termo} [no app|no aplicativo] (e|eh) [o] (que|oq)",
        "(nao sei|nao entendi) [o] (que|oq) (e|eh) {termo}",
      ],
    },
    { id: "bare", templates: ["{termo}", "[e] [o|a] {termo} [?]"] },
  ],
  {},
);

/** Definição do glossário. `bare`: o texto é só o termo ("rir?"); fica para depois das respostas prontas. */
export function glossaryAnswer(text: string, mode: "def" | "bare"): GeneratedReply | null {
  const m = GLOSS.match(text, { termo: readTerm as FieldReader });
  if (!m || (mode === "def" && m.id !== "def") || (mode === "bare" && m.id !== "bare")) return null;
  const g = m.values.termo as GlossaryTerm;
  return { kind: "glossario", id: g.id, text: `**${g.terms[0]}**: ${g.def}`, level: g.level, principle: g.principle, route: g.route };
}

// ---------- Por exercício e por músculo ----------

const lower = (m: MuscleId) => MUSCLE_LABEL[m].toLowerCase();

function equipOf(ex: ExerciseRef): string | undefined {
  const lib = LIB_BY_ID[ex.libId];
  if (lib) return lib.equipment;
  const e = EXT_BY_ID[ex.libId];
  return e ? (EQUIP_LABEL[e.equip] ?? e.equip) : undefined;
}

function exercisesFor(m: MuscleId): string[] {
  const prog = programDays()
    .flatMap((d) => d.exercises)
    .filter((e) => e.muscles[0] === m)
    .map((e) => shortName(e));
  const lib = LIBRARY.filter((l) => (LIB_MUSCLES[l.id] ?? [])[0] === m).map((l) => l.name);
  return [...new Set([...prog, ...lib])];
}

function frequencyOf(m: MuscleId): { days: string[]; total: number } {
  const days = programDays();
  const hit = days.filter((d) => d.exercises.some((e) => e.muscles.includes(m)));
  return { days: hit.map((d) => d.name), total: days.length };
}

const MUSCLE_RE =
  "(peito|peitoral|costas|dorsal|perna|pernas|quadriceps|coxa|posterior|gluteo|gluteos|biceps|triceps|braco|bracos|ombro|ombros|panturrilha|panturrilhas|abdomen|abdominal|barriga|trapezio|antebraco)";

/** Pergunta por exercício ou músculo, respondida com a biblioteca, SCIENCE e o programa ativo. */
export function libraryAnswer(text: string, d: AnswerData): GeneratedReply | null {
  const t = clean(text)
    .replace(/[^a-z0-9 ]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  const cmp = compareAnswer(t);
  if (cmp) return cmp;
  // Equipamento do exercício.
  if (/\b(qual|que) (equipamento|aparelho|maquina)\b|\b(usa|precisa de) (o )?que\b|\bfaz (com|em) que\b|\bequipamento\b/.test(t)) {
    const ex = detectExercise(t);
    const eq = ex && equipOf(ex);
    if (ex && eq)
      return {
        kind: "biblioteca",
        id: `equip-${ex.libId}`,
        text: `**${libraryName(ex.libId) ?? ex.name}** usa: ${eq.charAt(0).toLowerCase() + eq.slice(1)}.`,
        route: `/exercicios/${ex.libId}`,
      };
  }
  const muscle = detectMuscleWord(t);
  if (!muscle) return null;
  const mw = new RegExp(`\\b${MUSCLE_RE}\\b`).test(t);
  if (!mw) return null;
  // Exercícios para o músculo.
  if (
    /\b(exercicios?|treino|treinos|o que fazer|que fazer|como treinar|como trabalhar|melhores? exercicios?)\b.*\b(pra|para|de|do|da|no|na)\b/.test(
      t,
    ) &&
    !/\b(fiz|treinei|quantas|quantos|quando)\b/.test(t)
  ) {
    const taste = applyTaste(exercisesFor(muscle), d.memory?.notes);
    const list = taste.names.slice(0, 6);
    if (!list.length) return null;
    return {
      kind: "biblioteca",
      id: `exercicios-${muscle}`,
      text: `Exercícios para **${lower(muscle)}** (primeiro os do seu programa):\n${list.map((x) => `- ${x}`).join("\n")}\nNa biblioteca há fotos e o passo a passo de cada um.${taste.changed ? " Levei em conta o que você me contou." : ""}`,
      route: "/exercicios",
    };
  }
  // Quantas séries por semana para o músculo (conselho, não o que a pessoa fez).
  if (
    /\bquantas series\b/.test(t) &&
    /\b(devo|preciso|ideal|por semana|na semana|pra crescer|para crescer|recomend\w*)\b/.test(t) &&
    !/\b(fiz|eu fiz|treinei)\b/.test(t)
  ) {
    const w = weekFor(d.settings.mesoStart, d.today);
    const planned = plannedVolume(w || 2, true, d.settings.setAdjust)[muscle] ?? 0;
    const [lo, hi] = SCIENCE.volume.efficient;
    return {
      kind: "biblioteca",
      id: `series-${muscle}`,
      text: `Para **${lower(muscle)}**, de ${lo} a ${hi} séries difíceis por semana é a faixa eficiente para a maioria; ${SCIENCE.volume.minEffective} já fazem diferença. Seu programa pede **${formatWeight(Math.round(planned * 2) / 2)}** nesta semana (contando meia série quando ele só ajuda).`,
      level: "evidencia",
      principle: "volume-faixa",
      route: "/progresso",
    };
  }
  // Quantas vezes por semana o programa treina o músculo.
  if (
    /\b(quantas vezes|quantos dias|frequencia)\b/.test(t) &&
    /\b(semana|semanal|treino|treina)\b/.test(t) &&
    !/\b(fiz|treinei)\b/.test(t)
  ) {
    const f = frequencyOf(muscle);
    return {
      kind: "biblioteca",
      id: `frequencia-${muscle}`,
      text: f.days.length
        ? `Seu programa treina **${lower(muscle)}** em ${f.days.length} de ${f.total} dias: ${f.days.join(", ")}. Duas vezes por semana costuma ser bom; o total de séries pesa mais que a frequência.`
        : `Nenhum dia do seu programa treina ${lower(muscle)} direto. Duas vezes por semana costuma ser bom.`,
      level: "evidencia",
      principle: "frequencia",
      route: "/programas",
    };
  }
  return null;
}

// ---------- "X ou Y?" (bloco E do chat potente) ----------

/** "Supino ou crucifixo?", "diferença entre leg press e agachamento": os dois lado a lado, com o que a biblioteca sabe. */
function compareAnswer(t: string): GeneratedReply | null {
  // "Começo pelo supino ou pelo crucifixo?" é pergunta de ordem, não de escolha.
  if (/\b(comeco|comecar|primeiro|antes|depois|ordem|juntos|os dois|mesmo dia)\b/.test(t)) return null;
  const m =
    t.match(
      /^(?:qual (?:e )?(?:o )?melhor[, ]+|o que e melhor[, ]+|melhor )?(.+?) (?:ou|vs|versus|x) (.+?)(?: qual (?:e )?(?:o )?melhor| qual e melhor| o que e melhor)?$/,
    ) ?? t.match(/^(?:qual (?:e )?a )?diferenca entre (?:o |a )?(.+?) e (?:o |a )?(.+)$/);
  if (!m) return null;
  const a = detectExercise(m[1]);
  const b = detectExercise(m[2]);
  if (!a || !b || a.libId === b.libId) return null;
  const inProgram = new Set(programDays().flatMap((day) => day.exercises.map((e) => e.lib)));
  const line = (x: ExerciseRef) => {
    const name = libraryName(x.libId) ?? x.name;
    const muscles = (LIB_MUSCLES[x.libId] ?? EXT_BY_ID[x.libId]?.muscles ?? []).map((mu) => MUSCLE_LABEL[mu].toLowerCase());
    const eq = equipOf(x);
    const ev = EXERCISE_EVIDENCE[x.libId];
    return `**${name}**: ${muscles.length ? `trabalha ${muscles.join(", ")}` : "sem músculos cadastrados"}${eq ? `; ${eq.charAt(0).toLowerCase() + eq.slice(1)}` : ""}${ev ? `; ${ev.tag.toLowerCase()}` : ""}${inProgram.has(x.libId) ? " (está no seu programa)" : ""}.`;
  };
  return {
    kind: "biblioteca",
    id: `comparar-${a.libId}-${b.libId}`,
    text: `${line(a)}

${line(b)}

Os dois servem quando trabalham o mesmo músculo: escolha o que você faz com boa técnica e consegue progredir carga. O que já está no programa ganha no empate, porque tem histórico.`,
    level: "consenso",
    principle: "equipamento",
    route: `/exercicios/${a.libId}`,
  };
}

// ---------- Por princípio ----------

function principleWords(p: Principle): string[] {
  return [...p.id.split("-"), ...clean(p.tema).split(" ")].filter((w) => w.length > 3).map(stem);
}

/** "O que a ciência diz sobre {tema}": devolve o princípio do Guia com nível de evidência. */
export function principleAnswer(text: string): GeneratedReply | null {
  const t = prepare(text);
  const m = t.match(
    /^(?:o )?(?:que|oq|q) (?:diz|fala|dizem|falam|mostra) (?:a |o )?(?:ciencia|guia|estudo|estudos|pesquisa|pesquisas|literatura|evidencia) (?:sobre|de|do|da) (.+)$|^(?:principio|evidencia|ciencia|estudos?) (?:sobre|de|do|da) (.+)$/,
  );
  if (!m) return null;
  const topic = new Set(
    clean(m[1] ?? m[2])
      .split(" ")
      .filter((w) => w.length > 3)
      .map(stem),
  );
  let best: { p: Principle; hits: number } | undefined;
  for (const p of PRINCIPLES) {
    const hits = principleWords(p).filter((w) => topic.has(w)).length;
    if (hits && (!best || hits > best.hits)) best = { p, hits };
  }
  if (!best) return null;
  const p = best.p;
  const first = p.texto.split(/(?<=\.)\s/)[0];
  return {
    kind: "principio",
    id: p.id,
    text: `**${p.tema}**: ${first}${p.app ? `\n\nNo app: ${p.app}` : ""}`,
    level: p.nivel,
    principle: p.id,
  };
}

/** Todo princípio tem resposta: pelo glossário, por uma resposta pronta ou por `principleAnswer` (para os testes). */
export function principleQuestion(p: Principle): string {
  return `o que diz a ciencia sobre ${p.id.replace(/-/g, " ")}`;
}
