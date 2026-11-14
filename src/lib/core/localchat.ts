import { ANSWERS, type Answer } from "../../data/answers";
import type { EvidenceLevel } from "../../data/science";
import { SMALLTALK, type Smalltalk } from "../../data/smalltalk";
import { MUSCLE_LABEL, programDays } from "../../data/program";
import { daysBetween } from "../dates";
import { weekFor } from "../mesocycle";
import { formatWeight } from "../progression";
import { planAhead } from "../schedule";
import { fatiguePct, hoursToReady, muscleStatus } from "../visual";
import { findAnswer, guardTopic, levelOf } from "./answers";
import {
  continuePending,
  matchCommand,
  runCommand,
  type CommandAction,
  type CommandEnv,
  type CommandProposal,
  type PendingCommand,
} from "./commands";
import { detectExercise, latestWeight, type AnswerData, type DataCard, type DataContext } from "./data-answers";
import { glossaryAnswer, libraryAnswer, principleAnswer, type GeneratedReply } from "./generated";
import { handleIntent, norm, type IntentProposal } from "./intents";
import { queryAnswer, type QueryContext } from "./query";
import { prepare } from "./templates";

// AUG.CORE — o chat sem chave, em camadas (a de cima ganha): urgência e assuntos travados → comandos → intenções →
// consultas aos dados → respostas prontas (com glossário e respostas geradas da biblioteca) → papo → saída honesta.
// Sem modelo de linguagem, sem rede e sem texto inventado. Nada grava sem confirmação.

/** O que a tela mostra junto do texto. Fica guardado no histórico do chat (`CoachChat.local`). */
export interface LocalMeta {
  kind: "answer" | "data" | "maybe" | "none" | "guard" | "command" | "smalltalk";
  level?: EvidenceLevel;
  /** Id em PRINCIPLES: "Ler mais" no Guia. */
  principle?: string;
  route?: string;
  /** Texto do atalho para a rota (padrão: "Abrir no app"). */
  routeLabel?: string;
  /** Perguntas tocáveis: relacionadas, "você quis dizer" ou sugestões do "não sei". */
  chips?: string[];
  /** "Não sei": oferece levar a pergunta para outro chat. */
  handoff?: boolean;
  /** "Não sei" fora de assunto travado: oferece pesquisar na web (só sai do aparelho se a pessoa tocar). */
  web?: boolean;
  /** Cartão de "protocolo" com números da pessoa (próximos treinos, semana do ciclo, recorde…). */
  card?: DataCard;
  /** Bloco de "análise do núcleo": a conta feita com os dados da pessoa (peso → proteína, ritmo). */
  insight?: { label: string; text: string };
}

/** Memória curta da conversa: até 3 trocas, 5 minutos. */
export type ChatContext = DataContext &
  QueryContext & {
    /** Hora da última troca (expira em 5 min). */
    at?: number;
    /** Trocas desde que o assunto começou (expira depois de 3). */
    turns?: number;
    /** Pedido de comando esperando um campo. */
    pending?: PendingCommand;
    /** Há proposta esperando "sim" ou "não". */
    proposalOpen?: boolean;
    /** Contagem de mensagens (semente da variação do papo). */
    count?: number;
  };

export interface LocalReply {
  text: string;
  meta: LocalMeta;
  /** Contexto para a próxima pergunta (continuações como "e no agachamento?"). */
  ctx: ChatContext;
}

/** Proposta que a tela mostra com Aplicar/Recusar. Intenção (restrição, ausência) ou comando (série, peso, ajuste). */
export type CoreProposal = ({ source: "intent" } & IntentProposal) | ({ source: "command" } & CommandProposal);

export interface CoreReply extends LocalReply {
  proposal?: CoreProposal;
  action?: CommandAction;
  /** "Sim"/"não" respondendo a uma proposta aberta. */
  answerProposal?: "yes" | "no";
  /** Camada que respondeu (para a medição e o rótulo da tela). */
  layer:
    | "guard"
    | "pending"
    | "proposal"
    | "command"
    | "intent"
    | "glossary"
    | "data"
    | "generated"
    | "answer"
    | "smalltalk"
    | "maybe"
    | "none";
}

const BY_ID = new Map(ANSWERS.map((a) => [a.id, a]));

/** Pergunta curta e tocável a partir de uma resposta: a primeira forma de perguntar. */
export function askLabel(a: Answer): string {
  const q = a.asks[0].trim();
  const cap = q.charAt(0).toUpperCase() + q.slice(1);
  return /[?!.]$/.test(cap) ? cap : `${cap}?`;
}

