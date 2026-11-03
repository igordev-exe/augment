import Anthropic from "@anthropic-ai/sdk";
import { db } from "../db";
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

export const MODELS: { id: string; label: string }[] = [
  { id: "claude-opus-5-5", label: "Opus 5.5 · melhor análise" },
  { id: "claude-sonnet-5-5", label: "Sonnet 5.5 · mais barato" },
  { id: "claude-haiku-5-5", label: "Haiku 5.5 · o mais barato" },
];

export const DEFAULT_CONFIG: CoachConfig = { apiKey: "", model: "claude-opus-5-5", effort: "medium" };

export interface CoachChat {
  messages: Anthropic.Beta.BetaMessageParam[];
  /** Tokens somados na conversa (entrada sem cache, lidos do cache, saída). */
  usage: { input: number; cacheRead: number; output: number };
  /** Resposta às propostas, pelo id do tool_use. */
  proposals: Record<string, "aplicada" | "recusada">;
  /** Decisões sobre propostas ainda não contadas ao treinador (vão na próxima mensagem). */
  notes?: string[];
}

export const EMPTY_CHAT: CoachChat = { messages: [], usage: { input: 0, cacheRead: 0, output: 0 }, proposals: {} };

export async function loadCoachConfig(): Promise<CoachConfig> {
  const row = await db.kv.get("coach-config");
  return { ...DEFAULT_CONFIG, ...((row?.value as Partial<CoachConfig>) ?? {}) };
}

export async function saveCoachConfig(c: CoachConfig): Promise<void> {
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
 * O histórico só cresce (nunca reescreve mensagens antigas): mantém o cache e os blocos de raciocínio válidos.
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
  const system = coachSystem(data.settings.operator || "Igor");
  let cur = chat;

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
    cur = { ...cur, messages: [...cur.messages, { role: "user", content: results }] };
    h.onChat(cur);
  }
  return "limite";
}
