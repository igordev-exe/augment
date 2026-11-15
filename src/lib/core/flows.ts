import type { BodyGoal, Settings } from "../../data/types";
import { mondayOf } from "../dates";
import { recommendTemplate, type Focus, type Level } from "../onboarding";
import type { AnswerData } from "./data-answers";
import { handleIntent, norm } from "./intents";
import { readNumber } from "./readers";
import type { CoreProposal } from "./undo";

// AUG.CORE — bloco D do chat potente: conversas guiadas. Para pedidos grandes ("quero trocar de programa"), o chat faz
// no máximo 3 perguntas, cada uma com botões, e fecha com uma proposta ou um atalho. "Cancela" sai; pergunta fora do
// roteiro é respondida e o chat oferece "Continuar de onde paramos"; duas seguidas encerram. Expira em 10 minutos.

export const FLOW_TTL = 10 * 60_000;
export const CONTINUE = "Continuar de onde paramos";

export interface FlowState {
  id: FlowId;
  step: number;
  answers: Record<string, string>;
  at: number;
  /** Perguntas fora do roteiro seguidas. */
  off: number;
}

type FlowId = "programa" | "treino-hoje" | "pausa" | "meta-peso" | "incomodo";

interface Option {
  label: string;
  value: string;
  re: RegExp;
}

interface Step {
  key: string;
  ask: string;
  options: Option[];
  /** Resposta livre aceita quando nenhum botão casa (número, nome de exercício). */
  free?: (t: string) => string | undefined;
}

export interface FlowEnd {
  text: string;
  proposal?: CoreProposal;
  route?: string;
  routeLabel?: string;
}

interface Flow {
  id: FlowId;
  start: RegExp;
  intro: string;
  steps: Step[];
  finish: (a: Record<string, string>, d: AnswerData) => FlowEnd;
}

const opt = (label: string, value: string, re: RegExp): Option => ({ label, value, re });

const INTENT_ENV = (d: AnswerData) => ({ sessions: d.sessions, settings: d.settings, today: d.today, memory: d.memory });

