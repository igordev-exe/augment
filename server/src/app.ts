// Servidor do AUGMENT online. Uma função `handle(request, env)` sem dependências: roda no Cloudflare Workers
// (worker.ts) e no Node (node.ts). Rotas em JSON; login por token Bearer.

import { hashSecret, normalizeRecovery, randomId, randomToken, recoveryCode, sha256, verifySecret } from "./crypto";
import type { Db, DbStatement, Env } from "./db";
import {
  LIMITS,
  REPORT_REASONS,
  USERNAME_RE,
  type ActivityIn,
  type AuthResponse,
  type BackupMeta,
  type FeedItem,
  type Friend,
  type FriendsResponse,
  type Me,
  type Percentile,
  type PublicUser,
  type RankRow,
  type RecordIn,
  type Sex,
  type WorkoutChange,
  type WorkoutPull,
} from "./protocol";

const TOKEN_IDLE_MS = 180 * 24 * 3600_000;
const LOCK_AFTER = 5;
const LOCK_MS = 15 * 60_000;
const MAX_JSON = 25_000_000;

class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

const bad = (msg: string) => new HttpError(400, msg);

interface UserRow {
  id: string;
  username: string;
  display_name: string;
  pass_hash: string;
  recovery_hash: string;
  share_percentiles: number;
  share_activity: number;
  failed_logins: number;
  locked_until: number;
  created_at: number;
}

const pub = (u: Pick<UserRow, "id" | "username" | "display_name">): PublicUser => ({
  id: u.id,
  username: u.username,
  displayName: u.display_name,
});

interface Profile {
  sex: Sex;
  bw_kg: number;
}
const NO_PROFILE: Profile = { sex: "", bw_kg: 0 };

const meOf = (u: UserRow, p: Profile = NO_PROFILE): Me => ({
  ...pub(u),
  sharePercentiles: !!u.share_percentiles,
  shareActivity: !!u.share_activity,
  createdAt: u.created_at,
  sex: p.sex,
  bodyweightKg: p.bw_kg > 0 ? p.bw_kg : null,
});

async function profileOf(db: Db, userId: string): Promise<Profile> {
  const p = await db.prepare("SELECT sex, bw_kg FROM profiles WHERE user_id = ?").bind(userId).first<Profile>();
  return p ? { sex: p.sex === "m" || p.sex === "f" ? p.sex : "", bw_kg: p.bw_kg } : NO_PROFILE;
}

// ---------- utilidades ----------

function cors(req: Request, env: Env): Record<string, string> {
  const origin = req.headers.get("Origin") ?? "";
  const allowed = (env.ALLOWED_ORIGINS ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  const allow = !allowed.length ? "*" : allowed.includes(origin) ? origin : allowed[0];
  return {
    "Access-Control-Allow-Origin": allow,
    "Access-Control-Allow-Methods": "GET, POST, PUT, PATCH, DELETE, OPTIONS",
    "Access-Control-Allow-Headers": "Authorization, Content-Type",
    "Access-Control-Max-Age": "86400",
    Vary: "Origin",
  };
}

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" },
  });
}

async function body<T>(req: Request): Promise<T> {
  const len = Number(req.headers.get("Content-Length") ?? 0);
  if (len > MAX_JSON) throw new HttpError(413, "Envio grande demais.");
  const text = await req.text();
  if (text.length > MAX_JSON) throw new HttpError(413, "Envio grande demais.");
  try {
    return JSON.parse(text) as T;
  } catch {
    throw bad("JSON inválido.");
  }
}

const str = (v: unknown, max: number): string => (typeof v === "string" ? v.trim().slice(0, max) : "");
const num = (v: unknown): number => (typeof v === "number" && Number.isFinite(v) ? v : NaN);
const isDate = (v: unknown): v is string => typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v);

/** Janela fixa de tentativas. Devolve false quando passou do limite. */
async function rateLimit(db: Db, key: string, max: number, windowMs: number, now: number): Promise<boolean> {
  const row = await db
    .prepare("SELECT count, window_start FROM rate_limits WHERE key = ?")
    .bind(key)
    .first<{ count: number; window_start: number }>();
  if (!row || now - row.window_start > windowMs) {
    await db.prepare("INSERT OR REPLACE INTO rate_limits (key, count, window_start) VALUES (?, 1, ?)").bind(key, now).run();
    return true;
  }
  if (row.count >= max) return false;
  await db.prepare("UPDATE rate_limits SET count = count + 1 WHERE key = ?").bind(key).run();
  return true;
}

async function issueToken(db: Db, userId: string, now: number): Promise<string> {
  const token = randomToken();
  await db
    .prepare("INSERT INTO auth_tokens (token_hash, user_id, created_at, last_seen) VALUES (?, ?, ?, ?)")
    .bind(await sha256(token), userId, now, now)
    .run();
  return token;
}

async function authUser(req: Request, db: Db, now: number): Promise<{ user: UserRow; tokenHash: string }> {
  const h = req.headers.get("Authorization") ?? "";
  const token = h.startsWith("Bearer ") ? h.slice(7).trim() : "";
  if (!token) throw new HttpError(401, "Entre na sua conta.");
  const tokenHash = await sha256(token);
  const row = await db
    .prepare("SELECT u.*, t.last_seen AS t_seen FROM auth_tokens t JOIN users u ON u.id = t.user_id WHERE t.token_hash = ?")
    .bind(tokenHash)
    .first<UserRow & { t_seen: number }>();
  if (!row || now - row.t_seen > TOKEN_IDLE_MS) throw new HttpError(401, "Sessão expirada. Entre de novo.");
  // Atualiza o "visto por último" no máximo uma vez por hora (menos escrita no banco).
  if (now - row.t_seen > 3600_000) await db.prepare("UPDATE auth_tokens SET last_seen = ? WHERE token_hash = ?").bind(now, tokenHash).run();
  return { user: row, tokenHash };
}

const pair = (x: string, y: string): [string, string] => (x < y ? [x, y] : [y, x]);

async function areFriends(db: Db, x: string, y: string): Promise<boolean> {
  const [a, b] = pair(x, y);
  const row = await db.prepare("SELECT status FROM friendships WHERE a = ? AND b = ?").bind(a, b).first<{ status: string }>();
  return row?.status === "accepted";
}

