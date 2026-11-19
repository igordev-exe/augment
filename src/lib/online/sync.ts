// Sincronização "semi-online": o celular é a fonte da verdade e o servidor recebe cópias quando dá.
// - Recordes por exercício da biblioteca (para comparar com amigos e com todos os usuários).
// - Resumo dos treinos concluídos (feed dos amigos).
// - Backup automático do app inteiro (os 5 últimos ficam na nuvem).
// Sem internet nada quebra: cada envio tenta de novo na próxima oportunidade (abrir o app, voltar a conexão,
// terminar um treino, sair do app).
import { useSyncExternalStore } from "react";
import { cell, sameData } from "../store";
import type {
  ActivityIn,
  BackupMeta,
  FeedItem,
  FriendsResponse,
  Me,
  Percentile,
  PublicUser,
  RankRow,
  RecordIn,
} from "../../../server/src/protocol";
import { LIMITS } from "../../../server/src/protocol";
import { dayOf, exOf } from "../../data/program";
import type { Session } from "../../data/types";
import { db, exportBackup, isBackup, importBackup, loadBodyLog, loadSettings, saveBodyLog } from "../db";
import { E1RM_MAX_REPS, e1rm, prsBySession, toKg, workSets } from "../progression";
import { addDays, todayISO } from "../dates";
import { api, ApiError, apiUrl, isOnlineNow, loadToken, saveToken } from "./client";
import { quickHash } from "./hash";
import { resetWorkoutSync, syncWorkouts } from "./workouts";

export { quickHash };

export interface OnlineState {
  user: Me | null;
  lastSyncAt?: number;
  /** Último erro (sem conexão, sessão expirada…), para mostrar na tela da conta. */
  lastError?: string;
  recordsHash?: string;
  activityHash?: string;
  backupHash?: string;
  backupAt?: number;
  percentiles?: Record<string, Percentile>;
  percentilesAt?: number;
  /** A pessoa confirmou que guardou o código de recuperação (sem e-mail, ele é a única volta). */
  recoveryAck?: boolean;
  /** Última lista de amigos e feed recebidos: a tela de amigos abre mesmo sem internet. */
  social?: { friends: FriendsResponse; feed: FeedItem[]; at: number };
  /**
   * Último valor de cada painel que depende do servidor (regra F4 de docs/prompt-fluidez.md): a tela mostra na hora e
   * troca quando a resposta nova chega. Mora dentro do estado online, então some ao sair da conta e ao apagá-la.
   */
  net?: NetCache;
}

export interface NetCache {
  /** Ranking entre amigos por exercício da biblioteca. */
  ranking?: Record<string, RankRow[]>;
  backups?: BackupMeta[];
  /** Recordes de cada amigo (comparação nos Amigos). */
  records?: Record<string, RecordIn[]>;
  blocked?: PublicUser[];
}
/** Quantos exercícios ou amigos ficam guardados em cada mapa do cache (os mais antigos saem). */
export const NET_CACHE_MAX = 30;

const KEY = "online";
/** Estado online no estoque em memória (lib/store.ts): uma assinatura só, ligada no App por watchOnline(). */
export const onlineCell = cell<OnlineState>();

export async function loadOnline(): Promise<OnlineState> {
  const row = await db.kv.get(KEY);
  return onlineCell.set((row?.value as OnlineState) ?? { user: null });
}

export async function saveOnline(patch: Partial<OnlineState>): Promise<OnlineState> {
  const next = { ...(await loadOnline()), ...patch };
  onlineCell.set(next);
  await db.kv.put({ key: KEY, value: next });
  return onlineCell.get() ?? next;
}

/** Guarda o último valor de um painel de rede. Não grava se não mudou. */
export async function rememberNet<K extends "backups" | "blocked">(key: K, value: NetCache[K]): Promise<void> {
  const cur = await loadOnline();
  if (!cur.user || sameData(cur.net?.[key], value)) return;
  await saveOnline({ net: { ...cur.net, [key]: value } });
}

