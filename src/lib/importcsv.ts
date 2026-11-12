import { LIBRARY } from "../data/library";
import { EXTENDED } from "../data/library-extended";
import type { ProgramExercise, Session, SessionExercise, SetEntry, SetKind, Unit } from "../data/types";
import { toISO } from "./dates";
import { quickHash } from "./online/hash";
import { customExercise, dayCode, exerciseFromLibrary } from "./program-edit";

// Importar o histórico de outro app (Hevy ou Strong, exportado em CSV). Tudo no aparelho.
//
// Desenho: cada treino importado vira uma sessão concluída com retrato próprio (dia "importado", nome e sigla do
// treino no outro app, semana 0 = fora das regras do mesociclo) e cada exercício leva o seu retrato (`snap`):
// - nome reconhecido na biblioteca (português ou inglês) → retrato a partir da biblioteca, com o `lib` dela. Assim o
//   histórico e a sugestão de carga do mesmo exercício no programa usam os treinos importados (`historyOf` cai
//   para o histórico do mesmo `lib`);
// - não reconhecido → exercício `custom-…` com o nome original.
// O id da sessão é fixo por treino (origem + início + nome): importar o mesmo arquivo de novo não duplica.

export type ImportSource = "hevy" | "strong";

export interface ImportResult {
  source: ImportSource;
  sessions: Session[];
  /** Nome no outro app → nome na biblioteca do AUGMENT. */
  matched: Map<string, string>;
  /** Nomes que viraram exercício próprio (custom). */
  unmatched: string[];
  /** Linhas puladas (cardio, sem reps, data ilegível). */
  skipped: number;
}

// ---------- CSV ----------

/** Lê CSV com aspas, quebras de linha dentro de aspas e separador "," ou ";" (Strong em alguns idiomas). */
export function parseCsv(text: string): string[][] {
  const src = text.replace(/^﻿/, "");
  const firstLine = src.slice(0, src.indexOf("\n") === -1 ? src.length : src.indexOf("\n"));
  const sep = (firstLine.match(/;/g)?.length ?? 0) > (firstLine.match(/,/g)?.length ?? 0) ? ";" : ",";
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;
  for (let i = 0; i < src.length; i++) {
    const c = src[i];
    if (quoted) {
      if (c === '"' && src[i + 1] === '"') {
        cell += '"';
        i++;
      } else if (c === '"') quoted = false;
      else cell += c;
    } else if (c === '"') quoted = true;
    else if (c === sep) {
      row.push(cell);
      cell = "";
    } else if (c === "\n" || c === "\r") {
      if (c === "\r" && src[i + 1] === "\n") i++;
      row.push(cell);
      if (row.some((x) => x.trim())) rows.push(row);
      row = [];
      cell = "";
    } else cell += c;
  }
  row.push(cell);
  if (row.some((x) => x.trim())) rows.push(row);
  return rows;
}

const MONTHS: Record<string, number> = {
  jan: 0,
  feb: 1,
  fev: 1,
  mar: 2,
  apr: 3,
  abr: 3,
  may: 4,
  mai: 4,
  jun: 5,
  jul: 6,
  aug: 7,
  ago: 7,
  sep: 8,
  set: 8,
  oct: 9,
  out: 9,
  nov: 10,
  dec: 11,
  dez: 11,
};

/** Data e hora local: "2024-01-16 14:57:00", "2024-01-16T14:57" ou "16 Jan 2024, 14:57". null se não der para ler. */
export function parseDateTime(s: string): Date | null {
  const t = s.trim();
  let m = t.match(/^(\d{4})-(\d{2})-(\d{2})(?:[ T](\d{1,2}):(\d{2})(?::(\d{2}))?)?/);
  if (m) return new Date(+m[1], +m[2] - 1, +m[3], +(m[4] ?? 12), +(m[5] ?? 0), +(m[6] ?? 0));
  m = t.match(/^(\d{1,2}) ([A-Za-zç]{3})[a-z]*\.? (\d{4}),? (\d{1,2}):(\d{2})/);
  if (m && MONTHS[m[2].toLowerCase()] != null) return new Date(+m[3], MONTHS[m[2].toLowerCase()], +m[1], +m[4], +m[5]);
  return null;
}