/** Perguntas de exemplo da tela vazia: conhecimento, dados da pessoa e comandos, misturados. */
export const STARTERS = [
  "Qual meu recorde no supino?",
  "Qual o meu próximo treino?",
  "Quantas séries de peito fiz este mês?",
  "Quanta proteína devo comer?",
  "Descanso de 90 segundos",
  "Anilhas para 80 kg",
  "O que é RIR?",
  "Como foi minha semana?",
];

const DEFAULT_SUGGESTIONS = ["Quantas séries por músculo na semana?", "Quanta proteína devo comer por dia?", "Qual o meu próximo treino?"];

const WEIGHT_BASED = ["proteina-quanto", "ganhar-massa-comer", "perder-gordura-ritmo"];

/** A conta com o peso da pessoa nas respostas que dependem dele (vira o bloco de análise). */
export function personalInsight(a: Answer, data: AnswerData): LocalMeta["insight"] {
  if (!WEIGHT_BASED.includes(a.id)) return undefined;
  const w = latestWeight(data.bodyLog);
  if (!w) return { label: "Cálculo pessoal", text: "Registre o seu peso em Progresso e eu faço a conta para você." };
  const f = (n: number) => formatWeight(Math.round(n));
  const kg = (pct: number) => formatWeight(Math.round(w * pct * 10) / 10);
  const base = `Com o seu peso (~${f(w)} kg):`;
  if (a.id === "proteina-quanto")
    return { label: "Cálculo pessoal", text: `${base} **${f(w * 1.6)} a ${f(w * 2.2)} g de proteína por dia**.` };
  if (a.id === "ganhar-massa-comer") return { label: "Cálculo pessoal", text: `${base} **${kg(0.002)} a ${kg(0.005)} kg por semana**.` };
  return { label: "Cálculo pessoal", text: `${base} **${kg(0.005)} a ${kg(0.007)} kg por semana**.` };
}

function answerReply(a: Answer, data: AnswerData, ctx: ChatContext): LocalReply {
  return {
    text: a.answer,
    meta: {
      kind: "answer",
      level: levelOf(a),
      principle: a.principle,
      route: a.route,
      insight: personalInsight(a, data),
      chips: (a.related ?? [])
        .map((id) => BY_ID.get(id))
        .filter((x): x is Answer => !!x)
        .slice(0, 3)
        .map(askLabel),
    },
    ctx: { ...ctx, lastKind: undefined, query: undefined },
  };
}

function generatedReply(g: GeneratedReply, ctx: ChatContext): LocalReply {
  return {
    text: g.text,
    meta: { kind: "answer", level: g.level, principle: g.principle, route: g.route, chips: g.chips },
    ctx: { ...ctx, lastKind: undefined, query: undefined },
  };
}

/**
 * Sinal de urgência (dor no peito, falta de ar, desmaio, tontura). Na tela, vem ANTES das 6 intenções: "dor no
 * peito" casa a intenção de dor articular e viraria uma proposta de proteger o peitoral.
 */
export function isUrgent(text: string): boolean {
  return guardTopic(text) === "urgente";
}

// ---------- Papo ----------

function smalltalkData(s: Smalltalk, d: AnswerData): string | undefined {
  if (s.data === "hoje") {
    const next = planAhead(d.sessions, d.today, 7, d.settings.trainingDays)[0];
    const day = next && programDays().find((x) => x.id === next.dayId);
    if (!day) return undefined;
    if (d.sessions.some((x) => x.status === "done" && x.date === d.today)) return "Treino de hoje já está feito.";
    return next.date === d.today ? `Hoje é ${day.name}, ${day.exercises.length} exercícios.` : `Hoje é descanso; o próximo é ${day.name}.`;
  }
  if (s.data === "pronto") {
    const w = weekFor(d.settings.mesoStart, d.today);
    const st = muscleStatus(d.sessions, w, d.today, d.now ?? Date.now(), d.settings.setAdjust);
    const soon = Object.entries(st)
      .filter(([, v]) => v?.lastDate && fatiguePct(v) > 20 && hoursToReady(v) <= 14)
      .map(([m]) => MUSCLE_LABEL[m as keyof typeof MUSCLE_LABEL].toLowerCase())
      .slice(0, 2);
    if (!soon.length) return undefined;
    return `${soon.join(" e ")} ${soon.length > 1 ? "ficam prontos" : "fica pronto"} amanhã cedo.`.replace(/^./, (c) => c.toUpperCase());
  }
  if (s.data === "treinos") {
    const n = d.sessions.filter((x) => x.status === "done").length;
    if (!n) return undefined;
    const last = d.sessions.filter((x) => x.status === "done").sort((a, b) => (a.date < b.date ? 1 : -1))[0];
    const ago = daysBetween(last.date, d.today);
    return `${n} ${n === 1 ? "treino registrado" : "treinos registrados"}, o último ${ago === 0 ? "hoje" : ago === 1 ? "ontem" : `há ${ago} dias`}.`;
  }
  return undefined;
}

