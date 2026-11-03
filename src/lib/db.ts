import Dexie, { type Table } from "dexie";
import type { BodyEntry, Session, Settings, Unit } from "../data/types";

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
  machineWeights: {},
  swaps: {},
  videos: {},
  exerciseNotes: {},
};

const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function sanitizeRecordString(raw: unknown): Record<string, string> {
  if (!raw || typeof raw !== "object") return {};
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
    if (typeof v === "string" && v.trim()) out[k] = v;
  }
  return out;
}

function sanitizeUnits(raw: unknown): Record<string, Unit> {
  if (!raw || typeof raw !== "object") return {};
  const out: Record<string, Unit> = {};
  for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
    if (v === "kg" || v === "lb") out[k] = v;
  }
  return out;
}

function sanitizeIncrements(raw: unknown): Record<string, number> {
  if (!raw || typeof raw !== "object") return {};
  const out: Record<string, number> = {};
  for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
    const n = Number(v);
    if (Number.isFinite(n) && n > 0 && n <= 100) out[k] = n;
  }
  return out;
}

function sanitizeMachineWeights(raw: unknown): Record<string, number[]> {
  if (!raw || typeof raw !== "object") return {};
  const out: Record<string, number[]> = {};
  for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
    if (Array.isArray(v)) {
      const nums = Array.from(new Set(v.map((x) => Number(x)).filter((n) => Number.isFinite(n) && n >= 0 && n <= 1000))).sort(
        (a, b) => a - b,
      );
      if (nums.length > 0) out[k] = nums;
    }
  }
  return out;
}

function sanitizeTrainingDays(raw: unknown): number[] {
  if (!Array.isArray(raw)) return [...DEFAULT_SETTINGS.trainingDays];
  const valid = Array.from(new Set(raw.filter((d): d is number => typeof d === "number" && Number.isInteger(d) && d >= 0 && d <= 6))).sort(
    (a, b) => a - b,
  );
  return valid.length > 0 ? valid : [...DEFAULT_SETTINGS.trainingDays];
}

export function sanitizeSettings(raw: unknown): Settings {
  const s = (raw && typeof raw === "object" ? raw : {}) as Partial<Settings>;
  const operator = typeof s.operator === "string" && s.operator.trim() ? s.operator.trim().slice(0, 60) : DEFAULT_SETTINGS.operator;
  const mesoStart = typeof s.mesoStart === "string" && ISO_DATE_RE.test(s.mesoStart) ? s.mesoStart : DEFAULT_SETTINGS.mesoStart;
  return {
    operator,
    mesoStart,
    trainingDays: sanitizeTrainingDays(s.trainingDays),
    sound: typeof s.sound === "boolean" ? s.sound : DEFAULT_SETTINGS.sound,
    vibrate: typeof s.vibrate === "boolean" ? s.vibrate : DEFAULT_SETTINGS.vibrate,
    notify: typeof s.notify === "boolean" ? s.notify : undefined,
    units: sanitizeUnits(s.units),
    increments: sanitizeIncrements(s.increments),
    machineWeights: sanitizeMachineWeights(s.machineWeights),
    swaps: sanitizeRecordString(s.swaps),
    videos: sanitizeRecordString(s.videos),
    exerciseNotes: sanitizeRecordString(s.exerciseNotes),
    lastBackupAt: typeof s.lastBackupAt === "string" && ISO_DATE_RE.test(s.lastBackupAt) ? s.lastBackupAt : undefined,
    backupDismissed: typeof s.backupDismissed === "string" && ISO_DATE_RE.test(s.backupDismissed) ? s.backupDismissed : undefined,
    reentryDismissed: typeof s.reentryDismissed === "string" && ISO_DATE_RE.test(s.reentryDismissed) ? s.reentryDismissed : undefined,
    reportSeen: typeof s.reportSeen === "string" && ISO_DATE_RE.test(s.reportSeen) ? s.reportSeen : undefined,
  };
}

export async function loadSettings(): Promise<Settings> {
  const row = await db.kv.get("settings");
  return sanitizeSettings(row?.value);
}

export async function saveSettings(patch: Partial<Settings>): Promise<Settings> {
  return db.transaction("rw", db.kv, async () => {
    const row = await db.kv.get("settings");
    const cur = sanitizeSettings(row?.value);
    const next = sanitizeSettings({ ...cur, ...patch });
    await db.kv.put({ key: "settings", value: next });
    return next;
  });
}

// ---------- Body Log (F4: Peso corporal, medidas e fotos) ----------

function isBodyEntry(x: unknown): x is BodyEntry {
  const e = x as BodyEntry;
  return !!e && typeof e.id === "string" && typeof e.date === "string" && ISO_DATE_RE.test(e.date);
}

export async function loadBodyLog(): Promise<BodyEntry[]> {
  const row = await db.kv.get("body-log");
  if (!Array.isArray(row?.value)) return [];
  return (row.value as unknown[])
    .filter(isBodyEntry)
    .sort((a, b) => (a.date === b.date ? b.id.localeCompare(a.id) : b.date.localeCompare(a.date)));
}