// ---------- contas ----------

async function register(req: Request, db: Db, now: number): Promise<Response> {
  // Operadoras de celular põem muita gente atrás do mesmo IP: o limite é folgado, só barra robô.
  const ip = req.headers.get("CF-Connecting-IP") ?? req.headers.get("X-Forwarded-For")?.split(",")[0].trim() ?? "local";
  if (!(await rateLimit(db, `reg:${ip}`, 30, 3600_000, now)))
    throw new HttpError(429, "Muitos cadastros deste endereço. Tente daqui a uma hora.");
  const b = await body<Record<string, unknown>>(req);
  const username = str(b.username, 40).toLowerCase();
  const password = typeof b.password === "string" ? b.password : "";
  const displayName = str(b.displayName, 24) || username;
  if (!USERNAME_RE.test(username)) throw bad("Usuário: 3 a 20 letras minúsculas, números, ponto ou _.");
  if (password.length < 8) throw bad("A senha precisa de pelo menos 8 caracteres.");
  if (password.length > 200) throw bad("Senha longa demais.");
  const exists = await db.prepare("SELECT 1 FROM users WHERE username = ?").bind(username).first();
  if (exists) throw new HttpError(409, "Esse nome de usuário já existe.");
  const code = recoveryCode();
  const user: UserRow = {
    id: randomId(),
    username,
    display_name: displayName,
    pass_hash: await hashSecret(password),
    recovery_hash: await hashSecret(normalizeRecovery(code), 20_000),
    share_percentiles: b.sharePercentiles === false ? 0 : 1,
    share_activity: b.shareActivity === false ? 0 : 1,
    failed_logins: 0,
    locked_until: 0,
    created_at: now,
  };
  await db
    .prepare(
      "INSERT INTO users (id, username, display_name, pass_hash, recovery_hash, share_percentiles, share_activity, failed_logins, locked_until, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, 0, 0, ?)",
    )
    .bind(user.id, user.username, user.display_name, user.pass_hash, user.recovery_hash, user.share_percentiles, user.share_activity, now)
    .run();
  const out: AuthResponse = { token: await issueToken(db, user.id, now), user: meOf(user), recoveryCode: code };
  return json(out, 201);
}

async function login(req: Request, db: Db, now: number): Promise<Response> {
  const b = await body<Record<string, unknown>>(req);
  const username = str(b.username, 40).toLowerCase();
  const password = typeof b.password === "string" ? b.password : "";
  const user = await db.prepare("SELECT * FROM users WHERE username = ?").bind(username).first<UserRow>();
  if (!user) throw new HttpError(401, "Usuário ou senha incorretos.");
  if (user.locked_until > now) {
    const min = Math.ceil((user.locked_until - now) / 60_000);
    throw new HttpError(429, `Muitas tentativas. Tente de novo em ${min} min.`);
  }
  if (!(await verifySecret(password, user.pass_hash))) {
    const fails = user.failed_logins + 1;
    const lock = fails >= LOCK_AFTER ? now + LOCK_MS : 0;
    await db
      .prepare("UPDATE users SET failed_logins = ?, locked_until = ? WHERE id = ?")
      .bind(lock ? 0 : fails, lock, user.id)
      .run();
    throw new HttpError(401, "Usuário ou senha incorretos.");
  }
  await db.prepare("UPDATE users SET failed_logins = 0, locked_until = 0 WHERE id = ?").bind(user.id).run();
  const out: AuthResponse = { token: await issueToken(db, user.id, now), user: meOf(user, await profileOf(db, user.id)) };
  return json(out);
}

/** Esqueceu a senha: usuário + código de recuperação → senha nova, código novo, todos os aparelhos saem. */
async function recover(req: Request, db: Db, now: number): Promise<Response> {
  const b = await body<Record<string, unknown>>(req);
  const username = str(b.username, 40).toLowerCase();
  const code = normalizeRecovery(str(b.recoveryCode, 40));
  const password = typeof b.newPassword === "string" ? b.newPassword : "";
  if (password.length < 8) throw bad("A senha nova precisa de pelo menos 8 caracteres.");
  if (!(await rateLimit(db, `rec:${username}`, 5, 3600_000, now))) throw new HttpError(429, "Muitas tentativas. Tente daqui a uma hora.");
  const user = await db.prepare("SELECT * FROM users WHERE username = ?").bind(username).first<UserRow>();
  if (!user || !(await verifySecret(code, user.recovery_hash))) throw new HttpError(401, "Usuário ou código de recuperação incorretos.");
  const newCode = recoveryCode();
  await db.batch([
    db
      .prepare("UPDATE users SET pass_hash = ?, recovery_hash = ?, failed_logins = 0, locked_until = 0 WHERE id = ?")
      .bind(await hashSecret(password), await hashSecret(normalizeRecovery(newCode), 20_000), user.id),
    db.prepare("DELETE FROM auth_tokens WHERE user_id = ?").bind(user.id),
  ]);
  const out: AuthResponse = {
    token: await issueToken(db, user.id, now),
    user: meOf(user, await profileOf(db, user.id)),
    recoveryCode: newCode,
  };
  return json(out);
}