/** Situação de papo, ou undefined. Só casa a mensagem inteira (curta), nunca um pedaço de pergunta. */
export function matchSmalltalk(text: string): Smalltalk | undefined {
  const t = norm(text)
    .replace(/[!?.,;:]+/g, " ")
    // Vogal esticada no fim da palavra ("bom diaa", "oiii") conta como uma.
    .replace(/([aeiou])\1+\b/g, "$1")
    .replace(/\s+/g, " ")
    .trim();
  if (!t || t.split(" ").length > 9) return undefined;
  return SMALLTALK.find((s) => s.match.some((re) => re.test(t)));
}

function pick<T>(list: T[], seed: number): T {
  return list[Math.abs(seed) % list.length];
}

function smalltalkReply(s: Smalltalk, d: AnswerData, seed: number): string {
  const fact = smalltalkData(s, d);
  if (fact && s.replies.length) return pick(s.replies, seed).replace("{dado}", fact).trim();
  return pick(s.plain, seed);
}

// ---------- Saída honesta ----------

const OUT_OF_SCOPE: { kind: string; re: RegExp; text: string }[] = [
  {
    kind: "clima",
    re: /\b(clima|previsao|tempo (amanha|hoje|agora|la fora)|vai chover|chuva|temperatura|frio|calor|graus)\b/,
    text: "Previsão do tempo eu não tenho: não uso internet.",
  },
  {
    kind: "noticia",
    re: /\b(noticia|noticias|jornal|eleicao|eleicoes|presidente|governo|guerra|aconteceu|politica|bolsa|dolar|bitcoin|cripto)\b/,
    text: "Notícia e mercado eu não acompanho: fico no aparelho, sem internet.",
  },
  {
    kind: "receita",
    re: /\b(receita|como (faco|fazer|preparo|preparar) (um |uma |o |a )?(bolo|lasanha|pao|torta|feijoada|pizza|macarrao|panqueca|omelete|frango|arroz)|cozinhar|ingredientes)\b/,
    text: "Receita de cozinha eu não tenho. Sobre quanto comer de proteína ou carboidrato, eu respondo.",
  },
  {
    kind: "esporte",
    re: /\b(futebol|time|copa|campeonato|jogo de hoje|flamengo|corinthians|palmeiras|sao paulo|vasco|gremio|ufc|nba|formula 1)\b/,
    text: "Resultado de jogo eu não sei: não uso internet.",
  },
  {
    kind: "outro-app",
    re: /\b(whatsapp|zap|instagram|insta|spotify|youtube|netflix|uber|ifood|banco|pix|email|e mail|gmail|tiktok|google|maps|alarme|despertador|ligar para|liga pra|mensagem para)\b/,
    text: "Outros apps eu não controlo: só as telas do AUGMENT e o timer de descanso.",
  },
  {
    kind: "conta-geral",
    re: /\b(raiz quadrada|porcentagem de juros|juros|equacao|integral|derivada|imposto|cambio|converter (moeda|dolar|real))\b/,
    text: "Essa conta foge do que eu faço. Faço porcentagem, quilos e libras, 1RM e anilhas.",
  },
  {
    kind: "pessoal",
    re: /\b(namorad[oa]|namoro|relacionamento|terminei com|briga|emprego|trabalho|chefe|faculdade|escola|familia|dinheiro|divida|solidao|triste|sozinh[oa])\b/,
    text: "Esse assunto é da sua vida, e não tenho como ajudar bem nele. Se for pesado, converse com alguém de confiança.",
  },
  {
    kind: "conhecimento",
    re: /\b(capital|quem (foi|ganhou|descobriu|inventou)|quem (e|eh) o (presidente|mais)|historia d|quando (foi|aconteceu)|quantos habitantes|traduz|traducao|em ingles|significa em|poema|musica|letra d|escreve|redacao|programar|python|historia|imposto|celular|iphone|notebook|filme|serie da netflix|signo|astrologia)\b/,
    text: "Conhecimento geral eu não tenho: só treino, alimentação, recuperação e o app.",
  },
];

