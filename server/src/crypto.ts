// Senhas e tokens com a Web Crypto (existe igual no Cloudflare Workers e no Node 20+).

const enc = new TextEncoder();
/** O Workers aceita no máximo 100 mil iterações de PBKDF2. */
const PBKDF2_ITER = 100_000;

function b64url(bytes: Uint8Array): string {
  let s = "";
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function fromB64url(s: string): Uint8Array {
  const bin = atob(s.replace(/-/g, "+").replace(/_/g, "/"));
  return Uint8Array.from(bin, (c) => c.charCodeAt(0));
}

export function randomToken(bytes = 32): string {
  return b64url(crypto.getRandomValues(new Uint8Array(bytes)));
}

export function randomId(): string {
  return randomToken(12);
}

export async function sha256(text: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", enc.encode(text));
  return b64url(new Uint8Array(buf));
}

async function pbkdf2(secret: string, salt: Uint8Array, iter: number): Promise<Uint8Array> {
  const key = await crypto.subtle.importKey("raw", enc.encode(secret), "PBKDF2", false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits({ name: "PBKDF2", hash: "SHA-256", salt, iterations: iter }, key, 256);
  return new Uint8Array(bits);
}

/** Formato: pbkdf2$<iterações>$<sal>$<hash>. */
export async function hashSecret(secret: string, iter = PBKDF2_ITER): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const hash = await pbkdf2(secret, salt, iter);
  return `pbkdf2$${iter}$${b64url(salt)}$${b64url(hash)}`;
}

export async function verifySecret(secret: string, stored: string): Promise<boolean> {
  const [kind, iterS, saltS, hashS] = stored.split("$");
  if (kind !== "pbkdf2" || !iterS || !saltS || !hashS) return false;
  const got = await pbkdf2(secret, fromB64url(saltS), Number(iterS));
  const want = fromB64url(hashS);
  if (got.length !== want.length) return false;
  let diff = 0;
  for (let i = 0; i < got.length; i++) diff |= got[i] ^ want[i];
  return diff === 0;
}

/** Código de recuperação: 16 letras/números sem os ambíguos (0/O, 1/I/L), em 4 blocos. */
export function recoveryCode(): string {
  const abc = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  const chars = [...bytes].map((b) => abc[b % abc.length]);
  return [0, 4, 8, 12].map((i) => chars.slice(i, i + 4).join("")).join("-");
}

/** Normaliza o que a pessoa digitou no código (minúsculas, sem traço, espaços). */
export function normalizeRecovery(code: string): string {
  return code.toUpperCase().replace(/[^A-Z0-9]/g, "");
}
