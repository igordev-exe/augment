import { ANSWERS, GUARD_REPLY, type Answer, type GuardTopic } from "../../data/answers";
import { LIBRARY } from "../../data/library";
import { MUSCLE_LABEL } from "../../data/program";
import { PRINCIPLES, type EvidenceLevel } from "../../data/science";
import { hasAny, norm } from "./intents";

// AUG.CORE — buscador de respostas prontas (treinador sem chave, fase 1 de docs/prompt-chat-local.md).
//
// Escolha: implementação própria em vez do MiniSearch. Com poucas centenas de respostas, BM25 + radical leve +
// sinônimos + 1 erro de digitação cabem em ~250 linhas, sem dependência nova e sem peso no pacote inicial (a tela do
// treinador já é lazy). A medição está em answers.test.ts; se ela não bater a meta com esta versão, o próximo passo é
// comparar com o MiniSearch no mesmo conjunto de teste.
//
// Ordem: assunto proibido (trava) → busca. As 6 intenções de intents.ts vêm antes de tudo isto, na tela.

// ---------- Texto ----------

const STOPWORDS = new Set(
  (
    "a o as os um uma uns umas de do da dos das d em no na nos nas num numa por pelo pela pelos pelas pra pro pras pros para " +
    "com e ou que qual quais quanto quanta quantos quantas como quando porque pq por se eu me mim meu minha meus minhas " +
    "voce vc voces tu te ele ela eles elas isso isto esse essa este esta aquele aquela ai la aqui ja mais muito muita muitos " +
    "muitas bem tem ter tenho temos ser sou e foi estou esta to ta tava fazer faz faco devo deve devia posso pode podem " +
    "preciso precisa vale vou vai algum alguma alguns so tambem entao ne ok oi ola sobre coisa tipo mesmo ainda hoje bom boa " +
    "certo certa ideal sim nao eh ao aos seu sua seus suas nosso nossa tudo nada quero queria gostaria saber sabe alguem " +
    "dar da dou realmente favor ajuda ideais acho negocio sei deu tive teve vcs ruim entendi entender tal gente cara mano sempre agora dai nisso ate"
  ).split(/\s+/),
);

/**
 * Sinônimos e gírias → termo canônico. Vale para o texto das respostas e para a pergunta, então os dois lados se
 * encontram. Expressões mais longas são trocadas primeiro ("perder peso" antes de "peso").
 */