/** Categorias tão claras que respondem antes das respostas prontas ("previsão do tempo" não é recuperação). */
const STRONG = ["clima", "noticia", "receita", "esporte", "outro-app", "conhecimento"];

function honestExit(text: string, found: ReturnType<typeof findAnswer>, ctx: ChatContext): LocalReply {
  const t = norm(text);
  const cat = OUT_OF_SCOPE.find((c) => c.re.test(t));
  // Sugestão só com casamento razoável: um erro de digitação sozinho ("franca" → "frango") não basta.
  const near = found.kind === "none" ? found.hits.filter((h) => h.coverage >= 0.45 && h.score >= 2.5).slice(0, 3) : [];
  const chips = near.length ? near.map((h) => askLabel(h.answer)) : DEFAULT_SUGGESTIONS;
  const lead = cat
    ? cat.text
    : near.length
      ? "Ainda não sei responder isso com segurança. Talvez seja uma destas:"
      : "Ainda não sei responder isso. Pergunte de outro jeito, escolha uma das perguntas abaixo ou leve a pergunta para outro chat.";
  return {
    text: cat ? `${lead} Posso ajudar com uma destas:` : lead,
    meta: { kind: "none", chips, handoff: true, web: true },
    ctx,
  };
}

/** Responde sem rede e sem chave: travas, consultas, respostas prontas, papo e saída honesta. Nunca inventa. */
export function localReply(text: string, data: AnswerData, ctx: ChatContext = {}): LocalReply {
  const found = findAnswer(text);
  if (found.kind === "guard") return { text: found.reply, meta: { kind: "guard" }, ctx: {} };

  const strong = !matchSmalltalk(text) && OUT_OF_SCOPE.find((c) => STRONG.includes(c.kind) && c.re.test(norm(text)));
  if (strong) return honestExit(text, found, ctx);

  const g = glossaryAnswer(text, "def") ?? principleAnswer(text);
  if (g) return generatedReply(g, ctx);

  const d = queryAnswer(text, data, ctx);
  if (d) {
    return {
      text: d.text,
      meta: { kind: "data", route: d.route, card: d.card },
      ctx: { ...ctx, lastKind: d.kind, exercise: d.exercise ?? ctx.exercise, muscle: d.muscle ?? ctx.muscle, query: d.query },
    };
  }

  const lib = libraryAnswer(text, data);
  if (lib) return generatedReply(lib, ctx);

  // Papo só casa a mensagem inteira e curta ("boa noite", "valeu"): não é pergunta para resposta pronta. A medição
  // confere que nenhuma pergunta do conjunto de respostas prontas cai aqui.
  const small = matchSmalltalk(text);
  if (small) {
    const seed = Number(data.today.replace(/-/g, "")) + (ctx.count ?? 0);
    return { text: smalltalkReply(small, data, seed), meta: { kind: "smalltalk" }, ctx };
  }

  if (found.kind === "answer") return answerReply(found.answer, data, ctx);

  const bare = glossaryAnswer(text, "bare");
  if (bare) return generatedReply(bare, ctx);

  if (found.kind === "maybe") {
    return { text: "Você quis dizer:", meta: { kind: "maybe", chips: found.options.map(askLabel) }, ctx };
  }
  return honestExit(text, found, ctx);
}

// ---------- A conversa inteira ----------

const TTL = 5 * 60_000;
const YES =
  /^(sim|s|pode|pode sim|confirma|confirmo|aplica|aplicar|isso|isso mesmo|manda|manda ver|bora|ok|beleza|certo|claro|quero|faz|faca|anota|registra|salva)$/;
const NO = /^(nao|n|nao quero|cancela|cancelar|deixa|deixa pra la|esquece|recusa|recusar|nem|negativo)$/;

/**
 * Uma mensagem, todas as camadas. `env` diz se há timer correndo. A tela aplica `action` na hora (timer) e mostra
 * `proposal` com Aplicar/Recusar; nada daqui grava.
 */
