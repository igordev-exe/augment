// Fase 0 do núcleo ao vivo num backup real: erro das previsões antes (base) e depois (vivo).
// Uso: npm run backtest -- <augment-backup.json>

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { rememberPrograms, rememberSessions } from "../src/data/program";
import { DEFAULT_SETTINGS, isBackup } from "../src/lib/db";
import { backtest } from "../src/lib/core/backtest";

const file = process.argv.slice(2).find((a) => a !== "--");
if (!file) {
  console.error("Uso: npm run backtest -- <augment-backup.json>");
  process.exit(1);
}
const backup: unknown = JSON.parse(readFileSync(resolve(file), "utf8"));
if (!isBackup(backup)) {
  console.error("Esse arquivo não é um backup do AUGMENT.");
  process.exit(1);
}
if (Array.isArray(backup.programs)) rememberPrograms(backup.programs);
rememberSessions(backup.sessions);
const settings = { ...DEFAULT_SETTINGS, ...backup.settings };
const rows = (["base", "vivo"] as const).map((p) => {
  const r = backtest(backup.sessions, settings, p === "base" ? "base" : "live");
  return {
    previsão: p,
    exercícios: r.exercises,
    "1ª série (reps)": r.firstMae,
    "séries 2+ (reps)": r.laterMae,
    "carga ±1 passo": r.loadHitRate,
  };
});
console.table(rows);