const SYNONYMS: Record<string, string[]> = {
  // Abreviações de celular viram a palavra (quase sempre vazia) que elas encurtam.
  quanto: ["qnts", "qnt", "qnto", "qnta", "qntos", "qntas", "qto", "qtos", "qtas", "qts"],
  que: ["oq", "q"],
  para: ["p", "pro"],
  depois: ["dps", "dpois"],
  "fim de semana": ["fds"],
  mesmo: ["msm"],
  tambem: ["tb", "tbm"],
  tudo: ["td"],
  muito: ["mt", "mto", "mts"],
  hoje: ["hj"],
  nao: ["n"],
  demais: ["dms"],
  vale: ["vale a pena", "valem a pena", "compensa"],
  recorde: ["prs", "pr", "recordes", "melhor marca"],
  extra: ["a mais", "exercicio a mais"],
  ordem: ["comeco pelo", "comeco pela", "comecar pelo", "comecar pela", "faco primeiro", "fazer primeiro"],
  indisposto: ["dia ruim"],
  app: ["aplicativo", "no app", "do app"],
  hipertrofia: [
    "ganhar massa",
    "ganho de massa",
    "ganhar musculo",
    "ganhar musculos",
    "massa muscular",
    "crescer musculo",
    "ganho massa",
    "cresceu",
    "cresce",
    "crescendo",
    "hipertrofiar",
    "crescer",
    "crescimento",
    "ficar grande",
    "ficar maior",
    "massa",
  ],
  emagrecer: [
    "perder gordura",
    "perder peso",
    "perda de peso",
    "perda de gordura",
    "queimar gordura",
    "emagrecimento",
    "secar",
    "seca",
    "seco",
    "definir",
    "definicao",
    "cutting",
    "cut",
    "perder barriga",
  ],
  bulking: ["bulk", "superavit", "engordar"],
  divisao: [
    "abcde",
    "abcd",
    "abc",
    "ppl",
    "push pull legs",
    "fullbody",
    "full body",
    "corpo inteiro",
    "upper lower",
    "superior e inferior",
    "superior inferior",
    "split",
  ],
  frequencia: [
    "quantas vezes",
    "1x",
    "2x",
    "3x",
    "4x",
    "vezes por semana",
    "vezes na semana",
    "x por semana",
    "vez por semana",
    "vez na semana",
  ],
  treinar: ["malhar", "malhacao", "treinamento", "musculacao", "academia"],
  repeticao: ["reps", "rep", "repeticoes"],
  descanso: ["intervalo", "pausa", "descansar"],
  falha: ["falhar", "exaustao", "nao aguentar mais", "nao aguento mais", "ate o limite"],
  rir: ["reps na reserva", "repeticoes na reserva", "repeticao na reserva", "reserva"],
  deload: ["semana leve", "semana mais leve", "semana de descanso", "semana de recuperacao", "descarga"],
  sono: ["dormir", "dormindo", "durmo", "dormi", "insonia"],
  dolorido: ["dolorida", "doloridos", "quebrado", "quebrada", "moido", "moida", "dor muscular", "dor tardia"],
  cardio: ["aerobico", "aerobicos", "esteira", "corrida", "correr", "bike", "bicicleta", "caminhada", "caminhar", "spinning"],
  alongar: ["alongamento", "alongamentos", "esticar", "flexibilidade"],
  aquecer: ["aquecimento", "esquentar"],
  whey: ["whey protein", "proteina em po", "shake", "suplemento de proteina"],
  cafeina: ["cafe", "pre-treino", "energetico", "suplemento pre treino"],
  refeicao: ["cafe da manha", "comida", "almoco", "jantar", "lanche"],
  alcool: ["cerveja", "bebida alcoolica", "bebida", "beber", "vinho", "cachaca", "drink", "balada", "alcoolica"],
  maquina: ["maquinas", "aparelho", "aparelhos", "smith", "polia"],
  livre: ["peso livre", "pesos livres", "halter", "halteres", "barra livre"],
  carga: ["peso", "kg", "quilo", "quilos", "kilo", "kilos", "anilha", "anilhas"],
  mulher: ["mulheres", "feminino", "feminina", "menina", "meninas", "garota", "musculosa"],
  iniciante: [
    "comecando",
    "comecei",
    "novato",
    "novata",
    "primeira vez",
    "nunca treinei",
    "nunca fui",
    "por onde comeco",
    "por onde comecar",
  ],
  rim: ["rins", "renal", "renais"],
  backup: ["copia de seguranca", "exportar", "celular novo", "trocar de celular", "outro celular"],
  ficha: ["programa de treino", "rotina de treino", "planilha"],
  proteina: ["proteinas", "prot"],
  creatina: ["creatine", "monohidratada"],
  progressao: [
    "progredir",
    "evoluir",
    "aumentar carga",
    "subir carga",
    "subir peso",
    "subir o peso",
    "subo o peso",
    "subo a carga",
    "aumentar o peso",
    "aumentar peso",
  ],
  serie: ["series", "set", "sets", "volume"],
};

const PHRASES: [RegExp, string][] = Object.entries(SYNONYMS)
  .flatMap(([canon, variants]) => variants.map((v) => [v, canon] as const))
  .sort((a, b) => b[0].length - a[0].length)
  .map(([v, canon]) => [
    new RegExp(`(?:^|(?<=[^a-z0-9]))${v.replace(/[-]/g, "[- ]?").replace(/\s+/g, "\\s+")}(?=$|[^a-z0-9])`, "g"),
    canon,
  ]);

/** Sufixos do radical leve, do mais longo ao mais curto; corta o primeiro que deixa 3+ letras. */
const SUFFIXES = [
  "amentos",
  "imentos",
  "amento",
  "imento",
  "amente",
  "mente",
  "acoes",
  "icoes",
  "acao",
  "icao",
  "coes",
  "cao",
  "aram",
  "eram",
  "iram",
  "ando",
  "endo",
  "indo",
  "ados",
  "idos",
  "adas",
  "idas",
  "ado",
  "ido",
  "ada",
  "ida",
  "oes",
  "aes",
  "ais",
  "eis",
  "ava",
  "iam",
  "ei",
  "ou",
  "em",
  "ao",
  "al",
  "ar",
  "er",
  "ir",
  "as",
  "es",
  "os",
  "is",
  "a",
  "e",
  "o",
  "s",
];

export function stem(word: string): string {
  if (word.length <= 3 || /\d/.test(word)) return word;
  for (const s of SUFFIXES) {
    if (word.endsWith(s) && word.length - s.length >= 3) return word.slice(0, -s.length);
  }
  return word;
}

