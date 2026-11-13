import Anthropic from "@anthropic-ai/sdk";
import type { LocalMeta } from "../core/localchat";
import { db } from "../db";
import { isNative, readSecretKey, writeSecretKey } from "../native";
import { coachSystem, runCoachTool, ToolInputError, type CoachData } from "./context";
import { COACH_TOOLS } from "./tools";

// Fase 3: o treinador no app. A chave fica só neste aparelho (IndexedDB, fora do backup)
// e o app chama a API direto do navegador. As cargas continuam vindo do motor de regras.

export type Effort = "low" | "medium" | "high";

export interface CoachConfig {
  apiKey: string;
  model: string;
  effort: Effort;
}

/** US$ por milhão de tokens: [entrada, leitura de cache, saída]. */
export const MODELS: { id: string; label: string; price: [number, number, number] }[] = [
  { id: "claude-opus-5-5", label: "Opus 5.5 · melhor análise", price: [4, 0.2, 20] },
  { id: "claude-sonnet-5-5", label: "Sonnet 5.5 · mais barato", price: [2, 0.2, 10] },
  { id: "claude-haiku-5-5", label: "Haiku 5.5 · o mais barato", price: [0.1, 0.01, 0.5] },
];

export function modelPrice(modelId: string): [number, number, number] {
  return MODELS.find((m) => m.id === modelId)?.price ?? MODELS[0].price;
}

export const DEFAULT_CONFIG: CoachConfig = { apiKey: "", model: "claude-opus-5-5", effort: "medium" };

export interface CoachChat {
  messages: Anthropic.Beta.BetaMessageParam[];
  /** Tokens somados na conversa (entrada sem cache, lidos do cache, saída). */
  usage: { input: number; cacheRead: number; output: number };
  /** Resposta às propostas, pelo id do tool_use. */
  proposals: Record<string, "aplicada" | "recusada">;
  /** Decisões sobre propostas ainda não contadas ao treinador (vão na próxima mensagem). */
  notes?: string[];
  /** Timestamp do último turno (para podar tool_results antigos após o cache de 5 min expirar). */
  lastTurnAt?: number;
  /** Respostas prontas (sem chave), pelo índice da mensagem: nível de evidência, atalhos e perguntas tocáveis. */
  local?: Record<number, LocalMeta>;
}

export const EMPTY_CHAT: CoachChat = { messages: [], usage: { input: 0, cacheRead: 0, output: 0 }, proposals: {} };

/** Tempo de vida do cache efêmero na API (5 min). */
export const CACHE_TTL_MS = 5 * 60_000;

const PRUNED_TOOL_RESULT = JSON.stringify({
  resumido: "Dados da consulta anterior omitidos após expirar o cache. Consulte a ferramenta de novo se precisar de números atualizados.",
});

/**
 * Compacta `tool_result` volumosos de turnos anteriores quando o cache efêmero de 5 minutos já expirou.
 * Enquanto o cache estiver ativo (`now - lastTurnAt <= 5 min`), não toca no histórico para não invalidar o prefixo.
 */
export function pruneExpiredToolResults(chat: CoachChat, now = Date.now()): CoachChat {
  if (!chat.lastTurnAt || now - chat.lastTurnAt <= CACHE_TTL_MS || chat.messages.length <= 2) return chat;
  let anyChanged = false;
  const keepFrom = chat.messages.length - 2;
  const messages = chat.messages.map((m, idx) => {
    if (idx >= keepFrom || m.role !== "user" || !Array.isArray(m.content)) return m;
    let msgChanged = false;
    const nextContent = m.content.map((b) => {
      if (b.type === "tool_result" && !b.is_error && typeof b.content === "string" && b.content.length > 200) {
        msgChanged = true;
        anyChanged = true;
        return { ...b, content: PRUNED_TOOL_RESULT };
      }
      return b;
    });
    return msgChanged ? { ...m, content: nextContent } : m;
  });
  return anyChanged ? { ...chat, messages } : chat;
}

export async function loadCoachConfig(): Promise<CoachConfig> {
  const row = await db.kv.get("coach-config");
  const cfg = { ...DEFAULT_CONFIG, ...((row?.value as Partial<CoachConfig>) ?? {}) };
  if (!isNative) return cfg;
  // APK: a chave mora no armazenamento seguro do Android. Uma chave antiga no IndexedDB é movida para lá.
  if (cfg.apiKey) {
    await saveCoachConfig(cfg);
    return cfg;
  }
  return { ...cfg, apiKey: await readSecretKey().catch(() => "") };
}

export async function saveCoachConfig(c: CoachConfig): Promise<void> {
  if (isNative) {
    await writeSecretKey(c.apiKey);
    await db.kv.put({ key: "coach-config", value: { ...c, apiKey: "" } });
    return;
  }
  await db.kv.put({ key: "coach-config", value: c });
}

export async function loadCoachChat(): Promise<CoachChat> {
  const row = await db.kv.get("coach-chat");
  return { ...EMPTY_CHAT, ...((row?.value as Partial<CoachChat>) ?? {}) };
}

