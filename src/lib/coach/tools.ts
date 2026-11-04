import type Anthropic from "@anthropic-ai/sdk";

// Ferramentas do treinador. Ordem e texto fixos: fazem parte do prefixo em cache.
// eager_input_streaming: a entrada chega aos poucos no streaming; quem valida é runCoachTool.

export const COACH_TOOLS: Anthropic.Beta.BetaTool[] = [
  {
    name: "plano_atual",
    description:
      "Situação de hoje: semana do mesociclo e regra dela, último treino, aviso de retomada, alerta de fadiga acumulada, acessórios rotacionados, agenda dos próximos 7 dias e o próximo treino com a sugestão de carga do app para cada exercício. Use antes de falar do treino de hoje ou da semana.",
    input_schema: { type: "object", properties: {}, additionalProperties: false },
    eager_input_streaming: true,
  },
  {
    name: "relatorio_semana",
    description:
      "Relatório de uma semana (segunda a domingo): treinos feitos e não feitos, séries que faltaram, volume por músculo contra a meta, reps que sobraram contra a meta, estagnados, recordes, cardio/passos, sinais do corpo e o foco calculado. Sem 'semana', traz a semana passada.",
    input_schema: {
      type: "object",
      properties: { semana: { type: "string", description: "Qualquer data da semana, AAAA-MM-DD." } },
      additionalProperties: false,
    },
    eager_input_streaming: true,
  },
  {
    name: "relatorio_mesociclo",
    description:
      "Relatório consolidado do mesociclo atual (6 semanas + deload): aderência, volume total, recordes, evolução de carga e 1RM estimado do 1º ao último treino de cada exercício e os acessórios candidatos a troca no próximo mesociclo.",
    input_schema: { type: "object", properties: {}, additionalProperties: false },
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
      "Treinos concluídos num intervalo (máx. 62 dias), com check-in, cardio/passos, anotações, séries de cada exercício e como bateu. Sem datas: últimos 28 dias.",
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
    name: "corpo",
    description:
      "Histórico de peso corporal e medidas (cintura, braço e observações), a meta de peso dele e o ritmo semanal contra a faixa recomendada.",
    input_schema: { type: "object", properties: {}, additionalProperties: false },
    eager_input_streaming: true,
  },
  {
    name: "propor_ajuste",
    description:
      "Propõe uma mudança no app; ele vê um cartão e decide se aplica. Tipos: 'incremento' (muda o salto de carga de um exercício, em kg; exige exercicio e valor), 'recomecar_mesociclo' (volta para a semana 1 a partir desta segunda), 'repetir_semana' (volta uma semana), 'antecipar_deload' (entra na semana 7 de deload já nesta semana por fadiga), 'dias_treino' (muda os dias da semana em que ele treina; exige dias), 'lembrete_exercicio' (fixa um lembrete técnico curto no exercício; exige exercicio e nota), 'trocar_acessorio' (fixa uma alternativa da biblioteca para um exercício no mesociclo; exige exercicio e alternativa) e 'ajustar_series' (séries a mais ou a menos por treino num exercício, a partir da ficha: valor −2 a +2, 0 volta à ficha, entre 2 e 4 séries no total; use com o ajuste_series_proximo_meso do relatório do mesociclo). Sempre com motivo curto.",
    input_schema: {
      type: "object",
      properties: {
        tipo: {
          type: "string",
          enum: [
            "incremento",
            "recomecar_mesociclo",
            "repetir_semana",
            "antecipar_deload",
            "dias_treino",
            "lembrete_exercicio",
            "trocar_acessorio",
            "ajustar_series",
          ],
        },
        exercicio: {
          type: "string",
          description: "Id do exercício (para incremento, lembrete_exercicio, trocar_acessorio ou ajustar_series).",
        },
        valor: {
          type: "number",
          description: "Novo incremento em kg (incremento) ou séries a mais/menos sobre a ficha, −2 a +2 (ajustar_series).",
        },
        dias: {
          type: "array",
          items: { type: "integer" },
          description: "Dias da semana de treino: 0 = dom, 1 = seg … 6 = sáb (só para dias_treino).",
        },
        nota: {
          type: "string",
          description: "Lembrete técnico curto para aparecer no cartão do exercício (só para lembrete_exercicio).",
        },
        alternativa: {
          type: "string",
          description: "Nome da alternativa da biblioteca (ou vazio para voltar ao titular; só para trocar_acessorio).",
        },
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
  relatorio_mesociclo: "Lendo o relatório do mesociclo",
  historico_exercicio: "Lendo o histórico do exercício",
  treinos: "Lendo os treinos",
  corpo: "Lendo peso e medidas",
  propor_ajuste: "Preparando uma proposta",
};