/** Texto → termos: normaliza, troca sinônimos, tira palavras vazias e aplica o radical. */
export function terms(text: string): string[] {
  let t = norm(text).replace(/[^a-z0-9\s-]/g, " ");
  for (const [re, canon] of PHRASES) t = t.replace(re, ` ${canon} `);
  return t
    .split(/[\s-]+/)
    .filter((w) => w && !STOPWORDS.has(w))
    .map(stem);
}

/** Distância de edição com troca de vizinhas (Damerau restrita), parando cedo acima de 1. */
function within1(a: string, b: string): boolean {
  if (a === b) return true;
  const la = a.length;
  const lb = b.length;
  if (Math.abs(la - lb) > 1) return false;
  let i = 0;
  while (i < la && i < lb && a[i] === b[i]) i++;
  if (la === lb) {
    if (a.slice(i + 1) === b.slice(i + 1)) return true; // troca de uma letra
    return a[i] === b[i + 1] && a[i + 1] === b[i] && a.slice(i + 2) === b.slice(i + 2); // letras trocadas de lugar
  }
  return la > lb ? a.slice(i + 1) === b.slice(i) : a.slice(i) === b.slice(i + 1); // letra a mais ou a menos
}

// ---------- Assuntos que não se respondem ----------

const GUARDS: { topic: GuardTopic; words?: string[]; re?: RegExp }[] = [
  {
    topic: "urgente",
    words: [
      "dor no peito",
      "aperto no peito",
      "falta de ar",
      "desmaiei",
      "desmaio",
      "desmaiar",
      "tontura",
      "tonto",
      "tonta",
      "palpitacao",
      "coracao disparado",
      "vista escureceu",
      "vista escura",
      "formigamento no braco",
    ],
  },
  {
    topic: "lesao",
    words: [
      "lesao",
      "lesoes",
      "lesionei",
      "lesionado",
      "rompi",
      "rompeu",
      "ruptura",
      "fratura",
      "fraturei",
      "hernia",
      "tendinite",
      "bursite",
      "luxacao",
      "torci",
      "entorse",
      "dor forte",
      "dor aguda",
      "muita dor",
      "inchado",
      "inchou",
      "cirurgia",
      "operei",
      "fisioterapia",
    ],
  },
  {
    topic: "remedio",
    words: [
      "remedio",
      "remedios",
      "medicamento",
      "medicamentos",
      "medicacao",
      "antidepressivo",
      "anti inflamatorio",
      "antiinflamatorio",
      "ibuprofeno",
      "dipirona",
      "insulina",
      "ozempic",
      "semaglutida",
      "sibutramina",
      "tarja preta",
      "receita medica",
    ],
  },
  {
    topic: "hormonio",
    words: [
      "anabolizante",
      "anabolizantes",
      "bomba",
      "esteroide",
      "esteroides",
      "testosterona",
      "trembolona",
      "oxandrolona",
      "durateston",
      "deca",
      "stanozolol",
      "winstrol",
      "hormonio",
      "hormonios",
      "gh",
      "sarm",
      "sarms",
      "tpc",
      "trt",
      "ciclo de bomba",
    ],
  },
  {
    topic: "transtorno",
    words: [
      "anorexia",
      "anorexica",
      "bulimia",
      "compulsao",
      "vomitar",
      "vomito",
      "laxante",
      "laxantes",
      "purgar",
      "parar de comer",
      "ficar sem comer",
      "nao comer nada",
      "odeio meu corpo",
      "me sinto gorda",
      "me sinto gordo",
    ],
  },
  {
    topic: "gravidez",
    words: ["gravida", "gravidez", "gestante", "gestacao", "amamentando", "amamentacao", "pos parto", "puerperio"],
  },
  {
    topic: "doenca",
    words: [
      "doenca",
      "doencas",
      "diabetes",
      "diabetico",
      "diabetica",
      "hipertensao",
      "hipertenso",
      "pressao alta",
      "cancer",
      "cardiaco",
      "cardiaca",
      "problema no coracao",
      "problema de coracao",
      "asma",
      "epilepsia",
      "tireoide",
      "hipotireoidismo",
      "problema no rim",
      "problema nos rins",
      "insuficiencia",
    ],
  },
  {
    topic: "dieta-restritiva",
    words: ["so agua", "dieta da sopa", "dieta do ovo", "jejum prolongado"],
    re: /\b(?:[2-9]\d{2}|1[01]\d{2})\s*(?:kcal|calorias|cal)\b|\bjejum de \d+ dias\b/,
  },
  {
    topic: "menor",
    words: ["menor de idade", "adolescente", "crianca", "meu filho", "minha filha"],
    re: /\b(?:tenho|com|idade de|filho de|filha de)\s+(?:1[0-5]|[5-9])\s*anos\b/,
  },
];