export function coreReply(text: string, data: AnswerData, prev: ChatContext = {}, env: CommandEnv = {}): CoreReply {
  const now = env.now ?? data.now ?? Date.now();
  const fresh = prev.at != null && now - prev.at <= TTL && (prev.turns ?? 0) < 3;
  const ctx: ChatContext = fresh ? { ...prev, turns: (prev.turns ?? 0) + 1 } : { count: prev.count, turns: 0 };
  const stamp = (r: Omit<CoreReply, "ctx"> & { ctx: ChatContext }): CoreReply => ({
    ...r,
    ctx: { ...r.ctx, at: now, count: (prev.count ?? 0) + 1, turns: ctx.turns ?? 0 },
  });
  const guard = guardTopic(text);

  // 1. Urgência e assuntos travados: nenhuma camada abaixo responde.
  if (guard === "urgente") {
    const r = localReply(text, data, {});
    return stamp({ ...r, layer: "guard" });
  }

  const t = prepare(text);
  // "Sim"/"não" respondendo a uma proposta aberta.
  if (fresh && prev.proposalOpen && !guard) {
    if (YES.test(t))
      return stamp({
        text: "Aplicado.",
        meta: { kind: "command" },
        ctx: { ...ctx, proposalOpen: false },
        answerProposal: "yes",
        layer: "proposal",
      });
    if (NO.test(t))
      return stamp({
        text: "Ok, não mudei nada.",
        meta: { kind: "command" },
        ctx: { ...ctx, proposalOpen: false },
        answerProposal: "no",
        layer: "proposal",
      });
  }

  // Pedido em aberto esperando o campo que faltou.
  if (!guard && prev.pending) {
    const c = continuePending(text, prev.pending, data, { ...env, now });
    if (c) return stamp({ ...commandToReply(c, ctx), layer: "pending" });
  }

  // 2. Comandos.
  if (!guard) {
    const m = matchCommand(text);
    if (m) {
      const c = runCommand(m, data, text, { ...env, now });
      return stamp({ ...commandToReply(c, ctx), layer: "command" });
    }
  }

  // 3. Intenções (como antes: antes da trava, para "machuquei o ombro" virar proteção).
  const intent = handleIntent(text, { sessions: data.sessions, settings: data.settings, today: data.today, memory: data.memory });
  if (intent.matched) {
    return stamp({
      text: intent.reply,
      meta: { kind: "command" },
      ctx: { ...ctx, proposalOpen: !!intent.proposal, pending: undefined },
      proposal: intent.proposal ? { source: "intent", ...intent.proposal } : undefined,
      layer: "intent",
    });
  }

  // Correção curta ("não, o inclinado"): vira continuação com o mesmo movimento da pergunta anterior.
  const fix = fresh
    ? t.match(/^(?:nao|n|errado|errei)\s+(?:e\s+)?(?:o|a|no|na|era o|era a|quis dizer|eu quis dizer|o do|a do)?\s*(.+)$/)
    : null;
  let q = text;
  if (fix && (ctx.exercise || ctx.muscle || ctx.query)) {
    const anchor = ctx.exercise ? norm(ctx.exercise.name).split(" ")[0] : "";
    const withAnchor = anchor && detectExercise(`${anchor} ${fix[1]}`) ? `${anchor} ${fix[1]}` : fix[1];
    q = `e no ${withAnchor}`;
  }

  // 4 a 7. Consultas, respostas prontas, papo e saída honesta.
  const r = localReply(q, data, ctx);
  const layer: CoreReply["layer"] =
    r.meta.kind === "guard"
      ? "guard"
      : r.meta.kind === "data"
        ? "data"
        : r.meta.kind === "smalltalk"
          ? "smalltalk"
          : r.meta.kind === "maybe"
            ? "maybe"
            : r.meta.kind === "none"
              ? "none"
              : "answer";
  // Trava: sem web, sem memória.
  if (layer === "guard") return stamp({ ...r, ctx: {}, layer });
  const keep = layer === "data" ? r.ctx : { ...r.ctx, pending: undefined, proposalOpen: false };
  return stamp({ ...r, ctx: keep, layer });
}

function commandToReply(c: ReturnType<typeof runCommand>, ctx: ChatContext): Omit<CoreReply, "layer"> {
  return {
    text: c.text,
    meta: { kind: "command", route: c.route, routeLabel: c.routeLabel, card: c.card },
    ctx: { ...ctx, pending: c.pending, proposalOpen: !!c.proposal },
    action: c.action,
    proposal: c.proposal ? { source: "command", ...c.proposal } : undefined,
  };
}
