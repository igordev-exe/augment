// Bloco B do chat potente: pedidos compostos, frases com "e"/vírgula que NÃO são compostas, e conversas de várias
// trocas. Escrito como leigo digita no celular. "data" = consulta aos dados; o resto é o id do comando.

export interface GoldenCompound {
  q: string;
  parts: string[];
}

export const GOLDEN_COMPOUND: GoldenCompound[] = [
  { q: "anota 8 com 80 e comeca o descanso de 90 segundos", parts: ["treino-anotar", "timer-iniciar"] },
  { q: "anota 10 com 60, descanso de 2 minutos", parts: ["treino-anotar", "timer-iniciar"] },
  { q: "registra 12 com 40 e depois 10", parts: ["treino-anotar", "treino-anotar"] },
  { q: "anota 8 com 80 e depois 7", parts: ["treino-anotar", "treino-anotar"] },
  { q: "anota 8 com 80 e 7 com 75", parts: ["treino-anotar", "treino-anotar"] },
  { q: "80x8, 80x7 e 75x8", parts: ["treino-anotar", "treino-anotar", "treino-anotar"] },
  { q: "8 com 100 e 90 segundos de descanso", parts: ["treino-anotar", "timer-iniciar"] },
  { q: "fiz 9 com 70 e poe 2 min de descanso", parts: ["treino-anotar", "timer-iniciar"] },
  { q: "anota 6 com 120, depois descanso de 3 minutos", parts: ["treino-anotar", "timer-iniciar"] },
  { q: "anota 15 com 20 e mais 30 segundos no timer", parts: ["treino-anotar", "timer-somar"] },
  { q: "para o timer e anota 8 com 80", parts: ["timer-parar", "treino-anotar"] },
  { q: "pesei 81,2 hoje e abre o progresso", parts: ["corpo-peso", "navegar"] },
  { q: "pesei 80 e quanto falta pro deload", parts: ["corpo-peso", "cal-deload"] },
  { q: "muda pra libras e liga o som", parts: ["ajuste-unidade", "som-liga"] },
  { q: "desliga o som e desliga a vibracao", parts: ["som-desliga", "vibra-desliga"] },
  { q: "tira o som, liga a vibracao", parts: ["som-desliga", "vibra-liga"] },
  { q: "abre o historico e depois o progresso", parts: ["navegar", "navegar"] },
  { q: "que dia e hoje e quando acaba o ciclo", parts: ["cal-hoje", "cal-fim-ciclo"] },
  { q: "quanto e 80% de 120 e 100 libras em kg", parts: ["conta-porcento", "conta-converter"] },
  { q: "anilhas pra 100 e anilhas pra 60", parts: ["conta-anilhas", "conta-anilhas"] },
  { q: "1rm de 100 por 5, e 1rm de 80 por 10", parts: ["conta-1rm", "conta-1rm"] },
  { q: "quantas series de peito essa semana e de costas", parts: ["data", "data"] },
  { q: "quantas series de peito fiz em outubro e de costas", parts: ["data", "data"] },
  { q: "qual meu recorde no supino reto e no puxada", parts: ["data", "data"] },
  { q: "quantos treinos fiz esse mes, e quanto tempo treinei", parts: ["data", "data"] },
  { q: "qual meu peso, depois quantos treinos fiz essa semana", parts: ["data", "data"] },
  { q: "descanso de 90 segundos e quantas series faltam", parts: ["timer-iniciar", "treino-proxima"] },
  { q: "anota 8 com 80 e qual a proxima serie", parts: ["treino-anotar", "treino-proxima"] },
  { q: "anota 10 com 50; descanso de 1 minuto", parts: ["treino-anotar", "timer-iniciar"] },
  { q: "bota 2 min de descanso e abre o treino", parts: ["timer-iniciar", "treino-comecar"] },
  { q: "anota 8 x 80 e para o descanso", parts: ["treino-anotar", "timer-parar"] },
  { q: "pesei 79,5 hoje e anota 8 com 60", parts: ["corpo-peso", "treino-anotar"] },
  { q: "quanto e 70% de 140 e anilhas pra 100", parts: ["conta-porcento", "conta-anilhas"] },
  { q: "que horas sao e que dia e hoje", parts: ["cal-hora", "cal-hoje"] },
  { q: "anota 12 com 30 e depois 11 e depois 10", parts: ["treino-anotar", "treino-anotar", "treino-anotar"] },
  { q: "liga o som e descanso de 2 minutos", parts: ["som-liga", "timer-iniciar"] },
  { q: "abre os ajustes e muda pra kg", parts: ["navegar", "ajuste-unidade"] },
  { q: "descanso de 45 segundos, mais 15 segundos", parts: ["timer-iniciar", "timer-somar"] },
  { q: "anota 7 com 85 e 7 com 85", parts: ["treino-anotar", "treino-anotar"] },
  { q: "fiz 10 com 40, fiz 9 com 40", parts: ["treino-anotar", "treino-anotar"] },
  { q: "anota 5 com 140 e depois 4", parts: ["treino-anotar", "treino-anotar"] },
  { q: "pesei 82 e meu peso ta caindo?", parts: ["corpo-peso", "data"] },
  { q: "anota 8 com 80, poe 90s", parts: ["treino-anotar", "timer-iniciar"] },
  { q: "100kg x 5 e descanso de 3 min", parts: ["treino-anotar", "timer-iniciar"] },
  { q: "abre o guia e depois os exercicios", parts: ["navegar", "navegar"] },
];

