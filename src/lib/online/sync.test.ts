import "fake-indexeddb/auto";
import { fileURLToPath } from "node:url";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { handle } from "../../../server/src/app";
import { openSqlite } from "../../../server/src/sqlite-node";
import { pplProgram } from "../../data/templates/ppl";
import type { Session, SessionExercise } from "../../data/types";
import { db } from "../db";
import { newSet, snapOf } from "../sessions";
import { login, logout, register, requestFriend, acceptFriend, getFeed, friendsRanking } from "./account";
import { saveToken, setApiUrl } from "./client";
import { activityOf, libraryBests, loadOnline, listCloudBackups, restoreCloudBackup, syncIdle, syncNow } from "./sync";

// O app conversa com o servidor de verdade (mesmo código do Workers), num SQLite em memória, via fetch simulado.

const store = new Map<string, string>();
beforeAll(() => {
  vi.stubGlobal("localStorage", {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => void store.set(k, v),
    removeItem: (k: string) => void store.delete(k),
  });
});

let now = 0;
beforeEach(async () => {
  await syncIdle();
  const env = { DB: openSqlite(":memory:", fileURLToPath(new URL("../../../server/migrations", import.meta.url))) };
  vi.stubGlobal("fetch", (url: string, init: RequestInit) => handle(new Request(url, init), env, Date.now() + now));
  store.clear();
  setApiUrl("https://api.test");
  await saveToken("");
  await db.delete();
  await db.open();
});

const day = pplProgram(1).days[0];
const supino = day.exercises[0];

function entry(weight: number, reps: number[], extra: Partial<SessionExercise> = {}): SessionExercise {
  return {
    exId: supino.id,
    snap: snapOf(supino),
    unit: "kg",
    sets: reps.map((r) => ({ ...newSet("work", weight), reps: r, done: true })),
    ...extra,
  };
}

function session(id: string, date: string, exercises: SessionExercise[]): Session {
  const startedAt = Date.parse(`${date}T10:00:00`);
  return {
    id,
    dayId: day.id,
    day: { name: day.name, code: day.code },
    date,
    week: 2,
    startedAt,
    finishedAt: startedAt + 55 * 60_000,
    status: "done",
    exercises,
  };
}

describe("o que sobe para o servidor", () => {
  it("recordes: melhor 1RM estimado e maior carga por exercício da biblioteca, em kg", () => {
    const s = [
      session("a", "2027-01-01", [entry(80, [8, 8, 7])]),
      session("b", "2027-01-08", [entry(90, [3])]),
      session("c", "2027-01-15", [entry(200, [6], { unit: "lb" })]),
      // Alternativa e treino em andamento não contam.
      session("d", "2027-01-16", [entry(150, [10], { alt: "Supino no Smith" })]),
      { ...session("e", "2027-01-17", [entry(150, [10])]), status: "active" as const },
    ];
    const r = libraryBests(s);
    expect(r).toHaveLength(1);
    // 80×8 → 101,3; 90×3 → 99; 200 lb = 90,7 kg ×6 → 108,9.
    expect(r[0]).toMatchObject({ lib: supino.lib, e1rmKg: 108.9, loadKg: 90.7, reps: 6, date: "2027-01-15" });
  });

  it("atividade: resumo dos últimos 60 dias", () => {
    const a = activityOf([session("a", "2027-01-10", [entry(80, [8, 8])]), session("old", "2026-10-01", [entry(80, [8])])], "2027-01-12");
    expect(a).toEqual([{ id: "a", date: "2027-01-10", title: day.name, sets: 2, volumeKg: 1280, minutes: 55, prs: 0 }]);
  });
});

