import { addDays, mondayOf } from "../dates";
import { coachSystem, toolBodyLog, toolExerciseHistory, toolPlan, toolSessions, toolWeekReport, type CoachData } from "./context";

// Treinador sem chave de API: um documento com as instruções do treinador e os dados já calculados pelo app, para
// abrir no app do Claude, do Gemini (ou em qualquer chat de IA) da própria conta. Usado pelo app (folha de
// compartilhar / copiar) e pelo script `npm run coach` no computador.

const json = (x: unknown) => "```json\n" + JSON.stringify(x, null, 2) + "\n```";

export function coachHandoffText(data: CoachData, origin = "o app AUGMENT"): string {
  const recent = toolSessions(data, {});
  const exIds = [...new Set(recent.flatMap((s) => s.exercicios.filter((e) => e.series !== "não feito").map((e) => e.id)))];
  const body = data.bodyLog?.length ? `\n## Peso e medidas\n\n${json(toolBodyLog(data))}\n` : "";
  return `# AUGMENT: dados para o treinador (${data.today})

Gerado por ${origin}. Leia o documento inteiro antes de responder: ele traz as suas instruções como treinador, as regras do app, a base científica e os meus treinos.

## Instruções do treinador

${coachSystem(data.settings.operator)}

Observação: nesta conversa você não tem as ferramentas do app (nem \`propor_ajuste\`). Os dados abaixo já são a saída delas; para mudanças, diga o que ajustar e eu aplico no app.

## Plano atual

${json(toolPlan(data))}

## Relatório da semana passada

${json(toolWeekReport(data, { semana: addDays(mondayOf(data.today), -7) }))}

## Relatório desta semana (em andamento)

${json(toolWeekReport(data, { semana: data.today }))}

## Treinos dos últimos 28 dias

${json(recent)}

## Histórico dos exercícios feitos nesse período

${exIds.map((id) => json(toolExerciseHistory(data, { exercicio: id }))).join("\n\n")}
${body}
## Pedido

Com base só nos dados acima, faça o debrief da semana como treinador:

1. **Foco da semana que vem**: uma coisa só, a mais importante, e por quê.
2. **O que foi bem**: com números.
3. **O que corrigir**: no máximo 3 pontos, cada um com a ação concreta.
4. **Próximo treino**: exercício a exercício, com a carga e a meta de reps que o app sugere e o que observar.
5. **Uma pergunta** para mim, se faltar informação para decidir algo.

Depois do debrief, continue a conversa normalmente: posso perguntar qualquer coisa sobre o meu treino.
`;
}
