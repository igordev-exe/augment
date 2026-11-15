import { MUSCLE_LABEL } from "../../data/program";
import { libraryName } from "../../data/library-extended";
import { shortDate } from "../dates";
import { detectExercise, detectMuscleWord } from "./data-answers";
import { norm } from "./intents";
import type { OperatorMemory, OperatorNote } from "./operator";
import type { NoteProposal } from "./undo";

// AUG.CORE — bloco D do chat potente: memória do que a pessoa contou ("não gosto de agachamento", "prefiro halter",
// "treino em casa"). Só grava com confirmação. Assunto de saúde nunca vira lembrança (vai para a trava ou para a
// restrição de dor, que rodam antes). Efeito: as sugestões do chat (trocas, "exercícios para…") respeitam o gosto; o
// planejador do treino não muda por gosto, só por restrição.

const EQUIP: { key: string; label: string; words: RegExp }[] = [
  { key: "halter", label: "halter", words: /\b(halter|halteres|haltere)\b/ },
  { key: "barra", label: "barra", words: /\b(barra|barra livre)\b/ },
  { key: "maquina", label: "máquina", words: /\b(maquina|maquinas|aparelho|aparelhos)\b/ },
  { key: "cabo", label: "cabo", words: /\b(cabo|cabos|polia|polias)\b/ },
  { key: "corpo", label: "peso do corpo", words: /\b(peso do corpo|calistenia|peso corporal)\b/ },
];

const HEALTH = /\b(dor|doi|doendo|lesao|lesionei|machuc|inflam|tendinite|hernia|cirurgia|remedio)\b/;

function targetOf(rest: string): { target?: string; label?: string } {
  const eq = EQUIP.find((e) => e.words.test(rest));
  const ex = detectExercise(rest);
  if (ex && !eq) return { target: `lib:${ex.libId}`, label: (libraryName(ex.libId) ?? ex.name).replace(/\s*\(.*?\)/g, "") };
  if (eq) return { target: `equip:${eq.key}`, label: eq.label };
  const m = detectMuscleWord(rest);
  if (m) return { target: `muscle:${m}`, label: MUSCLE_LABEL[m].toLowerCase() };
  return {};
}