/** Guarda o último valor de um painel por item (exercício, amigo), com teto de NET_CACHE_MAX itens. */
export async function rememberNetItem<K extends "ranking" | "records">(
  key: K,
  id: string,
  value: NonNullable<NetCache[K]>[string],
): Promise<void> {
  const cur = await loadOnline();
  const map = { ...(cur.net?.[key] ?? {}) } as Record<string, unknown>;
  if (!cur.user || sameData(map[id], value)) return;
  delete map[id];
  map[id] = value;
  const ids = Object.keys(map);
  ids.slice(0, Math.max(0, ids.length - NET_CACHE_MAX)).forEach((old) => delete map[old]);
  await saveOnline({ net: { ...cur.net, [key]: map } });
}

/** Liga a assinatura do estado online (uma vez, no App). */
export function watchOnline(): Promise<OnlineState | undefined> {
  return onlineCell.watch(loadOnline);
}

export function useOnline(): OnlineState | undefined {
  return useSyncExternalStore(onlineCell.subscribe, onlineCell.get);
}

// ---------- o que sobe ----------

/**
 * Melhor marca por exercício da biblioteca, em kg. Só o exercício titular (sem alternativa) e só exercícios da
 * biblioteca (os criados pela pessoa não têm com quem comparar).
 */
export function libraryBests(sessions: Session[]): RecordIn[] {
  const best = new Map<string, RecordIn>();
  for (const s of sessions) {
    if (s.status !== "done") continue;
    for (const entry of s.exercises) {
      if (entry.alt) continue;
      const lib = exOf(entry)?.lib;
      if (!lib || lib.startsWith("custom-")) continue;
      for (const st of workSets(entry, false)) {
        const kg = toKg(st.weight!, entry.unit);
        if (!(kg > 0 && kg <= LIMITS.maxKg)) continue;
        const est = st.reps! <= E1RM_MAX_REPS ? e1rm(kg, st.reps!) : 0;
        const cur = best.get(lib);
        if (!cur) {
          best.set(lib, { lib, e1rmKg: est || kg, loadKg: kg, reps: st.reps!, date: s.date });
          continue;
        }
        if (kg > cur.loadKg) cur.loadKg = kg;
        if (est > cur.e1rmKg) Object.assign(cur, { e1rmKg: est, reps: st.reps!, date: s.date });
      }
    }
  }
  return [...best.values()]
    .map((r) => ({ ...r, e1rmKg: Math.round(Math.min(r.e1rmKg, LIMITS.maxKg) * 10) / 10, loadKg: Math.round(r.loadKg * 10) / 10 }))
    .sort((a, b) => a.lib.localeCompare(b.lib));
}

/** Resumo dos treinos concluídos nos últimos 60 dias (o que os amigos veem). */
export function activityOf(sessions: Session[], today = todayISO()): ActivityIn[] {
  const since = addDays(today, -60);
  const prs = prsBySession(sessions);
  return sessions
    .filter((s) => s.status === "done" && s.date >= since)
    .map((s) => {
      let sets = 0;
      let volumeKg = 0;
      for (const e of s.exercises) {
        for (const st of workSets(e)) {
          sets++;
          volumeKg += toKg(st.weight!, e.unit) * st.reps!;
        }
      }
      const minutes = s.finishedAt ? Math.round((s.finishedAt - s.startedAt) / 60_000) : 0;
      let title = s.day?.name;
      if (!title) {
        try {
          title = dayOf(s).name;
        } catch {
          title = "Treino";
        }
      }
      return {
        id: s.id,
        date: s.date,
        title,
        sets,
        volumeKg: Math.round(volumeKg),
        minutes: Math.max(0, Math.min(600, minutes)),
        prs: prs.get(s.id)?.length ?? 0,
      };
    })
    .sort((a, b) => a.id.localeCompare(b.id));
}

