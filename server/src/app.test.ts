import { fileURLToPath } from "node:url";
import { beforeEach, describe, expect, it } from "vitest";
import { handle } from "./app";
import type { Env } from "./db";
import type { AuthResponse, FeedItem, FriendsResponse, Percentile, RankRow } from "./protocol";
import { openSqlite } from "./sqlite-node";

const MIGRATION = fileURLToPath(new URL("../migrations", import.meta.url));
let env: Env;
let now = 1_800_000_000_000;

async function call<T = Record<string, unknown>>(method: string, path: string, opts: { token?: string; body?: unknown; ip?: string } = {}) {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (opts.token) headers.Authorization = `Bearer ${opts.token}`;
  if (opts.ip) headers["CF-Connecting-IP"] = opts.ip;
  const res = await handle(
    new Request(`https://api.test${path}`, { method, headers, body: opts.body === undefined ? undefined : JSON.stringify(opts.body) }),
    env,
    now,
  );
  return { status: res.status, data: (await res.json()) as T, headers: res.headers };
}

async function signup(username: string, extra: Record<string, unknown> = {}) {
  const r = await call<AuthResponse>("POST", "/auth/register", { body: { username, password: "senha-forte-1", ...extra }, ip: username });
  expect(r.status).toBe(201);
  return r.data;
}

async function befriend(a: AuthResponse, b: AuthResponse) {
  await call("POST", "/friends/request", { token: a.token, body: { username: b.user.username } });
  await call("POST", "/friends/accept", { token: b.token, body: { userId: a.user.id } });
}

beforeEach(() => {
  env = { DB: openSqlite(":memory:", MIGRATION) };
  now = 1_800_000_000_000;
});

describe("contas", () => {
  it("cadastra, entra, sai e recusa senha errada", async () => {
    const a = await signup("ana");
    expect(a.token).toBeTruthy();
    expect(a.recoveryCode).toMatch(/^[A-Z2-9]{4}-[A-Z2-9]{4}-[A-Z2-9]{4}-[A-Z2-9]{4}$/);
    expect((await call("GET", "/me", { token: a.token })).data.user).toMatchObject({ username: "ana", sharePercentiles: true });

    expect((await call("POST", "/auth/register", { body: { username: "ANA", password: "outra-senha" }, ip: "x" })).status).toBe(409);
    expect((await call("POST", "/auth/login", { body: { username: "ana", password: "errada!!" } })).status).toBe(401);
    const ok = await call<AuthResponse>("POST", "/auth/login", { body: { username: "Ana", password: "senha-forte-1" } });
    expect(ok.status).toBe(200);

    await call("POST", "/auth/logout", { token: ok.data.token });
    expect((await call("GET", "/me", { token: ok.data.token })).status).toBe(401);
    expect((await call("GET", "/me", { token: a.token })).status).toBe(200);
  });

  it("valida usuário e senha no cadastro", async () => {
    expect((await call("POST", "/auth/register", { body: { username: "a", password: "senha-forte-1" } })).status).toBe(400);
    expect((await call("POST", "/auth/register", { body: { username: "joão", password: "senha-forte-1" } })).status).toBe(400);
    expect((await call("POST", "/auth/register", { body: { username: "joao", password: "curta" } })).status).toBe(400);
  });

  it("bloqueia depois de 5 senhas erradas e libera depois de 15 min", async () => {
    await signup("bia");
    for (let i = 0; i < 5; i++) await call("POST", "/auth/login", { body: { username: "bia", password: "errada!!" } });
    expect((await call("POST", "/auth/login", { body: { username: "bia", password: "senha-forte-1" } })).status).toBe(429);
    now += 16 * 60_000;
    expect((await call("POST", "/auth/login", { body: { username: "bia", password: "senha-forte-1" } })).status).toBe(200);
  });

  it("recupera a conta com o código e derruba os outros aparelhos", async () => {
    const a = await signup("caio");
    const r = await call<AuthResponse>("POST", "/auth/recover", {
      body: { username: "caio", recoveryCode: a.recoveryCode!.toLowerCase().replace(/-/g, " "), newPassword: "senha-nova-22" },
    });
    expect(r.status).toBe(200);
    expect(r.data.recoveryCode).not.toBe(a.recoveryCode);
    expect((await call("GET", "/me", { token: a.token })).status).toBe(401);
    expect((await call("POST", "/auth/login", { body: { username: "caio", password: "senha-nova-22" } })).status).toBe(200);
    // O código antigo não vale mais.
    expect(
      (await call("POST", "/auth/recover", { body: { username: "caio", recoveryCode: a.recoveryCode, newPassword: "x".repeat(9) } }))
        .status,
    ).toBe(401);
  });

  it("apaga a conta e tudo dela", async () => {
    const a = await signup("duda");
    const b = await signup("edu");
    await befriend(a, b);
    await call("PUT", "/records", {
      token: a.token,
      body: { records: [{ lib: "supino-reto", e1rmKg: 100, loadKg: 90, reps: 4, date: "2027-01-01" }] },
    });
    await call("PUT", "/backups", { token: a.token, body: { data: '{"x":1}', sessions: 1 } });
    expect((await call("POST", "/me/delete", { token: a.token, body: { password: "errada!!" } })).status).toBe(401);
    expect((await call("POST", "/me/delete", { token: a.token, body: { password: "senha-forte-1" } })).status).toBe(200);
    expect((await call("GET", "/me", { token: a.token })).status).toBe(401);
    expect((await call<FriendsResponse>("GET", "/friends", { token: b.token })).data.friends).toHaveLength(0);
    for (const t of ["users", "records", "backups", "backup_chunks", "friendships", "auth_tokens"]) {
      const row = await env.DB.prepare(
        `SELECT COUNT(*) AS n FROM ${t} WHERE ${t === "backup_chunks" ? "1" : t === "friendships" ? "a = ?1 OR b = ?1" : t === "users" ? "id = ?1" : "user_id = ?1"}`,
      )
        .bind(...(t === "backup_chunks" ? [] : [a.user.id]))
        .first<{ n: number }>();
      expect(row?.n, t).toBe(0);
    }
  });
});