export async function saveCoachChat(c: CoachChat): Promise<void> {
  await db.kv.put({ key: "coach-chat", value: c });
}

/** Mensagem de erro em português para cada falha da API. */
export function errorText(err: unknown): string {
  if (err instanceof Anthropic.APIUserAbortError) return "Resposta interrompida.";
  if (err instanceof Anthropic.AuthenticationError) return "Chave da API inválida. Confira em Configurar.";
  if (err instanceof Anthropic.PermissionDeniedError) return "Essa chave não tem permissão para esse modelo.";
  if (err instanceof Anthropic.RateLimitError) return "Limite de uso da API atingido. Tente de novo em alguns minutos.";
  if (err instanceof Anthropic.BadRequestError) return `A API recusou o pedido: ${err.message}`;
  if (err instanceof Anthropic.APIConnectionError) return "Sem conexão com a API. O treinador precisa de internet.";
  if (err instanceof Anthropic.APIError) return `Erro da API (${err.status ?? "?"}): ${err.message}`;
  return err instanceof Error ? err.message : String(err);
}

const MAX_STEPS = 8;

export interface TurnHandlers {
  /** Texto chegando aos poucos. */
  onText: (delta: string) => void;
  /** Uma ferramenta vai rodar. */
  onTool: (name: string) => void;
  /** Histórico mudou (salve e redesenhe). */
  onChat: (chat: CoachChat) => void;
}

export type TurnEnd = "fim" | "recusa" | "limite";

/**
 * Roda um turno do treinador: manda o histórico, executa as ferramentas pedidas e repete até ele terminar.
 * O histórico só cresce enquanto o cache está quente; se o cache expirou (>5 min), poda os JSONs antigos.
 */
export async function coachTurn(
  config: CoachConfig,
  chat: CoachChat,
  data: CoachData,
  h: TurnHandlers,
  signal?: AbortSignal,
): Promise<TurnEnd> {
  const client = new Anthropic({ apiKey: config.apiKey, dangerouslyAllowBrowser: true });
  // Haiku não tem fallback no servidor; Opus e Sonnet tentam outro modelo se o pedido for recusado.
  const fallback = config.model.startsWith("claude-haiku")
    ? {}
    : { betas: ["server-side-fallback-2026-07-01"], fallbacks: "default" as const };
  const system = coachSystem(data.settings.operator);
  let cur = pruneExpiredToolResults(chat);

  for (let step = 0; step < MAX_STEPS; step++) {
    const stream = client.beta.messages.stream(
      {
        model: config.model,
        max_tokens: 16000,
        system: [{ type: "text", text: system, cache_control: { type: "ephemeral" } }],
        tools: COACH_TOOLS,
        messages: cur.messages,
        cache_control: { type: "ephemeral" },
        output_config: { effort: config.effort },
        ...fallback,
      },
      { signal },
    );
    for await (const ev of stream) {
      if (ev.type === "content_block_delta" && ev.delta.type === "text_delta") h.onText(ev.delta.text);
    }
    const msg = await stream.finalMessage();

    cur = {
      ...cur,
      lastTurnAt: Date.now(),
      messages: [...cur.messages, { role: "assistant", content: msg.content as Anthropic.Beta.BetaContentBlockParam[] }],
      usage: {
        input: cur.usage.input + (msg.usage.input_tokens ?? 0) + (msg.usage.cache_creation_input_tokens ?? 0),
        cacheRead: cur.usage.cacheRead + (msg.usage.cache_read_input_tokens ?? 0),
        output: cur.usage.output + (msg.usage.output_tokens ?? 0),
      },
    };
    h.onChat(cur);

    if (msg.stop_reason === "refusal") return "recusa";
    const uses = msg.content.filter((b): b is Anthropic.Beta.BetaToolUseBlock => b.type === "tool_use");
    if (!uses.length) return "fim";
    if (msg.stop_reason === "max_tokens") throw new Error("A resposta foi cortada no meio de uma consulta. Tente de novo.");

    // Todas as respostas das ferramentas voltam numa mensagem só.
    const results: Anthropic.Beta.BetaToolResultBlockParam[] = uses.map((u) => {
      h.onTool(u.name);
      const input = u.input;
      if (!input || typeof input !== "object" || Array.isArray(input)) {
        return { type: "tool_result", tool_use_id: u.id, is_error: true, content: "Entrada inválida: esperado um objeto JSON." };
      }
      try {
        const out = runCoachTool(u.name, input as Record<string, unknown>, data);
        return { type: "tool_result", tool_use_id: u.id, content: JSON.stringify(out) };
      } catch (e) {
        const text = e instanceof ToolInputError ? e.message : `Falha ao ler os dados: ${e instanceof Error ? e.message : e}`;
        return { type: "tool_result", tool_use_id: u.id, is_error: true, content: text };
      }
    });
    cur = { ...cur, lastTurnAt: Date.now(), messages: [...cur.messages, { role: "user", content: results }] };
    h.onChat(cur);
  }
  return "limite";
}
