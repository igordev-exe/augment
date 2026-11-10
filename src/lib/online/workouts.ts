// Treinos entre aparelhos da mesma conta: cada treino concluído sobe sozinho e os dos outros aparelhos descem,
// juntando os dois lados. Nada de "restaurar por cima": celular e tablet ficam com o mesmo histórico.
//
// Regras:
// - só treino concluído sincroniza (o treino em andamento é de um aparelho só);
// - o mesmo treino alterado nos dois lados: vale a versão deste aparelho, que sobe em seguida (último a gravar vence);
// - apagar um treino aqui apaga nos outros; mas um sumiço em massa (limpar o aparelho, importar por cima) NÃO apaga
//   a nuvem: o aparelho só esquece o que tinha sincronizado e junta tudo de novo.
import type { WorkoutChange, WorkoutPull } from "../../../server/src/protocol";
import { LIMITS } from "../../../server/src/protocol";
import type { Session } from "../../data/types";
import { db, isSession } from "../db";
import { api } from "./client";
import { quickHash } from "./hash";

const KEY = "online-workouts";

interface WorkoutSyncState {
  /** Última rev do servidor já aplicada aqui. */
  since: number;
  /** Hash de cada treino como foi sincronizado da última vez. */
  hashes: Record<string, string>;
}

async function loadState(): Promise<WorkoutSyncState> {
  const row = await db.kv.get(KEY);
  const v = row?.value as Partial<WorkoutSyncState> | undefined;
  return { since: v?.since ?? 0, hashes: { ...(v?.hashes ?? {}) } };
}

/** Esquece o que este aparelho já sincronizou (troca de conta, restauração): a próxima rodada junta tudo de novo. */
export async function resetWorkoutSync(): Promise<void> {
  await db.kv.delete(KEY);
}

const hashOf = (s: Session): string => quickHash(JSON.stringify(s));

export interface WorkoutSyncResult {
  pulled: number;
  pushed: number;
  removed: number;
}

export async function syncWorkouts(): Promise<WorkoutSyncResult> {
  const state = await loadState();
  const result: WorkoutSyncResult = { pulled: 0, pushed: 0, removed: 0 };

  const initialDone = (await db.sessions.toArray()).filter((s) => s.status === "done");
  const initialIds = new Set(initialDone.map((s) => s.id));
  const initialKnown = Object.keys(state.hashes);
  const initialMissing = initialKnown.filter((id) => !initialIds.has(id));
  if (initialMissing.length > 3 && initialMissing.length > initialKnown.length * 0.3) {
    // Sumiço em massa: o aparelho foi limpo ou restaurado. A nuvem não é apagada; junta tudo de novo já nesta rodada.
    state.hashes = {};
    state.since = 0;
  }

  // 1. Desce o que mudou nos outros aparelhos.
  for (let guard = 0; guard < 200; guard++) {
    const page = await api<WorkoutPull>("GET", `/workouts?since=${state.since}`);
    for (const c of page.changes) {
      const local = await db.sessions.get(c.id);
      const synced = state.hashes[c.id];
      const localHash = local?.status === "done" ? hashOf(local) : undefined;
      const untouched = !local || (localHash !== undefined && localHash === synced);
      if (c.deleted) {
        if (local && untouched) {
          await db.sessions.delete(c.id);
          result.removed++;
        }
        if (!local || untouched) delete state.hashes[c.id];
        continue;
      }
      if (local?.status === "active") continue;
      if (!untouched) {
        // Mudou aqui também: fica a versão local (sobe no passo 2). Se por acaso for igual, só marca como em dia.
        if (localHash === c.hash) state.hashes[c.id] = c.hash;
        continue;
      }
      let parsed: unknown;
      try {
        parsed = JSON.parse(c.data);
      } catch {
        continue;
      }
      if (!isSession(parsed) || parsed.id !== c.id || parsed.status !== "done") continue;
      await db.sessions.put(parsed);
      state.hashes[c.id] = hashOf(parsed);
      result.pulled++;
    }
    state.since = page.rev;
    if (!page.more) break;
  }

  // 2. Sobe o que é novo, mudou ou foi apagado aqui.
  const done = (await db.sessions.toArray()).filter((s) => s.status === "done");
  const ids = new Set(done.map((s) => s.id));
  const known = Object.keys(state.hashes);
  const missing = known.filter((id) => !ids.has(id));
  const changes: WorkoutChange[] = [];
  for (const id of missing) changes.push({ id, hash: "", data: "", deleted: true });
  const fresh = new Map<string, string>();
  for (const s of done) {
    const h = hashOf(s);
    if (state.hashes[s.id] === h) continue;
    const data = JSON.stringify(s);
    if (data.length > LIMITS.workoutMaxBytes) continue;
    changes.push({ id: s.id, hash: h, data });
    fresh.set(s.id, h);
  }
  for (let i = 0; i < changes.length; i += LIMITS.workoutsPerRequest) {
    const chunk = changes.slice(i, i + LIMITS.workoutsPerRequest);
    const r = await api<{ rev: number }>("PUT", "/workouts", { changes: chunk }, 60_000);
    for (const c of chunk) {
      if (c.deleted) delete state.hashes[c.id];
      else state.hashes[c.id] = fresh.get(c.id)!;
    }
    // Ninguém gravou no meio: avança, para não baixar de volta o que acabou de subir.
    if (r.rev === state.since + chunk.length) state.since = r.rev;
    result.pushed += chunk.length;
    await db.kv.put({ key: KEY, value: state });
  }
  await db.kv.put({ key: KEY, value: state });
  return result;
}
