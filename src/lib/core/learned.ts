import { stem } from "./answers";
import { norm } from "./intents";

// AUG.CORE — o que o chat aprende no aparelho (bloco A do chat potente). Puro: a gravação fica em `db.ts`.
//
// - Perguntas não entendidas (kv `chat-misses`): para o dono ver o que as pessoas perguntam (`npm run misses`) e
//   escrever frases de teste e respostas novas a partir disso. Fica no aparelho e no backup; não sobe ao servidor.
// - Apelidos (kv `chat-aliases`): a pessoa tocou numa sugestão depois de um "você quis dizer" ou de um "não sei";
//   a mesma frase passa a ir direto para a pergunta escolhida. Comando de gravação continua saindo como proposta.

export const MISS_MAX = 200;
export const ALIAS_MAX = 300;

export interface ChatMiss {
  /** Texto normalizado (sem acento, minúsculo). */
  text: string;
  layer: "none" | "maybe";
  /** Primeira e última vez (AAAA-MM-DD). */
  first: string;
  last: string;
  count: number;
}

export interface ChatAlias {
  /** Chave: as palavras da frase, pelo radical, em ordem. */
  key: string;
  /** A frase como a pessoa escreveu (para mostrar e apagar). */
  from: string;
  /** A pergunta escolhida, que o chat já sabe responder. */
  to: string;
  at: string;
  uses: number;
}

/** Chave estável da frase: sem acento, sem pontuação, pelo radical. "Qto de proteína?" = "qto de proteina". */
export function phraseKey(text: string): string {
  return norm(text)
    .replace(/[^a-z0-9 ]+/g, " ")
    .split(/\s+/)
    .filter(Boolean)
    .map(stem)
    .join(" ");
}

/** Guarda (ou soma) uma pergunta não entendida. A mais antiga sai acima do teto. Assunto travado nunca entra. */
export function recordMiss(list: ChatMiss[], text: string, layer: ChatMiss["layer"], today: string): ChatMiss[] {
  const t = norm(text).replace(/\s+/g, " ").trim().slice(0, 200);
  if (!t) return list;
  const i = list.findIndex((m) => m.text === t);
  const next =
    i >= 0
      ? list.map((m, k) => (k === i ? { ...m, layer, last: today, count: m.count + 1 } : m))
      : [...list, { text: t, layer, first: today, last: today, count: 1 }];
  return next.sort((a, b) => (a.last < b.last ? 1 : a.last > b.last ? -1 : 0)).slice(0, MISS_MAX);
}

/** Lista para o dono: da mais repetida para a menos, depois a mais recente. */
export function missReport(list: ChatMiss[]): ChatMiss[] {
  return [...list].sort((a, b) => b.count - a.count || (a.last < b.last ? 1 : -1));
}

/** Aprende "essa frase → essa pergunta". Frase igual à pergunta, vazia ou curta demais não vira apelido. */
export function learnAlias(list: ChatAlias[], from: string, to: string, today: string): ChatAlias[] {
  const key = phraseKey(from);
  if (!key || key === phraseKey(to) || key.length < 3) return list;
  const rest = list.filter((a) => a.key !== key);
  return [{ key, from: from.trim().slice(0, 200), to: to.trim(), at: today, uses: 0 }, ...rest].slice(0, ALIAS_MAX);
}

/** Pergunta aprendida para esta frase, ou undefined. */
export function lookupAlias(list: ChatAlias[] | undefined, text: string): ChatAlias | undefined {
  if (!list?.length) return undefined;
  const key = phraseKey(text);
  return list.find((a) => a.key === key);
}

/** "Esquece esse apelido": tira o último aprendido (ou o desta frase). */
export function forgetAlias(list: ChatAlias[], text?: string): ChatAlias[] {
  if (text) {
    const key = phraseKey(text);
    if (list.some((a) => a.key === key)) return list.filter((a) => a.key !== key);
  }
  return list.slice(1);
}

/** Pedido para esquecer o que foi aprendido. */
export const FORGET_ALIAS =
  /^(esquece|esqueca|apaga|desfaz|nao) (esse|este|o|isso|esse) ?(apelido|atalho|aprendizado|que voce aprendeu)?$|^esquece (isso|esse apelido|o apelido)$/;

export function sanitizeMisses(x: unknown): ChatMiss[] {
  if (!Array.isArray(x)) return [];
  return x
    .filter(
      (m): m is ChatMiss =>
        !!m &&
        typeof m.text === "string" &&
        (m.layer === "none" || m.layer === "maybe") &&
        typeof m.count === "number" &&
        typeof m.last === "string",
    )
    .map((m) => ({
      text: m.text.slice(0, 200),
      layer: m.layer,
      first: String(m.first ?? m.last),
      last: m.last,
      count: Math.max(1, Math.floor(m.count)),
    }))
    .slice(0, MISS_MAX);
}

export function sanitizeAliases(x: unknown): ChatAlias[] {
  if (!Array.isArray(x)) return [];
  return x
    .filter((a): a is ChatAlias => !!a && typeof a.key === "string" && typeof a.to === "string" && typeof a.from === "string")
    .map((a) => ({ key: a.key, from: a.from.slice(0, 200), to: a.to.slice(0, 200), at: String(a.at ?? ""), uses: Number(a.uses) || 0 }))
    .slice(0, ALIAS_MAX);
}

/** Junta dois registros (backup "Juntar"): soma as contagens das mesmas frases. */
export function mergeMisses(a: ChatMiss[], b: ChatMiss[]): ChatMiss[] {
  const by = new Map(a.map((m) => [m.text, m]));
  for (const m of b) {
    const cur = by.get(m.text);
    by.set(m.text, cur ? { ...cur, count: cur.count + m.count, last: cur.last > m.last ? cur.last : m.last } : m);
  }
  return [...by.values()].sort((x, y) => (x.last < y.last ? 1 : -1)).slice(0, MISS_MAX);
}

export function mergeAliases(a: ChatAlias[], b: ChatAlias[]): ChatAlias[] {
  const keys = new Set(a.map((x) => x.key));
  return [...a, ...b.filter((x) => !keys.has(x.key))].slice(0, ALIAS_MAX);
}