const FLOWS: Flow[] = [
  {
    id: "programa",
    start:
      /\b(quero|queria|vou|preciso|como) (trocar|mudar) (de |o )?(programa|ficha)\b|^trocar de (programa|ficha)$|\b(qual|que) programa (devo|eu devo|e melhor pra eu) (fazer|seguir)\b|\bmontar (um )?programa novo\b/,
    intro: "Vamos achar o programa certo. São 3 perguntas.",
    steps: [
      {
        key: "dias",
        ask: "Quantos dias por semana você consegue treinar?",
        options: [
          opt("3 dias", "3", /^3|tres/),
          opt("4 dias", "4", /^4|quatro/),
          opt("5 dias", "5", /^5|cinco/),
          opt("6 dias", "6", /^6|seis/),
        ],
        free: (t) => {
          const n = readNumber(t.replace(/dias?|vezes/, "").trim());
          return n && n >= 2 && n <= 7 ? String(Math.min(6, Math.max(3, n))) : undefined;
        },
      },
      {
        key: "nivel",
        ask: "Há quanto tempo você treina?",
        options: [
          opt("Menos de 6 meses", "iniciante", /iniciante|comecando|menos de|pouco|novo|nunca/),
          opt("6 meses a 2 anos", "intermediario", /intermediario|um ano|1 ano|seis meses|6 meses|2 anos|dois anos/),
          opt("Mais de 2 anos", "avancado", /avancado|mais de|anos|muito tempo|faz tempo/),
        ],
      },
      {
        key: "foco",
        ask: "Quer um foco a mais?",
        options: [
          opt("Equilibrado", "geral", /equilibrado|geral|tanto faz|nenhum|nao|corpo todo/),
          opt("Mais glúteo", "gluteo", /gluteo|bumbum|perna/),
        ],
      },
    ],
    finish: (a) => {
      const r = recommendTemplate({ days: Number(a.dias), level: a.nivel as Level, focus: a.foco as Focus });
      return {
        text: `Para ${a.dias} dias, nível ${a.nivel === "iniciante" ? "iniciante" : a.nivel === "intermediario" ? "intermediário" : "avançado"}${a.foco === "gluteo" ? ", com foco em glúteo" : ""}: **${r.template.name}**. ${r.template.pitch}${r.note ? ` ${r.note}` : ""}\n\nO seu programa atual não muda até você escolher o novo em Programas.`,
        route: "/programas",
        routeLabel: "Ver os modelos",
      };
    },
  },
  {
    id: "treino-hoje",
    start:
      /\b(me ajuda a |ajuda a |quero )?(montar|monta|planejar|planeja|ajustar|ajusta|adaptar|adapta) (o |meu |o meu )?treino (de hoje|do dia|pra hoje|para hoje)\b/,
    intro: "Vamos ajustar o treino de hoje. São 3 perguntas.",
    steps: [
      {
        key: "tempo",
        ask: "Quanto tempo você tem?",
        options: [
          opt("30 min", "30", /\b30\b|meia hora/),
          opt("45 min", "45", /\b45\b/),
          opt("60 min", "60", /\b60\b|uma hora|1 hora/),
          opt("Sem pressa", "livre", /sem pressa|livre|quanto precisar|tranquilo/),
        ],
        free: (t) => {
          const m = t.match(/(\d{2,3})/);
          return m ? m[1] : undefined;
        },
      },
      {
        key: "equip",
        ask: "Onde você vai treinar?",
        options: [
          opt("Academia completa", "academia", /academia|completa|tudo/),
          opt("Só halteres", "halteres", /halter/),
          opt("Em casa, sem nada", "corpo", /casa|nada|sem equipamento|peso do corpo/),
        ],
      },
      {
        key: "dor",
        ask: "Algum incômodo hoje?",
        options: [
          opt("Nenhum", "nenhum", /nenhum|nao|tudo bem|nada/),
          opt("Ombro", "ombro", /ombro/),
          opt("Joelho", "joelho", /joelho/),
          opt("Lombar", "lombar", /lombar|costas/),
        ],
      },
    ],
    finish: (a, d) => {
      const asks = [
        a.tempo !== "livre" ? `tenho so ${a.tempo} minutos hoje` : "",
        a.equip === "halteres" ? "so tenho halteres" : a.equip === "corpo" ? "em casa so peso do corpo" : "",
        a.dor !== "nenhum" ? `dor no ${a.dor}` : "",
      ].filter(Boolean);
      const results = asks.map((q) => handleIntent(q, INTENT_ENV(d))).filter((r) => r.matched);
      const items: CoreProposal[] = results.flatMap((r) => (r.proposal ? [{ source: "intent" as const, ...r.proposal }] : []));
      if (!items.length)
        return { text: "Então é o treino de hoje como está no programa. Bom treino.", route: "/", routeLabel: "Ir para o treino" };
      return {
        text: `Montei o treino de hoje:\n\n${results.map((r) => r.reply.split("\n")[0]).join("\n\n")}\n\nNada muda até você aplicar, e vale só por hoje.`,
        proposal: items.length === 1 ? items[0] : { source: "batch", items, confirmLabel: items.map((i) => i.confirmLabel).join(" + ") },
        route: "/",
        routeLabel: "Ir para o treino",
      };
    },
  },
  {
    id: "pausa",
    start:
      /\b(voltei|to voltando|estou voltando|voltando|vou voltar) (a treinar|pra academia|para a academia|de (uma )?pausa|a malhar|depois de (um tempo|uma pausa|ferias))\b|\bfiquei (um tempo |muito tempo |uns dias )?parado\b/,
    intro: "Bem-vindo de volta.",
    steps: [
      {
        key: "tempo",
        ask: "Quanto tempo você ficou sem treinar?",
        options: [
          opt("Uma semana", "7", /uma semana|1 semana|poucos dias|alguns dias/),
          opt("Duas semanas", "14", /duas semanas|2 semanas|quinze dias|15 dias/),
          opt("Um mês", "30", /um mes|1 mes|trinta dias|30 dias/),
          opt("Mais de um mês", "60", /mais de|meses|muito tempo|ano/),
        ],
      },
    ],
    finish: (a, d) => {
      const days = Number(a.tempo);
      if (days < 10)
        return {
          text: "Uma semana não apaga nada. Siga a semana do ciclo com as cargas da última vez; a primeira série de cada exercício já mostra como você está.",
          route: "/",
          routeLabel: "Ir para o treino",
        };
      const patch: Partial<Settings> = { mesoStart: mondayOf(d.today) };
      return {
        text: `Depois de ${days >= 30 ? "um mês ou mais" : "duas semanas"} parado, o melhor é recomeçar o ciclo pela semana 1: séries mais leves e sem ir à falha nas duas primeiras semanas. A força volta rápido.`,
        proposal: { source: "command", kind: "settings", patch, confirmLabel: "Recomeçar o ciclo na semana 1" },
      };
    },
  },
  {
    id: "meta-peso",
    start:
      /\b(definir|colocar|botar|criar|quero|mudar|trocar) (uma |a |minha )?meta de peso\b|^meta de peso$|\bquero (perder|ganhar) peso\b/,
    intro: "Vamos definir a meta.",
    steps: [
      {
        key: "modo",
        ask: "Qual é o objetivo?",
        options: [
          opt("Perder peso", "perder", /perder|emagrecer|secar|baixar/),
          opt("Ganhar peso", "ganhar", /ganhar|engordar|crescer|subir/),
          opt("Manter", "manter", /manter|ficar/),
        ],
      },
      {
        key: "alvo",
        ask: "Até quanto? Diga o peso em kg, ou toque em Sem número.",
        options: [opt("Sem número", "0", /sem numero|nao sei|tanto faz|qualquer/)],
        free: (t) => {
          const n = readNumber(t.replace(/kg|quilos?/, "").trim());
          return n && n >= 30 && n <= 300 ? String(n) : undefined;
        },
      },
    ],
    finish: (a) => {
      const goal: BodyGoal = { mode: a.modo as BodyGoal["mode"], ...(Number(a.alvo) ? { targetKg: Number(a.alvo) } : {}) };
      const label = `${goal.mode === "perder" ? "Perder peso" : goal.mode === "ganhar" ? "Ganhar peso" : "Manter o peso"}${goal.targetKg ? ` até ${goal.targetKg} kg` : ""}`;
      return {
        text: `Meta: **${label}**. O ritmo que funciona é devagar: perder 0,5% a 1% do peso por semana, ou ganhar 0,25% a 0,5%. Eu acompanho pela biometria.`,
        proposal: { source: "command", kind: "settings", patch: { bodyGoal: goal }, confirmLabel: `Meta: ${label}` },
        route: "/progresso",
        routeLabel: "Abrir a biometria",
      };
    },
  },
  {
    id: "incomodo",
    start:
      /^(tenho|to com|estou com|sinto|senti) (um |uns |algum )?(incomodo|desconforto|incomodos)( (num|em um|no|em algum) exercicio)?$|^(algo|uma coisa|um exercicio) (ta|esta) (me )?incomodando$/,
    intro: "Vamos ver isso com calma.",
    steps: [
      {
        key: "onde",
        ask: "Onde é o incômodo?",
        options: [
          opt("Ombro", "ombro", /ombro/),
          opt("Joelho", "joelho", /joelho/),
          opt("Lombar", "lombar", /lombar|costas|coluna/),
          opt("Cotovelo", "cotovelo", /cotovelo/),
        ],
        free: (t) => (/punho|pulso/.test(t) ? "punho" : /quadril/.test(t) ? "quadril" : undefined),
      },
      {
        key: "ex",
        ask: "Em qual exercício aparece? Diga o nome, ou toque em Não sei.",
        options: [opt("Não sei", "", /nao sei|vario|varios|todos|qualquer/)],
        free: (t) => (t.length >= 3 ? t : undefined),
      },
      {
        key: "desde",
        ask: "Desde quando?",
        options: [
          opt("Hoje", "hoje", /hoje|agora/),
          opt("Esta semana", "semana", /semana|uns dias|ontem/),
          opt("Faz tempo", "tempo", /faz tempo|meses|muito tempo|sempre/),
        ],
      },
    ],
    finish: (a, d) => {
      const r = handleIntent(`dor no ${a.onde}${a.ex ? ` no ${a.ex}` : ""}`, INTENT_ENV(d));
      const tail =
        a.desde === "tempo"
          ? "\n\nComo já faz tempo, vale procurar um fisioterapeuta ou médico do esporte: o app ajusta o treino, mas não avalia."
          : "";
      return {
        text: `${r.matched ? r.reply : `Anotei o incômodo no ${a.onde}.`}${tail}`,
        proposal: r.proposal ? { source: "intent", ...r.proposal } : undefined,
      };
    },
  },
];