/** Algo para guardar na frase, ou null. A tela só grava depois de Aplicar ou "sim". */
export function detectNote(text: string, today: string, newId: () => string): (NoteProposal & { text: string }) | null {
  const t = norm(text)
    .replace(/[^a-z0-9 ]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (HEALTH.test(t)) return null;
  let kind: OperatorNote["kind"] | undefined;
  let rest = "";
  let m: RegExpMatchArray | null;
  if (
    (m = t.match(
      /^(?:eu )?(?:nao gosto|odeio|detesto|nao curto|nao suporto|tenho raiva) (?:de |do |da |dos |das |muito de |muito do )?(.+)$/,
    ))
  ) {
    kind = "dislike";
    rest = m[1];
  } else if ((m = t.match(/^(?:eu )?(?:prefiro|gosto mais de|gosto mais do|curto mais|amo|adoro|gosto muito de|gosto muito do) (.+)$/))) {
    kind = "prefer";
    rest = m[1];
  } else if (
    (m = t.match(
      /^(?:eu )?(treino (?:de manha|cedo|a tarde|a noite|de noite|em casa|na academia|no condominio|sozinho)|quero focar (?:em |no |na )?.+|meu (?:objetivo|foco) (?:e|eh) .+|so tenho (?:a manha|a noite|o fim de semana) .*)$/,
    ))
  ) {
    kind = "fact";
    rest = m[1];
  }
  if (!kind) return null;
  const { target, label } = targetOf(rest);
  if (kind !== "fact" && !target) return null;
  const note: OperatorNote = { id: newId(), kind, target, label, text: text.trim().slice(0, 200), at: today };
  const what =
    kind === "dislike" ? `que você não gosta de **${label}**` : kind === "prefer" ? `que você prefere **${label}**` : `"${text.trim()}"`;
  return {
    text: `Quer que eu guarde ${what}? Vou levar isso em conta nas trocas e nas sugestões de exercício. O treino planejado não muda por gosto.`,
    note,
    confirmLabel:
      kind === "dislike" ? `Guardar: não gosta de ${label}` : kind === "prefer" ? `Guardar: prefere ${label}` : `Guardar: ${text.trim()}`,
  };
}

const ABOUT =
  /^(o que (voce|vc) sabe (sobre|de) mim|o que (voce|vc) (lembra|guardou|guarda) (de|sobre) mim|o que (voce|vc) lembra|minhas preferencias|o que (voce|vc) aprendeu (sobre mim|de mim))$/;

/** "O que você sabe sobre mim?": o que está guardado, com data. */
export function aboutMe(text: string, memory: OperatorMemory | undefined, today: string): string | null {
  const t = norm(text)
    .replace(/[^a-z ]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (!ABOUT.test(t)) return null;
  const notes = memory?.notes ?? [];
  const cons = (memory?.constraints ?? []).filter((c) => c.expiresAt >= today);
  const abs = (memory?.absences ?? []).filter((a) => a.until >= today);
  if (!notes.length && !cons.length && !abs.length)
    return 'Ainda não guardei nada sobre você além dos treinos. Se quiser, me conte: "não gosto de agachamento", "prefiro halter", "treino em casa".';
  const lines = [
    ...notes.map(
      (n) =>
        `- ${n.kind === "dislike" ? "Não gosta de" : n.kind === "prefer" ? "Prefere" : "Disse:"} ${n.label ?? `"${n.text}"`} (${shortDate(n.at)})`,
    ),
    ...cons.map(
      (c) =>
        `- Restrição até ${shortDate(c.expiresAt)}: ${c.kind === "time-cap" ? `treino de até ${c.minutes} min` : c.kind === "equipment" ? "equipamento limitado" : c.kind === "pain" ? "incômodo" : "agenda"}`,
    ),
    ...abs.map((a) => `- Ausência de ${shortDate(a.from)} a ${shortDate(a.until)}`),
  ];
  return `O que eu guardei:\n${lines.join("\n")}\n\nPara tirar algo: "esquece que eu não gosto de agachamento". Também dá em Ajustes → O que o núcleo guardou.`;
}

/** "Esquece que eu não gosto de agachamento": a lembrança que casa, ou null. */
export function forgetNote(text: string, memory: OperatorMemory | undefined): (NoteProposal & { text: string }) | "none" | null {
  const t = norm(text)
    .replace(/[^a-z0-9 ]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  const m = t.match(/^(?:esquece|esqueca|apaga|tira|nao precisa lembrar) (?:que |o que |de que )?(?:eu )?(.+)$/);
  if (!m || /\b(apelido|atalho|isso|esse|este)$/.test(m[1])) return null;
  const notes = memory?.notes ?? [];
  const want = targetOf(m[1].replace(/^(nao gosto|prefiro|gosto mais|odeio|detesto) (de |do |da )?/, ""));
  const hit =
    notes.find((n) => want.target && n.target === want.target) ??
    notes.find((n) => norm(n.text).includes(m[1]) || m[1].includes(norm(n.label ?? "~~")));
  if (!hit) return notes.length ? "none" : null;
  return {
    text: `Esquecer **${hit.label ?? hit.text}**?`,
    forgetNoteId: hit.id,
    confirmLabel: `Esquecer: ${hit.kind === "dislike" ? "não gosta de " : hit.kind === "prefer" ? "prefere " : ""}${hit.label ?? hit.text}`,
  };
}

/**
 * Lista de exercícios (nomes) com o gosto aplicado: tira o que a pessoa não gosta e põe na frente o equipamento
 * preferido. `changed` diz se o gosto mudou alguma coisa (a resposta avisa).
 */
export function applyTaste(names: string[], notes: OperatorNote[] | undefined): { names: string[]; changed: boolean } {
  if (!notes?.length) return { names, changed: false };
  const dislikedLib = new Set(notes.filter((n) => n.kind === "dislike" && n.target?.startsWith("lib:")).map((n) => n.target!.slice(4)));
  const dislikedEq = notes
    .filter((n) => n.kind === "dislike" && n.target?.startsWith("equip:"))
    .map((n) => EQUIP.find((e) => `equip:${e.key}` === n.target));
  const preferEq = notes
    .filter((n) => n.kind === "prefer" && n.target?.startsWith("equip:"))
    .map((n) => EQUIP.find((e) => `equip:${e.key}` === n.target));
  const preferLib = new Set(notes.filter((n) => n.kind === "prefer" && n.target?.startsWith("lib:")).map((n) => n.target!.slice(4)));
  const libOf = (name: string) => detectExercise(name)?.libId;
  const kept = names.filter((n) => {
    const id = libOf(n);
    if (id && dislikedLib.has(id)) return false;
    return !dislikedEq.some((e) => e?.words.test(norm(n)));
  });
  const score = (n: string) => (preferLib.has(libOf(n) ?? "") ? 2 : preferEq.some((e) => e?.words.test(norm(n))) ? 1 : 0);
  const sorted = [...kept].sort((a, b) => score(b) - score(a));
  return { names: sorted, changed: sorted.length !== names.length || sorted.some((n, i) => n !== names[i]) };
}