describe("amigos", () => {
  it("pedido, aceite, busca e desfazer", async () => {
    const a = await signup("fabi");
    const b = await signup("gabi");
    expect(
      (await call<{ users: { username: string }[] }>("GET", "/users/search?q=ga", { token: a.token })).data.users.map((u) => u.username),
    ).toEqual(["gabi"]);

    expect((await call("POST", "/friends/request", { token: a.token, body: { username: "gabi" } })).data.status).toBe("pending");
    const fb = (await call<FriendsResponse>("GET", "/friends", { token: b.token })).data;
    expect(fb.incoming.map((u) => u.username)).toEqual(["fabi"]);
    expect((await call<FriendsResponse>("GET", "/friends", { token: a.token })).data.outgoing).toHaveLength(1);

    // Quem pediu não pode aceitar o próprio pedido.
    expect((await call("POST", "/friends/accept", { token: a.token, body: { userId: b.user.id } })).status).toBe(404);
    expect((await call("POST", "/friends/accept", { token: b.token, body: { userId: a.user.id } })).status).toBe(200);
    expect((await call<FriendsResponse>("GET", "/friends", { token: a.token })).data.friends.map((f) => f.username)).toEqual(["gabi"]);

    await call("POST", "/friends/remove", { token: b.token, body: { userId: a.user.id } });
    expect((await call<FriendsResponse>("GET", "/friends", { token: a.token })).data.friends).toHaveLength(0);
  });

  it("pedido cruzado vira amizade direto", async () => {
    const a = await signup("hugo");
    const b = await signup("iris");
    await call("POST", "/friends/request", { token: a.token, body: { username: "iris" } });
    expect((await call("POST", "/friends/request", { token: b.token, body: { username: "hugo" } })).data.status).toBe("accepted");
  });

  it("feed mostra só amigos que compartilham", async () => {
    const a = await signup("joana");
    const b = await signup("kaique");
    const c = await signup("lia", { shareActivity: false });
    const d = await signup("mauro");
    await befriend(a, b);
    await befriend(a, c);
    const act = (id: string) => ({
      activity: [{ id, date: "2027-01-10", title: "Push A", sets: 18, volumeKg: 5400, minutes: 62, prs: 2 }],
    });
    await call("PUT", "/activity", { token: b.token, body: act("s1") });
    await call("PUT", "/activity", { token: c.token, body: act("s2") });
    await call("PUT", "/activity", { token: d.token, body: act("s3") });
    now = Date.parse("2027-01-12T12:00:00Z");
    const f = (await call<{ feed: FeedItem[] }>("GET", "/feed", { token: a.token })).data.feed;
    expect(f.map((x) => x.user.username)).toEqual(["kaique"]);
    expect(f[0]).toMatchObject({ title: "Push A", sets: 18, prs: 2 });
    // Recordes de quem não é amigo: proibido.
    expect((await call("GET", `/users/${d.user.id}/records`, { token: a.token })).status).toBe(403);
  });
});

