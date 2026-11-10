// Conversa com o servidor do AUGMENT online. O app funciona sem isto: tudo continua no aparelho (IndexedDB) e o
// servidor só recebe cópias (recordes, resumo dos treinos, backup) quando há conta e internet.
import { isNative, readSecretKey, writeSecretKey } from "../native";

const URL_KEY = "augment-api-url";
const TOKEN_KEY = "augment-online-token";

/** Endereço do servidor: o que a pessoa configurou em Ajustes ou o do build (VITE_API_URL). Vazio = sem online. */
export function apiUrl(): string {
  let custom = "";
  try {
    custom = localStorage.getItem(URL_KEY) ?? "";
  } catch {
    /* sem localStorage */
  }
  return (custom || import.meta.env.VITE_API_URL || "").trim().replace(/\/+$/, "");
}

export function setApiUrl(url: string): void {
  const v = url.trim().replace(/\/+$/, "");
  if (v) localStorage.setItem(URL_KEY, v);
  else localStorage.removeItem(URL_KEY);
}

export function hasCustomApiUrl(): boolean {
  return !!localStorage.getItem(URL_KEY);
}

// ---------- token ----------

let tokenCache: string | null = null;

/** No celular o token fica no armazenamento seguro (Keystore/Keychain); no navegador, no localStorage. */
export async function loadToken(): Promise<string> {
  if (tokenCache !== null) return tokenCache;
  tokenCache = isNative ? await readSecretKey(TOKEN_KEY).catch(() => "") : (localStorage.getItem(TOKEN_KEY) ?? "");
  return tokenCache;
}

export async function saveToken(token: string): Promise<void> {
  tokenCache = token;
  if (isNative) await writeSecretKey(token, TOKEN_KEY).catch(() => {});
  else if (token) localStorage.setItem(TOKEN_KEY, token);
  else localStorage.removeItem(TOKEN_KEY);
}

// ---------- chamadas ----------

export class ApiError extends Error {
  constructor(
    message: string,
    /** 0 = sem conexão / servidor fora do ar. */
    public status: number,
  ) {
    super(message);
  }
  get offline(): boolean {
    return this.status === 0;
  }
}

export function isOnlineNow(): boolean {
  return typeof navigator === "undefined" || navigator.onLine !== false;
}

export async function api<T>(method: string, path: string, body?: unknown, timeoutMs = 20_000): Promise<T> {
  const base = apiUrl();
  if (!base) throw new ApiError("Servidor online não configurado.", 0);
  const token = await loadToken();
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  let res: Response;
  try {
    res = await fetch(base + path, {
      method,
      headers: {
        ...(body === undefined ? {} : { "Content-Type": "application/json" }),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: ctrl.signal,
    });
  } catch {
    throw new ApiError("Sem conexão com o servidor. Seus dados continuam salvos no celular.", 0);
  } finally {
    clearTimeout(timer);
  }
  let data: unknown = null;
  try {
    data = await res.json();
  } catch {
    /* resposta sem JSON */
  }
  if (!res.ok) {
    const msg =
      data && typeof data === "object" && "error" in data ? String((data as { error: unknown }).error) : `Erro ${res.status} no servidor.`;
    throw new ApiError(msg, res.status);
  }
  return data as T;
}

/** Texto curto para mostrar ao usuário a partir de qualquer erro. */
export function onlineErrorText(err: unknown): string {
  if (err instanceof ApiError) return err.message;
  return "Algo deu errado. Tente de novo.";
}