export function guardTopic(text: string): GuardTopic | undefined {
  const t = norm(text);
  return GUARDS.find((g) => (g.words && hasAny(t, g.words)) || g.re?.test(t))?.topic;
}

// ---------- Índice e BM25 ----------

/** Peso por campo: perguntas > termos-chave > texto da resposta. */
const FIELD_WEIGHT = { asks: 3, keys: 2, answer: 1 } as const;
/** Parâmetros do BM25 (exportados para a calibração). */
export const BM25 = { k1: 1.2, b: 0.5 };

/**
 * Vocabulário do domínio que não é o assunto da pergunta: nomes de exercício e de músculo. "Começo pelo supino ou
 * pelo crucifixo?" é sobre ordem; o supino não pode contar como palavra desconhecida e derrubar a cobertura.
 */
const DOMAIN_WORDS = [
  ...LIBRARY.map((l) => l.name),
  ...Object.values(MUSCLE_LABEL),
  "supino agachamento crucifixo remada puxada rosca terra stiff leg press flexao barra fixa mergulho afundo bulgaro " +
    "prancha abdominal panturrilha gluteo perna pernas braco bracos ombro ombros costas peito biceps triceps coxa " +
    "posterior quadriceps dorsal trapezio antebraco cadeira extensora flexora elevacao lateral pelvica desenvolvimento " +
    "hack smith polia cabo halter halteres maquina banco",
].join(" ");
let domainCache: Set<string> | null = null;
/** Termos de entidade (exercício, músculo). Os termos canônicos de sinônimo (máquina, livre, carga…) não entram. */
function domain(): Set<string> {
  if (!domainCache) {
    const canon = new Set(Object.keys(SYNONYMS).flatMap((k) => terms(k)));
    domainCache = new Set(terms(DOMAIN_WORDS).filter((t) => !canon.has(t)));
  }
  return domainCache;
}

/** Termos que contam para a busca (hoje, todos; o filtro de entidade fica na pergunta, em `rank`). */
function topicTerms(text: string): string[] {
  return terms(text);
}

interface Doc {
  answer: Answer;
  tf: Map<string, number>;
  len: number;
}

export interface AnswerIndex {
  docs: Doc[];
  df: Map<string, number>;
  avgLen: number;
  /** Termos longos do vocabulário, para a tolerância a erro de digitação. */
  long: string[];
}

export function buildIndex(answers: Answer[] = ANSWERS): AnswerIndex {
  const docs: Doc[] = answers.map((answer) => {
    const tf = new Map<string, number>();
    const add = (text: string, w: number) => {
      // Dentro de um campo, cada termo conta uma vez por frase (as perguntas repetem palavras de propósito).
      for (const term of new Set(topicTerms(text))) tf.set(term, (tf.get(term) ?? 0) + w);
    };
    for (const q of answer.asks) add(q, FIELD_WEIGHT.asks);
    for (const k of answer.keys ?? []) add(k, FIELD_WEIGHT.keys);
    add(answer.answer, FIELD_WEIGHT.answer);
    let len = 0;
    for (const v of tf.values()) len += v;
    return { answer, tf, len };
  });
  const df = new Map<string, number>();
  for (const d of docs) for (const term of d.tf.keys()) df.set(term, (df.get(term) ?? 0) + 1);
  const avgLen = docs.reduce((s, d) => s + d.len, 0) / Math.max(1, docs.length);
  return { docs, df, avgLen, long: [...df.keys()].filter((k) => k.length >= 5) };
}

let cached: AnswerIndex | null = null;
/** Montado na primeira pergunta (a tela do treinador já é lazy). */
export function answerIndex(): AnswerIndex {
  return (cached ??= buildIndex());
}

function idf(ix: AnswerIndex, term: string): number {
  const n = ix.df.get(term) ?? 0;
  const N = ix.docs.length;
  return Math.log(1 + (N - n + 0.5) / (n + 0.5));
}

export interface Hit {
  answer: Answer;
  score: number;
  /** Fração (ponderada pela raridade) dos termos da pergunta que essa resposta cobre. */
  coverage: number;
  /** Termos da pergunta que essa resposta casou. */
  matched: string[];
}