describe("recordes e comparação", () => {
  it("guarda só a maior marca e descarta absurdos e exercícios próprios", async () => {
    const a = await signup("nina");
    const put = (records: unknown[]) => call<{ saved: number }>("PUT", "/records", { token: a.token, body: { records } });
    expect((await put([{ lib: "agachamento", e1rmKg: 120, loadKg: 100, reps: 6, date: "2027-01-01" }])).data.saved).toBe(1);
    await put([{ lib: "agachamento", e1rmKg: 110, loadKg: 105, reps: 3, date: "2027-01-08" }]);
    const r = (
      await call<{ records: { e1rmKg: number; loadKg: number; reps: number; date: string }[] }>("GET", `/users/${a.user.id}/records`, {
        token: a.token,
      })
    ).data.records;
    expect(r[0]).toMatchObject({ e1rmKg: 120, loadKg: 105, reps: 6, date: "2027-01-01" });
    expect(
      (
        await put([
          { lib: "agachamento", e1rmKg: 9000, loadKg: 100, reps: 6, date: "2027-01-01" },
          { lib: "custom-meu", e1rmKg: 50, loadKg: 40, reps: 8, date: "2027-01-01" },
          { lib: "x'; drop", e1rmKg: 50, loadKg: 40, reps: 8, date: "2027-01-01" },
        ])
      ).data.saved,
    ).toBe(0);
  });

  it("calcula a porcentagem só com 5+ outros e respeita quem saiu da comparação", async () => {
    const me = await signup("otto");
    await call("PUT", "/records", {
      token: me.token,
      body: { records: [{ lib: "leg-press", e1rmKg: 200, loadKg: 160, reps: 8, date: "2027-01-01" }] },
    });
    const pct = async () =>
      (await call<{ percentiles: Percentile[] }>("GET", "/records/percentiles?libs=leg-press,nada", { token: me.token })).data.percentiles;

    const loads = [100, 140, 180, 220, 260];
    for (const [i, l] of loads.slice(0, 4).entries()) {
      const u = await signup(`user${i}`);
      await call("PUT", "/records", {
        token: u.token,
        body: { records: [{ lib: "leg-press", e1rmKg: l * 1.25, loadKg: l, reps: 8, date: "2027-01-01" }] },
      });
    }
    expect((await pct())[0]).toMatchObject({ others: 4, pctLoad: null });

    const fifth = await signup("user4");
    await call("PUT", "/records", {
      token: fifth.token,
      body: { records: [{ lib: "leg-press", e1rmKg: 325, loadKg: 260, reps: 8, date: "2027-01-01" }] },
    });
    const hidden = await signup("user5", { sharePercentiles: false });
    await call("PUT", "/records", {
      token: hidden.token,
      body: { records: [{ lib: "leg-press", e1rmKg: 50, loadKg: 40, reps: 8, date: "2027-01-01" }] },
    });

    const p = (await pct())[0];
    // Carga 160: acima de 100 e 140 → 2 de 5 = 40%. 1RM 200: acima de 125 e 175 → 40%.
    expect(p).toMatchObject({ lib: "leg-press", others: 5, pctLoad: 40, pctE1rm: 40 });
  });

  it("ranking entre amigos inclui você e só amigos", async () => {
    const a = await signup("paula");
    const b = await signup("quim");
    const c = await signup("rui");
    await befriend(a, b);
    for (const [u, kg] of [
      [a, 80],
      [b, 100],
      [c, 140],
    ] as const) {
      await call("PUT", "/records", {
        token: u.token,
        body: { records: [{ lib: "remada", e1rmKg: kg, loadKg: kg - 10, reps: 8, date: "2027-01-01" }] },
      });
    }
    const rk = (await call<{ ranking: RankRow[] }>("GET", "/records/friends?lib=remada", { token: a.token })).data.ranking;
    expect(rk.map((r) => [r.user.username, r.me])).toEqual([
      ["quim", false],
      ["paula", true],
    ]);
  });
});