/** Frases com "e", vírgula ou "depois" que são um pedido só (não podem quebrar). */
export const GOLDEN_NOT_COMPOUND: string[] = [
  "supino e agachamento sao bons?",
  "peito e triceps no mesmo dia pode?",
  "arroz e feijao depois do treino",
  "qual a diferenca entre supino e crucifixo",
  "como faz o stiff e o terra",
  "o que e drop set e rest pause",
  "posso treinar peito e costas no mesmo dia",
  "creatina e whey juntos?",
  "cansado e sem vontade de treinar",
  "dor no ombro e no cotovelo",
  "series e repeticoes pra hipertrofia",
  "biceps e triceps quantas series",
  "quanto descanso entre series e entre exercicios",
  "tenho 2 halteres e uma barra, da pra treinar?",
  "treino de manha e a tarde",
  "comer antes e depois do treino",
  "melhor fazer leg press e agachamento ou so um?",
  "dormi mal e to cansado",
  "quantas vezes treino perna e gluteo",
  "voce e um robo ou uma pessoa?",
  "oi, tudo bem?",
  "bom dia, como vai",
  "valeu, ate mais",
  "obrigado, ajudou muito",
  "beleza, entendi",
  "ok, depois eu vejo",
  "nao, deixa pra la",
  "supino reto e inclinado qual e melhor",
  "puxada e remada trabalham o que",
  "aquecimento e alongamento antes do treino",
  "cardio e musculacao no mesmo dia",
  "proteina e carboidrato quanto comer",
  "hipertrofia e forca qual a diferenca",
  "maquina e peso livre qual melhor",
  "falha e falha tecnica",
  "rir e rpe e a mesma coisa?",
  "deload e descanso total?",
  "ombro e trapezio doendo",
  "costas e biceps juntos e bom?",
  "pernas e gluteo crescem com agachamento?",
  "e ai, tudo certo?",
  "hmm, nao sei",
  "acho que sim, depois vejo",
  "perdi o treino de ontem e de hoje",
  "fiquei doente e nao treinei",
  "subir carga e repeticoes ao mesmo tempo?",
  "musculo dolorido e treinar de novo",
  "manha, tarde ou noite, quando treinar",
  "supino, crucifixo ou flexao",
  "o que e superset e bi-set",
  "pesado e leve no mesmo treino",
  "volume e intensidade qual importa mais",
  "agua e cafe antes do treino",
  "sono e recuperacao",
  "tempo de descanso e hipertrofia",
  "dor nas costas e lombar",
  "abdominal e prancha todo dia",
  "eu e meu amigo treinamos juntos",
  "treino em casa e academia",
  "panturrilha e antebraco crescem devagar?",
];

export interface GoldenTurn {
  q: string;
  /** Trecho que tem de aparecer na resposta (minúsculo, sem acento). */
  has?: string;
  /** Camada esperada. */
  layer?: string;
  /** Proposta esperada (sim) ou proibida (não). */
  proposal?: boolean;
}

