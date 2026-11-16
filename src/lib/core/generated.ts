import { GLOSSARY, type GlossaryTerm } from "../../data/glossary";
import { applyTaste } from "./notes";
import { LIBRARY, LIB_BY_ID, LIB_MUSCLES } from "../../data/library";
import { EXTENDED, EQUIP_LABEL, EXT_BY_ID, libraryName } from "../../data/library-extended";
import { MUSCLE_LABEL, programDays, shortName } from "../../data/program";
import { AUDITS, EXERCISE_EVIDENCE, PRINCIPLES, SCIENCE, SYNERGISTS, type EvidenceLevel, type Principle } from "../../data/science";
import { TEMPLATES, type TemplateInfo } from "../../data/templates";
import type { MuscleId, ProgramExercise } from "../../data/types";
import { weekFor } from "../mesocycle";
import { formatWeight } from "../progression";
import { plannedVolume } from "../sessions";
import { stem } from "./answers";
import { detectExercise, detectMuscleWord, type AnswerData, type ExerciseRef } from "./data-answers";
import { clean } from "./readers";
import { prepare, templateSet, type FieldReader } from "./templates";

// AUG.CORE — respostas geradas em tempo de execução, a partir dos dados do app (não escritas à mão): o glossário,
// as perguntas por exercício e por músculo (biblioteca, modelos, SCIENCE e o programa ativo) e uma resposta por
// princípio e auditoria do Guia. Cresce com os dados: exercício novo na biblioteca já tem resposta.

