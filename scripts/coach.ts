// Fase 0 do treinador: transforma um backup do app num arquivo para o Claude ler (Claude Code ou claude.ai).
// Uso: npm run coach -- <augment-backup.json>
// Sai em coach/saida/treinador-AAAA-MM-DD.md, com as instruções do treinador e os dados já calculados pelo app.

import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { addDays, todayISO } from "../src/lib/dates";
import { DEFAULT_SETTINGS, isBackup } from "../src/lib/db";
import { type CoachData } from "../src/lib/coach/context";
import { coachHandoffText } from "../src/lib/coach/handoff";

const file = process.argv.slice(2).find((a) => a !== "--");
if (!file) {
  console.error("Uso: npm run coach -- <augment-backup.json>");
  process.exit(1);
}

const backup: unknown = JSON.parse(readFileSync(resolve(file), "utf8"));
if (!isBackup(backup)) {
  console.error("Esse arquivo não é um backup do AUGMENT.");
  process.exit(1);
}

const today = todayISO();
const data: CoachData = { sessions: backup.sessions, settings: { ...DEFAULT_SETTINGS, ...backup.settings }, today };
const md = coachHandoffText(data, `\`npm run coach\` a partir de \`${file.split(/[\\/]/).pop()}\``);
const recent = data.sessions.filter((x) => x.status === "done" && x.date >= addDays(today, -28));

const outDir = resolve("coach/saida");
mkdirSync(outDir, { recursive: true });
const out = resolve(outDir, `treinador-${today}.md`);
writeFileSync(out, md, "utf8");
console.log(`Gerado: ${out} (${Math.round(md.length / 1024)} KB, ${recent.length} treinos nos últimos 28 dias)`);
