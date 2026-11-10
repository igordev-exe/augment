// Registro de erros: quando uma tela quebra, o app guarda o erro no aparelho (últimos 20) e, se houver servidor
// configurado e internet, manda uma cópia sem dados pessoais (mensagem, trecho da pilha, rota e versão).
import { db } from "./db";
import { isNative } from "./native";
import { apiUrl } from "./online/client";

export interface ErrorEntry {
  at: number;
  message: string;
  stack: string;
  route: string;
  version: string;
}

const KEY = "error-log";
const MAX = 20;
const sent = new Set<string>();

/** Tira o que pode identificar a pessoa: endereços completos viram só o caminho do arquivo. */
export function cleanStack(stack: string): string {
  return stack
    .replace(/https?:\/\/[^\s)]*?\/(assets|src)\//g, "$1/")
    .replace(/\?[^\s:)]*/g, "")
    .split("\n")
    .slice(0, 12)
    .join("\n")
    .slice(0, 1500);
}

export function describeError(err: unknown): { message: string; stack: string } {
  if (err instanceof Error) return { message: `${err.name}: ${err.message}`.slice(0, 300), stack: cleanStack(err.stack ?? "") };
  return { message: String(err).slice(0, 300), stack: "" };
}

export async function loadErrorLog(): Promise<ErrorEntry[]> {
  try {
    return ((await db.kv.get(KEY))?.value as ErrorEntry[] | undefined) ?? [];
  } catch {
    return [];
  }
}

export async function reportError(err: unknown, where = ""): Promise<void> {
  const { message, stack } = describeError(err);
  // Rota sem o id do treino/exercício (não interessa e pode identificar).
  const route = (location.hash.replace(/^#/, "") || "/").replace(/\/[^/]{6,}$/, "/:id").slice(0, 80);
  const entry: ErrorEntry = { at: Date.now(), message: where ? `[${where}] ${message}` : message, stack, route, version: __APP_VERSION__ };
  try {
    await db.kv.put({ key: KEY, value: [entry, ...(await loadErrorLog())].slice(0, MAX) });
  } catch {
    /* banco indisponível: segue só com o envio */
  }
  const base = apiUrl();
  const fp = `${entry.message}|${stack.slice(0, 120)}`;
  if (!base || sent.has(fp) || sent.size > 10) return;
  sent.add(fp);
  fetch(`${base}/errors`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ...entry, platform: isNative ? "app" : "web" }),
    keepalive: true,
  }).catch(() => {});
}

/** Erros fora do React (promessas sem tratamento, scripts). */
export function installErrorReporting(): void {
  window.addEventListener("error", (e) => void reportError(e.error ?? e.message, "window"));
  window.addEventListener("unhandledrejection", (e) => void reportError(e.reason, "promise"));
}
