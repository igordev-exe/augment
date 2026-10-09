import Dexie, { type Table } from "dexie";
import type { Session, Settings } from "../data/types";

// Tudo fica no IndexedDB do próprio celular. Faça backup em Ajustes → Exportar.

interface KV {
  key: string;
  value: unknown;
}

class AugmentDB extends Dexie {
  sessions!: Table<Session, string>;
  kv!: Table<KV, string>;

  constructor() {
    super("augment");
    this.version(1).stores({
      sessions: "id, date, dayId, status",
      kv: "key",
    });
  }
}

export const db = new AugmentDB();

export const DEFAULT_SETTINGS: Settings = {
  operator: "Igor",
  // Início do primeiro mesociclo: segunda, 21/09/2026.
  mesoStart: "2026-09-21",
  trainingDays: [1, 2, 3, 4, 5],
  sound: true,
  vibrate: true,
  units: {},
  increments: {},
  videos: {},
};

export async function loadSettings(): Promise<Settings> {
  const row = await db.kv.get("settings");
  return { ...DEFAULT_SETTINGS, ...((row?.value as Partial<Settings>) ?? {}) };
}

export async function saveSettings(patch: Partial<Settings>): Promise<Settings> {
  const cur = await loadSettings();
  const next = { ...cur, ...patch };
  await db.kv.put({ key: "settings", value: next });
  return next;
}

export function uid(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

// ---------- Backup ----------

export interface Backup {
  app: "augment" | "anilha";
  version: 1;
  exportedAt: string;
  settings: Settings;
  sessions: Session[];
}

export async function exportBackup(): Promise<Backup> {
  return {
    app: "augment",
    version: 1,
    exportedAt: new Date().toISOString(),
    settings: await loadSettings(),
    sessions: await db.sessions.toArray(),
  };
}

export function isBackup(x: unknown): x is Backup {
  const b = x as Backup;
  return !!b && (b.app === "augment" || b.app === "anilha") && Array.isArray(b.sessions) && typeof b.settings === "object";
}

/** mode "merge": mantém o que já existe e adiciona/atualiza pelo id. "replace": apaga tudo antes. */
export async function importBackup(b: Backup, mode: "merge" | "replace"): Promise<number> {
  await db.transaction("rw", db.sessions, db.kv, async () => {
    if (mode === "replace") {
      await db.sessions.clear();
      await db.kv.put({ key: "settings", value: { ...DEFAULT_SETTINGS, ...b.settings } });
    }
    await db.sessions.bulkPut(b.sessions);
  });
  return b.sessions.length;
}