/** Ordena as respostas pela pergunta. Termo desconhecido de 5+ letras tenta um vizinho a 1 erro de digitação. */
export function rank(query: string, ix: AnswerIndex = answerIndex()): Hit[] {
  // Nome de exercício ou músculo que nenhuma resposta cita não é o assunto ("começo pelo supino ou pelo
  // crucifixo?" é sobre ordem): sai da conta, em vez de derrubar a cobertura como palavra desconhecida.
  const d = domain();
  // Número solto ("55 anos", "30 séries") que nenhuma resposta cita também não é assunto.
  const qTerms = [...new Set(topicTerms(query))].filter((t) => ix.df.has(t) || (!d.has(t) && !/^\d+$/.test(t)));
  if (!qTerms.length) return [];
  const maxIdf = Math.log(1 + (ix.docs.length + 0.5) / 0.5);
  // Cada termo da pergunta vira uma lista de termos do índice (ele mesmo, ou vizinhos com erro de 1 letra).
  const expanded = qTerms.map((q) => {
    if (ix.df.has(q)) return { q, alts: [{ term: q, w: 1 }] };
    if (q.length >= 5) {
      const near = ix.long.filter((v) => within1(q, v)).map((term) => ({ term, w: 0.8 }));
      if (near.length) return { q, alts: near };
    }
    return { q, alts: [] as { term: string; w: number }[] };
  });
  // Peso de cada termo na cobertura: a raridade dele; termo desconhecido pesa o máximo.
  const weightOf = (e: (typeof expanded)[number]) => (e.alts.length ? Math.max(...e.alts.map((a) => idf(ix, a.term))) : maxIdf);
  const totalW = expanded.reduce((s, e) => s + weightOf(e), 0);

  const hits: Hit[] = [];
  for (const d of ix.docs) {
    let score = 0;
    let covered = 0;
    const matched: string[] = [];
    for (const e of expanded) {
      let best = 0;
      for (const a of e.alts) {
        const tf = d.tf.get(a.term);
        if (!tf) continue;
        const s = a.w * idf(ix, a.term) * ((tf * (BM25.k1 + 1)) / (tf + BM25.k1 * (1 - BM25.b + (BM25.b * d.len) / ix.avgLen)));
        best = Math.max(best, s);
      }
      if (best > 0) {
        score += best;
        covered += weightOf(e);
        matched.push(e.q);
      }
    }
    if (score > 0) hits.push({ answer: d.answer, score, coverage: covered / totalW, matched });
  }
  return hits.sort((a, b) => b.score - a.score);
}

// ---------- Decisão ----------

/**
 * Limiares calibrados no conjunto de teste (answers.golden.ts; distribuição impressa por answers.test.ts):
 * - placar abaixo de `minScore` ou cobertura abaixo de `minCoverage`: não sabe. Fora do escopo, o maior placar com
 *   cobertura ≥ 0,5 ficou em ~3,1 ("que horas são"); dentro, o menor ficou em ~3,4.
 * - "Você quis dizer…" só quando outra resposta chega a `ambiguous` do placar do 1º E casa um termo da pergunta que
 *   o 1º não casa (leitura diferente). Se as duas casam as mesmas palavras, o placar decide.
 */
export const THRESHOLDS = { minScore: 3.25, minCoverage: 0.52, ambiguous: 0.8 };

export type FindResult =
  | { kind: "answer"; answer: Answer; hits: Hit[] }
  | { kind: "maybe"; options: Answer[]; hits: Hit[] }
  | { kind: "none"; suggestions: Answer[]; hits: Hit[] }
  | { kind: "guard"; topic: GuardTopic; reply: string };

export function findAnswer(query: string, ix: AnswerIndex = answerIndex()): FindResult {
  const guard = guardTopic(query);
  if (guard) return { kind: "guard", topic: guard, reply: guard === "urgente" ? GUARD_REPLY.urgente : GUARD_REPLY.geral };
  const hits = rank(query, ix);
  const top = hits[0];
  if (!top || top.score < THRESHOLDS.minScore || top.coverage < THRESHOLDS.minCoverage) {
    return { kind: "none", suggestions: hits.slice(0, 3).map((h) => h.answer), hits };
  }
  const close = hits.filter(
    (h) =>
      h !== top &&
      h.score >= top.score * THRESHOLDS.ambiguous &&
      h.coverage >= THRESHOLDS.minCoverage &&
      h.matched.some((t) => !top.matched.includes(t)),
  );
  if (close.length) return { kind: "maybe", options: [top, ...close].slice(0, 3).map((h) => h.answer), hits };
  return { kind: "answer", answer: top.answer, hits };
}

/** Nível de evidência da resposta: o dela ou o do princípio a que ela aponta. */
export function levelOf(a: Answer): EvidenceLevel | undefined {
  return a.level ?? PRINCIPLES.find((p) => p.id === a.principle)?.nivel;
}