export interface GeneratedReply {
  kind: "glossario" | "biblioteca" | "principio";
  id: string;
  text: string;
  level?: EvidenceLevel;
  principle?: string;
  route?: string;
  chips?: string[];
  exercise?: ExerciseRef;
  muscle?: MuscleId;
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

// ---------- Por exercício, músculo e modelos ----------

const lower = (m: MuscleId) => MUSCLE_LABEL[m].toLowerCase();

const COMPOUND_CURATED = new Set([
  "supino-inclinado-halteres",
  "supino-reto-maquina",
  "supino-inclinado-smith",
  "desenvolvimento-maquina",
  "desenvolvimento-halteres",
  "puxada-aberta",
  "puxada-unilateral",
  "remada-apoio-peito",
  "remada-baixa-neutra",
  "hack",
  "leg-press-profundo",
  "terra-romeno",
  "elevacao-pelvica",
  "bulgaro-leg-press-alto",
]);

function isCompound(libId: string): boolean {
  if (EXT_BY_ID[libId]) return EXT_BY_ID[libId].compound;
  if (COMPOUND_CURATED.has(libId)) return true;
  if ((SYNERGISTS[libId]?.length ?? 0) > 0) return true;
  return programExerciseOf(libId)?.compound ?? false;
}

function programExerciseOf(libId: string): ProgramExercise | undefined {
  for (const day of programDays()) {
    const found = day.exercises.find((e) => e.lib === libId);
    if (found) return found;
  }
  return undefined;
}

function equipOf(ex: ExerciseRef): string | undefined {
  const lib = LIB_BY_ID[ex.libId];
  if (lib) return lib.equipment;
  const e = EXT_BY_ID[ex.libId];
  return e ? (EQUIP_LABEL[e.equip] ?? e.equip) : undefined;
}

type EquipFilter = "halteres" | "barra" | "polia" | "maquina" | "corporal" | "elastico" | "kettlebell";

function detectEquipFilter(t: string): { key: EquipFilter; label: string } | undefined {
  if (/\b(halter|halteres|dumbbell)\b/.test(t)) return { key: "halteres", label: "halteres" };
  if (/\b(barra|barras)\b/.test(t) && !/\bbarra fixa\b/.test(t)) return { key: "barra", label: "barra" };
  if (/\b(polia|cabo|cabos|crossover|pulley)\b/.test(t)) return { key: "polia", label: "polia/cabo" };
  if (/\b(maquina|maquinas|aparelho|aparelhos)\b/.test(t)) return { key: "maquina", label: "máquina" };
  if (/\b(em casa|peso do corpo|peso corporal|calistenia|sem equipamento|sem aparelho|sem peso)\b/.test(t))
    return { key: "corporal", label: "peso corporal" };
  if (/\b(elastico|elasticos|faixa|band)\b/.test(t)) return { key: "elastico", label: "elástico" };
  if (/\b(kettlebell|kettlebells)\b/.test(t)) return { key: "kettlebell", label: "kettlebell" };
  return undefined;
}

function curatedMatchesEquip(rawEquip: string, filter: EquipFilter): boolean {
  const e = clean(rawEquip);
  switch (filter) {
    case "halteres":
      return /\bhalter/.test(e);
    case "barra":
      return /\bbarra\b|\bt-bar\b/.test(e);
    case "polia":
      return /polia|cabo|crossover|pulley|triangulo/.test(e);
    case "maquina":
      return /maquina|smith|hack|leg press|cadeira|peck deck|hip thrust|hammer|scott/.test(e);
    case "corporal":
    case "elastico":
    case "kettlebell":
      return false;
  }
}

function extMatchesEquip(equip: string, filter: EquipFilter): boolean {
  if (filter === "barra") return equip === "barra" || equip === "barra-w";
  return equip === filter;
}

function expandedMusclesForQuery(t: string, muscle: MuscleId): MuscleId[] {
  if (/\b(perna|pernas)\b/.test(t)) return ["quadriceps", "posterior", "gluteo"];
  if (/\b(ombro|ombros)\b/.test(t)) return ["deltAnterior", "deltLateral", "deltPosterior"];
  if (/\b(braco|bracos)\b/.test(t)) return ["biceps", "triceps", "antebraco"];
  return [muscle];
}

function exercisesFor(muscles: MuscleId[], equip?: EquipFilter, kind?: "composto" | "isolado"): string[] {
  const mSet = new Set(muscles);
  const prog =
    equip || kind
      ? []
      : programDays()
          .flatMap((d) => d.exercises)
          .filter((e) => mSet.has(e.muscles[0]))
          .map((e) => shortName(e));
  const lib = LIBRARY.filter((l) => {
    const lm = LIB_MUSCLES[l.id] ?? [];
    if (!lm.some((m) => mSet.has(m))) return false;
    if (equip && !curatedMatchesEquip(l.equipment, equip)) return false;
    if (kind === "composto" && !isCompound(l.id)) return false;
    if (kind === "isolado" && isCompound(l.id)) return false;
    return true;
  }).map((l) => l.name);
  const ext = EXTENDED.filter((e) => {
    if (e.level === "expert") return false;
    if (!e.muscles.some((m) => mSet.has(m))) return false;
    if (equip && !extMatchesEquip(e.equip, equip)) return false;
    if (kind === "composto" && !e.compound) return false;
    if (kind === "isolado" && e.compound) return false;
    return true;
  }).map((e) => e.name);
  // Sem filtros específicos, prioriza programa e biblioteca curada antes dos exercícios extras.
  return [...new Set([...prog, ...lib, ...ext])];
}

function frequencyOf(m: MuscleId): { days: string[]; total: number } {
  const days = programDays();
  const hit = days.filter((d) => d.exercises.some((e) => e.muscles.includes(m)));
  return { days: hit.map((d) => d.name), total: days.length };
}

const MUSCLE_RE =
  "(peito|peitoral|costas|dorsal|perna|pernas|quadriceps|coxa|posterior|gluteo|gluteos|biceps|triceps|braco|bracos|ombro|ombros|panturrilha|panturrilhas|abdomen|abdominal|barriga|trapezio|antebraco)";

const PERSONAL_HISTORY_RE =
  /\b(meu|minha|meus|minhas|eu|fiz|peguei|levantei|treinei|malhei|recorde|recordes|1rm|rm|pr|prs|ontem|hoje|semana passada|este mes|esse mes|mes passado|nesse ciclo|no ciclo|ultimos|ultima|ultimo|evolucao|evoluiu|historico|progresso|melhor|maior|maximo|maxima|media|subiu|caiu)\b|\bem (janeiro|fevereiro|marco|abril|maio|junho|julho|agosto|setembro|outubro|novembro|dezembro)\b/;

/** Pergunta sobre algum modelo pronto de programa do app. */
function templateAnswer(t: string): GeneratedReply | null {
  if (
    /\b(quais (?:sao )?(?:os )?(?:modelos|programas|fichas)(?: pront[oa]s?)?(?: d[oa] app| no app| disponiveis| que existem)?)\b/.test(t) &&
    !/\b(full ?body|upper ?lower|superior ?e? ?inferior|ppl|push ?pull ?legs)\b/.test(t)
  ) {
    const lines = TEMPLATES.map((x) => `- **${x.name}** (${x.level}): ${x.pitch}`);
    return {
      kind: "biblioteca",
      id: "modelos-lista",
      text: `Modelos prontos do app (mesmo volume-alvo, mude pela agenda ou objetivo):\n${lines.join("\n")}\nVeja e copie qualquer um em Programas.`,
      level: "evidencia",
      principle: "divisao",
      route: "/programas",
    };
  }
  const structureCue =
    /\b(quais (?:os )?exercicios|como (?:e|eh|funciona|e montado|e dividido)|mostra|detalhes|dias d[ao]|estrutura d[ao]|o que tem n[ao]|ficha d[ao]|modelo|programa)\b/.test(
      t,
    );
  if (!structureCue || /\b(ou|vs|versus|melhor divisao|qual divisao|programa fixo|trocar|apagar)\b/.test(t)) return null;
  const wantsGlute = /\b(gluteo|gluteos|perna|pernas|bumbum)\b/.test(t);
  const wantsStrength = /\bforca\b/.test(t);
  let id: string | undefined;
  if (/\bfull ?body\b|\bfb ?3\b|\bcorpo inteiro\b/.test(t)) id = wantsGlute ? "fb-3-gluteo" : "fb-3";
  else if (/\b(upper ?lower|superior ?e? ?inferior|ul ?4)\b/.test(t)) id = wantsStrength ? "ul-forca" : wantsGlute ? "ul-4-gluteo" : "ul-4";
  else if (/\b(ppl|push ?pull ?legs)\b/.test(t)) id = wantsGlute ? "ppl-6-gluteo" : /\b6\b/.test(t) ? "ppl-6" : "ppl-v2";
  if (!id) return null;
  const info: TemplateInfo | undefined = TEMPLATES.find((x) => x.id === id);
  if (!info) return null;
  const prog = info.make(0);
  const daysText = prog.days
    .map(
      (day) =>
        `- **${day.name}** (${day.focus}): ${day.exercises.slice(0, 4).map(shortName).join(", ")}${day.exercises.length > 4 ? "…" : ""}`,
    )
    .join("\n");
  return {
    kind: "biblioteca",
    id: `modelo-${info.id}`,
    text: `**${info.name}** (${info.level}) — ${info.pitch}\n${daysText}\nAbra em Programas para ver todas as séries e copiar para você.`,
    level: "evidencia",
    principle: "divisao",
    route: "/programas",
  };
}

/** Respostas composicionais para um exercício detectado (equipamento, erros/dicas, séries/reps/descanso, composto/isolado). */
function exerciseAspectAnswer(t: string): GeneratedReply | null {
  if (PERSONAL_HISTORY_RE.test(t)) return null;
  const ex = detectExercise(t);
  if (!ex) return null;
  const name = libraryName(ex.libId) ?? ex.name;
  const eq = equipOf(ex);

  // Equipamento do exercício.
  if (/\b(qual|que) (equipamento|aparelho|maquina)\b|\b(usa|precisa de) (o )?que\b|\bfaz (com|em) que\b|\bequipamento\b/.test(t) && eq) {
    return {
      kind: "biblioteca",
      id: `equip-${ex.libId}`,
      text: `**${name}** usa: ${eq.charAt(0).toLowerCase() + eq.slice(1)}.`,
      route: `/exercicios/${ex.libId}`,
      exercise: ex,
    };
  }

  // Erros comuns, dicas, postura e detalhes técnicos.
  if (/\b(erro|erros|errar|dica|dicas|cuidado|cuidados|segredo|detalhe|detalhes|ajustar|ajuste|como melhorar|como acertar)\b/.test(t)) {
    const lib = LIB_BY_ID[ex.libId];
    if (lib) {
      const parts = [`**${lib.name}** — dicas e erros comuns:`];
      if (lib.setup.length) parts.push(`Ajuste: ${lib.setup.slice(0, 2).join(" ")}`);
      if (lib.errors.length) parts.push(`Erros comuns a evitar:\n${lib.errors.map((e) => `- ${e}`).join("\n")}`);
      if (lib.why) parts.push(`Por que ajuda: ${lib.why}`);
      return {
        kind: "biblioteca",
        id: `erros-${ex.libId}`,
        text: parts.join("\n"),
        level: "consenso",
        route: `/exercicios/${ex.libId}`,
        exercise: ex,
      };
    }
    const ext = EXT_BY_ID[ex.libId];
    if (ext) {
      const kind = ext.compound ? "composto (multiarticular)" : "isolado (monoarticular)";
      const eqLabel = eq ? eq.toLowerCase() : "equipamento padrão";
      const main = ext.muscles.map(lower).join(" e ");
      const syn = ext.synergists.map(lower).join(", ");
      return {
        kind: "biblioteca",
        id: `erros-${ex.libId}`,
        text: `**${name}** é um exercício ${kind} (${eqLabel}) para **${main || "o alvo"}**${syn ? `, com ajuda de ${syn}` : ""}. Dicas principais: desça controlando o peso (2–3 s), use amplitude completa sem dor e pare antes de a postura ceder${ext.compound ? "; faça 1 ou 2 séries leves de aquecimento antes da carga de trabalho" : ""}. Na página do exercício há fotos e guia passo a passo.`,
        level: "consenso",
        route: `/exercicios/${ex.libId}`,
        exercise: ex,
      };
    }
  }

  // Séries, faixa de repetições e descanso recomendados para o exercício.
  if (
    /\b(quantas (series|repeticoes|reps)|faixa de (reps|repeticoes)|(qual|quanto) (?:e |eh |o )?(?:tempo de )?(?:descanso|intervalo|pausa)|quanto descansar|descanso (?:no|na|do|da|entre)|repeticoes (?:no|na|do|da|para|pra)|series (?:no|na|do|da|para|pra))\b/.test(
      t,
    ) &&
    !/\b(semana|semanais|por semana|na semana)\b/.test(t)
  ) {
    const comp = isCompound(ex.libId);
    const progEx = programExerciseOf(ex.libId);
    const intro = progEx
      ? `**${name}** está na sua ficha atual com **${progEx.sets} séries de ${progEx.reps[0]}–${progEx.reps[1]} repetições** e descanso de **${progEx.restLabel}**.\n\n`
      : `**${name}** é um exercício ${comp ? "composto" : "isolado"}. `;
    const guidance = comp
      ? "Para compostos pesados, a faixa de **3 a 4 séries de 6 a 12 repetições** (parando com 1–2 reps na reserva) e descanso de **2 a 3 minutos** preserva a carga e as repetições."
      : "Para isoladores, **2 a 4 séries de 10 a 15 repetições** perto do limite (0–2 RIR) com descanso de **1,5 a 2 minutos** costuma render muito bem.";
    return {
      kind: "biblioteca",
      id: `prescricao-${ex.libId}`,
      text: `${intro}${guidance}`,
      level: "evidencia",
      principle: "descanso-consenso",
      route: `/exercicios/${ex.libId}`,
      exercise: ex,
    };
  }

  // Composto vs. isolado (quando não é pergunta de lista para o músculo).
  const hasMuscleList = detectMuscleWord(t) && /\b(exercicios?|quais|melhores?|opcoes)\b/.test(t);
  if (!hasMuscleList && /\b(composto|isolado|isolador|multiarticular|monoarticular)\b/.test(t)) {
    const comp = isCompound(ex.libId);
    const main = (LIB_MUSCLES[ex.libId] ?? EXT_BY_ID[ex.libId]?.muscles ?? []).map(lower);
    const synIds = EXT_BY_ID[ex.libId]?.synergists ?? SYNERGISTS[ex.libId] ?? [];
    const syn = synIds.map(lower);
    return {
      kind: "biblioteca",
      id: `tipo-${ex.libId}`,
      text: `**${name}** é um exercício **${comp ? "composto (multiarticular)" : "isolado (monoarticular)"}**${eq ? ` (${eq.toLowerCase()})` : ""}. Trabalha diretamente **${main.join(" e ") || "o músculo-alvo"}**${syn.length ? `, com ajuda de ${syn.join(", ")} (que contam meia série no volume semanal)` : ""}.`,
      level: "evidencia",
      principle: "volume-fracionado",
      route: `/exercicios/${ex.libId}`,
      exercise: ex,
    };
  }

  return null;
}

/** Pergunta por exercício, músculo ou modelo do app, respondida com a biblioteca, TEMPLATES, SCIENCE e o programa ativo. */
export function libraryAnswer(text: string, d: AnswerData): GeneratedReply | null {
  const t = clean(text)
    .replace(/[^a-z0-9 ]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  const cmp = compareAnswer(t);
  if (cmp) return cmp;

  const tmpl = templateAnswer(t);
  if (tmpl) return tmpl;

  const exAspect = exerciseAspectAnswer(t);
  if (exAspect) return exAspect;

  const muscle = detectMuscleWord(t);
  if (!muscle) return null;
  const mw = new RegExp(`\\b${MUSCLE_RE}\\b`).test(t);
  if (!mw) return null;

  // Tempo de recuperação do músculo.
  if (/\b(quanto tempo|quantas horas|quantos dias)\b.*\b(recuper\w*|descans\w*)\b/.test(t) && !PERSONAL_HISTORY_RE.test(t)) {
    return {
      kind: "biblioteca",
      id: `recuperacao-${muscle}`,
      text: `Para **${lower(muscle)}**, a recuperação completa de um treino pesado costuma levar de **48 a 72 horas**. Por isso os programas dão pelo menos 2 dias antes de repetir pesado.\n\nQuer ver como está agora? Pergunte **"posso treinar ${lower(muscle)} hoje?"** e eu calculo pelas suas últimas sessões.`,
      level: "consenso",
      principle: "descanso-consenso",
      route: "/progresso",
      muscle,
    };
  }

  // Exercícios para o músculo (com filtro opcional de equipamento e composto/isolado).
  const eqFilter = detectEquipFilter(t);
  const kindFilter: "composto" | "isolado" | undefined = /\b(compostos?|multiarticular\w*)\b/.test(t)
    ? "composto"
    : /\b(isolados?|isolador\w*|monoarticular\w*)\b/.test(t)
      ? "isolado"
      : undefined;
  const wantsExercises =
    /\b(exercicios?|movimentos?|opcoes)\b/.test(t) ||
    /\b(treino|treinos|o que fazer|que fazer|como treinar|como trabalhar|melhores? exercicios?)\b.*\b(pra|para|de|do|da|no|na)\b/.test(t);
  if (
    wantsExercises &&
    !PERSONAL_HISTORY_RE.test(t) &&
    !/\b(fiz|treinei|quantas|quantos|quando|series|repeticoes|vezes|dias|dor|lesao)\b/.test(t)
  ) {
    const muscles = expandedMusclesForQuery(t, muscle);
    const pool = exercisesFor(muscles, eqFilter?.key, kindFilter);
    const taste = applyTaste(pool, d.memory?.notes);
    const list = taste.names.slice(0, 6);
    if (!list.length) {
      if (eqFilter || kindFilter) {
        const fallback = applyTaste(exercisesFor(muscles), d.memory?.notes).names.slice(0, 5);
        if (!fallback.length) return null;
        return {
          kind: "biblioteca",
          id: `exercicios-${muscle}`,
          text: `Não achei muitos registros com esse filtro exato para **${lower(muscle)}**, mas estas são boas opções gerais na biblioteca:\n${fallback.map((x) => `- ${x}`).join("\n")}\nVeja todos em Exercícios.`,
          route: "/exercicios",
          muscle,
        };
      }
      return null;
    }
    const qualParts = [
      kindFilter === "composto" ? "compostos" : kindFilter === "isolado" ? "isolados" : "",
      eqFilter ? `com ${eqFilter.label}` : "",
    ].filter(Boolean);
    const suffix = qualParts.length ? ` ${qualParts.join(" ")}` : " (primeiro os do seu programa)";
    const tag = [muscle, kindFilter, eqFilter?.key].filter(Boolean).join("-");
    return {
      kind: "biblioteca",
      id: `exercicios-${tag}`,
      text: `Exercícios para **${lower(muscle)}**${suffix}:\n${list.map((x) => `- ${x}`).join("\n")}\nNa biblioteca há fotos e o passo a passo de cada um.${taste.changed ? " Levei em conta o que você me contou." : ""}`,
      route: "/exercicios",
      muscle,
    };
  }

  // Quantas séries por semana para o músculo (conselho, não o que a pessoa fez).
  if (
    /\b(quantas series|qual (?:e |eh )?o volume)\b/.test(t) &&
    /\b(devo|preciso|ideal|por semana|na semana|semanal|pra crescer|para crescer|recomend\w*)\b/.test(t) &&
    !PERSONAL_HISTORY_RE.test(t)
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
      muscle,
    };
  }

  // Quantas vezes por semana o programa treina o músculo.
  if (
    /\b(quantas vezes|quantos dias|frequencia)\b/.test(t) &&
    /\b(semana|semanal|treino|treina|treinar)\b/.test(t) &&
    !PERSONAL_HISTORY_RE.test(t)
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
      muscle,
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

// ---------- Por princípio e auditorias ----------

const AUDIT_STOP = new Set("mais menos sempre todo mundo fazer causa causam semana primeiras semanas crescimento".split(" "));

function auditWords(crenca: string): string[] {
  return clean(crenca)
    .split(/[^a-z0-9]+/)
    .filter((w) => !AUDIT_STOP.has(w) && (w.length > 3 || /^\d+$/.test(w)))
    .map(stem);
}

function principleWords(p: Principle): string[] {
  return [...p.id.split("-"), ...clean(p.tema).split(" ")].filter((w) => w.length > 3).map(stem);
}

/** "O que a ciência diz sobre {tema}" ou "é verdade que {crença}": devolve o princípio ou auditoria do Guia. */
export function principleAnswer(text: string): GeneratedReply | null {
  const t = prepare(text);
  const scienceM = t.match(
    /^(?:o )?(?:que|oq|q) (?:diz|fala|dizem|falam|mostra) (?:a |o )?(?:ciencia|guia|estudo|estudos|pesquisa|pesquisas|literatura|evidencia) (?:sobre|de|do|da) (.+)$|^(?:o )?(?:que|oq|q) (?:a |o )?(?:ciencia|guia|estudo|estudos|pesquisa|pesquisas|literatura|evidencia) (?:diz|fala|dizem|falam|mostra) (?:sobre|de|do|da) (.+)$|^(?:qual (?:e |eh )?(?:a )?(?:evidencia|ciencia|base cientifica) (?:sobre|de|do|da) (.+))$|^(?:principio|evidencia|ciencia|estudos?) (?:sobre|de|do|da) (.+)$|^existe evidencia (?:de |para |sobre )?(.+)$/,
  );
  const mythM = t.match(/^(?:e |eh )?(?:verdade|mito)(?: que)? (.+)$|^(?:mito ou verdade)(?: sobre| que|:)? (.+)$/);
  const rawTopic = scienceM?.[1] ?? scienceM?.[2] ?? scienceM?.[3] ?? scienceM?.[4] ?? scienceM?.[5] ?? mythM?.[1] ?? mythM?.[2];
  if (!rawTopic) return null;

  const isMyth = !!mythM;
  const topicWords = clean(rawTopic)
    .split(/[^a-z0-9]+/)
    .filter((w) => w.length > 3 || /^\d+$/.test(w))
    .map(stem);
  const topic = new Set(topicWords);

  let bestP: { p: Principle; hits: number } | undefined;
  for (const p of PRINCIPLES) {
    const hits = principleWords(p).filter((w) => topic.has(w)).length;
    if (hits && (!bestP || hits > bestP.hits)) bestP = { p, hits };
  }

  let bestA: { idx: number; hits: number } | undefined;
  AUDITS.forEach((a, idx) => {
    const hits = auditWords(a.crenca).filter((w) => topic.has(w)).length;
    if (hits >= 2 && (!bestA || hits > bestA.hits)) bestA = { idx, hits };
  });

  if (bestA && (!bestP || (isMyth ? bestA.hits >= bestP.hits : bestA.hits > bestP.hits))) {
    const a = AUDITS[bestA.idx];
    return {
      kind: "principio",
      id: `audit-${bestA.idx}`,
      text: `**Sobre a ideia "${a.crenca}"**: ${a.veredito}`,
      level: "evidencia",
    };
  }
  if (!bestP) return null;
  const p = bestP.p;
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