/** "1h 5m", "45m", "3600" (segundos) → minutos. */
function durationMin(s: string | undefined): number | null {
  if (!s) return null;
  const h = s.match(/(\d+)\s*h/);
  const mi = s.match(/(\d+)\s*m(?!s)/);
  if (h || mi) return (h ? +h[1] * 60 : 0) + (mi ? +mi[1] : 0);
  const n = Number(s);
  return Number.isFinite(n) && n > 0 ? Math.round(n / 60) : null;
}

const num = (s: string | undefined): number | null => {
  if (s == null || !s.trim()) return null;
  const n = Number(s.trim().replace(",", "."));
  return Number.isFinite(n) ? n : null;
};

// ---------- Nomes → biblioteca ----------

const STOP = new Set([
  "the",
  "a",
  "an",
  "with",
  "on",
  "of",
  "and",
  "de",
  "do",
  "da",
  "com",
  "na",
  "no",
  "e",
  "em",
  "technique",
  "tecnica",
  "ou",
  "bicep",
  "biceps",
]);
/** Sinônimos que mudam de app para app. */
const SYN: Record<string, string> = {
  dumbbells: "dumbbell",
  db: "dumbbell",
  bb: "barbell",
  halteres: "dumbbell",
  halter: "dumbbell",
  barra: "barbell",
  maquina: "machine",
  bands: "band",
  elastico: "band",
  cables: "cable",
  pulley: "cable",
  polia: "cable",
  cabo: "cable",
  pulldown: "pulldown",
  "pull-down": "pulldown",
  extensions: "extension",
  curls: "curl",
  raises: "raise",
  presses: "press",
  rows: "row",
  flyes: "fly",
  flys: "fly",
  squats: "squat",
  deadlifts: "deadlift",
  leverage: "machine",
  machines: "machine",
  bicep: "biceps",
  tricep: "triceps",
};

/** Nomes que os apps escrevem de jeitos diferentes para o mesmo movimento. */
const PHRASES: [RegExp, string][] = [
  [/\b(overhead|military) press\b/gi, "shoulder press"],
  [/\bohp\b/gi, "shoulder press"],
];

export function nameTokens(s: string): Set<string> {
  return new Set(
    PHRASES.reduce((acc, [re, to]) => acc.replace(re, to), s)
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .toLowerCase()
      .replace(/[()[\],/–-]/g, " ")
      .split(/\s+/)
      .map((w) => SYN[w] ?? w)
      .filter((w) => w.length > 1 && !STOP.has(w)),
  );
}

interface Candidate {
  lib: string;
  name: string;
  tokens: Set<string>;
  curated: boolean;
}

let CANDIDATES: Candidate[] | null = null;
function candidates(): Candidate[] {
  if (CANDIDATES) return CANDIDATES;
  CANDIDATES = [
    ...LIBRARY.flatMap((l) => [
      { lib: l.id, name: l.name, tokens: nameTokens(l.name), curated: true },
      { lib: l.id, name: l.name, tokens: nameTokens(l.videoEn), curated: true },
    ]),
    ...EXTENDED.flatMap((e) => [
      { lib: e.id, name: e.name, tokens: nameTokens(e.en), curated: false },
      { lib: e.id, name: e.name, tokens: nameTokens(e.name), curated: false },
    ]),
  ];
  return CANDIDATES;
}

/** Palavras de equipamento: valem metade (o nome do movimento manda) e, se as duas listas têm e não batem, não casa. */
const EQUIP = new Set([
  "barbell",
  "dumbbell",
  "cable",
  "machine",
  "smith",
  "kettlebell",
  "band",
  "bar",
  "ez",
  "halter",
  "barra",
  "cabo",
  "maquina",
]);
/** Palavras que fazem de um movimento outro exercício: têm de estar nos dois nomes ("Deadlift" ≠ "Romanian Deadlift"). */
const VARIANT = new Set([
  "romanian",
  "stiff",
  "sumo",
  "incline",
  "decline",
  "single",
  "one",
  "reverse",
  "front",
  "bulgarian",
  "hack",
  "seated",
  "lying",
  "standing",
  "overhead",
  "behind",
  "unilateral",
  "deficit",
  "split",
  "jump",
  "hammer",
  "guillotine",
  "neutral",
  "close",
  "floor",
  "board",
  "pin",
  "paused",
  "spoto",
  "larsen",
  "inclinado",
  "declinado",
  "romeno",
  "sentado",
  "deitado",
  "frontal",
  "martelo",
  "guilhotina",
  "neutra",
  "fechada",
  "scapular",
  "escapular",
  "preacher",
  "scott",
  "rope",
  "corda",
  "assisted",
  "tuck",
  "smith",
  "kneeling",
  "weighted",
]);
/** Detalhe de pegada e largura: não muda o exercício para fins de histórico. */
const FILLER = new Set([
  "wide",
  "medium",
  "grip",
  "regular",
  "standard",
  "pegada",
  "media",
  "aberta",
  "pronada",
  "supinada",
  "barra",
  "reta",
]);
const weightOf = (w: string) => (EQUIP.has(w) ? 0.5 : 1);
const sum = (s: Iterable<string>) => [...s].reduce((a, w) => a + weightOf(w), 0);