async function patchMe(req: Request, db: Db, user: UserRow, now: number): Promise<Response> {
  const b = await body<Record<string, unknown>>(req);
  const next = { ...user };
  if (typeof b.displayName === "string") next.display_name = str(b.displayName, 24) || user.username;
  if (typeof b.sharePercentiles === "boolean") next.share_percentiles = b.sharePercentiles ? 1 : 0;
  if (typeof b.shareActivity === "boolean") next.share_activity = b.shareActivity ? 1 : 0;
  await db
    .prepare("UPDATE users SET display_name = ?, share_percentiles = ?, share_activity = ? WHERE id = ?")
    .bind(next.display_name, next.share_percentiles, next.share_activity, user.id)
    .run();
  // Sexo e peso: opcionais, só para a comparação por faixa. `null` ou "" apaga.
  const p = { ...(await profileOf(db, user.id)) };
  let touched = false;
  if (b.sex === "m" || b.sex === "f" || b.sex === "") {
    p.sex = b.sex;
    touched = true;
  }
  if (b.bodyweightKg === null) {
    p.bw_kg = 0;
    touched = true;
  } else if (typeof b.bodyweightKg === "number") {
    const kg = num(b.bodyweightKg);
    if (!(kg >= 30 && kg <= 300)) throw bad("Peso corporal: entre 30 e 300 kg.");
    p.bw_kg = Math.round(kg * 10) / 10;
    touched = true;
  }
  if (touched) {
    await db
      .prepare(
        "INSERT INTO profiles (user_id, sex, bw_kg, updated_at) VALUES (?, ?, ?, ?) ON CONFLICT (user_id) DO UPDATE SET sex = excluded.sex, bw_kg = excluded.bw_kg, updated_at = excluded.updated_at",
      )
      .bind(user.id, p.sex, p.bw_kg, now)
      .run();
  }
  return json({ user: meOf(next, p) });
}

/** Perdeu o código de recuperação mas ainda está logado: confirma a senha e recebe um novo (o antigo deixa de valer). */
async function newRecoveryCode(req: Request, db: Db, user: UserRow, now: number): Promise<Response> {
  const b = await body<Record<string, unknown>>(req);
  const pw = typeof b.password === "string" ? b.password : "";
  if (!(await rateLimit(db, `rc:${user.id}`, 5, 3600_000, now))) throw new HttpError(429, "Muitas tentativas. Tente daqui a uma hora.");
  if (!(await verifySecret(pw, user.pass_hash))) throw new HttpError(401, "Senha incorreta.");
  const code = recoveryCode();
  await db
    .prepare("UPDATE users SET recovery_hash = ? WHERE id = ?")
    .bind(await hashSecret(normalizeRecovery(code), 20_000), user.id)
    .run();
  return json({ recoveryCode: code });
}

async function changePassword(req: Request, db: Db, user: UserRow, tokenHash: string): Promise<Response> {
  const b = await body<Record<string, unknown>>(req);
  const cur = typeof b.currentPassword === "string" ? b.currentPassword : "";
  const next = typeof b.newPassword === "string" ? b.newPassword : "";
  if (next.length < 8) throw bad("A senha nova precisa de pelo menos 8 caracteres.");
  if (!(await verifySecret(cur, user.pass_hash))) throw new HttpError(401, "Senha atual incorreta.");
  await db.batch([
    db.prepare("UPDATE users SET pass_hash = ? WHERE id = ?").bind(await hashSecret(next), user.id),
    // Os outros aparelhos saem; este continua.
    db.prepare("DELETE FROM auth_tokens WHERE user_id = ? AND token_hash != ?").bind(user.id, tokenHash),
  ]);
  return json({ ok: true });
}

/** Apagar a conta: some tudo do servidor (exigência das lojas de app). O que está no celular continua. */
async function deleteAccount(req: Request, db: Db, user: UserRow): Promise<Response> {
  const b = await body<Record<string, unknown>>(req);
  const pw = typeof b.password === "string" ? b.password : "";
  if (!(await verifySecret(pw, user.pass_hash))) throw new HttpError(401, "Senha incorreta.");
  await db.batch(wipeUser(db, user.id));
  return json({ ok: true });
}

/** Tudo de uma pessoa no servidor, para apagar de uma vez. */
function wipeUser(db: Db, id: string): DbStatement[] {
  return [
    db.prepare("DELETE FROM backup_chunks WHERE backup_id IN (SELECT id FROM backups WHERE user_id = ?)").bind(id),
    db.prepare("DELETE FROM backups WHERE user_id = ?").bind(id),
    db.prepare("DELETE FROM activity WHERE user_id = ?").bind(id),
    db.prepare("DELETE FROM workouts WHERE user_id = ?").bind(id),
    db.prepare("DELETE FROM records WHERE user_id = ?").bind(id),
    db.prepare("DELETE FROM friendships WHERE a = ? OR b = ?").bind(id, id),
    db.prepare("DELETE FROM profiles WHERE user_id = ?").bind(id),
    db.prepare("DELETE FROM blocks WHERE blocker = ? OR blocked = ?").bind(id, id),
    db.prepare("DELETE FROM reports WHERE reporter = ? OR target = ?").bind(id, id),
    db.prepare("DELETE FROM auth_tokens WHERE user_id = ?").bind(id),
    db.prepare("DELETE FROM users WHERE id = ?").bind(id),
  ];
}

// ---------- amigos ----------

