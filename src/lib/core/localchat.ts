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
import { continuePending, runCommand, type CommandAction, type CommandEnv, type CommandMatch, type PendingCommand } from "./commands";
import { detectExercise, detectMuscleWord, latestWeight, type AnswerData, type DataCard, type DataContext } from "./data-answers";
import { glossaryAnswer, libraryAnswer, principleAnswer, type GeneratedReply } from "./generated";
import { handleIntent, matchIntent, norm } from "./intents";
import { parseQuery, queryAnswer, type QueryContext } from "./query";
import { prepare } from "./templates";
import { FORGET_ALIAS, lookupAlias, type ChatAlias } from "./learned";
import { readCommand, readingLabel, splitRequest } from "./understand";
import { applyPure, type CoreProposal } from "./undo";
import { whyAnswer, type ReasonReply } from "./why";
import { whatIfAnswer } from "./whatif";
import { asideFor, capabilitiesAnswer, stateChips, summaryAnswer, traceAnswer } from "./assist";
import { PRINCIPLES } from "../../data/science";
import { CONTINUE, continueFlow, FLOW_TTL, startFlow, type FlowReply, type FlowState } from "./flows";
import { aboutMe, detectNote, forgetNote } from "./notes";
import { EMPTY_OPERATOR_MEMORY } from "./operator";

export type { CoreProposal } from "./undo";

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
  /** Frase livre: como o núcleo entendeu o pedido ("Entendi: descanso de 90 s"), para a pessoa conferir. */
  understood?: string;
  /** Pergunta que veio de um apelido aprendido (a tela oferece "Esquecer esse atalho"). */
  alias?: string;
}

/** Memória curta da conversa: até 3 trocas, 5 minutos. */
export type ChatContext = DataContext &
  QueryContext & {
    /** Hora da última troca (o assunto vale 15 min). */
    at?: number;
    /** Trocas desde que o assunto começou (vale por 10). */
    turns?: number;
    /** Último comando feito ("repete", "de novo", "repete com 85"). */
    lastCommand?: Pick<CommandMatch, "id" | "values">;
    /** Última resposta pronta ("resumindo", "explica melhor"). */
    lastAnswer?: string;
    /** "Aliás" já dito hoje, por assunto (atravessa o fim do assunto, como a contagem). */
    asides?: Record<string, string>;
    /** Conversa guiada aberta (até 3 perguntas). */
    flow?: FlowState;
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

export interface CoreReply extends LocalReply {
  proposal?: CoreProposal;
  action?: CommandAction;
  /** Pedido composto: ações sem gravação que rodam na hora, na ordem (o timer de "anota… e começa o descanso"). */
  actions?: CommandAction[];
  /** Pedido composto: a resposta de cada parte, na ordem em que foram ditas. */
  parts?: CoreReply[];
  /** "Sim"/"não" respondendo a uma proposta aberta. */
  answerProposal?: "yes" | "no";
  /** "Esquece esse apelido": a tela tira o último aprendido. */
  forgetAlias?: boolean;
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
    | "why"
    | "whatif"
    | "assist"
    | "flow"
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
    ctx: { ...ctx, lastAnswer: a.id },
  };
}