describe("sincronização com o servidor", () => {
  it("sem conta não faz nada; com conta sobe recordes, atividade e backup, e restaura em outro aparelho", async () => {
    await db.sessions.bulkPut([session("a", "2027-01-01", [entry(80, [8, 8])])]);
    expect(await syncNow()).toBeNull();

    const r = await register({
      username: "ana",
      password: "senha-forte-1",
      displayName: "Ana",
      sharePercentiles: true,
      shareActivity: true,
    });
    expect(r.recoveryCode).toBeTruthy();
    const st = await syncNow("manual");
    expect(st?.lastError).toBeUndefined();
    expect(st?.backupAt).toBeGreaterThan(0);
    expect(st?.percentiles?.[supino.lib]).toMatchObject({ others: 0, pctLoad: null });
    expect(await listCloudBackups()).toHaveLength(1);

    // Nada mudou: não manda outro backup.
    await syncNow("manual");
    expect(await listCloudBackups()).toHaveLength(1);

    // "Outro celular": dados apagados, entra na mesma conta e restaura.
    await logout();
    await db.sessions.clear();
    await login("ana", "senha-forte-1");
    const [b] = await listCloudBackups();
    expect(await restoreCloudBackup(b.id)).toBe(1);
    expect((await db.sessions.toArray()).map((s) => s.id)).toEqual(["a"]);

    // Segundo aparelho com um treino que a nuvem não tem: "Juntar" soma em vez de trocar.
    await db.sessions.put(session("z", "2026-11-02", [entry(80, [8])]));
    await restoreCloudBackup(b.id, "merge");
    expect((await db.sessions.toArray()).map((s) => s.id).sort()).toEqual(["a", "z"]);
  });

  it("amigos veem o treino e o ranking do exercício", async () => {
    await register({ username: "bia", password: "senha-forte-1", displayName: "Bia", sharePercentiles: true, shareActivity: true });
    await db.sessions.bulkPut([session("b1", new Date().toISOString().slice(0, 10), [entry(100, [5])])]);
    await syncNow("treino");
    await logout();

    await db.sessions.clear();
    await register({ username: "caio", password: "senha-forte-1", displayName: "Caio", sharePercentiles: true, shareActivity: true });
    await db.sessions.bulkPut([session("c1", new Date().toISOString().slice(0, 10), [entry(70, [8])])]);
    await syncNow("treino");
    await requestFriend("bia");
    await logout();

    await login("bia", "senha-forte-1");
    const st = await loadOnline();
    expect(st.user?.username).toBe("bia");
    const pending = await import("./account").then((m) => m.getFriends());
    await acceptFriend(pending.incoming[0].id);
    // O feed traz os treinos dos amigos e os seus (para ver as reações que você recebeu).
    expect((await getFeed()).map((f) => f.user.username)).toEqual(["caio", "bia"]);
    expect((await friendsRanking(supino.lib)).map((x) => [x.user.username, x.loadKg])).toEqual([
      ["bia", 100],
      ["caio", 70],
    ]);
  });

  it("sessão expirada no servidor: sai da conta sem apagar nada do celular", async () => {
    await register({ username: "duda", password: "senha-forte-1", displayName: "", sharePercentiles: true, shareActivity: true });
    await syncIdle();
    await db.sessions.bulkPut([session("d1", "2027-01-01", [entry(60, [10])])]);
    await saveToken("token-invalido");
    const st = await syncNow("manual");
    expect(st?.user).toBeNull();
    expect(st?.lastError).toMatch(/expirou/);
    expect(await db.sessions.count()).toBe(1);
  });
});