async function searchUsers(url: URL, db: Db, user: UserRow): Promise<Response> {
  const q = (url.searchParams.get("q") ?? "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_.]/g, "");
  if (q.length < 2) return json({ users: [] });
  const { results } = await db
    .prepare(
      `SELECT id, username, display_name FROM users WHERE username LIKE ?1 AND id != ?2
       AND NOT EXISTS (SELECT 1 FROM blocks k WHERE (k.blocker = ?2 AND k.blocked = users.id) OR (k.blocker = users.id AND k.blocked = ?2))
       ORDER BY username LIMIT 10`,
    )
    .bind(`${q}%`, user.id)
    .all<UserRow>();
  return json({ users: results.map(pub) });
}

async function listFriends(db: Db, user: UserRow): Promise<Response> {
  const { results } = await db
    .prepare(
      `SELECT f.status, f.requester, f.created_at, u.id, u.username, u.display_name
       FROM friendships f JOIN users u ON u.id = CASE WHEN f.a = ?1 THEN f.b ELSE f.a END
       WHERE f.a = ?1 OR f.b = ?1 ORDER BY u.username`,
    )
    .bind(user.id)
    .all<UserRow & { status: string; requester: string }>();
  const out: FriendsResponse = { friends: [], incoming: [], outgoing: [] };
  for (const r of results) {
    if (r.status === "accepted") out.friends.push({ ...pub(r), since: r.created_at } satisfies Friend);
    else if (r.requester === user.id) out.outgoing.push(pub(r));
    else out.incoming.push(pub(r));
  }
  return json(out);
}

async function requestFriend(req: Request, db: Db, user: UserRow, now: number): Promise<Response> {
  const b = await body<Record<string, unknown>>(req);
  const username = str(b.username, 40).toLowerCase();
  const other = await db.prepare("SELECT id, username, display_name FROM users WHERE username = ?").bind(username).first<UserRow>();
  if (!other) throw new HttpError(404, "Não achei ninguém com esse usuário.");
  if (other.id === user.id) throw bad("Esse é você.");
  const blk = await db
    .prepare("SELECT blocker FROM blocks WHERE (blocker = ?1 AND blocked = ?2) OR (blocker = ?2 AND blocked = ?1)")
    .bind(user.id, other.id)
    .first<{ blocker: string }>();
  if (blk?.blocker === user.id) throw bad("Você bloqueou essa pessoa. Desbloqueie primeiro.");
  // Quem foi bloqueado não fica sabendo: a resposta é a mesma de usuário inexistente.
  if (blk) throw new HttpError(404, "Não achei ninguém com esse usuário.");
  const [a, c] = pair(user.id, other.id);
  const cur = await db
    .prepare("SELECT status, requester FROM friendships WHERE a = ? AND b = ?")
    .bind(a, c)
    .first<{ status: string; requester: string }>();
  if (cur?.status === "accepted") return json({ status: "accepted", user: pub(other) });
  if (cur && cur.requester !== user.id) {
    // A outra pessoa já tinha pedido: os dois querem, vira amizade.
    await db.prepare("UPDATE friendships SET status = 'accepted', created_at = ? WHERE a = ? AND b = ?").bind(now, a, c).run();
    return json({ status: "accepted", user: pub(other) });
  }
  if (!cur) {
    if (!(await rateLimit(db, `fr:${user.id}`, 60, 3600_000, now))) throw new HttpError(429, "Muitos pedidos. Tente mais tarde.");
    await db
      .prepare("INSERT INTO friendships (a, b, requester, status, created_at) VALUES (?, ?, ?, 'pending', ?)")
      .bind(a, c, user.id, now)
      .run();
  }
  return json({ status: "pending", user: pub(other) });
}

async function acceptFriend(req: Request, db: Db, user: UserRow, now: number): Promise<Response> {
  const b = await body<Record<string, unknown>>(req);
  const otherId = str(b.userId, 40);
  const [a, c] = pair(user.id, otherId);
  const r = await db
    .prepare("UPDATE friendships SET status = 'accepted', created_at = ? WHERE a = ? AND b = ? AND status = 'pending' AND requester != ?")
    .bind(now, a, c, user.id)
    .run();
  if (!r.meta.changes) throw new HttpError(404, "Pedido não encontrado.");
  return json({ ok: true });
}

/** Recusar, cancelar pedido ou desfazer amizade: tudo apaga o par. */
async function removeFriend(req: Request, db: Db, user: UserRow): Promise<Response> {
  const b = await body<Record<string, unknown>>(req);
  const [a, c] = pair(user.id, str(b.userId, 40));
  await db.prepare("DELETE FROM friendships WHERE a = ? AND b = ?").bind(a, c).run();
  return json({ ok: true });
}

// ---------- bloquear e denunciar ----------

/** Bloquear: desfaz a amizade (ou o pedido); um não acha mais o outro na busca nem consegue mandar pedido. */
async function blockUser(req: Request, db: Db, user: UserRow, now: number): Promise<Response> {
  const b = await body<Record<string, unknown>>(req);
  const otherId = str(b.userId, 40);
  if (!otherId || otherId === user.id) throw bad("Usuário inválido.");
  if (!(await db.prepare("SELECT 1 FROM users WHERE id = ?").bind(otherId).first())) throw new HttpError(404, "Usuário não encontrado.");
  const [a, c] = pair(user.id, otherId);
  await db.batch([
    db.prepare("INSERT OR IGNORE INTO blocks (blocker, blocked, created_at) VALUES (?, ?, ?)").bind(user.id, otherId, now),
    db.prepare("DELETE FROM friendships WHERE a = ? AND b = ?").bind(a, c),
  ]);
  return json({ ok: true });
}

async function unblockUser(req: Request, db: Db, user: UserRow): Promise<Response> {
  const b = await body<Record<string, unknown>>(req);
  await db.prepare("DELETE FROM blocks WHERE blocker = ? AND blocked = ?").bind(user.id, str(b.userId, 40)).run();
  return json({ ok: true });
}

async function listBlocks(db: Db, user: UserRow): Promise<Response> {
  const { results } = await db
    .prepare(
      "SELECT u.id, u.username, u.display_name FROM blocks k JOIN users u ON u.id = k.blocked WHERE k.blocker = ? ORDER BY u.username",
    )
    .bind(user.id)
    .all<UserRow>();
  return json({ blocked: results.map(pub) });
}

/** Denúncia: fica guardada para o dono do servidor ler (/admin/reports), com o nome como estava na hora. */
async function reportUser(req: Request, db: Db, user: UserRow, now: number): Promise<Response> {
  const b = await body<Record<string, unknown>>(req);
  const reason = str(b.reason, 30);
  if (!(REPORT_REASONS as readonly string[]).includes(reason)) throw bad("Escolha um motivo.");
  const target = await db.prepare("SELECT id, username, display_name FROM users WHERE id = ?").bind(str(b.userId, 40)).first<UserRow>();
  if (!target || target.id === user.id) throw new HttpError(404, "Usuário não encontrado.");
  if (!(await rateLimit(db, `rep:${user.id}`, 10, 24 * 3600_000, now))) throw new HttpError(429, "Muitas denúncias hoje. Tente amanhã.");
  await db
    .prepare(
      "INSERT INTO reports (id, reporter, target, target_username, target_name, reason, detail, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
    )
    .bind(randomId(), user.id, target.id, target.username, target.display_name, reason, str(b.detail, 500), now)
    .run();
  return json({ ok: true });
}

// ---------- recordes ----------

function cleanRecord(r: unknown): RecordIn | null {
  if (!r || typeof r !== "object") return null;
  const o = r as Record<string, unknown>;
  const lib = str(o.lib, 80);
  const e1rmKg = num(o.e1rmKg);
  const loadKg = num(o.loadKg);
  const reps = Math.round(num(o.reps));
  if (!/^[a-zA-Z0-9_.()-]{2,80}$/.test(lib) || lib.startsWith("custom-")) return null;
  if (!(e1rmKg > 0 && e1rmKg <= LIMITS.maxKg && loadKg > 0 && loadKg <= LIMITS.maxKg && reps >= 1 && reps <= 100)) return null;
  if (!isDate(o.date)) return null;
  return { lib, e1rmKg: Math.round(e1rmKg * 10) / 10, loadKg: Math.round(loadKg * 10) / 10, reps, date: o.date };
}

/** Recebe as melhores marcas do aparelho e guarda a maior (o servidor nunca diminui um recorde por engano). */
async function putRecords(req: Request, db: Db, user: UserRow, now: number): Promise<Response> {
  const b = await body<{ records?: unknown[] }>(req);
  const list = (Array.isArray(b.records) ? b.records : [])
    .slice(0, LIMITS.recordsPerRequest)
    .map(cleanRecord)
    .filter((r): r is RecordIn => !!r);
  if (list.length) {
    await db.batch(
      list.map((r) =>
        db
          .prepare(
            `INSERT INTO records (user_id, lib, e1rm_kg, load_kg, reps, date, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)
             ON CONFLICT (user_id, lib) DO UPDATE SET
               e1rm_kg = MAX(e1rm_kg, excluded.e1rm_kg),
               load_kg = MAX(load_kg, excluded.load_kg),
               reps = CASE WHEN excluded.e1rm_kg > e1rm_kg THEN excluded.reps ELSE reps END,
               date = CASE WHEN excluded.e1rm_kg > e1rm_kg THEN excluded.date ELSE date END,
               updated_at = excluded.updated_at`,
          )
          .bind(user.id, r.lib, r.e1rmKg, r.loadKg, r.reps, r.date, now),
      ),
    );
  }
  return json({ saved: list.length });
}

/**
 * "Você levanta mais que X% dos usuários": compara com quem aceitou entrar na comparação. Quem informou sexo e/ou peso
 * recebe também a comparação dentro da própria faixa (mesmo sexo, peso até 10% diferente) e, com o peso, a força
 * relativa (1RM estimada dividida pelo peso corporal). Duas consultas, qualquer que seja o número de exercícios.
 */
async function percentiles(url: URL, db: Db, user: UserRow): Promise<Response> {
  const libs = (url.searchParams.get("libs") ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean)
    .slice(0, 100);
  if (!libs.length) return json({ percentiles: [] });
  const marks = libs.map((_, i) => `?${i + 2}`).join(",");
  const mine = (
    await db
      .prepare(`SELECT lib, e1rm_kg, load_kg FROM records WHERE user_id = ?1 AND lib IN (${marks})`)
      .bind(user.id, ...libs)
      .all<{ lib: string; e1rm_kg: number; load_kg: number }>()
  ).results;
  const me = await profileOf(db, user.id);
  const marks2 = libs.map((_, i) => `?${i + 4}`).join(",");
  const inGroup = "(?2 = '' OR p.sex = ?2) AND (?3 = 0 OR (p.bw_kg >= ?3 * 0.9 AND p.bw_kg <= ?3 * 1.1))";
  const cmp = (a: string, b: string) => `CASE WHEN ${a} < ${b} THEN 1.0 WHEN ${a} = ${b} THEN 0.5 ELSE 0 END`;
  const { results } = await db
    .prepare(
      `SELECT r.lib AS lib, COUNT(*) AS n,
         SUM(${cmp("r.e1rm_kg", "m.e1rm_kg")}) AS below_e,
         SUM(${cmp("r.load_kg", "m.load_kg")}) AS below_l,
         SUM(CASE WHEN ${inGroup} THEN 1 ELSE 0 END) AS g_n,
         SUM(CASE WHEN ${inGroup} THEN ${cmp("r.load_kg", "m.load_kg")} ELSE 0 END) AS g_below,
         SUM(CASE WHEN ?3 > 0 AND p.bw_kg > 0 THEN 1 ELSE 0 END) AS r_n,
         SUM(CASE WHEN ?3 > 0 AND p.bw_kg > 0 THEN ${cmp("r.e1rm_kg / p.bw_kg", "m.e1rm_kg / ?3")} ELSE 0 END) AS r_below
       FROM records m
       JOIN records r ON r.lib = m.lib AND r.user_id != m.user_id
       JOIN users u ON u.id = r.user_id AND u.share_percentiles = 1
       LEFT JOIN profiles p ON p.user_id = r.user_id
       WHERE m.user_id = ?1 AND m.lib IN (${marks2})
       GROUP BY r.lib`,
    )
    .bind(user.id, me.sex, me.bw_kg, ...libs)
    .all<{ lib: string; n: number; below_e: number; below_l: number; g_n: number; g_below: number; r_n: number; r_below: number }>();
  const agg = new Map(results.map((r) => [r.lib, r]));
  const pct = (below: number, n: number): number | null => (n >= LIMITS.minOthers ? Math.round((100 * below) / n) : null);
  const hasGroup = me.sex !== "" || me.bw_kg > 0;
  const out: Percentile[] = mine.map((m) => {
    const a = agg.get(m.lib);
    const p: Percentile = {
      lib: m.lib,
      e1rmKg: m.e1rm_kg,
      loadKg: m.load_kg,
      pctE1rm: pct(a?.below_e ?? 0, a?.n ?? 0),
      pctLoad: pct(a?.below_l ?? 0, a?.n ?? 0),
      others: a?.n ?? 0,
    };
    if (hasGroup) p.group = { pct: pct(a?.g_below ?? 0, a?.g_n ?? 0), others: a?.g_n ?? 0, sex: me.sex, weight: me.bw_kg > 0 };
    if (me.bw_kg > 0)
      p.rel = { ratio: Math.round((100 * m.e1rm_kg) / me.bw_kg) / 100, pct: pct(a?.r_below ?? 0, a?.r_n ?? 0), others: a?.r_n ?? 0 };
    return p;
  });
  return json({ percentiles: out });
}

/** Ranking entre você e seus amigos num exercício. */
async function friendsRanking(url: URL, db: Db, user: UserRow): Promise<Response> {
  const lib = (url.searchParams.get("lib") ?? "").trim();
  if (!lib) throw bad("Falta o exercício.");
  const { results } = await db
    .prepare(
      `SELECT u.id, u.username, u.display_name, r.e1rm_kg, r.load_kg, r.reps, r.date
       FROM records r JOIN users u ON u.id = r.user_id
       WHERE r.lib = ?1 AND (u.id = ?2 OR (u.share_activity = 1 AND EXISTS (
         SELECT 1 FROM friendships f WHERE f.status = 'accepted' AND ((f.a = ?2 AND f.b = u.id) OR (f.b = ?2 AND f.a = u.id)))))
       ORDER BY r.e1rm_kg DESC LIMIT 50`,
    )
    .bind(lib, user.id)
    .all<UserRow & { e1rm_kg: number; load_kg: number; reps: number; date: string }>();
  const rows: RankRow[] = results.map((r) => ({
    user: pub(r),
    e1rmKg: r.e1rm_kg,
    loadKg: r.load_kg,
    reps: r.reps,
    date: r.date,
    me: r.id === user.id,
  }));
  return json({ ranking: rows });
}

/** Recordes de um amigo (todos os exercícios), para comparar lado a lado. */
async function friendRecords(friendId: string, db: Db, user: UserRow): Promise<Response> {
  if (friendId !== user.id) {
    if (!(await areFriends(db, user.id, friendId))) throw new HttpError(403, "Vocês ainda não são amigos.");
    const f = await db.prepare("SELECT share_activity FROM users WHERE id = ?").bind(friendId).first<{ share_activity: number }>();
    if (!f?.share_activity) return json({ records: [] });
  }
  const { results } = await db
    .prepare("SELECT lib, e1rm_kg, load_kg, reps, date FROM records WHERE user_id = ? ORDER BY lib")
    .bind(friendId)
    .all<{ lib: string; e1rm_kg: number; load_kg: number; reps: number; date: string }>();
  const records: RecordIn[] = results.map((r) => ({ lib: r.lib, e1rmKg: r.e1rm_kg, loadKg: r.load_kg, reps: r.reps, date: r.date }));
  return json({ records });
}

// ---------- atividade ----------

function cleanActivity(a: unknown): ActivityIn | null {
  if (!a || typeof a !== "object") return null;
  const o = a as Record<string, unknown>;
  const id = str(o.id, 60);
  if (!id || !isDate(o.date)) return null;
  const n = (v: unknown, max: number) => Math.max(0, Math.min(max, Math.round(num(v) || 0)));
  return {
    id,
    date: o.date,
    title: str(o.title, 60) || "Treino",
    sets: n(o.sets, 200),
    volumeKg: n(o.volumeKg, 500_000),
    minutes: n(o.minutes, 600),
    prs: n(o.prs, 100),
  };
}

async function putActivity(req: Request, db: Db, user: UserRow, now: number): Promise<Response> {
  const b = await body<{ activity?: unknown[] }>(req);
  const list = (Array.isArray(b.activity) ? b.activity : [])
    .slice(0, LIMITS.activityPerRequest)
    .map(cleanActivity)
    .filter((r): r is ActivityIn => !!r);
  if (list.length) {
    await db.batch(
      list.map((a) =>
        db
          .prepare(
            `INSERT INTO activity (user_id, id, date, title, sets, volume_kg, minutes, prs, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
             ON CONFLICT (user_id, id) DO UPDATE SET date = excluded.date, title = excluded.title, sets = excluded.sets,
               volume_kg = excluded.volume_kg, minutes = excluded.minutes, prs = excluded.prs`,
          )
          .bind(user.id, a.id, a.date, a.title, a.sets, a.volumeKg, a.minutes, a.prs, now),
      ),
    );
  }
  return json({ saved: list.length });
}

/** Treinos recentes dos amigos (30 dias), mais novos primeiro. */
async function feed(db: Db, user: UserRow, now: number): Promise<Response> {
  const since = new Date(now - 30 * 24 * 3600_000).toISOString().slice(0, 10);
  const { results } = await db
    .prepare(
      `SELECT a.*, u.username, u.display_name FROM activity a JOIN users u ON u.id = a.user_id
       WHERE a.date >= ?2 AND u.share_activity = 1 AND EXISTS (
         SELECT 1 FROM friendships f WHERE f.status = 'accepted' AND ((f.a = ?1 AND f.b = a.user_id) OR (f.b = ?1 AND f.a = a.user_id)))
       ORDER BY a.date DESC, a.created_at DESC LIMIT 60`,
    )
    .bind(user.id, since)
    .all<{
      user_id: string;
      id: string;
      date: string;
      title: string;
      sets: number;
      volume_kg: number;
      minutes: number;
      prs: number;
      username: string;
      display_name: string;
    }>();
  const items: FeedItem[] = results.map((r) => ({
    id: r.id,
    date: r.date,
    title: r.title,
    sets: r.sets,
    volumeKg: r.volume_kg,
    minutes: r.minutes,
    prs: r.prs,
    user: { id: r.user_id, username: r.username, displayName: r.display_name },
  }));
  return json({ feed: items });
}

// ---------- backup ----------

async function listBackups(db: Db, user: UserRow): Promise<BackupMeta[]> {
  const { results } = await db
    .prepare("SELECT id, created_at, size, sessions, hash FROM backups WHERE user_id = ? ORDER BY created_at DESC")
    .bind(user.id)
    .all<{ id: string; created_at: number; size: number; sessions: number; hash: string }>();
  return results.map((r) => ({ id: r.id, createdAt: r.created_at, size: r.size, sessions: r.sessions, hash: r.hash }));
}

async function putBackup(req: Request, db: Db, user: UserRow, now: number): Promise<Response> {
  const b = await body<{ data?: unknown; sessions?: unknown }>(req);
  if (typeof b.data !== "string" || !b.data.startsWith("{")) throw bad("Backup inválido.");
  const data = b.data;
  if (data.length > LIMITS.backupMaxBytes) throw new HttpError(413, "Backup grande demais.");
  const hash = await sha256(data);
  const existing = await listBackups(db, user);
  // Igual ao último: nada mudou, não ocupa espaço de novo.
  if (existing[0]?.hash === hash) return json({ backup: existing[0], unchanged: true });
  const id = randomId();
  const size = LIMITS.backupChunkBytes;
  const chunks: string[] = [];
  for (let i = 0; i < data.length; i += size) chunks.push(data.slice(i, i + size));
  const sessions = Math.max(0, Math.round(num(b.sessions) || 0));
  await db.batch([
    db
      .prepare("INSERT INTO backups (id, user_id, created_at, size, hash, sessions, chunks) VALUES (?, ?, ?, ?, ?, ?, ?)")
      .bind(id, user.id, now, data.length, hash, sessions, chunks.length),
    ...chunks.map((c, i) => db.prepare("INSERT INTO backup_chunks (backup_id, idx, data) VALUES (?, ?, ?)").bind(id, i, c)),
  ]);
  // Mantém só os mais recentes.
  const old = existing.slice(LIMITS.backupsKept - 1);
  if (old.length) {
    await db.batch(
      old.flatMap((o) => [
        db.prepare("DELETE FROM backup_chunks WHERE backup_id = ?").bind(o.id),
        db.prepare("DELETE FROM backups WHERE id = ?").bind(o.id),
      ]),
    );
  }
  const meta: BackupMeta = { id, createdAt: now, size: data.length, sessions, hash };
  return json({ backup: meta }, 201);
}

async function getBackup(id: string, db: Db, user: UserRow): Promise<Response> {
  const meta = await db.prepare("SELECT id FROM backups WHERE id = ? AND user_id = ?").bind(id, user.id).first();
  if (!meta) throw new HttpError(404, "Backup não encontrado.");
  const { results } = await db.prepare("SELECT data FROM backup_chunks WHERE backup_id = ? ORDER BY idx").bind(id).all<{ data: string }>();
  return json({ data: results.map((r) => r.data).join("") });
}

// ---------- treinos entre aparelhos ----------

/** O que mudou depois da rev `since` (em qualquer aparelho da conta), em lotes. */
async function pullWorkouts(url: URL, db: Db, user: UserRow): Promise<Response> {
  const since = Math.max(0, Math.round(Number(url.searchParams.get("since")) || 0));
  const limit = LIMITS.workoutsPerRequest;
  const { results } = await db
    .prepare("SELECT id, rev, hash, deleted, data FROM workouts WHERE user_id = ? AND rev > ? ORDER BY rev LIMIT ?")
    .bind(user.id, since, limit + 1)
    .all<{ id: string; rev: number; hash: string; deleted: number; data: string }>();
  const page = results.slice(0, limit);
  const out: WorkoutPull = {
    changes: page.map((r) => ({ id: r.id, hash: r.hash, data: r.data, deleted: !!r.deleted })),
    rev: page.length ? page[page.length - 1].rev : since,
    more: results.length > limit,
  };
  return json(out);
}

/** Grava treinos novos, alterados ou apagados. Vale o último que chegou; igual ao que já existe não gasta rev. */
async function pushWorkouts(req: Request, db: Db, user: UserRow, now: number): Promise<Response> {
  const b = await body<{ changes?: unknown[] }>(req);
  const list: WorkoutChange[] = [];
  for (const c of (Array.isArray(b.changes) ? b.changes : []).slice(0, LIMITS.workoutsPerRequest)) {
    if (!c || typeof c !== "object") continue;
    const o = c as Record<string, unknown>;
    const id = str(o.id, 80);
    const deleted = o.deleted === true;
    const data = deleted ? "" : typeof o.data === "string" ? o.data : "";
    if (!id || (!deleted && (!data.startsWith("{") || data.length > LIMITS.workoutMaxBytes))) continue;
    list.push({ id, hash: deleted ? "" : str(o.hash, 40), data, deleted });
  }
  if (list.length) {
    await db.batch(
      list.map((c) =>
        db
          .prepare(
            `INSERT INTO workouts (user_id, id, rev, hash, deleted, data, updated_at)
             VALUES (?1, ?2, (SELECT COALESCE(MAX(rev), 0) + 1 FROM workouts WHERE user_id = ?1), ?3, ?4, ?5, ?6)
             ON CONFLICT (user_id, id) DO UPDATE SET
               rev = (SELECT COALESCE(MAX(rev), 0) + 1 FROM workouts WHERE user_id = ?1),
               hash = excluded.hash, deleted = excluded.deleted, data = excluded.data, updated_at = excluded.updated_at
             WHERE workouts.hash != excluded.hash OR workouts.deleted != excluded.deleted`,
          )
          .bind(user.id, c.id, c.hash, c.deleted ? 1 : 0, c.data, now),
      ),
    );
  }
  const row = await db
    .prepare("SELECT COALESCE(MAX(rev), 0) AS rev FROM workouts WHERE user_id = ?")
    .bind(user.id)
    .first<{ rev: number }>();
  return json({ saved: list.length, rev: row?.rev ?? 0 });
}

// ---------- erros do app e administração ----------

const clientIp = (req: Request): string =>
  req.headers.get("CF-Connecting-IP") ?? req.headers.get("X-Forwarded-For")?.split(",")[0].trim() ?? "local";

/** Recebe um erro do app (sem login). Erros iguais somam; guarda os 300 mais recentes. */
async function reportError(req: Request, db: Db, now: number): Promise<Response> {
  if (!(await rateLimit(db, `err:${clientIp(req)}`, 30, 3600_000, now))) return json({ ok: true, dropped: true });
  const b = await body<Record<string, unknown>>(req);
  const message = str(b.message, 300);
  if (!message) throw bad("Falta a mensagem.");
  const stack = str(b.stack, 1500);
  const route = str(b.route, 80);
  const version = str(b.version, 30);
  const platform = str(b.platform, 30);
  const fingerprint = await sha256(`${message}|${stack.split("\n").slice(0, 3).join("|")}|${version}`);
  await db.batch([
    db
      .prepare(
        `INSERT INTO error_reports (fingerprint, message, stack, route, version, platform, count, first_at, last_at)
         VALUES (?, ?, ?, ?, ?, ?, 1, ?, ?)
         ON CONFLICT (fingerprint) DO UPDATE SET count = count + 1, last_at = excluded.last_at, route = excluded.route`,
      )
      .bind(fingerprint, message, stack, route, version, platform, now, now),
    db.prepare(
      "DELETE FROM error_reports WHERE fingerprint NOT IN (SELECT fingerprint FROM error_reports ORDER BY last_at DESC LIMIT 300)",
    ),
  ]);
  return json({ ok: true });
}

function requireAdmin(req: Request, env: Env): void {
  const h = req.headers.get("Authorization") ?? "";
  const token = h.startsWith("Bearer ") ? h.slice(7).trim() : "";
  if (!env.ADMIN_TOKEN || env.ADMIN_TOKEN.length < 16 || token !== env.ADMIN_TOKEN) throw new HttpError(403, "Acesso só do administrador.");
}

async function adminReports(db: Db): Promise<Response> {
  const { results } = await db
    .prepare(
      `SELECT r.id, r.target, r.target_username, r.target_name, r.reason, r.detail, r.created_at,
         (SELECT COUNT(DISTINCT x.reporter) FROM reports x WHERE x.target = r.target) AS reporters
       FROM reports r ORDER BY r.created_at DESC LIMIT 200`,
    )
    .all();
  return json({ reports: results });
}

/** O dono remove uma conta denunciada: apaga tudo dela, como o "apagar conta" da própria pessoa. */
async function adminDeleteUser(req: Request, db: Db): Promise<Response> {
  const b = await body<Record<string, unknown>>(req);
  const id = str(b.userId, 40);
  if (!(await db.prepare("SELECT 1 FROM users WHERE id = ?").bind(id).first())) throw new HttpError(404, "Usuário não encontrado.");
  await db.batch(wipeUser(db, id));
  return json({ ok: true });
}

async function adminErrors(db: Db): Promise<Response> {
  const { results } = await db
    .prepare("SELECT message, stack, route, version, platform, count, first_at, last_at FROM error_reports ORDER BY last_at DESC LIMIT 100")
    .all();
  return json({ errors: results });
}

// ---------- roteador ----------

export async function handle(req: Request, env: Env, now = Date.now()): Promise<Response> {
  const headers = cors(req, env);
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers });
  let res: Response;
  try {
    res = await route(req, env, now);
  } catch (err) {
    if (err instanceof HttpError) res = json({ error: err.message }, err.status);
    else {
      console.error(err);
      res = json({ error: "Erro no servidor. Tente de novo." }, 500);
    }
  }
  for (const [k, v] of Object.entries(headers)) res.headers.set(k, v);
  return res;
}

