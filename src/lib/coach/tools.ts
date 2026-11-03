import type Anthropic from "@anthropic-ai/sdk";

// Ferramentas do treinador. Ordem e texto fixos: fazem parte do prefixo em cache.
// eager_input_streaming: a entrada chega aos poucos no streaming; quem valida é runCoachTool.

export const COACH_TOOLS: Anthropic.Beta.BetaTool[] = [
  {
    name: "plano_atual",
    description:
      "Situação de hoje: semana do mesociclo e regra dela, último treino, aviso de retomada, agenda dos próximos 7 dias e o próximo treino com a sugestão de carga do app para cada exercício. Use antes de falar do treino de hoje ou da semana.",
    input_schema: { type: "object", properties: {}, additionalProperties: false },
    eager_input_streaming: true,
  },
  {
    name: "relatorio_semana",
    description:
      "Relatório de uma semana (segunda a domingo): treinos feitos e não feitos, séries que faltaram, volume por músculo contra a meta, reps que sobraram contra a meta, estagnados, recordes, sinais do corpo e o foco calculado. Sem 'semana', traz a semana passada.",
    input_schema: {
      type: "object",
      properties: { semana: { type: "string", description: "Qualquer data da semana, AAAA-MM-DD." } },
      additionalProperties: false,
    },
    eager_input_streaming: true,
  },
  {
    name: "historico_exercicio",
    description:
      "Últimas 8 sessões de um exercício (séries com peso×reps e sobra, como bateu, anotação), recordes e a sugestão do app para a próxima vez.",
    input_schema: {
      type: "object",
      properties: { exercicio: { type: "string", description: "Id do exercício no programa, ex.: pull-a.puxada-aberta." } },
      required: ["exercicio"],
      additionalProperties: false,
    },
    eager_input_streaming: true,
  },
  {
    name: "treinos",
    description:
      "Treinos concluídos num intervalo (máx. 62 dias), com check-in, anotações, séries de cada exercício e como bateu. Sem datas: últimos 28 dias.",
    input_schema: {
      type: "object",
      properties: {
        de: { type: "string", description: "AAAA-MM-DD" },
        ate: { type: "string", description: "AAAA-MM-DD" },
      },
      additionalProperties: false,
    },
    eager_input_streaming: true,
  },
  {
    name: "propor_ajuste",
    description:
      "Propõe uma mudança no app; ele vê um cartão e decide se aplica. Tipos: 'incremento' (muda o salto de carga de um exercício, em kg; exige exercicio e valor), 'recomecar_mesociclo' (volta para a semana 1 a partir desta segunda) e 'repetir_semana' (volta uma semana). Sempre com motivo curto.",
    input_schema: {
      type: "object",
      properties: {
        tipo: { type: "string", enum: ["incremento", "recomecar_mesociclo", "repetir_semana"] },
        exercicio: { type: "string", description: "Id do exercício (só para incremento)." },
        valor: { type: "number", description: "Novo incremento em kg (só para incremento)." },
        motivo: { type: "string", description: "Uma frase explicando por quê." },
      },
      required: ["tipo", "motivo"],
      additionalProperties: false,
    },
    eager_input_streaming: true,
  },
];

/** Rótulo do que o treinador está fazendo, para mostrar enquanto a ferramenta roda. */
export const TOOL_LABEL: Record<string, string> = {
  plano_atual: "Lendo o plano de hoje",
  relatorio_semana: "Lendo o relatório da semana",
  historico_exercicio: "Lendo o histórico do exercício",
  treinos: "Lendo os treinos",
  propor_ajuste: "Preparando uma proposta",
};