/**
 * Exercício da biblioteca com o nome mais parecido, ou null. Conservador de propósito: casar errado põe o histórico
 * no exercício errado; não casar só cria um exercício próprio. Precisa cobrir bem os dois nomes (palavras de
 * equipamento valem metade) e o equipamento não pode conflitar ("Deadlift (Barbell)" não vira "Cable Deadlifts").
 */
export function matchLibrary(name: string): { lib: string; name: string } | null {
  const a = nameTokens(name);
  const aw = sum(a);
  if (!aw) return null;
  const aEq = [...a].filter((w) => EQUIP.has(w));
  let best: { c: Candidate; score: number } | null = null;
  for (const c of candidates()) {
    const common = [...a].filter((w) => c.tokens.has(w));
    if (!common.some((w) => !EQUIP.has(w))) continue;
    const cEq = [...c.tokens].filter((w) => EQUIP.has(w));
    if (aEq.length && cEq.length && !aEq.some((w) => cEq.includes(w))) continue;
    if ([...c.tokens].some((w) => VARIANT.has(w) && !a.has(w)) || [...a].some((w) => VARIANT.has(w) && !c.tokens.has(w))) continue;
    // O movimento manda: as palavras que não são equipamento têm de bater na maior parte ("Chest Fly" ≠ "Chest Press").
    const aCore = [...a].filter((w) => !EQUIP.has(w));
    if (aCore.filter((w) => c.tokens.has(w)).length / Math.max(1, aCore.length) < 0.66) continue;
    // E a biblioteca não pode ter outra palavra de movimento além das da pessoa ("Calf Raise" ≠ "Donkey Calf Raise");
    // pegada e largura (wide, medium, grip) não contam.
    if ([...c.tokens].some((w) => !EQUIP.has(w) && !FILLER.has(w) && !a.has(w))) continue;
    const cw = sum(common);
    const ic = cw / aw;
    const cc = cw / Math.max(1, sum(c.tokens));
    if (ic < 0.5 || cc < 0.5) continue;
    // A biblioteca curada (a do programa) ganha o empate: é ela que o histórico do programa usa.
    const score = 0.6 * ic + 0.4 * cc + (c.curated ? 0.06 : 0);
    if (!best || score > best.score) best = { c, score };
  }
  return best && best.score >= 0.6 ? { lib: best.c.lib, name: best.c.name } : null;
}

// ---------- Hevy / Strong → sessões ----------

interface Row {
  title: string;
  start: Date;
  minutes: number | null;
  exercise: string;
  kind: SetKind;
  failure: boolean;
  weight: number | null;
  reps: number | null;
  notes?: string;
}

export function detectSource(header: string[]): ImportSource | null {
  const h = header.map((x) => x.trim().toLowerCase());
  if (h.includes("exercise_title") && h.includes("start_time")) return "hevy";
  if (h.includes("exercise name") && h.includes("set order")) return "strong";
  return null;
}

/**
 * Lê o CSV exportado pelo Hevy ou pelo Strong. `strongUnit`: o Strong não diz a unidade no arquivo (é a do app de
 * quem exportou); o Hevy diz no cabeçalho (weight_kg ou weight_lbs).
 */