async function route(req: Request, env: Env, now: number): Promise<Response> {
  const db = env.DB;
  const url = new URL(req.url);
  const path = url.pathname.replace(/\/+$/, "") || "/";
  const m = req.method;

  if (path === "/" || path === "/health") return json({ ok: true, service: "augment", version: 1 });
  if (m === "POST" && path === "/auth/register") return register(req, db, now);
  if (m === "POST" && path === "/auth/login") return login(req, db, now);
  if (m === "POST" && path === "/auth/recover") return recover(req, db, now);
  if (m === "POST" && path === "/errors") return reportError(req, db, now);
  if (path.startsWith("/admin/")) {
    requireAdmin(req, env);
    if (m === "GET" && path === "/admin/errors") return adminErrors(db);
    if (m === "GET" && path === "/admin/reports") return adminReports(db);
    if (m === "POST" && path === "/admin/users/delete") return adminDeleteUser(req, db);
    throw new HttpError(404, "Rota não encontrada.");
  }

  const { user, tokenHash } = await authUser(req, db, now);

  if (m === "POST" && path === "/auth/logout") {
    await db.prepare("DELETE FROM auth_tokens WHERE token_hash = ?").bind(tokenHash).run();
    return json({ ok: true });
  }
  if (m === "GET" && path === "/me") return json({ user: meOf(user, await profileOf(db, user.id)) });
  if (m === "PATCH" && path === "/me") return patchMe(req, db, user, now);
  if (m === "POST" && path === "/me/recovery-code") return newRecoveryCode(req, db, user, now);
  if (m === "POST" && path === "/me/password") return changePassword(req, db, user, tokenHash);
  if (m === "POST" && path === "/me/delete") return deleteAccount(req, db, user);

  if (m === "GET" && path === "/users/search") return searchUsers(url, db, user);
  if (m === "GET" && path === "/friends") return listFriends(db, user);
  if (m === "POST" && path === "/friends/request") return requestFriend(req, db, user, now);
  if (m === "POST" && path === "/friends/accept") return acceptFriend(req, db, user, now);
  if (m === "POST" && path === "/friends/remove") return removeFriend(req, db, user);

  if (m === "GET" && path === "/blocks") return listBlocks(db, user);
  if (m === "POST" && path === "/users/block") return blockUser(req, db, user, now);
  if (m === "POST" && path === "/users/unblock") return unblockUser(req, db, user);
  if (m === "POST" && path === "/reports") return reportUser(req, db, user, now);

  if (m === "PUT" && path === "/records") return putRecords(req, db, user, now);
  if (m === "GET" && path === "/records/percentiles") return percentiles(url, db, user);
  if (m === "GET" && path === "/records/friends") return friendsRanking(url, db, user);
  const fr = path.match(/^\/users\/([\w-]+)\/records$/);
  if (m === "GET" && fr) return friendRecords(fr[1], db, user);

  if (m === "PUT" && path === "/activity") return putActivity(req, db, user, now);
  if (m === "GET" && path === "/feed") return feed(db, user, now);

  if (m === "GET" && path === "/workouts") return pullWorkouts(url, db, user);
  if (m === "PUT" && path === "/workouts") return pushWorkouts(req, db, user, now);

  if (m === "GET" && path === "/backups") return json({ backups: await listBackups(db, user) });
  if (m === "PUT" && path === "/backups") return putBackup(req, db, user, now);
  const bk = path.match(/^\/backups\/([\w-]+)$/);
  if (m === "GET" && bk) return getBackup(bk[1], db, user);

  throw new HttpError(404, "Rota não encontrada.");
}