describe("backup", () => {
  it("guarda em pedaços, devolve igual, ignora repetido e mantém só os 5 últimos", async () => {
    const a = await signup("sara");
    const big = JSON.stringify({ sessions: Array.from({ length: 3 }, (_, i) => ({ id: i, pad: "x".repeat(1_000_000) })) });
    const r = await call<{ backup: { id: string; size: number } }>("PUT", "/backups", { token: a.token, body: { data: big, sessions: 3 } });
    expect(r.status).toBe(201);
    const chunks = await env.DB.prepare("SELECT COUNT(*) AS n FROM backup_chunks WHERE backup_id = ?")
      .bind(r.data.backup.id)
      .first<{ n: number }>();
    expect(chunks?.n).toBe(3);
    expect((await call<{ data: string }>("GET", `/backups/${r.data.backup.id}`, { token: a.token })).data.data).toBe(big);

    expect((await call("PUT", "/backups", { token: a.token, body: { data: big, sessions: 3 } })).data.unchanged).toBe(true);
    for (let i = 0; i < 6; i++) {
      now += 1000;
      await call("PUT", "/backups", { token: a.token, body: { data: `{"n":${i}}`, sessions: i } });
    }
    const list = (await call<{ backups: { sessions: number }[] }>("GET", "/backups", { token: a.token })).data.backups;
    expect(list.map((b) => b.sessions)).toEqual([5, 4, 3, 2, 1]);

    const other = await signup("tito");
    expect((await call("GET", `/backups/${r.data.backup.id}`, { token: other.token })).status).toBe(404);
  });
});

describe("http", () => {
  it("responde CORS e pede login nas rotas fechadas", async () => {
    const pre = await handle(new Request("https://api.test/friends", { method: "OPTIONS", headers: { Origin: "https://localhost" } }), env);
    expect(pre.status).toBe(204);
    expect(pre.headers.get("Access-Control-Allow-Origin")).toBe("*");
    expect((await call("GET", "/friends")).status).toBe(401);
    expect((await call("GET", "/health")).data.ok).toBe(true);
  });
});

describe("erros do app", () => {
  it("soma erros iguais e só o administrador lê", async () => {
    const send = () =>
      call("POST", "/errors", {
        body: {
          message: "TypeError: x is undefined",
          stack: "at A (assets/a.js:1:2)\nat B",
          route: "/progresso",
          version: "1.0.0",
          platform: "web",
        },
      });
    expect((await send()).status).toBe(200);
    await send();
    expect((await call("GET", "/admin/errors")).status).toBe(403);
    env.ADMIN_TOKEN = "segredo-do-dono-123456";
    expect((await call("GET", "/admin/errors", { token: "errado" })).status).toBe(403);
    const r = await call<{ errors: { message: string; count: number }[] }>("GET", "/admin/errors", { token: env.ADMIN_TOKEN });
    expect(r.data.errors).toEqual([expect.objectContaining({ message: "TypeError: x is undefined", count: 2, route: "/progresso" })]);
  });
});

describe("comparação por faixa e força relativa", () => {
  const rec = (kg: number) => ({ records: [{ lib: "supino", e1rmKg: kg, loadKg: kg, reps: 1, date: "2026-11-01" }] });

  it("compara dentro do mesmo sexo e peso parecido, e por kg de peso corporal", async () => {
    const me = await signup("euzinha");
    await call("PUT", "/records", { token: me.token, body: rec(60) });
    // 6 homens pesados que levantam mais; 6 mulheres leves que levantam menos.
    for (let i = 0; i < 6; i++) {
      const h = await signup(`homem${i}`);
      await call("PATCH", "/me", { token: h.token, body: { sex: "m", bodyweightKg: 95 } });
      await call("PUT", "/records", { token: h.token, body: rec(100 + i) });
      const f = await signup(`mulher${i}`);
      await call("PATCH", "/me", { token: f.token, body: { sex: "f", bodyweightKg: 58 + i } });
      await call("PUT", "/records", { token: f.token, body: rec(40 + i) });
    }
    const get = async () =>
      (await call<{ percentiles: Percentile[] }>("GET", "/records/percentiles?libs=supino", { token: me.token })).data.percentiles[0];

    const plain = await get();
    expect(plain).toMatchObject({ pctLoad: 50, others: 12 });
    expect(plain.group).toBeUndefined();
    expect(plain.rel).toBeUndefined();

    const p = await call<{ user: { sex: string; bodyweightKg: number } }>("PATCH", "/me", {
      token: me.token,
      body: { sex: "f", bodyweightKg: 60 },
    });
    expect(p.data.user).toMatchObject({ sex: "f", bodyweightKg: 60 });
    const fair = await get();
    expect(fair.pctLoad).toBe(50);
    expect(fair.group).toEqual({ pct: 100, others: 6, sex: "f", weight: true });
    // 60/60 = 1,0 por kg; homens 100/95 ≈ 1,05+ (acima); mulheres ≤ 45/58 (abaixo).
    expect(fair.rel).toEqual({ ratio: 1, pct: 50, others: 12 });

    // Faixa com pouca gente não mostra porcentagem.
    await call("PATCH", "/me", { token: me.token, body: { bodyweightKg: 120 } });
    expect((await get()).group).toMatchObject({ pct: null, others: 0 });
    // Apagar os dados volta à comparação simples.
    await call("PATCH", "/me", { token: me.token, body: { sex: "", bodyweightKg: null } });
    expect((await get()).group).toBeUndefined();
    expect((await call("PATCH", "/me", { token: me.token, body: { bodyweightKg: 5 } })).status).toBe(400);
  });
});