export function importWorkoutsCsv(text: string, strongUnit: Unit = "kg"): ImportResult | null {
  const rows = parseCsv(text);
  if (rows.length < 2) return null;
  const source = detectSource(rows[0]);
  if (!source) return null;
  const col = (name: string) => rows[0].findIndex((x) => x.trim().toLowerCase() === name);
  let unit: Unit = strongUnit;
  const parsed: Row[] = [];
  let skipped = 0;

  for (const r of rows.slice(1)) {
    const get = (i: number) => (i >= 0 ? r[i]?.trim() : undefined);
    let row: Row | null = null;
    if (source === "hevy") {
      const wkg = col("weight_kg");
      const wlb = col("weight_lbs");
      unit = wkg >= 0 ? "kg" : "lb";
      const start = parseDateTime(get(col("start_time")) ?? "");
      const end = parseDateTime(get(col("end_time")) ?? "");
      const type = (get(col("set_type")) ?? "normal").toLowerCase();
      if (start)
        row = {
          title: get(col("title")) || "Treino",
          start,
          minutes: end ? Math.max(0, Math.round((+end - +start) / 60_000)) : null,
          exercise: get(col("exercise_title")) ?? "",
          kind: type === "warmup" ? "warmup" : type === "dropset" ? "drop" : "work",
          failure: type === "failure",
          weight: num(get(wkg >= 0 ? wkg : wlb)),
          reps: num(get(col("reps"))),
          notes: get(col("exercise_notes")) || undefined,
        };
    } else {
      const start = parseDateTime(get(col("date")) ?? "");
      const order = (get(col("set order")) ?? "").toUpperCase();
      if (start)
        row = {
          title: get(col("workout name")) || "Treino",
          start,
          minutes: durationMin(get(col("duration"))),
          exercise: get(col("exercise name")) ?? "",
          kind: order === "W" ? "warmup" : order === "D" ? "drop" : "work",
          failure: order === "F",
          weight: num(get(col("weight"))),
          reps: num(get(col("reps"))),
          notes: get(col("notes")) || undefined,
        };
    }
    // Cardio, alongamento, linhas sem reps: ficam de fora (o app conta séries com carga e reps).
    if (!row || !row.exercise || !row.reps || row.reps <= 0) {
      skipped++;
      continue;
    }
    parsed.push(row);
  }

  // Agrupa em treinos (mesmo início e nome) e, dentro, em exercícios na ordem em que aparecem.
  const workouts = new Map<string, Row[]>();
  for (const r of parsed) {
    const k = `${+r.start}|${r.title}`;
    workouts.set(k, [...(workouts.get(k) ?? []), r]);
  }
  const matched = new Map<string, string>();
  const unmatched = new Set<string>();
  const snapByName = new Map<string, ProgramExercise>();
  const taken = new Set<string>();
  const snapOf = (name: string): ProgramExercise => {
    const cached = snapByName.get(name);
    if (cached) return cached;
    const hit = matchLibrary(name);
    const snap = hit ? exerciseFromLibrary(hit.lib, "importado", taken) : customExercise(name, [], "importado", taken);
    taken.add(snap.id);
    if (hit) matched.set(name, hit.name);
    else unmatched.add(name);
    snapByName.set(name, snap);
    return snap;
  };

  const sessions: Session[] = [];
  for (const [k, rs] of workouts) {
    const first = rs[0];
    const byEx = new Map<string, Row[]>();
    for (const r of rs) byEx.set(r.exercise, [...(byEx.get(r.exercise) ?? []), r]);
    const id = `imp-${source}-${quickHash(k)}`;
    const exercises: SessionExercise[] = [...byEx.entries()].map(([name, sets], ei) => {
      const snap = snapOf(name);
      return {
        exId: snap.id,
        snap,
        unit,
        notes: sets.find((s) => s.notes)?.notes,
        sets: sets.map(
          (s, si): SetEntry => ({
            id: `${id}-${ei}-${si}`,
            kind: s.kind,
            weight: s.weight ?? 0,
            reps: s.reps,
            done: true,
            failure: s.failure || undefined,
            doneAt: +first.start + si * 120_000,
          }),
        ),
      };
    });
    const startedAt = +first.start;
    sessions.push({
      id,
      dayId: "importado",
      day: { name: first.title.slice(0, 40), code: dayCode(first.title) },
      date: toISO(first.start),
      week: 0,
      startedAt,
      finishedAt: startedAt + (first.minutes ?? 60) * 60_000,
      status: "done",
      notes: `Importado do ${source === "hevy" ? "Hevy" : "Strong"}.`,
      exercises,
    });
  }
  sessions.sort((a, b) => a.startedAt - b.startedAt);
  return { source, sessions, matched, unmatched: [...unmatched].sort(), skipped };
}
