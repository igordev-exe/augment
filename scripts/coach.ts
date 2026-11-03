// Fase 0 do treinador: transforma um backup do app num arquivo para o Claude ler (Claude Code ou claude.ai).
// Uso: npm run coach -- <augment-backup.json>
// Sai em coach/saida/treinador-AAAA-MM-DD.md, com as instruções do treinador e os dados já calculados pelo app.

import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { addDays, mondayOf, todayISO } from "../src/lib/dates";
import { DEFAULT_SETTINGS, isBackup } from "../src/lib/db";
import { coachSystem, toolExerciseHistory, toolPlan, toolSessions, toolWeekReport, type CoachData } from "../src/lib/coach/context";

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
const json = (x: unknown) => "```json\n" + JSON.stringify(x, null, 2) + "\n```";

const recent = toolSessions(data, {});
const exIds = [...new Set(recent.flatMap((s) => s.exercicios.filter((e) => e.series !== "não feito").map((e) => e.id)))];

const md = `# AUGMENT: dados para o treinador (${today})

Arquivo gerado por \`npm run coach\` a partir de \`${file.split(/[\\/]/).pop()}\`. Para usar no claude.ai, cole o arquivo inteiro numa conversa.

## Instruções do treinador

${coachSystem(data.settings.operator || "Igor")}

## Plano atual

${json(toolPlan(data))}

## Relatório da semana passada

${json(toolWeekReport(data, { semana: addDays(mondayOf(today), -7) }))}

## Relatório desta semana (em andamento)

${json(toolWeekReport(data, { semana: today }))}

## Treinos dos últimos 28 dias

${json(recent)}

## Histórico dos exercícios feitos nesse período

${exIds.map((id) => json(toolExerciseHistory(data, { exercicio: id }))).join("\n\n")}

## Pedido

Com base só nos dados acima, faça o debrief da semana como treinador:

1. **Foco da semana que vem**: uma coisa só, a mais importante, e por quê.
2. **O que foi bem**: com números.
3. **O que corrigir**: no máximo 3 pontos, cada um com a ação concreta.
4. **Próximo treino**: exercício a exercício, com a carga e a meta de reps que o app sugere e o que observar.
5. **Uma pergunta** para mim, se faltar informação para decidir algo.
`;

const outDir = resolve("coach/saida");
mkdirSync(outDir, { recursive: true });
const out = resolve(outDir, `treinador-${today}.md`);
writeFileSync(out, md, "utf8");
console.log(`Gerado: ${out} (${Math.round(md.length / 1024)} KB, ${recent.length} treinos nos últimos 28 dias)`);
