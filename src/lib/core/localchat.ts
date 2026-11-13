import { ANSWERS, type Answer } from "../../data/answers";
import { formatWeight } from "../progression";
import { findAnswer, guardTopic, levelOf } from "./answers";
import { dataAnswer, latestWeight, type AnswerData, type DataContext } from "./data-answers";
import type { EvidenceLevel } from "../../data/science";

// AUG.CORE — o chat sem chave: junta a trava de assuntos proibidos, as respostas com os dados da pessoa e o buscador
// de respostas prontas numa resposta só. As 6 intenções (intents.ts) continuam antes disto, na tela.

/** O que a tela mostra junto do texto. Fica guardado no histórico do chat (`CoachChat.local`). */
export interface LocalMeta {
  kind: "answer" | "data" | "maybe" | "none" | "guard";
  level?: EvidenceLevel;
  /** Id em PRINCIPLES: "Ler mais" no Guia. */
  principle?: string;
  route?: string;
  /** Perguntas tocáveis: relacionadas, "você quis dizer" ou sugestões do "não sei". */
  chips?: string[];
  /** "Não sei": oferece levar a pergunta para outro chat. */
  handoff?: boolean;
}

export interface LocalReply {
  text: string;
  meta: LocalMeta;
  /** Contexto para a próxima pergunta (continuações como "e no agachamento?"). */
  ctx: DataContext;
}

const BY_ID = new Map(ANSWERS.map((a) => [a.id, a]));

/** Pergunta curta e tocável a partir de uma resposta: a primeira forma de perguntar. */
export function askLabel(a: Answer): string {
  const q = a.asks[0].trim();
  const cap = q.charAt(0).toUpperCase() + q.slice(1);
  return /[?!.]$/.test(cap) ? cap : `${cap}?`;
}

/** Perguntas de exemplo da tela vazia: conhecimento e dados da pessoa, misturados. */
export const STARTERS = [
  "Qual meu recorde no supino?",
  "Qual o meu próximo treino?",
  "Quanta proteína devo comer?",
  "Em que semana do ciclo estou?",
  "Creatina funciona?",
  "Posso treinar perna hoje?",
  "Quanto tempo descansar entre as séries?",
  "Como foi minha semana?",
];

const DEFAULT_SUGGESTIONS = ["Quantas séries por músculo na semana?", "Quanta proteína devo comer por dia?", "Qual o meu próximo treino?"];

/** Acrescenta a conta com o peso da pessoa nas respostas que dependem dele. */
function personalize(a: Answer, data: AnswerData): string {
  const w = latestWeight(data.bodyLog);
  const f = (n: number) => formatWeight(Math.round(n));
  if (!w) {
    return ["proteina-quanto", "ganhar-massa-comer", "perder-gordura-ritmo"].includes(a.id)
      ? `${a.answer}\n\nRegistre o seu peso em Progresso e eu faço a conta para você.`
      : a.answer;
  }
  if (a.id === "proteina-quanto")
    return `${a.answer}\n\nCom o seu peso (~${f(w)} kg): **${f(w * 1.6)} a ${f(w * 2.2)} g de proteína por dia**.`;
  if (a.id === "ganhar-massa-comer") {
    const lo = Math.round(w * 0.002 * 10) / 10;
    const hi = Math.round(w * 0.005 * 10) / 10;
    return `${a.answer}\n\nCom o seu peso (~${f(w)} kg): **${formatWeight(lo)} a ${formatWeight(hi)} kg por semana**.`;
  }
  if (a.id === "perder-gordura-ritmo") {
    const lo = Math.round(w * 0.005 * 10) / 10;
    const hi = Math.round(w * 0.007 * 10) / 10;
    return `${a.answer}\n\nCom o seu peso (~${f(w)} kg): **${formatWeight(lo)} a ${formatWeight(hi)} kg por semana**.`;
  }
  return a.answer;
}

function answerReply(a: Answer, data: AnswerData, ctx: DataContext): LocalReply {
  return {
    text: personalize(a, data),
    meta: {
      kind: "answer",
      level: levelOf(a),
      principle: a.principle,
      route: a.route,
      chips: (a.related ?? [])
        .map((id) => BY_ID.get(id))
        .filter((x): x is Answer => !!x)
        .slice(0, 3)
        .map(askLabel),
    },
    ctx: { ...ctx, lastKind: undefined },
  };
}

/**
 * Sinal de urgência (dor no peito, falta de ar, desmaio, tontura). Na tela, vem ANTES das 6 intenções: "dor no
 * peito" casa a intenção de dor articular e viraria uma proposta de proteger o peitoral.
 */
export function isUrgent(text: string): boolean {
  return guardTopic(text) === "urgente";
}

/** Responde sem rede e sem chave. Nunca inventa: quando não acha, diz que não sabe. */
export function localReply(text: string, data: AnswerData, ctx: DataContext = {}): LocalReply {
  const found = findAnswer(text);
  if (found.kind === "guard") return { text: found.reply, meta: { kind: "guard" }, ctx: {} };

  const d = dataAnswer(text, data, ctx);
  if (d) {
    return {
      text: d.text,
      meta: { kind: "data", route: d.route },
      ctx: { lastKind: d.kind, exercise: d.exercise ?? ctx.exercise, muscle: d.muscle ?? ctx.muscle },
    };
  }

  if (found.kind === "answer") return answerReply(found.answer, data, ctx);
  if (found.kind === "maybe") {
    return { text: "Você quis dizer:", meta: { kind: "maybe", chips: found.options.map(askLabel) }, ctx };
  }
  // Sugestão só com casamento razoável: um erro de digitação sozinho ("franca" → "frango") não basta.
  const near = found.hits.filter((h) => h.coverage >= 0.45 && h.score >= 2.5).slice(0, 3);
  return {
    text: near.length
      ? "Ainda não sei responder isso com segurança. Talvez seja uma destas:"
      : "Ainda não sei responder isso. Pergunte de outro jeito, escolha uma das perguntas abaixo ou leve a pergunta para outro chat.",
    meta: { kind: "none", chips: near.length ? near.map((h) => askLabel(h.answer)) : DEFAULT_SUGGESTIONS, handoff: true },
    ctx,
  };
}