/**
 * Backup para a nuvem: o mesmo JSON do "Exportar backup", mas SEM as fotos do corpo, a não ser que a pessoa ligue
 * "Incluir fotos" (`settings.cloudPhotos`). Mesmo ligado, se passar do limite de tamanho as fotos ficam de fora.
 */
export async function backupPayload(): Promise<{ data: string; hash: string; sessions: number; photosDropped: boolean }> {
  let b = await exportBackup();
  const withPhotos = (await loadSettings()).cloudPhotos === true;
  const strip = () => {
    if (Array.isArray(b.bodyLog)) b = { ...b, bodyLog: b.bodyLog.map((e) => ({ ...e, photoDataUrl: undefined })) };
  };
  if (!withPhotos) strip();
  let data = JSON.stringify(b);
  let photosDropped = false;
  if (withPhotos && data.length > LIMITS.backupMaxBytes) {
    strip();
    data = JSON.stringify(b);
    photosDropped = true;
  }
  // O hash ignora a data de exportação: só muda quando os dados mudam.
  const hash = quickHash(JSON.stringify({ ...b, exportedAt: "" }));
  return { data, hash, sessions: b.sessions.length, photosDropped };
}

// ---------- sincronizar ----------

export type SyncReason = "abrir" | "conexao" | "sair-do-app" | "treino" | "manual" | "periodico";

/** Backup automático no máximo a cada 10 min (menos quando é pedido ou quando acaba um treino). */
const BACKUP_MIN_GAP = 10 * 60_000;
let running: Promise<OnlineState | null> | null = null;
let queued: Promise<OnlineState | null> | null = null;

/** Um envio por vez; pedido no meio de outro roda de novo logo depois (para pegar o que mudou). */
export function syncNow(reason: SyncReason = "manual"): Promise<OnlineState | null> {
  if (!running) {
    running = doSync(reason).finally(() => (running = null));
    return running;
  }
  if (!queued) {
    queued = running.then(() => {
      queued = null;
      return syncNow(reason);
    });
  }
  return queued;
}

/** Espera o envio em andamento terminar (testes e troca de conta). */
export async function syncIdle(): Promise<void> {
  while (running || queued) await (queued ?? running);
}

async function doSync(reason: SyncReason): Promise<OnlineState | null> {
  const state = await loadOnline();
  if (!state.user || !apiUrl() || !(await loadToken())) return null;
  if (!isOnlineNow()) return saveOnline({ lastError: "Sem internet. Tudo fica salvo no celular e sobe quando a conexão voltar." });
  try {
    // Primeiro junta os treinos com os outros aparelhos: os recordes e o backup já saem com tudo.
    await syncWorkouts();
    const sessions = await db.sessions.toArray();
    const patch: Partial<OnlineState> = {};

    const records = libraryBests(sessions);
    const rHash = quickHash(JSON.stringify(records));
    if (rHash !== state.recordsHash) {
      for (let i = 0; i < records.length; i += LIMITS.recordsPerRequest) {
        await api("PUT", "/records", { records: records.slice(i, i + LIMITS.recordsPerRequest) });
      }
      patch.recordsHash = rHash;
    }

    const activity = activityOf(sessions);
    const aHash = quickHash(JSON.stringify(activity));
    if (aHash !== state.activityHash) {
      for (let i = 0; i < activity.length; i += LIMITS.activityPerRequest) {
        await api("PUT", "/activity", { activity: activity.slice(i, i + LIMITS.activityPerRequest) });
      }
      patch.activityHash = aHash;
    }

    const urgent = reason === "manual" || reason === "treino" || reason === "sair-do-app";
    if (urgent || !state.backupAt || Date.now() - state.backupAt > BACKUP_MIN_GAP) {
      const payload = await backupPayload();
      const bHash = payload.hash;
      if (bHash !== state.backupHash && payload.sessions > 0) {
        await api("PUT", "/backups", { data: payload.data, sessions: payload.sessions }, 120_000);
        patch.backupHash = bHash;
        patch.backupAt = Date.now();
      }
    }

    // Comparação com a comunidade: atualiza quando os recordes mudam ou a cada 6 h.
    if (patch.recordsHash || !state.percentilesAt || Date.now() - state.percentilesAt > 6 * 3600_000) {
      const map: Record<string, Percentile> = {};
      const libs = records.map((r) => r.lib);
      for (let i = 0; i < libs.length; i += 100) {
        const q = encodeURIComponent(libs.slice(i, i + 100).join(","));
        const r = await api<{ percentiles: Percentile[] }>("GET", `/records/percentiles?libs=${q}`);
        for (const p of r.percentiles) map[p.lib] = p;
      }
      patch.percentiles = map;
      patch.percentilesAt = Date.now();
    }

    return saveOnline({ ...patch, lastSyncAt: Date.now(), lastError: undefined });
  } catch (err) {
    if (err instanceof ApiError && err.status === 401) {
      await saveToken("");
      return saveOnline({ user: null, lastError: "Sua sessão expirou. Entre de novo para voltar a sincronizar." });
    }
    return saveOnline({ lastError: err instanceof ApiError ? err.message : "Falha ao sincronizar. Tento de novo depois." });
  }
}