describe("treinos entre dois aparelhos", () => {
  // Dois "aparelhos" = dois estados locais (sessões + o que cada um já sincronizou), trocados à mão.
  type Device = { sessions: Session[]; kv: { key: string; value: unknown }[] };
  const empty = (): Device => ({ sessions: [], kv: [] });
  async function swap(save: Device, load: Device) {
    await syncIdle();
    save.sessions = await db.sessions.toArray();
    save.kv = (await db.kv.toArray()).filter((r) => r.key === "online-workouts");
    await db.sessions.clear();
    await db.kv.delete("online-workouts");
    await db.sessions.bulkPut(load.sessions);
    await db.kv.bulkPut(load.kv);
  }
  const ids = async () => (await db.sessions.toArray()).map((s) => s.id).sort();

  it("junta os treinos dos dois, propaga edição e exclusão, e não apaga a nuvem num sumiço em massa", async () => {
    const phone = empty();
    const tablet = empty();
    await register({ username: "eva", password: "senha-forte-1", displayName: "Eva", sharePercentiles: true, shareActivity: true });
    await syncIdle();

    // Celular treina A e B.
    await db.sessions.bulkPut([session("A", "2027-01-01", [entry(60, [10])]), session("B", "2027-01-03", [entry(62.5, [9])])]);
    await syncNow("treino");

    // Tablet (vazio) entra: recebe A e B, treina C.
    await swap(phone, tablet);
    await syncNow("manual");
    expect(await ids()).toEqual(["A", "B"]);
    await db.sessions.put(session("C", "2027-01-05", [entry(65, [8])]));
    await syncNow("treino");

    // Celular recebe C; corrige B e apaga A.
    await swap(tablet, phone);
    await syncNow("manual");
    expect(await ids()).toEqual(["A", "B", "C"]);
    await db.sessions.put(session("B", "2027-01-03", [entry(70, [9])]));
    await db.sessions.delete("A");
    await syncNow("manual");

    // Tablet: A some, B vem corrigido.
    await swap(phone, tablet);
    await syncNow("manual");
    expect(await ids()).toEqual(["B", "C"]);
    expect((await db.sessions.get("B"))!.exercises[0].sets[0].weight).toBe(70);

    // Tablet com mais treinos é limpo de uma vez: a nuvem não apaga nada, e tudo volta.
    await db.sessions.bulkPut(["D", "E", "F"].map((id, i) => session(id, `2027-01-1${i}`, [entry(60, [8])])));
    await syncNow("manual");
    await db.sessions.clear();
    await syncNow("manual");
    await syncNow("manual");
    expect(await ids()).toEqual(["B", "C", "D", "E", "F"]);

    // Treino em andamento nunca sobe.
    await db.sessions.put({ ...session("G", "2027-01-20", [entry(60, [8])]), status: "active" as const });
    await syncNow("manual");
    await swap(tablet, phone);
    await syncNow("manual");
    expect(await ids()).toEqual(["B", "C", "D", "E", "F"]);
  });
});

describe("fotos do corpo e o backup da nuvem", () => {
  const PHOTO = "data:image/jpeg;base64,AAAA";

  it("ficam fora por padrão, entram só se a pessoa ligar, e restaurar não apaga as do aparelho", async () => {
    const { loadBodyLog, loadSettings, saveBodyLog, saveSettings } = await import("../db");
    const { backupPayload } = await import("./sync");
    await db.sessions.bulkPut([session("a", "2027-01-01", [entry(80, [8])])]);
    await saveBodyLog([{ id: "b1", date: "2027-01-01", weightKg: 80, photoDataUrl: PHOTO }]);

    expect((await backupPayload()).data).not.toContain(PHOTO);
    await saveSettings({ ...(await loadSettings()), cloudPhotos: true });
    expect((await backupPayload()).data).toContain(PHOTO);
    await saveSettings({ ...(await loadSettings()), cloudPhotos: false });

    await register({ username: "ana", password: "senha-forte-1", displayName: "Ana", sharePercentiles: true, shareActivity: true });
    await syncNow("manual");
    const [b] = await listCloudBackups();
    await restoreCloudBackup(b.id);
    expect(await loadBodyLog()).toEqual([expect.objectContaining({ id: "b1", weightKg: 80, photoDataUrl: PHOTO })]);
  });

  it("perfil para a comparação por faixa e código de recuperação novo", async () => {
    const { newRecoveryCode, updateProfile } = await import("./account");
    const r = await register({
      username: "ana",
      password: "senha-forte-1",
      displayName: "Ana",
      sharePercentiles: true,
      shareActivity: true,
    });
    const me = await updateProfile({ sex: "f", bodyweightKg: 61.5 });
    expect(me).toMatchObject({ sex: "f", bodyweightKg: 61.5 });
    await syncIdle();
    expect((await loadOnline()).user).toMatchObject({ sex: "f", bodyweightKg: 61.5 });
    const code = await newRecoveryCode("senha-forte-1");
    expect(code).not.toBe(r.recoveryCode);
    expect((await loadOnline()).recoveryAck).toBe(false);
  });
});
