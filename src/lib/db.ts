import Dexie, { type Table } from "dexie";
import { rememberPrograms, setActiveProgram } from "../data/program";
import { pplProgram, PPL_PROGRAM_ID } from "../data/templates/ppl";
import type { BodyEntry, BodyGoal, Program, ProgramExercise, Session, Settings, Unit } from "../data/types";
import { PERSONAS } from "../data/personas";
import { closeFinishedMesos, mergeOperatorMemory, sanitizeOperatorMemory, type Constraint, type OperatorMemory } from "./core/operator";
import { addDays, mondayOf, todayISO } from "./dates";
import { createRestorePoint } from "./restore";

// Tudo fica no IndexedDB do próprio celular. Faça backup em Ajustes → Exportar.
// Versões do banco:
//   1. sessões + chave-valor (ajustes, medições, treinador). O programa era fixo no código.
//   2. tabela `programs` (o programa vira dado) e retrato de cada exercício nas sessões (`snap`).
//   3. retrato do dia nas sessões (`day`: nome e sigla), para o histórico depois de trocar de programa.

interface KV {
  key: string;
  value: unknown;
}

class AugmentDB extends Dexie {
  sessions!: Table<Session, string>;
  kv!: Table<KV, string>;
  programs!: Table<Program, string>;

  constructor() {
    super("augment");
    this.version(1).stores({
      sessions: "id, date, dayId, status",
      kv: "key",
    });
    // v2: o programa (antes fixo em src/data/program.ts) vira registro. Quem já usava o app ganha o PPL com os
    // mesmos ids de dia e exercício, e cada sessão antiga recebe o retrato dos exercícios.
    this.version(2)
      .stores({
        sessions: "id, date, dayId, status",
        kv: "key",
        programs: "id",
      })
      .upgrade(async (tx) => {
        const ppl = pplProgram();
        await tx.table("programs").put(ppl);
        await tx
          .table("sessions")
          .toCollection()
          .modify((sess: Session) => {
            backfillSnapshots([sess], [ppl]);
          });
        const row = (await tx.table("kv").get("settings")) as KV | undefined;
        if (row && row.value && typeof row.value === "object") {
          const cur = row.value as Partial<Settings>;
          if (!cur.activeProgramId) await tx.table("kv").put({ key: "settings", value: { ...cur, activeProgramId: PPL_PROGRAM_ID } });
        }
      });
    this.version(3)
      .stores({
        sessions: "id, date, dayId, status",
        kv: "key",
        programs: "id",
      })
      .upgrade(async (tx) => {
        const programs = (await tx.table("programs").toArray()) as Program[];
        await tx
          .table("sessions")
          .toCollection()
          .modify((sess: Session) => {
            backfillSnapshots([sess], [...programs, pplProgram()]);
          });
      });
    // Instalação nova: começa com o modelo PPL (as boas-vindas da fase 3 vão deixar escolher outro).
    this.on("populate", (tx) => {
      tx.table("programs").add(pplProgram());
    });
  }
}

export const db = new AugmentDB();

export const DEFAULT_SETTINGS: Settings = {
  // Sem nome: a tela de abertura pergunta; até lá o app fala com "você".
  operator: "",
  // Primeiro mesociclo começa na segunda desta semana. Fica gravado no primeiro acesso (ver `ensureSettings`).
  mesoStart: mondayOf(todayISO()),
  trainingDays: [1, 2, 3, 4, 5],
  sound: true,
  vibrate: true,
  units: {},
  increments: {},
  machineWeights: {},
  swaps: {},
  videos: {},
  exerciseNotes: {},
  setAdjust: {},
};

const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/** Ajuste de séries por exercício: inteiros de −2 a +2, sem zeros. */
function sanitizeSetAdjust(raw: unknown): Record<string, number> {
  if (!raw || typeof raw !== "object") return {};
  const out: Record<string, number> = {};
  for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
    if (typeof v === "number" && Number.isInteger(v) && v !== 0 && Math.abs(v) <= 2) out[k] = v;
  }
  return out;
}

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

function sanitizeBodyGoal(raw: unknown): BodyGoal | undefined {
  if (!raw || typeof raw !== "object") return undefined;
  const g = raw as Partial<BodyGoal>;
  if (g.mode !== "perder" && g.mode !== "ganhar" && g.mode !== "manter") return undefined;
  const t = Number(g.targetKg);
  return { mode: g.mode, targetKg: Number.isFinite(t) && t >= 30 && t <= 250 ? Number(t.toFixed(1)) : undefined };
}