/** Liga a sincronização automática: ao abrir, ao voltar a internet, ao sair do app e a cada 15 min. */
export function startAutoSync(): () => void {
  const onOnline = () => void syncNow("conexao");
  const onVisibility = () => {
    if (document.visibilityState === "hidden") void syncNow("sair-do-app");
  };
  const first = setTimeout(() => void syncNow("abrir"), 4000);
  const every = setInterval(() => {
    if (document.visibilityState === "visible") void syncNow("periodico");
  }, 15 * 60_000);
  window.addEventListener("online", onOnline);
  document.addEventListener("visibilitychange", onVisibility);
  return () => {
    clearTimeout(first);
    clearInterval(every);
    window.removeEventListener("online", onOnline);
    document.removeEventListener("visibilitychange", onVisibility);
  };
}

// ---------- backup da nuvem ----------

export async function listCloudBackups(): Promise<BackupMeta[]> {
  return (await api<{ backups: BackupMeta[] }>("GET", "/backups")).backups;
}

/** Troca os dados do aparelho pelo backup da nuvem (o estado atual vira um ponto de restauração antes). */
/**
 * Traz um backup da nuvem para o aparelho. "replace" troca tudo pelo backup; "merge" junta (treinos, peso, programas e
 * memória dos dois lados), para quem usa dois aparelhos. Os dois criam antes um ponto de restauração. Quem toca é a
 * pessoa: o servidor nunca sobrescreve nada sozinho.
 */
export async function restoreCloudBackup(id: string, mode: "replace" | "merge" = "replace"): Promise<number> {
  const { data } = await api<{ data: string }>("GET", `/backups/${encodeURIComponent(id)}`, undefined, 120_000);
  let parsed: unknown;
  try {
    parsed = JSON.parse(data);
  } catch {
    parsed = null;
  }
  if (!isBackup(parsed)) throw new ApiError("O backup da nuvem está danificado.", 422);
  // As fotos do corpo normalmente não vão para a nuvem: as que estão neste aparelho voltam para os mesmos registros.
  const photos = new Map((await loadBodyLog()).filter((e) => e.photoDataUrl).map((e) => [e.id, e.photoDataUrl]));
  const n = await importBackup(parsed, mode);
  if (photos.size) {
    const log = await loadBodyLog();
    if (log.some((e) => !e.photoDataUrl && photos.has(e.id)))
      await saveBodyLog(log.map((e) => (!e.photoDataUrl && photos.has(e.id) ? { ...e, photoDataUrl: photos.get(e.id) } : e)));
  }
  // Depois de restaurar, tudo precisa subir de novo para bater com o servidor.
  await saveOnline({ recordsHash: undefined, activityHash: undefined, backupHash: undefined });
  await resetWorkoutSync();
  return n;
}
