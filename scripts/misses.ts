// Perguntas que o chat sem chave não entendeu, a partir de um backup (bloco A do chat potente).
// Uso: npm run misses -- <augment-backup.json>
// Da mais repetida para a menos. É de onde saem frases novas para os conjuntos de teste e respostas novas.

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { isBackup } from "../src/lib/db";
import { missReport, sanitizeMisses } from "../src/lib/core/learned";

const file = process.argv.slice(2).find((a) => a !== "--");
if (!file) {
  console.error("Uso: npm run misses -- <augment-backup.json>");
  process.exit(1);
}
const backup: unknown = JSON.parse(readFileSync(resolve(file), "utf8"));
if (!isBackup(backup)) {
  console.error("Esse arquivo não é um backup do AUGMENT.");
  process.exit(1);
}
const list = missReport(sanitizeMisses(backup.chatMisses));
if (!list.length) {
  console.log("Nenhuma pergunta não entendida nesse backup.");
  process.exit(0);
}
console.table(
  list.map((m) => ({ vezes: m.count, camada: m.layer === "maybe" ? "você quis dizer" : "não sei", última: m.last, pergunta: m.text })),
);