export async function saveBodyLog(entries: BodyEntry[]): Promise<BodyEntry[]> {
  return db.transaction("rw", db.kv, async () => {
    const clean = entries.filter(isBodyEntry).sort((a, b) => (a.date === b.date ? b.id.localeCompare(a.id) : b.date.localeCompare(a.date)));
    await db.kv.put({ key: "body-log", value: clean });
    return clean;
  });
}

export async function upsertBodyEntry(entry: BodyEntry): Promise<BodyEntry[]> {
  return db.transaction("rw", db.kv, async () => {
    const cur = await loadBodyLog();
    const rest = cur.filter((x) => x.id !== entry.id);
    const next = [entry, ...rest].sort((a, b) => (a.date === b.date ? b.id.localeCompare(a.id) : b.date.localeCompare(a.date)));
    await db.kv.put({ key: "body-log", value: next });
    return next;
  });
}

export async function deleteBodyEntry(id: string): Promise<BodyEntry[]> {
  return db.transaction("rw", db.kv, async () => {
    const cur = await loadBodyLog();
    const next = cur.filter((x) => x.id !== id);
    await db.kv.put({ key: "body-log", value: next });
    return next;
  });
}

export function uid(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

// ---------- Backup ----------

export interface Backup {
  app: "augment";
  version: 1;
  exportedAt: string;
  settings: Settings;
  sessions: Session[];
  bodyLog?: BodyEntry[];
}

export async function exportBackup(): Promise<Backup> {
  const [settings, sessions, bodyLog] = await Promise.all([loadSettings(), db.sessions.toArray(), loadBodyLog()]);
  return {
    app: "augment",
    version: 1,
    exportedAt: new Date().toISOString(),
    settings,
    sessions,
    bodyLog,
  };
}

export function isBackup(x: unknown): x is Backup {
  const b = x as Backup;
  return !!b && b.app === "augment" && b.version === 1 && Array.isArray(b.sessions) && !!b.settings && typeof b.settings === "object";
}

function isSession(x: unknown): x is Session {
  const s = x as Session;
  return (
    !!s &&
    typeof s.id === "string" &&
    typeof s.dayId === "string" &&
    ISO_DATE_RE.test(s.date) &&
    (s.status === "done" || s.status === "active") &&
    Array.isArray(s.exercises) &&
    s.exercises.every((e) => typeof e?.exId === "string" && Array.isArray(e.sets))
  );
}

/** mode "merge": mantém o que já existe e adiciona/atualiza pelo id (mesclando ajustes). "replace": apaga tudo antes. */
export async function importBackup(b: Backup, mode: "merge" | "replace"): Promise<number> {
  const sessions = b.sessions.filter(isSession);
  const incomingBody = Array.isArray(b.bodyLog) ? b.bodyLog.filter(isBodyEntry) : [];
  await db.transaction("rw", db.sessions, db.kv, async () => {
    const incoming = sanitizeSettings(b.settings);
    const rawIncoming = (b.settings ?? {}) as Partial<Settings>;
    if (mode === "replace") {
      await db.sessions.clear();
      await db.kv.put({
        key: "settings",
        value: incoming,
      });
      await db.kv.put({
        key: "body-log",
        value: incomingBody,
      });
    } else {
      const cur = await loadSettings();
      const merged = sanitizeSettings({
        ...incoming,
        ...cur,
        operator: cur.operator !== DEFAULT_SETTINGS.operator ? cur.operator : rawIncoming.operator ? incoming.operator : cur.operator,
        mesoStart:
          cur.mesoStart !== DEFAULT_SETTINGS.mesoStart ? cur.mesoStart : rawIncoming.mesoStart ? incoming.mesoStart : cur.mesoStart,
        trainingDays:
          JSON.stringify(cur.trainingDays) !== JSON.stringify(DEFAULT_SETTINGS.trainingDays)
            ? cur.trainingDays
            : Array.isArray(rawIncoming.trainingDays)
              ? incoming.trainingDays
              : cur.trainingDays,
        units: { ...incoming.units, ...cur.units },
        increments: { ...incoming.increments, ...cur.increments },
        machineWeights: { ...incoming.machineWeights, ...cur.machineWeights },
        swaps: { ...incoming.swaps, ...cur.swaps },
        videos: { ...incoming.videos, ...cur.videos },
        exerciseNotes: { ...incoming.exerciseNotes, ...cur.exerciseNotes },
      });
      await db.kv.put({ key: "settings", value: merged });
      if (incomingBody.length > 0) {
        const curBody = await loadBodyLog();
        const byId = new Map<string, BodyEntry>();
        for (const e of incomingBody) byId.set(e.id, e);
        for (const e of curBody) byId.set(e.id, e);
        const mergedBody = Array.from(byId.values()).sort((a, b) =>
          a.date === b.date ? b.id.localeCompare(a.id) : b.date.localeCompare(a.date),
        );
        await db.kv.put({ key: "body-log", value: mergedBody });
      }
    }
    await db.sessions.bulkPut(sessions);
  });
  return sessions.length;
}