const BY_ID = new Map(FLOWS.map((f) => [f.id, f]));

export interface FlowReply {
  text: string;
  chips?: string[];
  flow?: FlowState;
  end?: FlowEnd;
}

const clean = (text: string) =>
  norm(text)
    .replace(/[^a-z0-9 ]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();

function askStep(f: Flow, step: number): { text: string; chips: string[] } {
  const s = f.steps[step];
  return { text: `${step + 1}/${f.steps.length}. ${s.ask}`, chips: s.options.map((o) => o.label) };
}

/** Começa um roteiro, ou null. */
export function startFlow(text: string, now: number): FlowReply | null {
  const t = clean(text);
  const f = FLOWS.find((x) => x.start.test(t));
  if (!f) return null;
  const q = askStep(f, 0);
  return { text: `${f.intro}\n\n${q.text}`, chips: q.chips, flow: { id: f.id, step: 0, answers: {}, at: now, off: 0 } };
}

/**
 * Próximo passo do roteiro aberto. Devolve "cancel" (saiu), "off" (a mensagem não responde à pergunta: a conversa
 * segue normal) ou a resposta (pergunta seguinte ou fim).
 */
export function continueFlow(text: string, state: FlowState, d: AnswerData, now: number): FlowReply | "cancel" | "off" {
  const f = BY_ID.get(state.id);
  if (!f) return "cancel";
  const t = clean(text);
  if (/^(cancela|cancelar|sair|esquece|deixa pra la|para|parar|nao quero mais|desisto)$/.test(t)) return "cancel";
  if (t === clean(CONTINUE)) {
    const q = askStep(f, state.step);
    return { text: q.text, chips: q.chips, flow: { ...state, at: now, off: 0 } };
  }
  const s = f.steps[state.step];
  const value = s.options.find((o) => o.re.test(t) || clean(o.label) === t)?.value ?? s.free?.(t);
  if (value == null) return "off";
  const answers = { ...state.answers, [s.key]: value };
  const next = state.step + 1;
  if (next < f.steps.length) {
    const q = askStep(f, next);
    return { text: q.text, chips: q.chips, flow: { ...state, step: next, answers, at: now, off: 0 } };
  }
  const end = f.finish(answers, d);
  return { text: end.text, end };
}