/** Conversas de 2 a 5 trocas: o assunto passa adiante (referência, troca de eixo, repete, desfaz). */
export const GOLDEN_CONVERSATIONS: { name: string; turns: GoldenTurn[] }[] = [
  {
    name: "recorde → nele",
    turns: [
      { q: "qual meu recorde no supino inclinado", layer: "data" },
      { q: "e quando foi a ultima vez que fiz ele", has: "inclinado" },
    ],
  },
  {
    name: "recorde → e no outro",
    turns: [
      { q: "qual meu recorde na puxada", layer: "data" },
      { q: "e na remada?", has: "remada" },
    ],
  },
  {
    name: "séries → outro músculo",
    turns: [
      { q: "quantas series de peito fiz essa semana", layer: "data" },
      { q: "e de costas?", layer: "data", has: "costas" },
    ],
  },
  {
    name: "séries → outro período",
    turns: [
      { q: "quantas series de peito fiz essa semana", layer: "data" },
      { q: "e semana passada?", layer: "data" },
    ],
  },
  {
    name: "assunto sobrevive a resposta pronta",
    turns: [
      { q: "qual meu recorde no supino inclinado", layer: "data" },
      { q: "o que e rir", layer: "answer" },
      { q: "e no crucifixo?", layer: "data", has: "crucifixo" },
    ],
  },
  {
    name: "assunto sobrevive ao papo",
    turns: [
      { q: "quantas series de peito fiz essa semana", layer: "data" },
      { q: "valeu", layer: "smalltalk" },
      { q: "e de costas?", layer: "data" },
    ],
  },
  { name: "timer → repete", turns: [{ q: "descanso de 90 segundos" }, { q: "repete", has: "1 min 30" }] },
  { name: "timer → repete com outro tempo", turns: [{ q: "descanso de 90 segundos" }, { q: "repete com 2 minutos", has: "2 min" }] },
  { name: "anilhas → repete com outra carga", turns: [{ q: "anilhas pra 100" }, { q: "repete com 60", has: "60" }] },
  { name: "conta → de novo", turns: [{ q: "quanto e 80% de 120" }, { q: "de novo", has: "96" }] },
  { name: "desfaz sem nada", turns: [{ q: "desfaz", has: "nada recente" }] },
  {
    name: "peso → sim",
    turns: [
      { q: "pesei 81 hoje", proposal: true },
      { q: "sim", layer: "proposal" },
    ],
  },
  {
    name: "peso → nao",
    turns: [
      { q: "pesei 81 hoje", proposal: true },
      { q: "nao", layer: "proposal" },
    ],
  },
  {
    name: "ajuste → sim",
    turns: [
      { q: "muda pra libras", proposal: true },
      { q: "pode", layer: "proposal" },
    ],
  },
  {
    name: "correção de exercício",
    turns: [
      { q: "qual meu recorde no supino reto", layer: "data" },
      { q: "nao, o inclinado", has: "inclinado" },
    ],
  },
  {
    name: "pedido em aberto",
    turns: [
      { q: "anota uma serie", layer: "command" },
      { q: "8 com 80", layer: "pending" },
    ],
  },
  {
    name: "dele",
    turns: [
      { q: "qual meu recorde na puxada", layer: "data" },
      { q: "como faz ele", has: "puxada" },
    ],
  },
  {
    name: "esse exercício",
    turns: [
      { q: "qual meu recorde no crucifixo", layer: "data" },
      { q: "o que esse exercicio trabalha", has: "crucifixo" },
    ],
  },
  {
    name: "três trocas, eixo a eixo",
    turns: [
      { q: "quantas series de peito fiz em outubro", layer: "data" },
      { q: "e de costas?", layer: "data" },
      { q: "e de ombro?", layer: "data" },
    ],
  },
  {
    name: "papo não quebra proposta",
    turns: [
      { q: "pesei 81 hoje", proposal: true },
      { q: "sim", layer: "proposal" },
      { q: "valeu", layer: "smalltalk" },
    ],
  },
  {
    name: "repete sem comando anterior",
    turns: [
      { q: "qual meu recorde no supino reto", layer: "data" },
      { q: "repete", proposal: false },
    ],
  },
  {
    name: "composto e depois continuação",
    turns: [
      { q: "quantas series de peito essa semana e de costas", layer: "data" },
      { q: "e de pernas?", layer: "data" },
    ],
  },
  { name: "timer → mais tempo", turns: [{ q: "descanso de 90 segundos" }, { q: "mais 30 segundos" }] },
  {
    name: "recorde → trocar ele",
    turns: [
      { q: "qual meu recorde no supino inclinado", layer: "data" },
      { q: "troca ele hoje", layer: "command" },
    ],
  },
  {
    name: "papo, depois pergunta nova",
    turns: [
      { q: "bom dia", layer: "smalltalk" },
      { q: "quantas series de peito fiz essa semana", layer: "data" },
    ],
  },
];
