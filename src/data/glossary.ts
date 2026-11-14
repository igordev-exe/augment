import type { EvidenceLevel } from "./science";

// Glossário do chat sem chave: termo → definição curta (1 ou 2 frases), escrita para leigo. Um modelo só ("o que é
// {termo}", "{termo} é o quê", "{termo}?") responde todos. `principle` liga ao Guia ("Ler mais"); `level` vale para
// o que é afirmação de ciência (definição pura de palavra fica sem nível).

export interface GlossaryTerm {
  id: string;
  /** Formas de escrever o termo (a primeira é a que aparece na resposta). */
  terms: string[];
  def: string;
  principle?: string;
  level?: EvidenceLevel;
  route?: string;
}

export const GLOSSARY: GlossaryTerm[] = [
  // ---------- Esforço ----------
  {
    id: "rir",
    terms: ["RIR", "reps na reserva", "repeticoes na reserva", "reps em reserva"],
    def: "Quantas repetições ainda sobravam quando você parou a série. RIR 2 = dava para fazer mais 2 com boa técnica.",
    principle: "rir-hipertrofia",
  },
  {
    id: "rpe",
    terms: ["RPE", "escala de esforco percebido", "esforco percebido"],
    def: "Nota de 1 a 10 para o esforço da série. RPE 8 é o mesmo que sobrar 2 repetições (RIR 2).",
  },
  {
    id: "falha",
    terms: ["falha", "falha muscular", "ir ate a falha", "falha concentrica"],
    def: "O ponto em que você não consegue completar mais uma repetição, mesmo tentando. No app, F na série.",
    principle: "rir-hipertrofia",
  },
  {
    id: "falha-tecnica",
    terms: ["falha tecnica"],
    def: "Quando a próxima repetição só sairia com a técnica quebrando. Na prática, sobram 1 ou 2. No app, T na série.",
  },
  {
    id: "intensidade",
    terms: ["intensidade", "intensidade de carga"],
    def: 'Quão pesada é a carga em relação ao seu máximo. 80% do 1RM é alta; 50% é baixa. No dia a dia também se usa para "esforço".',
  },
  {
    id: "volume",
    terms: ["volume", "volume de treino"],
    def: "Quanto você treina um músculo, contado em séries difíceis por semana. É o principal motor do crescimento.",
    principle: "volume-dose",
    level: "evidencia",
  },
  {
    id: "volume-fracionado",
    terms: ["volume fracionado", "serie fracionada", "series fracionadas", "serie indireta"],
    def: "Jeito de contar séries em que o músculo que só ajuda vale meia série. O tríceps num supino conta 0,5.",
    principle: "volume-fracionado",
    level: "evidencia",
  },
  {
    id: "serie-efetiva",
    terms: ["serie efetiva", "serie valida", "serie dificil", "serie de trabalho"],
    def: "Série feita perto da falha (sobrando até 3 ou 4). Aquecimento não conta.",
  },
  {
    id: "tonelagem",
    terms: ["tonelagem", "volume load", "carga total"],
    def: "Carga × repetições somadas no treino. Mostra o trabalho total, mas não substitui a contagem de séries.",
  },
  {
    id: "teto-sessao",
    terms: ["teto por sessao", "teto de series", "limite por sessao"],
    def: "Até umas 11 séries por músculo num treino. Passou disso, o ganho por série cai bastante; melhor dividir em dois dias.",
    principle: "teto-sessao",
  },
  {
    id: "dose-volume",
    terms: ["dose resposta", "dose de volume", "retorno decrescente"],
    def: "Mais séries dão mais músculo, mas cada série a mais rende um pouco menos que a anterior.",
    principle: "volume-dose",
    level: "evidencia",
  },
  {
    id: "marcos-volume",
    terms: ["marcos de volume", "volume minimo", "minimo de series"],
    def: "Umas 4 séries por semana já fazem diferença; de 10 a 20 é a faixa eficiente para a maioria.",
    principle: "volume-marcos",
    level: "evidencia",
  },
  {
    id: "acsm",
    terms: ["ACSM", "diretriz do acsm", "posicionamento do acsm"],
    def: "Colégio Americano de Medicina do Esporte. A diretriz de 2026 dele resume o que a pesquisa diz sobre volume e frequência.",
    principle: "acsm-2026",
    level: "consenso",
  },
  // ---------- Carga e progressão ----------
  {
    id: "1rm",
    terms: ["1RM", "rm", "uma repeticao maxima", "repeticao maxima", "carga maxima"],
    def: "A maior carga que você levanta uma vez só. O app estima pela fórmula de Epley a partir de séries de até 15 repetições.",
    route: "/progresso",
  },
  {
    id: "e1rm",
    terms: ["1RM estimado", "e1rm", "maximo estimado"],
    def: "Seu máximo calculado de uma série comum (carga × repetições), sem precisar testar uma repetição máxima.",
  },
  {
    id: "pr",
    terms: ["PR", "recorde pessoal", "personal record"],
    def: "Sua melhor marca num exercício. O app avisa quando você bate uma.",
    route: "/progresso",
  },
  {
    id: "sobrecarga",
    terms: ["sobrecarga progressiva", "progressao de carga", "sobrecarga"],
    def: "Pedir um pouco mais ao músculo com o tempo: mais carga, mais repetições ou mais séries.",
    principle: "progressao",
    level: "evidencia",
  },
  {
    id: "progressao-dupla",
    terms: ["progressao dupla", "dupla progressao"],
    def: "Primeiro sobe as repetições até o topo da faixa; quando bate em todas as séries, sobe a carga e volta para baixo da faixa. É como o app sugere carga.",
  },
  {
    id: "faixa-reps",
    terms: ["faixa de repeticoes", "faixa de reps", "range de reps"],
    def: "O intervalo alvo da série, como 8 a 12. Cresce músculo de 5 a 30 repetições, desde que perto da falha.",
    principle: "carga-faixa",
    level: "evidencia",
  },
  {
    id: "estagnacao",
    terms: ["estagnacao", "plato", "platô", "estagnar"],
    def: "Quando a força não sobe por várias sessões seguidas. O app considera depois de 3 treinos parados.",
  },
  {
    id: "backoff",
    terms: ["backoff", "serie de recuo", "back off"],
    def: "Série com menos carga depois da principal, para fazer mais repetições com técnica boa. O app sugere uns 15% a menos.",
  },
  {
    id: "aquecimento",
    terms: ["aquecimento", "serie de aquecimento", "series de aquecimento"],
    def: "Séries leves antes da carga de trabalho, para preparar articulação e movimento. Não contam como volume.",
  },
  {
    id: "carga-relativa",
    terms: ["forca relativa", "carga relativa"],
    def: "Sua força dividida pelo seu peso corporal. Ajuda a comparar pessoas de tamanhos diferentes.",
  },
  {
    id: "anilha",
    terms: ["anilha", "anilhas"],
    def: 'Os discos de peso que vão na barra. O app calcula quantas de cada lado: pergunte "anilhas pra 80".',
  },
  // ---------- Técnicas ----------
  {
    id: "drop-set",
    terms: ["drop set", "dropset", "drop", "serie descendente"],
    def: "Chegar perto da falha, tirar uns 20 a 30% da carga e continuar sem descanso. Economiza tempo; não cresce mais que séries normais.",
    principle: "sistemas-avancados",
    level: "evidencia",
  },
  {
    id: "superset",
    terms: ["superset", "super serie", "superserie", "bi set", "biset"],
    def: "Dois exercícios seguidos, sem descanso entre eles. No app, A1 e A2. Bom para ganhar tempo, sobretudo em músculos opostos.",
  },
  {
    id: "rest-pause",
    terms: ["rest pause", "rest-pause", "pausa descanso"],
    def: "Ir perto da falha, descansar 10 a 20 segundos e fazer mais algumas repetições com a mesma carga.",
    principle: "sistemas-avancados",
  },
  {
    id: "myo-reps",
    terms: ["myo reps", "myoreps", "myo-reps"],
    def: "Uma série de ativação perto da falha seguida de mini-séries curtas com pausas de poucos segundos. Variante do rest-pause.",
  },
  {
    id: "parciais",
    terms: ["parciais", "repeticoes parciais", "parcial alongada", "lengthened partials"],
    def: "Repetições curtas na parte em que o músculo está alongado. Depois da falha, podem somar um pouco de estímulo.",
    principle: "parciais-pos-falha",
    level: "hipotese",
  },
  {
    id: "pausa-alongado",
    terms: ["pausa no alongamento", "pausa alongada", "pausa embaixo"],
    def: "Segurar 1 a 2 segundos na posição de maior alongamento, como no fundo do supino. Tira o impulso e deixa a série mais honesta.",
    principle: "pausa-alongamento",
  },
  {
    id: "cadencia",
    terms: ["cadencia", "tempo de execucao", "velocidade da repeticao"],
    def: "A velocidade de cada fase da repetição. De meio a 8 segundos por repetição dá resultado parecido; o importante é controlar.",
    principle: "cadencia",
  },
  {
    id: "excentrica",
    terms: ["excentrica", "fase excentrica", "negativa"],
    def: "A fase em que o músculo alonga sob carga, como descer a barra no supino.",
  },
  {
    id: "concentrica",
    terms: ["concentrica", "fase concentrica"],
    def: "A fase em que o músculo encurta e levanta a carga, como subir a barra no supino.",
  },
  { id: "isometria", terms: ["isometria", "isometrico", "prancha isometrica"], def: "Contração sem movimento, como segurar uma prancha." },
  {
    id: "bfr",
    terms: ["BFR", "oclusao", "restricao de fluxo", "kaatsu"],
    def: "Treino leve com uma faixa apertando o alto do braço ou da coxa. Cresce músculo com carga baixa; precisa de equipamento e cuidado.",
    principle: "bfr",
    level: "evidencia",
  },
  {
    id: "intensificador",
    terms: ["intensificador", "intensificadores", "tecnica avancada", "tecnicas avancadas"],
    def: "Drop set, rest-pause, parciais e afins. No app entram a partir da semana 3 e com limite por treino.",
    principle: "sistemas-avancados",
  },
  {
    id: "amplitude",
    terms: ["amplitude", "amplitude completa", "rom", "range of motion"],
    def: "O caminho completo do movimento. Treinar com o músculo bem alongado tende a render mais.",
    principle: "parciais-alongadas",
    level: "evidencia",
  },
  {
    id: "titina",
    terms: ["titina"],
    def: "Proteína gigante dentro do músculo que funciona como mola. Uma hipótese é que ela sinaliza o crescimento quando o músculo é esticado sob carga.",
    principle: "titina",
    level: "hipotese",
  },
  {
    id: "estabilidade",
    terms: ["estabilidade", "exercicio estavel", "maquina estavel"],
    def: "Quanto o exercício te segura no lugar. Máquinas estáveis deixam ir mais perto da falha sem a técnica quebrar.",
    principle: "estabilidade",
    level: "campo",
  },
  // ---------- Organização ----------
  {
    id: "mesociclo",
    terms: ["mesociclo", "meso", "ciclo"],
    def: "Bloco de semanas com um plano. No app são 7: 6 de carga crescente e 1 de deload.",
    route: "/relatorio",
  },
  {
    id: "deload",
    terms: ["deload", "semana de descarga", "descarga"],
    def: "Semana mais leve para o corpo se recuperar: metade das séries, mesma carga, longe da falha. No app é a semana 7.",
    principle: "deload",
  },
  {
    id: "periodizacao",
    terms: ["periodizacao", "periodizar"],
    def: "Organizar o treino em fases ao longo das semanas. Ajuda a manter a progressão e a encaixar o descanso.",
    principle: "periodizacao",
    level: "evidencia",
  },
  {
    id: "inicio-bloco",
    terms: ["inicio do bloco", "semana de entrada", "comeco do ciclo", "semana 1"],
    def: "A primeira semana do ciclo vem mais leve (sobrando 2 a 3 repetições) para o corpo se readaptar antes de apertar.",
    principle: "inicio-bloco",
    level: "campo",
  },
  {
    id: "frequencia",
    terms: ["frequencia", "frequencia de treino"],
    def: "Quantas vezes por semana você treina um músculo. Duas costuma ser bom; o total de séries importa mais.",
    principle: "frequencia",
    level: "evidencia",
  },
  {
    id: "split",
    terms: ["split", "divisao", "divisao de treino"],
    def: "Como os músculos são divididos nos dias: corpo inteiro, superior/inferior, push/pull/legs.",
    route: "/programas",
  },
  {
    id: "ppl",
    terms: ["PPL", "push pull legs", "push pull leg"],
    def: "Divisão em empurrar (peito, ombro, tríceps), puxar (costas, bíceps) e pernas.",
  },
  {
    id: "upper-lower",
    terms: ["upper lower", "superior inferior", "upper/lower"],
    def: "Divisão alternando dias de parte de cima e de parte de baixo do corpo.",
  },
  {
    id: "full-body",
    terms: ["full body", "fullbody", "corpo inteiro", "treino de corpo inteiro"],
    def: "Treino que trabalha o corpo todo em cada sessão. Bom para quem treina 2 ou 3 vezes por semana.",
  },
  {
    id: "abc",
    terms: ["ABC", "treino abc", "abcd", "treino abcde"],
    def: "Divisão em que cada letra é um dia diferente (A, B, C). Quanto mais letras, menos vezes cada músculo é treinado.",
  },
  {
    id: "ficha",
    terms: ["ficha", "ficha de treino", "programa de treino"],
    def: "A lista de exercícios, séries e repetições de cada dia. No app, é o programa.",
    route: "/programas",
  },
  {
    id: "composto",
    terms: ["composto", "exercicio composto", "multiarticular", "multi articular"],
    def: "Exercício que mexe várias articulações e músculos juntos, como agachamento, supino e remada.",
  },
  {
    id: "isolado",
    terms: ["isolado", "exercicio isolado", "monoarticular", "uniarticular"],
    def: "Exercício de uma articulação só, como rosca, extensora e elevação lateral.",
  },
  {
    id: "unilateral",
    terms: ["unilateral", "um lado por vez"],
    def: "Exercício feito com um braço ou uma perna de cada vez. Ajuda a corrigir diferença entre os lados.",
  },
  {
    id: "sinergista",
    terms: ["sinergista", "sinergistas", "musculo auxiliar"],
    def: "Músculo que ajuda no movimento sem ser o alvo, como o tríceps no supino. No app conta meia série.",
  },
  {
    id: "descanso",
    terms: ["descanso entre series", "intervalo", "tempo de descanso"],
    def: "A pausa entre séries. Uns 2 minutos ou mais nos compostos rendem mais repetições e mais músculo que pausas curtas.",
    principle: "descanso",
    level: "evidencia",
  },
  {
    id: "autorregulacao",
    terms: ["autorregulacao", "autoregulacao", "treino autorregulado"],
    def: "Ajustar carga e séries pelo dia: se rendeu menos, o plano se adapta em vez de forçar.",
    principle: "autorregulacao",
  },
  {
    id: "ancora",
    terms: ["ancora", "exercicio ancora", "serie ancora"],
    def: "Um exercício fixo que serve de régua para ler o dia. Se ele caiu muito, o resto do treino se ajusta.",
    principle: "ancora",
    level: "campo",
  },
  {
    id: "check-in",
    terms: ["check in", "checkin"],
    def: "As perguntas rápidas antes do treino (sono, energia, dor). Num dia ruim, o app oferece tirar séries dos isolados.",
  },
  // ---------- Corpo e alimentação ----------
  {
    id: "hipertrofia",
    terms: ["hipertrofia", "hipertrofia muscular"],
    def: "Crescimento do músculo. Vem de séries difíceis, progressão, proteína suficiente e sono.",
  },
  {
    id: "sarcoplasmatica",
    terms: ["hipertrofia sarcoplasmatica", "sarcoplasmatica", "hipertrofia miofibrilar", "miofibrilar"],
    def: 'Ideia de que existe um crescimento "de líquido" separado do de fibra. Na prática, o treino comum faz os dois juntos.',
    principle: "sarcoplasmatica",
    level: "hipotese",
  },
  {
    id: "pump",
    terms: ["pump", "bomba", "inchaço"],
    def: "O músculo cheio e inchado durante o treino, por causa do sangue. É sensação boa, mas não prova de crescimento.",
    principle: "pump",
  },
  {
    id: "carboidrato",
    terms: ["carboidrato", "carbo", "carboidratos"],
    def: "A principal fonte de energia dos treinos pesados. Pouco carboidrato tende a piorar o rendimento em treinos longos.",
    principle: "carboidrato",
    level: "evidencia",
  },
  {
    id: "proteina",
    terms: ["proteina", "proteinas"],
    def: "O nutriente que constrói músculo. Para quem treina, uns 1,6 a 2,2 g por kg de peso por dia.",
    principle: "proteina",
    level: "evidencia",
  },
  {
    id: "bulking",
    terms: ["bulking", "bulk", "fase de ganho"],
    def: "Fase comendo um pouco acima do gasto para ganhar músculo. Ritmo bom: uns 0,25 a 0,5% do peso por semana.",
  },
  {
    id: "cutting",
    terms: ["cutting", "cut", "fase de corte", "definicao"],
    def: "Fase comendo abaixo do gasto para perder gordura, mantendo o treino pesado para segurar o músculo.",
  },
  {
    id: "recomposicao",
    terms: ["recomposicao", "recomposicao corporal", "recomp"],
    def: "Perder gordura e ganhar músculo ao mesmo tempo. Mais comum em quem está começando ou voltando.",
    principle: "recomposicao",
  },
  {
    id: "deficit",
    terms: ["deficit calorico", "deficit", "deficit de calorias"],
    def: "Comer menos energia do que gasta. É o que faz perder peso.",
  },
  {
    id: "superavit",
    terms: ["superavit calorico", "superavit"],
    def: "Comer mais energia do que gasta. Junto do treino, ajuda a ganhar músculo.",
  },
  {
    id: "tmb",
    terms: ["TMB", "taxa metabolica basal", "metabolismo basal"],
    def: "A energia que o corpo gasta parado, só para funcionar.",
  },
  {
    id: "creatina",
    terms: ["creatina"],
    def: "Suplemento mais estudado do esporte: 3 a 5 g por dia aumentam um pouco a força e o volume de treino.",
    level: "evidencia",
  },
  {
    id: "whey",
    terms: ["whey", "whey protein", "wey"],
    def: "Proteína do soro do leite em pó. É comida prática, não mágica: conta junto com a proteína do dia.",
  },
  {
    id: "doms",
    terms: ["DOMS", "dor tardia", "dor muscular tardia", "dor de dia seguinte"],
    def: "A dor muscular que aparece 1 ou 2 dias depois do treino. É normal e não mede o quanto você cresceu.",
  },
  {
    id: "catabolismo",
    terms: ["catabolismo", "catabolizar", "perder massa"],
    def: 'Quebra de tecido do corpo. O medo de "catabolizar" em poucas horas sem comer é exagerado.',
  },
  {
    id: "anabolismo",
    terms: ["anabolismo", "janela anabolica"],
    def: 'Construção de tecido. A "janela" depois do treino é bem mais larga do que se dizia: o total do dia pesa mais.',
  },
  // ---------- Diferenças ----------
  {
    id: "mulheres-volume",
    terms: ["treino feminino", "treino para mulher", "mulher treina diferente"],
    def: "Mulheres crescem músculo na mesma proporção que homens com o mesmo treino; o ponto de partida é que muda.",
    principle: "mulheres-volume",
    level: "evidencia",
  },
  {
    id: "sexos-fadiga",
    terms: ["fadiga em mulheres", "mulher cansa menos", "diferenca de fadiga"],
    def: "Mulheres costumam cansar menos entre séries e aguentar mais repetições com a mesma porcentagem de carga.",
    principle: "sexos-fadiga",
    level: "evidencia",
  },
  {
    id: "femoropatelar",
    terms: ["femoropatelar", "sindrome femoropatelar", "condromalacia"],
    def: "Dor na frente do joelho, ao redor da patela. Treino de força bem dosado costuma ajudar; dor forte pede avaliação profissional.",
    principle: "dor-femoropatelar",
    level: "evidencia",
  },
  // ---------- App ----------
  {
    id: "sugestao",
    terms: ["sugestao de carga", "numero cinza", "carga sugerida"],
    def: "O número em cinza na próxima série: a carga que o app sugere pelo seu histórico. Marque ✓ para usar ou digite outra.",
  },
  { id: "operador", terms: ["operador"], def: "É como o app chama você. O nome fica em Ajustes.", route: "/ajustes" },
  {
    id: "posto",
    terms: ["posto", "patente", "rank"],
    def: "Seu nível no app, que sobe com o número de treinos registrados.",
    route: "/progresso",
  },
  {
    id: "ponto-restauracao",
    terms: ["ponto de restauracao", "pontos de restauracao"],
    def: "Cópia dos seus dados guardada no aparelho (até 6). Dá para voltar a ela em Ajustes.",
    route: "/ajustes",
  },
];