export function sanitizeSettings(raw: unknown): Settings {
  const s = (raw && typeof raw === "object" ? raw : {}) as Partial<Settings>;
  const operator = typeof s.operator === "string" && s.operator.trim() ? s.operator.trim().slice(0, 60) : DEFAULT_SETTINGS.operator;
  const mesoStart = typeof s.mesoStart === "string" && ISO_DATE_RE.test(s.mesoStart) ? s.mesoStart : DEFAULT_SETTINGS.mesoStart;
  return {
    operator,
    activeProgramId: typeof s.activeProgramId === "string" && s.activeProgramId.trim() ? s.activeProgramId.trim().slice(0, 80) : undefined,
    mesoStart,
    trainingDays: sanitizeTrainingDays(s.trainingDays),
    sound: typeof s.sound === "boolean" ? s.sound : DEFAULT_SETTINGS.sound,
    vibrate: typeof s.vibrate === "boolean" ? s.vibrate : DEFAULT_SETTINGS.vibrate,
    notify: typeof s.notify === "boolean" ? s.notify : undefined,
    fx: s.fx === "max" || s.fx === "min" || s.fx === "auto" ? s.fx : undefined,
    units: sanitizeUnits(s.units),
    increments: sanitizeIncrements(s.increments),
    machineWeights: sanitizeMachineWeights(s.machineWeights),
    swaps: sanitizeRecordString(s.swaps),
    videos: sanitizeRecordString(s.videos),
    exerciseNotes: sanitizeRecordString(s.exerciseNotes),
    setAdjust: sanitizeSetAdjust(s.setAdjust),
    bodyGoal: sanitizeBodyGoal(s.bodyGoal),
    lastBackupAt: typeof s.lastBackupAt === "string" && ISO_DATE_RE.test(s.lastBackupAt) ? s.lastBackupAt : undefined,
    backupDismissed: typeof s.backupDismissed === "string" && ISO_DATE_RE.test(s.backupDismissed) ? s.backupDismissed : undefined,
    reentryDismissed: typeof s.reentryDismissed === "string" && ISO_DATE_RE.test(s.reentryDismissed) ? s.reentryDismissed : undefined,
    reportSeen: typeof s.reportSeen === "string" && ISO_DATE_RE.test(s.reportSeen) ? s.reportSeen : undefined,
    onboarded: s.onboarded === true ? true : undefined,
    cloudPhotos: s.cloudPhotos === true ? true : undefined,
    persona: PERSONAS.some((p) => p.id === s.persona) ? (s.persona as string) : undefined,
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

// ---------- Programas ----------

const STOPS = new Set(["F", "T", "R"]);
const isPair = (x: unknown) => Array.isArray(x) && x.length === 2 && x.every((n) => typeof n === "number" && Number.isFinite(n));

function isProgramExercise(x: unknown): x is ProgramExercise {
  const e = x as ProgramExercise;
  return (
    !!e &&
    typeof e.id === "string" &&
    typeof e.lib === "string" &&
    typeof e.name === "string" &&
    Array.isArray(e.muscles) &&
    typeof e.sets === "number" &&
    isPair(e.reps) &&
    isPair(e.rest) &&
    STOPS.has(e.stop)
  );
}

/** Programa vindo de backup ou do banco: confere o formato antes de usar. */
export function isProgram(x: unknown): x is Program {
  const p = x as Program;
  return (
    !!p &&
    typeof p.id === "string" &&
    typeof p.name === "string" &&
    Array.isArray(p.days) &&
    p.days.length > 0 &&
    p.days.every(
      (d) =>
        !!d && typeof d.id === "string" && typeof d.name === "string" && Array.isArray(d.exercises) && d.exercises.every(isProgramExercise),
    ) &&
    (p.retired === undefined || (Array.isArray(p.retired) && p.retired.every(isProgramExercise)))
  );
}

/**
 * Preenche o retrato (`snap`) dos exercícios das sessões que ainda não têm, procurando o exercício pelo id nos
 * programas dados (dias e removidos). Muda as sessões no lugar e devolve quantos retratos criou.
 */
export function backfillSnapshots(sessions: Session[], programs: Program[]): number {
  const byId = new Map<string, ProgramExercise>();
  const days = new Map<string, { name: string; code: string; focus?: string }>();
  for (const p of programs) {
    for (const e of p.retired ?? []) byId.set(e.id, e);
    for (const d of p.days) {
      for (const e of d.exercises) byId.set(e.id, e);
      if (!days.has(d.id)) days.set(d.id, { name: d.name, code: d.code, focus: d.focus || undefined });
    }
  }
  let n = 0;
  for (const s of sessions) {
    if (!s.day && days.has(s.dayId)) s.day = { ...days.get(s.dayId)! };
    for (const e of s.exercises) {
      if (e.snap) continue;
      const ex = byId.get(e.exId);
      if (ex) {
        e.snap = structuredClone(ex);
        n++;
      }
    }
  }
  return n;
}

/**
 * Carrega o programa ativo e põe no registro (`src/data/program.ts`). Se o id dos ajustes não existir, usa o primeiro
 * programa salvo; sem nenhum, cria o PPL. Chamado ao abrir o app e depois de importar um backup.
 */
/**
 * Grava os ajustes no primeiro acesso, para a data de início do mesociclo não andar junto com o relógio. Se já houver
 * treinos sem ajustes salvos (instalação antiga), a data sai do treino mais antigo e da semana dele.
 */
async function ensureSettings(): Promise<void> {
  if (await db.kv.get("settings")) return;
  const first = await db.sessions.orderBy("date").first();
  const mesoStart = first ? addDays(mondayOf(first.date), -7 * Math.max(0, (first.week || 1) - 1)) : mondayOf(todayISO());
  await db.kv.put({ key: "settings", value: sanitizeSettings({ ...DEFAULT_SETTINGS, mesoStart }) });
}

export async function loadActiveProgram(): Promise<Program> {
  await ensureSettings();
  const settings = await loadSettings();
  let p = settings.activeProgramId ? await db.programs.get(settings.activeProgramId) : undefined;
  if (!p || !isProgram(p)) p = (await db.programs.toArray()).find(isProgram);
  if (!p) {
    p = pplProgram();
    await db.programs.put(p);
  }
  if (settings.activeProgramId !== p.id) await saveSettings({ activeProgramId: p.id });
  rememberPrograms((await db.programs.toArray()).filter(isProgram));
  setActiveProgram(p);
  return p;
}

/** Salva o programa (novo ou editado). Se for o ativo, o app passa a usar a versão nova na hora. */
export async function saveProgram(p: Program): Promise<void> {
  if (!isProgram(p)) throw new Error("Programa inválido.");
  const next = { ...p, updatedAt: Date.now() };
  await db.programs.put(next);
  const settings = await loadSettings();
  if (settings.activeProgramId === p.id) setActiveProgram(next);
}

/** Usa outro programa a partir de agora. O histórico fica (cada sessão guarda o retrato dos exercícios). */
export async function activateProgram(id: string): Promise<Program> {
  const p = await db.programs.get(id);
  if (!p || !isProgram(p)) throw new Error("Programa não encontrado.");
  await saveSettings({ activeProgramId: id });
  rememberPrograms((await db.programs.toArray()).filter(isProgram));
  setActiveProgram(p);
  return p;
}

/** Apaga um programa que não está em uso. */
export async function deleteProgram(id: string): Promise<void> {
  const settings = await loadSettings();
  if (settings.activeProgramId === id) throw new Error("Não dá para apagar o programa em uso.");
  await db.programs.delete(id);
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

// ---------- Memória do Operador (AUG.CORE) ----------

export async function loadOperatorMemory(): Promise<OperatorMemory> {
  const row = await db.kv.get("operator-memory");
  return sanitizeOperatorMemory(row?.value);
}

export async function saveOperatorMemory(patch: Partial<OperatorMemory>): Promise<OperatorMemory> {
  return db.transaction("rw", db.kv, async () => {
    const row = await db.kv.get("operator-memory");
    const cur = sanitizeOperatorMemory(row?.value);
    const next = sanitizeOperatorMemory({ ...cur, ...patch });
    await db.kv.put({ key: "operator-memory", value: next });
    return next;
  });
}

export async function upsertConstraint(c: Constraint): Promise<OperatorMemory> {
  return db.transaction("rw", db.kv, async () => {
    const cur = await loadOperatorMemory();
    const rest = cur.constraints.filter((x) => x.id !== c.id && x.kind !== c.kind);
    const next = sanitizeOperatorMemory({ ...cur, constraints: [...rest, c] });
    await db.kv.put({ key: "operator-memory", value: next });
    return next;
  });
}

/** Ao abrir o app: resume na memória os mesociclos que terminaram (7 semanas passaram, ou a pessoa reiniciou o ciclo). */
export async function ensureMesoHistory(today: string): Promise<OperatorMemory | null> {
  const [memory, settings, sessions] = await Promise.all([loadOperatorMemory(), loadSettings(), db.sessions.toArray()]);
  const next = closeFinishedMesos(memory, sessions.filter(isSession), settings, today);
  if (!next) return null;
  await db.kv.put({ key: "operator-memory", value: sanitizeOperatorMemory(next) });
  return next;
}

export async function removeConstraint(id: string): Promise<OperatorMemory> {
  return db.transaction("rw", db.kv, async () => {
    const cur = await loadOperatorMemory();
    const next = sanitizeOperatorMemory({ ...cur, constraints: cur.constraints.filter((x) => x.id !== id) });
    await db.kv.put({ key: "operator-memory", value: next });
    return next;
  });
}

// ---------- Backup ----------

export interface Backup {
  /** Continua "1": um backup novo ainda abre num app antigo, que só ignora `programs`. */
  app: "augment";
  version: 1;
  exportedAt: string;
  settings: Settings;
  sessions: Session[];
  bodyLog?: BodyEntry[];
  /** Programas salvos (a partir da versão 2 do banco). Backup antigo não tem: o import cria o PPL. */
  programs?: Program[];
  /** Memória declarada do gêmeo digital (restrições temporárias, janela de calibração e histórico de ciclos). */
  operatorMemory?: OperatorMemory;
}

export async function exportBackup(): Promise<Backup> {
  const [settings, sessions, bodyLog, programs, operatorMemory] = await Promise.all([
    loadSettings(),
    db.sessions.toArray(),
    loadBodyLog(),
    db.programs.toArray(),
    loadOperatorMemory(),
  ]);
  return {
    app: "augment",
    version: 1,
    exportedAt: new Date().toISOString(),
    settings,
    sessions,
    bodyLog,
    programs,
    operatorMemory,
  };
}

export function isBackup(x: unknown): x is Backup {
  const b = x as Backup;
  return !!b && b.app === "augment" && b.version === 1 && Array.isArray(b.sessions) && !!b.settings && typeof b.settings === "object";
}

export function isSession(x: unknown): x is Session {
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
export async function importBackup(b: Backup, mode: "merge" | "replace", opts: { snapshot?: boolean } = {}): Promise<number> {
  // Guarda o estado atual antes de mexer.
  if (opts.snapshot !== false) await createRestorePoint("antes-importar");
  const sessions = b.sessions.filter(isSession);
  const incomingBody = Array.isArray(b.bodyLog) ? b.bodyLog.filter(isBodyEntry) : [];
  const incomingPrograms = Array.isArray(b.programs) ? b.programs.filter(isProgram) : [];
  await db.transaction("rw", db.sessions, db.kv, db.programs, async () => {
    const incoming = sanitizeSettings(b.settings);
    const rawIncoming = (b.settings ?? {}) as Partial<Settings>;
    // Programas: backup antigo (sem programas) traz o PPL, que é o programa com que ele foi gravado.
    const programsIn = incomingPrograms.length ? incomingPrograms : [pplProgram()];
    const current = mode === "replace" ? [] : await db.programs.toArray();
    // Retratos para sessões antigas: procura nos programas do backup, nos atuais e no PPL.
    backfillSnapshots(sessions, [...programsIn, ...current, pplProgram()]);
    if (mode === "replace") {
      await db.sessions.clear();
      await db.programs.clear();
      await db.programs.bulkPut(programsIn);
      const activeOk = incoming.activeProgramId && programsIn.some((p) => p.id === incoming.activeProgramId);
      await db.kv.put({
        key: "settings",
        value: { ...incoming, activeProgramId: activeOk ? incoming.activeProgramId : programsIn[0].id },
      });
      await db.kv.put({
        key: "body-log",
        value: incomingBody,
      });
      await db.kv.put({
        key: "operator-memory",
        value: sanitizeOperatorMemory(b.operatorMemory),
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
        setAdjust: { ...incoming.setAdjust, ...cur.setAdjust },
        videos: { ...incoming.videos, ...cur.videos },
        exerciseNotes: { ...incoming.exerciseNotes, ...cur.exerciseNotes },
        bodyGoal: cur.bodyGoal ?? incoming.bodyGoal,
        activeProgramId: cur.activeProgramId ?? incoming.activeProgramId,
      });
      await db.kv.put({ key: "settings", value: merged });
      // Mesclar: programa que já existe aqui fica como está (pode ter sido editado); os novos entram.
      const have = new Set(current.map((p) => p.id));
      await db.programs.bulkPut(programsIn.filter((p) => !have.has(p.id)));
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
      if (b.operatorMemory) {
        const curMem = await loadOperatorMemory();
        const mergedMem = mergeOperatorMemory(curMem, sanitizeOperatorMemory(b.operatorMemory));
        await db.kv.put({ key: "operator-memory", value: mergedMem });
      }
    }
    await db.sessions.bulkPut(sessions);
  });
  await loadActiveProgram();
  return sessions.length;
}