function generatedReply(g: GeneratedReply, ctx: ChatContext): LocalReply {
  return {
    text: g.text,
    meta: { kind: "answer", level: g.level, principle: g.principle, route: g.route, chips: g.chips },
    ctx,
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

  // Assunto claramente de fora ganha das respostas prontas, mas não de uma pergunta sobre o próprio treino ("quando
  // foi a última vez que fiz supino" tem o "quando foi" do conhecimento geral).
  const own = !!detectMuscleWord(text) || /\b(treinei|treino|treinos|fiz|serie|series|carga|recorde|ultima vez)\b/.test(norm(text));
  const strong = !matchSmalltalk(text) && !own && OUT_OF_SCOPE.find((c) => STRONG.includes(c.kind) && c.re.test(norm(text)));
  if (strong) return honestExit(text, found, ctx);

  const g = glossaryAnswer(text, "def") ?? principleAnswer(text);
  if (g) return generatedReply(g, ctx);

  // Papo curto ("valeu", "show") não é continuação da consulta anterior, mesmo com o assunto aberto.
  const chat = matchSmalltalk(text);
  if (chat && !detectExercise(text) && !detectMuscleWord(text)) {
    const seed = Number(data.today.replace(/-/g, "")) + (ctx.count ?? 0);
    return { text: smalltalkReply(chat, data, seed), meta: { kind: "smalltalk" }, ctx };
  }

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

const TTL = 15 * 60_000;
const MAX_TURNS = 10;
const PROPOSAL_TTL = 5 * 60_000;
const UNDO =
  /^(desfaz|desfazer|desfaca|desfaz isso|desfaz o ultimo|desfaz a ultima|volta atras|cancela isso|anula|anula isso|apaga o que voce fez|errei desfaz)$/;
const REPEAT = /^(repete|repetir|de novo|outra vez|mesma coisa|faz de novo|repete isso)(?: (?:com|de|so que com|mas com|para|pra) (.+))?$/;

/** Troca "ele", "nele", "esse exercício" pelo último exercício citado. Sem exercício na frase e com um no assunto. */
export function resolveRefs(text: string, ctx: ChatContext): string {
  if (!ctx.exercise || detectExercise(text)) return text;
  // Sem o parêntese do nome do programa ("Supino inclinado com halteres (30–45°)").
  const name = ctx.exercise.name.replace(/\s*\(.*?\)/g, "").trim();
  return text
    .replace(/\b(nele|nesse exercicio|neste exercicio|no mesmo exercicio)\b/gi, `no ${name}`)
    .replace(/\b(dele|desse exercicio|deste exercicio|do mesmo exercicio)\b/gi, `do ${name}`)
    .replace(/\b(ele|esse exercicio|este exercicio|o mesmo exercicio)\b/gi, name);
}
const YES =
  /^(sim|s|pode|pode sim|confirma|confirmo|aplica|aplicar|isso|isso mesmo|manda|manda ver|bora|ok|beleza|certo|claro|quero|faz|faca|anota|registra|salva)$/;
const NO = /^(nao|n|nao quero|cancela|cancelar|deixa|deixa pra la|esquece|recusa|recusar|nem|negativo)$/;

/**
 * Uma mensagem, todas as camadas. `env` diz se há timer correndo. A tela aplica `action` na hora (timer) e mostra
 * `proposal` com Aplicar/Recusar; nada daqui grava.
 */
export interface CoreEnv extends CommandEnv {
  /** O que "desfaz" desfaria agora (a tela guarda a pilha; o núcleo só pergunta). */
  undoLabel?: string;
}

type CoreData = AnswerData & { aliases?: ChatAlias[] };

export function coreReply(text: string, data: CoreData, prev: ChatContext = {}, env: CoreEnv = {}): CoreReply {
  const guard = guardTopic(text);
  // Pedido composto: cada parte passa por todas as camadas; a trava de qualquer parte trava a mensagem inteira.
  // Queixa e intenção ("perdi o treino de ontem e de hoje") são um pedido só, mesmo com "e".
  if (!guard && !(prev.proposalOpen || prev.pending) && !matchIntent(text)) {
    const split = splitRequest(text, (piece) => {
      if (guardTopic(piece)) return null;
      const m = readCommand(piece, data);
      if (m && !m.ask && !m.partial) return "command";
      return parseQuery(piece, data) ? "query" : null;
    });
    if (split) return compoundReply(split, data, prev, env);
  }
  const r = singleReply(text, data, prev, env);
  // Pergunta fora do roteiro: respondida, e o chat oferece voltar para a conversa guiada.
  if (prev.flow && r.ctx.flow && r.ctx.flow.off > prev.flow.off)
    r.meta = { ...r.meta, chips: [CONTINUE, ...(r.meta.chips ?? [])].slice(0, 3) };
  return r;
}

function compoundReply(split: NonNullable<ReturnType<typeof splitRequest>>, data: CoreData, prev: ChatContext, env: CoreEnv): CoreReply {
  const replies: CoreReply[] = [];
  let ctx = prev;
  let d = data;
  let lastLoad: unknown;
  const proposals: CoreProposal[] = [];
  const now: CommandAction[] = [];
  const then: CommandAction[] = [];
  for (const part of split.parts) {
    let q = part.text;
    // "anota 8 com 80 e depois 7": o número sozinho herda a carga da série anterior.
    if (part.kind === "number" && ctx.lastCommand?.id === "treino-anotar" && lastLoad) {
      const l = lastLoad as { value: number; unit?: string };
      q = `anota ${part.text} com ${String(l.value).replace(".", ",")}${l.unit ? ` ${l.unit}` : ""}`;
    }
    // "quantas séries de peito e de costas": a continuação vira "e de costas" com o assunto da anterior.
    if (part.kind === "fragment") q = `e ${part.text.replace(/^e /, "")}`;
    const r = singleReply(q, d, { ...ctx, proposalOpen: false }, env);
    replies.push(r);
    ctx = r.ctx;
    if (ctx.lastCommand?.id === "treino-anotar" && ctx.lastCommand.values.carga) lastLoad = ctx.lastCommand.values.carga;
    if (r.proposal) {
      proposals.push(r.proposal);
      // A próxima parte enxerga o que esta propôs (a 2ª série vai para a série seguinte, não para a mesma).
      const st = applyPure(
        { sessions: d.sessions, bodyLog: d.bodyLog, settings: d.settings, memory: d.memory ?? EMPTY_OPERATOR_MEMORY },
        r.proposal,
        () => "virtual",
      );
      d = { ...d, sessions: d.sessions.map((s) => st.sessions.find((x) => x.id === s.id) ?? s), bodyLog: st.bodyLog };
    }
    if (r.action) (proposals.length ? then : now).push(r.action);
  }
  const proposal: CoreProposal | undefined =
    proposals.length === 1 && !then.length
      ? proposals[0]
      : proposals.length
        ? {
            source: "batch",
            items: proposals,
            then: then.length ? then : undefined,
            confirmLabel: proposals.map((p) => p.confirmLabel).join(" + "),
          }
        : undefined;
  const text = [
    ...replies.map((r) => r.text),
    ...(split.leftover ? [`Esta parte eu não entendi: “${split.leftover}”.`] : []),
    ...(then.length ? ["O descanso começa quando você aplicar."] : []),
  ].join("\n\n");
  const first = replies.find((r) => r.meta.card) ?? replies[0];
  const anyCommand = replies.some((r) => r.layer === "command" || r.layer === "pending");
  return {
    text,
    meta: { ...first.meta, kind: anyCommand ? "command" : first.meta.kind, chips: undefined, understood: undefined },
    ctx: { ...ctx, proposalOpen: !!proposal },
    proposal,
    action: now[0],
    actions: now.length ? now : undefined,
    parts: replies,
    layer: anyCommand ? "command" : replies[0].layer,
  };
}

function singleReply(text: string, data: CoreData, prev: ChatContext, env: CoreEnv): CoreReply {
  const now = env.now ?? data.now ?? Date.now();
  const fresh = prev.at != null && now - prev.at <= TTL && (prev.turns ?? 0) < MAX_TURNS;
  const ctx: ChatContext = fresh ? { ...prev, turns: (prev.turns ?? 0) + 1 } : { count: prev.count, asides: prev.asides, turns: 0 };
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

  // Pedido para esquecer o que o chat aprendeu.
  if (!guard && FORGET_ALIAS.test(prepare(text)))
    return stamp({
      text: "Esqueci o último atalho que eu tinha aprendido.",
      meta: { kind: "command" },
      ctx,
      forgetAlias: true,
      layer: "command",
    });

  // Frase que a pessoa já ensinou: vai direto para a pergunta escolhida (nunca em assunto travado).
  const alias = !guard ? lookupAlias(data.aliases, text) : undefined;
  if (alias) text = alias.to;

  // "Ele", "nele", "esse exercício": o último exercício citado.
  if (fresh) text = resolveRefs(text, ctx);

  const t = prepare(text);
  // "Sim"/"não" respondendo a uma proposta aberta.
  // A proposta aberta expira como antes (5 min), mesmo com o assunto valendo mais tempo.
  if (fresh && prev.proposalOpen && now - (prev.at ?? 0) <= PROPOSAL_TTL && !guard) {
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

  // Conversa guiada aberta: a mensagem responde à pergunta, cancela, ou sai do roteiro (e a conversa segue normal).
  if (!guard && ctx.flow) {
    if (now - ctx.flow.at > FLOW_TTL) ctx.flow = undefined;
    else {
      const fr = continueFlow(text, ctx.flow, data, now);
      if (fr === "cancel")
        return stamp({
          text: "Ok, parei por aqui. Nada mudou.",
          meta: { kind: "command" },
          ctx: { ...ctx, flow: undefined },
          layer: "flow",
        });
      if (fr === "off") ctx.flow = ctx.flow.off >= 1 ? undefined : { ...ctx.flow, off: ctx.flow.off + 1 };
      else return stamp(flowReply(fr, ctx));
    }
  }

  // "Desfaz": mostra o que vai ser desfeito e desfaz com um toque (ou "sim").
  if (!guard && UNDO.test(t)) {
    if (!env.undoLabel) return stamp({ text: "Não há nada recente para desfazer.", meta: { kind: "command" }, ctx, layer: "command" });
    return stamp({
      text: `Desfazer **${env.undoLabel}**?`,
      meta: { kind: "command" },
      ctx: { ...ctx, proposalOpen: true },
      proposal: { source: "undo", confirmLabel: `Desfazer: ${env.undoLabel}` },
      layer: "command",
    });
  }

  // "Repete", "de novo", "repete com 85": o último comando, trocando só o campo dito.
  const again = !guard && fresh && ctx.lastCommand ? t.match(REPEAT) : null;
  if (again && ctx.lastCommand) {
    const values = { ...ctx.lastCommand.values };
    if (again[2]) {
      const over = readCommand(`anota 1 com ${again[2]}`, data)?.values.carga;
      const dur = readCommand(`descanso de ${again[2]}`, data)?.values.duracao;
      if (ctx.lastCommand.id.startsWith("timer") && dur != null) values.duracao = dur;
      else if (over) values.carga = over;
    }
    const m = { id: ctx.lastCommand.id, values };
    const c = runCommand(m, data, text, { ...env, now });
    const r = commandToReply(c, ctx);
    r.ctx.lastCommand = m;
    return stamp({ ...r, layer: "command" });
  }

  // Pedido em aberto esperando o campo que faltou.
  if (!guard && prev.pending) {
    const c = continuePending(text, prev.pending, data, { ...env, now });
    if (c) return stamp({ ...commandToReply(c, ctx), layer: "pending" });
  }

  // 2. Comandos: frases-modelo e, se nenhuma casar, a frase livre (campos em qualquer ordem).
  if (!guard) {
    const m = readCommand(text, data);
    if (m?.ask) {
      return stamp({
        text: "Não entendi bem qual dos dois. Toque no que você quis:",
        meta: { kind: "maybe", chips: m.ask },
        ctx: { ...ctx, pending: undefined },
        layer: "maybe",
      });
    }
    if (m) {
      const c = runCommand(m, data, text, { ...env, now });
      const r = commandToReply(c, ctx);
      if (!c.pending) r.ctx.lastCommand = { id: m.id, values: m.values };
      // Leitura livre de nota média que não grava: diz como entendeu (a de nota alta não precisa; a gravação já
      // repete os campos na proposta).
      if (m.free && (m.score ?? 1) < 0.9 && !c.proposal && !c.pending) r.meta.understood = `Entendi: ${readingLabel(m)}.`;
      if (alias) r.meta.alias = alias.from;
      return stamp({ ...r, layer: "command" });
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

  // 3b. Raciocínio com os dados: "por quê", "e se", resumo, de onde saiu o número, o que o chat sabe, mais curto/longo.
  if (!guard) {
    // Memória do que a pessoa contou: guardar (com confirmação), listar e esquecer.
    const about = aboutMe(text, data.memory, data.today);
    if (about)
      return stamp({ text: about, meta: { kind: "data", route: "/ajustes", routeLabel: "Abrir os ajustes" }, ctx, layer: "assist" });
    const forget = forgetNote(text, data.memory);
    if (forget === "none")
      return stamp({
        text: 'Não achei isso no que eu guardei. Pergunte "o que você sabe sobre mim" para ver a lista.',
        meta: { kind: "command" },
        ctx,
        layer: "assist",
      });
    if (forget) {
      const { text: ft, ...fp } = forget;
      return stamp({
        text: ft,
        meta: { kind: "command" },
        ctx: { ...ctx, proposalOpen: true },
        proposal: { source: "note", ...fp },
        layer: "assist",
      });
    }
    const note = detectNote(text, data.today, () => `n${now.toString(36)}`);
    if (note) {
      const { text: nt, ...np } = note;
      return stamp({
        text: nt,
        meta: { kind: "command" },
        ctx: { ...ctx, proposalOpen: true },
        proposal: { source: "note", ...np },
        layer: "assist",
      });
    }
    const why = whyAnswer(text, data, { exercise: ctx.exercise, muscle: ctx.muscle });
    if (why) return stamp({ ...reasonReply(why, ctx), layer: "why" });
    const wi = whatIfAnswer(text, data, { exercise: ctx.exercise, muscle: ctx.muscle });
    if (wi?.redirect) {
      const ir = handleIntent(wi.redirect, { sessions: data.sessions, settings: data.settings, today: data.today, memory: data.memory });
      if (ir.matched)
        return stamp({
          text: ir.reply,
          meta: { kind: "command" },
          ctx: { ...ctx, proposalOpen: !!ir.proposal, pending: undefined },
          proposal: ir.proposal ? { source: "intent", ...ir.proposal } : undefined,
          layer: "intent",
        });
    } else if (wi) {
      const r = reasonReply(wi, ctx);
      return stamp({ ...r, ctx: { ...r.ctx, proposalOpen: !!wi.proposal }, proposal: wi.proposal, layer: "whatif" });
    }
    const sum = summaryAnswer(text, data);
    if (sum)
      return stamp({
        text: sum.text,
        meta: { kind: "data", card: sum.card, route: sum.route, routeLabel: "Abrir o relatório" },
        ctx,
        layer: "assist",
      });
    const trace = traceAnswer(text, data, ctx.query);
    if (trace) return stamp({ text: trace, meta: { kind: "data" }, ctx, layer: "assist" });
    const caps = capabilitiesAnswer(text);
    if (caps) return stamp({ text: caps.text, meta: { kind: "answer", chips: caps.chips }, ctx, layer: "assist" });
    const flow = startFlow(text, now);
    if (flow) return stamp(flowReply(flow, ctx));
    const depth = fresh && ctx.lastAnswer ? depthReply(t, ctx.lastAnswer) : null;
    if (depth)
      return stamp({ text: depth, meta: { kind: "answer", principle: BY_ID.get(ctx.lastAnswer!)?.principle }, ctx, layer: "assist" });
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
  if (alias) r.meta = { ...r.meta, alias: alias.from };
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
  // Resposta com dados: botões que saem do estado da pessoa e, se houver, um "Aliás" de verdade.
  if (layer === "data") {
    const ex = r.ctx.exercise && detectExercise(q) ? r.ctx.exercise : undefined;
    const mu = detectMuscleWord(q) ? r.ctx.muscle : undefined;
    const chips = stateChips(data, ex, mu, q);
    if (chips.length) r.meta = { ...r.meta, chips };
    const aside = asideFor(data, ex, r.ctx.asides ?? {});
    if (aside) {
      r.text = `${r.text}\n\n${aside.text}`;
      r.ctx = { ...r.ctx, asides: { ...(r.ctx.asides ?? {}), [aside.key]: data.today } };
    }
  }
  const keep = layer === "data" ? r.ctx : { ...r.ctx, pending: undefined, proposalOpen: false };
  return stamp({ ...r, ctx: keep, layer });
}

function flowReply(fr: FlowReply, ctx: ChatContext): Omit<CoreReply, "layer"> & { layer: "flow" } {
  return {
    text: fr.text,
    meta: { kind: "command", chips: fr.chips, route: fr.end?.route, routeLabel: fr.end?.routeLabel },
    ctx: { ...ctx, flow: fr.flow, proposalOpen: !!fr.end?.proposal, pending: undefined },
    proposal: fr.end?.proposal,
    layer: "flow",
  };
}

function reasonReply(r: ReasonReply, ctx: ChatContext): Omit<CoreReply, "layer"> {
  return {
    text: r.text,
    meta: { kind: "data", level: r.level, principle: r.principle, route: r.route, routeLabel: r.routeLabel, card: r.card, chips: r.chips },
    ctx: { ...ctx, exercise: r.exercise ?? ctx.exercise, muscle: r.muscle ?? ctx.muscle },
  };
}

const SHORTER = /^(resumindo|resume|resumo disso|mais simples|mais curto|em uma frase|explica simples|simplifica|tl ?dr)$/;
const LONGER = /^(explica melhor|explica mais|mais detalhe|mais detalhes|detalha|aprofunda|quero saber mais|fala mais|me explica isso)$/;

/** A última resposta pronta noutro tamanho: a primeira frase, ou a resposta com o que o Guia diz. */
function depthReply(t: string, answerId: string): string | null {
  const a = BY_ID.get(answerId);
  if (!a) return null;
  if (SHORTER.test(t)) return a.answer.replace(/\*\*/g, "").split(/(?<=[.!?])\s/)[0];
  if (LONGER.test(t)) {
    const p = a.principle ? PRINCIPLES.find((x) => x.id === a.principle) : undefined;
    return p
      ? `${a.answer}\n\n**No Guia (${p.tema}):** ${p.texto}${p.app ? ` ${p.app}` : ""}`
      : `${a.answer}\n\nNão tenho mais detalhe sobre isso além do que está acima.`;
  }
  return null;
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
