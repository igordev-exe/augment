import { addDays } from "./dates";
import { db, exportBackup, importBackup, uid, type Backup } from "./db";

// Pontos de restauração: cópias completas guardadas no próprio aparelho (IndexedDB), feitas sozinhas
// uma vez por semana e antes de importar, restaurar ou apagar. Protegem contra um "Substituir tudo" errado.
// Não substituem o backup exportado: se o navegador perder os dados, perde os pontos junto.

export type RestoreReason = "semanal" | "antes-importar" | "antes-restaurar" | "antes-apagar" | "manual";

export interface RestorePoint {
  id: string;
  /** ISO com hora. */
  at: string;
  reason: RestoreReason;
  sessions: number;
  bodyEntries: number;
}

export const RESTORE_LABEL: Record<RestoreReason, string> = {
  semanal: "Automático semanal",
  "antes-importar": "Antes de importar",
  "antes-restaurar": "Antes de restaurar",
  "antes-apagar": "Antes de apagar tudo",
  manual: "Criado por você",
};

/** Quantos pontos ficam guardados (os mais antigos saem). */
export const MAX_POINTS = 6;
const INDEX = "restore-index";
const key = (id: string) => `restore:${id}`;

export async function listRestorePoints(): Promise<RestorePoint[]> {
  const row = await db.kv.get(INDEX);
  return Array.isArray(row?.value) ? (row.value as RestorePoint[]) : [];
}

/** Cria um ponto com tudo o que está no aparelho agora. Não cria se não houver nada para guardar. */
export async function createRestorePoint(reason: RestoreReason, now = new Date()): Promise<RestorePoint | null> {
  const data = await exportBackup();
  if (!data.sessions.length && !(data.bodyLog ?? []).length) return null;
  const point: RestorePoint = {
    id: uid(),
    at: now.toISOString(),
    reason,
    sessions: data.sessions.length,
    bodyEntries: (data.bodyLog ?? []).length,
  };
  await db.transaction("rw", db.kv, async () => {
    const list = [point, ...(await listRestorePoints())];
    const keep = list.slice(0, MAX_POINTS);
    for (const old of list.slice(MAX_POINTS)) await db.kv.delete(key(old.id));
    await db.kv.put({ key: key(point.id), value: data });
    await db.kv.put({ key: INDEX, value: keep });
  });
  return point;
}

/** Ponto semanal: cria se o último automático tiver 7+ dias (ou se não houver nenhum). */
export async function ensureWeeklyRestorePoint(today: string, now = new Date()): Promise<RestorePoint | null> {
  const last = (await listRestorePoints()).find((p) => p.reason === "semanal");
  if (last && last.at.slice(0, 10) > addDays(today, -7)) return null;
  return createRestorePoint("semanal", now);
}

export async function loadRestorePoint(id: string): Promise<Backup | null> {
  const row = await db.kv.get(key(id));
  return (row?.value as Backup | undefined) ?? null;
}

/** Volta ao estado do ponto. Antes, guarda o estado atual num ponto novo, para dar para desfazer. */
export async function restoreFrom(id: string): Promise<number> {
  const data = await loadRestorePoint(id);
  if (!data) throw new Error("Ponto de restauração não encontrado.");
  await createRestorePoint("antes-restaurar");
  return importBackup(data, "replace", { snapshot: false });
}

export async function deleteRestorePoint(id: string): Promise<void> {
  await db.transaction("rw", db.kv, async () => {
    await db.kv.delete(key(id));
    await db.kv.put({ key: INDEX, value: (await listRestorePoints()).filter((p) => p.id !== id) });
  });
}