describe("código de recuperação novo", () => {
  it("gera outro com a senha, e o antigo deixa de valer", async () => {
    const a = await signup("ana");
    expect((await call("POST", "/me/recovery-code", { token: a.token, body: { password: "errada" } })).status).toBe(401);
    const r = await call<{ recoveryCode: string }>("POST", "/me/recovery-code", { token: a.token, body: { password: "senha-forte-1" } });
    expect(r.data.recoveryCode).toMatch(/^[A-Z2-9]{4}(-[A-Z2-9]{4}){3}$/);
    expect(r.data.recoveryCode).not.toBe(a.recoveryCode);
    const old = await call("POST", "/auth/recover", {
      body: { username: "ana", recoveryCode: a.recoveryCode, newPassword: "nova-senha-9" },
    });
    expect(old.status).toBe(401);
    const ok = await call("POST", "/auth/recover", {
      body: { username: "ana", recoveryCode: r.data.recoveryCode, newPassword: "nova-senha-9" },
    });
    expect(ok.status).toBe(200);
  });
});

describe("bloquear e denunciar", () => {
  it("bloqueio desfaz a amizade e esconde um do outro", async () => {
    const a = await signup("ana");
    const b = await signup("beto");
    await befriend(a, b);
    expect((await call("POST", "/users/block", { token: a.token, body: { userId: b.user.id } })).status).toBe(200);
    expect((await call<FriendsResponse>("GET", "/friends", { token: b.token })).data.friends).toEqual([]);
    expect((await call<{ users: unknown[] }>("GET", "/users/search?q=an", { token: b.token })).data.users).toEqual([]);
    expect((await call<{ users: unknown[] }>("GET", "/users/search?q=be", { token: a.token })).data.users).toEqual([]);
    expect((await call("POST", "/friends/request", { token: b.token, body: { username: "ana" } })).status).toBe(404);
    expect((await call("POST", "/friends/request", { token: a.token, body: { username: "beto" } })).status).toBe(400);
    expect(
      (await call<{ blocked: { username: string }[] }>("GET", "/blocks", { token: a.token })).data.blocked.map((u) => u.username),
    ).toEqual(["beto"]);

    await call("POST", "/users/unblock", { token: a.token, body: { userId: b.user.id } });
    expect((await call("POST", "/friends/request", { token: b.token, body: { username: "ana" } })).status).toBe(200);
  });

  it("denúncia fica para o administrador, que pode remover a conta", async () => {
    const a = await signup("ana");
    const b = await signup("beto");
    expect((await call("POST", "/reports", { token: a.token, body: { userId: b.user.id, reason: "qualquer" } })).status).toBe(400);
    expect(
      (await call("POST", "/reports", { token: a.token, body: { userId: b.user.id, reason: "ofensivo", detail: "nome ofensivo" } })).status,
    ).toBe(200);
    env.ADMIN_TOKEN = "segredo-do-dono-123456";
    expect((await call("GET", "/admin/reports", { token: a.token })).status).toBe(403);
    const r = await call<{ reports: Record<string, unknown>[] }>("GET", "/admin/reports", { token: env.ADMIN_TOKEN });
    expect(r.data.reports).toEqual([
      expect.objectContaining({ target_username: "beto", reason: "ofensivo", detail: "nome ofensivo", reporters: 1 }),
    ]);
    expect((await call("POST", "/admin/users/delete", { token: env.ADMIN_TOKEN, body: { userId: b.user.id } })).status).toBe(200);
    expect((await call("GET", "/me", { token: b.token })).status).toBe(401);
  });
});
