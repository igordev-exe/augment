import { LIBRARY } from "../../data/library";
import { commandVocabulary, findScreenIn, matchCommand, type CommandId, type CommandMatch } from "./commands";
import { detectExercise, type AnswerData } from "./data-answers";
import { clean, readDuration, readUnit } from "./readers";

// AUG.CORE — bloco A do chat potente: entender frase livre. Só entra quando nenhuma frase-modelo casou, em três
// passos: (1) limpa o jeito de falar (enchimento, "hj", "vamo", palavra repetida) e corrige um erro de digitação;
// (2) tenta os modelos de novo no texto limpo; (3) acha a palavra de ação e os campos em qualquer ordem. Na dúvida
// entre dois pedidos, pergunta com botões. Nunca chuta em comando de gravação, e negação ("não anota") nunca executa.

/** Enchimento de fala que não muda o pedido. "ai"/"ei"/"por favor" já saem em `prepare`. */
const SPOKEN = [
  "tipo",
  "ne",
  "entao",
  "queria saber",
  "quero saber",
  "me diz",
  "me fala",
  "sabe me dizer",
  "sera que",
  "voce pode",
  "vc pode",
  "pode",
  "da pra",
  "consegue",
  "pra mim",
  "por mim",
  "mesmo",
  "rapido",
  "agora mesmo",
  "uns",
  "umas",
  "ae",
  "ai",
  "ei",
  "por favor",
  "pfv",
  "beleza",
  "blz",
  "cara",
  "mano",
  "velho",
];

/** Abreviação e fala de celular → palavra cheia. */
const SHORT: Record<string, string> = {
  hj: "hoje",
  q: "que",
  vc: "voce",
  pq: "porque",
  tbm: "tambem",
  vamo: "vamos",
  bora: "vamos",
  to: "estou",
  ta: "esta",
  pro: "para o",
  pra: "para",
  mt: "muito",
  qto: "quanto",
  seg: "segundos",
  segs: "segundos",
  min: "minutos",
  mins: "minutos",
  hrs: "horas",
};

const SPOKEN_RE = new RegExp(`\\b(${SPOKEN.sort((a, b) => b.length - a.length).join("|")})\\b`, "g");

/** Texto sem o jeito de falar. Não toca em número nem em unidade. */
export function tidy(text: string): string {
  const t = clean(text)
    .replace(/\bacabei de (fazer|fechar|terminar)\b/g, "fiz")
    .replace(/(\d)\s*x\s*(\d)/g, "$1 x $2")
    .replace(/(\d)(kg|lb|s|seg|min|reps?)\b/g, "$1 $2")
    .replace(SPOKEN_RE, " ")
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => SHORT[w] ?? w)
    .join(" ");
  // Palavra repetida ("anota anota") conta uma vez.
  return t.replace(/\b(\w+)( \1\b)+/g, "$1").trim();
}

// ---------- Erro de digitação ----------

/** Distância de edição com troca de vizinhas (Damerau restrita), com teto: acima de `max` devolve max + 1. */
export function editDistance(a: string, b: string, max = 1): number {
  if (Math.abs(a.length - b.length) > max) return max + 1;
  const d: number[][] = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array(b.length).fill(0)]);
  for (let j = 1; j <= b.length; j++) d[0][j] = j;
  for (let i = 1; i <= a.length; i++) {
    let rowMin = Infinity;
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + cost);
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) d[i][j] = Math.min(d[i][j], d[i - 2][j - 2] + 1);
      rowMin = Math.min(rowMin, d[i][j]);
    }
    if (rowMin > max) return max + 1;
  }
  return d[a.length][b.length];
}

/** Palavras que valem a correção: ações, telas, unidades de tempo e o nome dos exercícios curados. */
let vocab: Set<string> | null = null;
function vocabulary(): Set<string> {
  if (vocab) return vocab;
  const words = new Set<string>();
  for (const a of ACTIONS) for (const w of a.words) for (const p of w.split(" ")) if (p.length >= 4) words.add(p);
  for (const w of [
    "descanso",
    "cronometro",
    "segundos",
    "minutos",
    "repeticoes",
    "historico",
    "progresso",
    "relatorio",
    "exercicios",
    "biblioteca",
    "ajustes",
    "programas",
    "amigos",
    "deload",
    "ciclo",
    "anilhas",
    "libras",
    "quilos",
    "vibracao",
  ])
    words.add(w);
  for (const l of LIBRARY) for (const p of clean(l.name).split(" ")) if (p.length >= 5) words.add(p);
  for (const w of commandVocabulary()) words.add(w);
  return (vocab = words);
}

/** Corrige uma palavra com 5+ letras que está a 1 edição de uma só palavra conhecida ("descaso" → "descanso"). */
export function fixTypos(text: string): string {
  const v = vocabulary();
  return text
    .split(" ")
    .map((w) => {
      if (w.length < 4 || v.has(w) || /\d/.test(w)) return w;
      // Palavra cortada no fim ("anot" → "anota"): só ação, para não virar outra coisa.
      const prefix = [...v].filter((x) => x.length === w.length + 1 && x.startsWith(w) && ACTION_WORDS.has(x));
      if (prefix.length) return prefix.sort()[0];
      if (w.length < 5) return w;
      // Plural e singular não são erro ("programa" × "programas").
      const near = [...v].filter((x) => x !== `${w}s` && `${x}s` !== w && Math.abs(x.length - w.length) <= 1 && editDistance(w, x) === 1);
      if (near.length === 1) return near[0];
      // Várias: a de mesmo tamanho (troca de letra ou de vizinhas), se for uma só.
      const same = near.filter((x) => x.length === w.length);
      return same.length === 1 ? same[0] : w;
    })
    .join(" ");
}

// ---------- Ações e campos ----------

interface Action {
  id: CommandId;
  words: string[];
  /** Campos obrigatórios para executar. */
  needs: ("carga" | "reps" | "duracao" | "tela" | "exercicio" | "unidade" | "numero")[];
}

const ACTIONS: Action[] = [
  {
    id: "treino-anotar",
    words: [
      "anota",
      "anotar",
      "anote",
      "registra",
      "registrar",
      "marca",
      "marcar",
      "salva",
      "salvar",
      "bota",
      "poe",
      "coloca",
      "fiz",
      "fechei",
      "terminei",
      "consegui",
      "saiu",
      "lanca",
    ],
    needs: ["reps", "carga"],
  },
  {
    id: "timer-parar",
    words: ["para", "parar", "pare", "cancela", "cancelar", "pula", "pular", "chega", "encerra", "zera", "descansei"],
    needs: [],
  },
  { id: "timer-somar", words: ["mais", "acrescenta", "adiciona", "soma", "aumenta", "estende"], needs: ["duracao"] },
  { id: "timer-tirar", words: ["tira", "menos", "diminui", "reduz"], needs: ["duracao"] },
  {
    id: "timer-iniciar",
    words: ["descanso", "descansar", "descansa", "timer", "cronometro", "pausa", "intervalo", "conta", "rodando", "contador"],
    needs: ["duracao"],
  },
  {
    id: "navegar",
    words: ["abre", "abra", "abrir", "abri", "mostra", "mostrar", "ver", "vejo", "cade", "onde", "leva", "vai", "volta", "entra", "acessa"],
    needs: ["tela"],
  },
  { id: "navegar-exercicio", words: ["abre", "abra", "abrir", "mostra", "pagina"], needs: ["exercicio"] },
  { id: "treino-comecar", words: ["comecar", "comeca", "comece", "inicia", "iniciar", "vamos", "partiu"], needs: [] },
  { id: "treino-trocar", words: ["troca", "trocar", "troque", "substitui", "substituir", "muda", "mudar"], needs: ["exercicio"] },
  { id: "corpo-peso", words: ["pesei", "balanca", "peso", "pesando", "estou com", "acordei com"], needs: ["carga"] },
];

/** Leituras que viram proposta de gravação: a frase livre é mais exigente com elas. */
const WRITES = new Set<CommandId>(["treino-anotar", "treino-trocar", "corpo-peso"]);

const ACTION_WORDS = new Set(ACTIONS.flatMap((a) => a.words));

const has = (t: string, w: string) => new RegExp(`(^| )${w}( |$)`).test(t);

/** Pergunta de verdade: a fala não é um pedido de ação. */
const QUESTION = new RegExp(
  "(^| )(" +
    ["qual", "quais", "quanto", "quanta", "quantos", "quantas", "como", "porque", "por que", "posso", "vale", "devo", "seria"]
      .concat(["importante", "ideal", "o que", "quando", "onde fica", "tenho que", "preciso", "melhor", "pior", "ou"])
      .concat(["exagero", "demais", "pouco", "muito", "bom", "ruim", "ajuda", "funciona", "suficiente", "normal", "certo"])
      .concat(["errado", "seguidos", "seguidas", "todo dia", "todos os dias", "motivacao", "jejum"])
      .join("|") +
    ")( |$)",
);

/** Frase que começa negando ("não anota", "ainda não", "não precisa parar"): nunca executa. */
const NEGATION = /^(nao|nem|nunca|ainda nao)( |$)(?!quero (som|barulho|bip|vibr))/;

/** A palavra de ação vem logo depois de um "não" (até 3 palavras): "hoje não quero fazer…" nega o "fazer". */
function negatedNear(t: string, word: string): boolean {
  const w = t.split(" ");
  const i = w.indexOf(word.split(" ")[0]);
  return w.slice(Math.max(0, i - 3), i).some((x) => x === "nao" || x === "nem" || x === "nunca");
}

interface Slots {
  carga?: { value: number; unit?: "kg" | "lb" };
  reps?: number;
  duracao?: number;
  tela?: ReturnType<typeof findScreenIn>;
  exercicio?: ReturnType<typeof detectExercise>;
  /** Números sem marca, na ordem em que apareceram. */
  bare: number[];
  /** Sobrou alguma palavra que não é número, unidade, ação ou ligação ("com", "de", "x")? */
  onlyNumbers: boolean;
}

const LINK = new Set([
  ...["com", "de", "x", "por", "no", "na", "em", "e", "a", "o", "um", "uma", "serie", "essa", "kg", "lb", "reps", "rep", "repeticoes"],
  ...["vezes", "quilos", "kilos", "libras", "s", "seg", "segundos", "minuto", "minutos", "m", "min"],
]);

const NUM = "(\\d+(?:[.,]\\d+)?)";

function slots(t: string): Slots {
  const out: Slots = { bare: [], onlyNumbers: false };
  let rest = t;
  // Duração: "1:30", "90 s", "2 minutos", "um minuto e meio", "dois minutos".
  const dur =
    rest.match(/\b\d{1,2}:\d{2}\b/) ??
    rest.match(/\b(\d+|um|uma|dois|duas|tres|quatro|cinco|meio)( (minuto|minutos|m|segundo|segundos|s))( e (meio|\d+ segundos))?\b/);
  if (dur) {
    const s = readDuration(dur[0]);
    if (s != null) {
      out.duracao = s;
      rest = rest.replace(dur[0], " ");
    }
  }
  // Reps marcadas: "8 reps", "8 repeticoes", "8 vezes".
  const reps = rest.match(new RegExp(`\\b${NUM} (reps|rep|repeticoes|repeticao|vezes)\\b`));
  if (reps) {
    out.reps = Number(reps[1].replace(",", "."));
    rest = rest.replace(reps[0], " ");
  }
  // Carga marcada: "80 kg", "22,5 quilos", "100 lb".
  const load = rest.match(new RegExp(`\\b${NUM} (kg|quilos|quilo|kilos|kilo|lb|libras|libra)\\b`));
  if (load) {
    out.carga = { value: Number(load[1].replace(",", ".")), unit: readUnit(load[2]) };
    rest = rest.replace(load[0], " ");
  }
  out.bare = [...rest.matchAll(new RegExp(`\\b${NUM}\\b`, "g"))].map((m) => Number(m[1].replace(",", ".")));
  const words = t.split(" ").filter((w) => !/^\d/.test(w) && !LINK.has(w) && !ACTION_WORDS.has(w));
  out.onlyNumbers = words.length === 0;
  out.tela = findScreenIn(t);
  out.exercicio = detectExercise(t);
  return out;
}

/** Reps e carga a partir dos números soltos: reps é inteiro até 30; a carga, o outro. Dois candidatos = dúvida. */
function repsAndLoad(s: Slots): { reps?: number; carga?: Slots["carga"]; doubt?: boolean } {
  let reps = s.reps;
  let carga = s.carga;
  const bare = [...s.bare];
  if (reps == null && carga == null && bare.length === 2) {
    const [a, b] = bare;
    const aReps = Number.isInteger(a) && a <= 30;
    const bReps = Number.isInteger(b) && b <= 30;
    if (aReps && !bReps) return { reps: a, carga: { value: b } };
    if (bReps && !aReps) return { reps: b, carga: { value: a } };
    return { doubt: true };
  }
  if (reps == null && bare.length) {
    const r = bare.find((n) => Number.isInteger(n) && n <= 30 && n !== carga?.value);
    if (r != null) reps = r;
  }
  if (carga == null && bare.length) {
    const c = bare.find((n) => n !== reps);
    if (c != null) carga = { value: c };
  }
  return { reps, carga };
}

export interface FreeRead extends CommandMatch {
  /** 0 a 1: quanto da frase a leitura explica. */
  score: number;
}

/** Leituras possíveis da frase livre (sem as frases-modelo), da mais forte para a mais fraca. */
export function freeReadings(text: string, asked = false): FreeRead[] {
  const t = text;
  if (!t || NEGATION.test(t)) return [];
  const question = asked || QUESTION.test(t);
  const s = slots(t);
  const out: FreeRead[] = [];
  const rl = repsAndLoad(s);

  // Só números e unidades ("80x8", "8 reps 80 kg", "90s"): série ou descanso.
  if (s.onlyNumbers && !question) {
    if (s.duracao != null && rl.reps == null && !s.carga) out.push({ id: "timer-iniciar", values: { duracao: s.duracao }, score: 0.75 });
    else if (rl.doubt)
      out.push({
        id: "treino-anotar",
        values: {},
        score: 0.5,
        ask: [`Anotar ${s.bare[0]} reps com ${s.bare[1]} kg`, `Anotar ${s.bare[1]} reps com ${s.bare[0]} kg`],
      });
    else if (rl.reps != null && rl.carga) out.push({ id: "treino-anotar", values: { reps: rl.reps, carga: rl.carga }, score: 0.8 });
  }

  for (const a of ACTIONS) {
    const word = a.words.find((w) => has(t, w) && !negatedNear(t, w));
    if (!word) continue;
    // Pergunta só aceita leitura que não muda nada nem abre nada sozinha.
    if (question) continue;
    const values: Record<string, unknown> = {};
    let ok = true;
    for (const need of a.needs) {
      if (need === "duracao") {
        if (s.duracao != null) values.duracao = s.duracao;
        else if (a.id !== "timer-iniciar" && s.bare.length === 1) values.duracao = s.bare[0];
        else ok = false;
      } else if (need === "reps" || need === "carga") {
        if (rl.doubt) {
          out.push({
            id: a.id,
            values: {},
            score: 0.5,
            ask: [`Anotar ${s.bare[0]} reps com ${s.bare[1]} kg`, `Anotar ${s.bare[1]} reps com ${s.bare[0]} kg`],
          });
          ok = false;
          break;
        }
        if (need === "reps" && rl.reps != null) values.reps = rl.reps;
        else if (need === "carga" && rl.carga) values.carga = rl.carga;
        else ok = false;
      } else if (need === "tela") {
        if (s.tela && !s.exercicio) values.tela = s.tela;
        else ok = false;
      } else if (need === "exercicio") {
        if (s.exercicio) values.exercicio = s.exercicio;
        else ok = false;
      }
    }
    if (!ok) continue;
    // Gravação na frase livre só sem "não" em lugar nenhum e sem outra coisa misturada (tempo, exercício, %).
    if (WRITES.has(a.id) && (/(^| )(nao|nem|nunca)( |$)/.test(t) || /%/.test(t))) continue;
    // Peso do corpo: um número só, sem reps, sem tempo nem exercício, numa faixa de gente.
    if (a.id === "corpo-peso") {
      if (s.duracao != null || s.tela) continue;
      const v = s.carga?.value ?? (s.bare.length === 1 ? s.bare[0] : undefined);
      if (v == null || v < 30 || v > 300 || s.reps != null || s.bare.length > (s.carga ? 0 : 1)) continue;
      values.carga = s.carga ?? { value: v };
    }
    // Começar exige a palavra treino/treinar (ou "agora") para não pegar "vamos ver o historico".
    if (a.id === "treino-comecar" && !/(^| )(treino|treinar|agora)( |$)/.test(t)) continue;
    // Parar exige o timer na frase, ou "descansei".
    if (a.id === "timer-parar" && !/(descanso|timer|cronometro|contador|descansei|pausa)/.test(t)) continue;
    // Somar e tirar falam do descanso que está correndo; sem duração na frase não há o que somar.
    if ((a.id === "timer-somar" || a.id === "timer-tirar") && s.duracao == null && s.bare.length !== 1) continue;
    // Anotar não pode ser uma conta escondida ("80% de 100") nem comida ("comi 8 ovos").
    if (a.id === "treino-anotar" && /(%|por cento|ovos|arroz|gramas|g de|horas|anos)/.test(t)) continue;
    const coverage = 0.6 + (a.needs.length ? 0.3 : 0.15) + (s.onlyNumbers ? 0.1 : 0);
    out.push({ id: a.id, values, score: Math.min(1, Math.round(coverage * 100) / 100) });
  }

  // Tela citada sozinha ("historico"): atalho.
  if (!out.length && s.tela && !question && t.split(" ").length <= 3 && !s.exercicio)
    out.push({ id: "navegar", values: { tela: s.tela }, score: 0.7 });

  return out.sort((a, b) => b.score - a.score);
}

/** "90" → "1 min 30 s"; "120" → "2 min"; "45" → "45 s". */
function secs(n: number): string {
  const m = Math.floor(n / 60);
  const r = n % 60;
  return m ? `${m} min${r ? ` ${r} s` : ""}` : `${r} s`;
}

/** Rótulo curto do pedido lido ("descanso de 90 s", "anotar 8 × 80 kg"), para o "Entendi:". */
export function readingLabel(m: CommandMatch): string {
  const v = m.values as Record<string, unknown>;
  const kg = (c: unknown) => {
    const x = c as { value: number; unit?: string } | undefined;
    return x ? `${String(x.value).replace(".", ",")} ${x.unit ?? "kg"}` : "";
  };
  switch (m.id) {
    case "treino-anotar":
      return `anotar ${v.reps} × ${kg(v.carga)}`;
    case "timer-iniciar":
      return `descanso de ${secs(v.duracao as number)}`;
    case "timer-somar":
      return `mais ${secs(v.duracao as number)} no descanso`;
    case "timer-tirar":
      return `menos ${secs(v.duracao as number)} no descanso`;
    case "timer-parar":
      return "parar o descanso";
    case "navegar":
      return `abrir ${(v.tela as { label: string }).label}`;
    case "navegar-exercicio":
    case "treino-trocar":
      return `${m.id === "treino-trocar" ? "trocar" : "abrir"} ${(v.exercicio as { name: string }).name}`;
    case "corpo-peso":
      return `peso de hoje: ${kg(v.carga)}`;
    case "treino-comecar":
      return "começar o treino";
    default:
      return m.id;
  }
}

/**
 * O pedido da frase: primeiro as frases-modelo (no texto como veio, limpo e corrigido), depois a frase livre.
 * Devolve `ask` quando há duas leituras próximas: a tela pergunta com botões em vez de chutar.
 */
export function readCommand(text: string, _data?: AnswerData): (CommandMatch & { free?: boolean; score?: number }) | null {
  const raw = clean(text);
  if (NEGATION.test(raw) && !/(^| )nao quero (som|barulho|bip|vibr)/.test(raw)) return null;
  // "80 x 8" sozinho é série, não multiplicação: conta pede "quanto é" ou "calcula".
  const bareTimes = /^\d+(?:[.,]\d+)? ?x ?\d+(?:[.,]\d+)?$/.test(tidy(text));
  const direct = bareTimes ? null : matchCommand(text);
  if (direct) return fixOrder(direct);
  const t = fixTypos(tidy(text));
  if (!t) return null;
  const again = bareTimes ? null : matchCommand(t);
  if (again && !again.partial) return { ...fixOrder(again), free: true, score: 0.9 };
  // "?" some no `clean`: vem do texto original. "Dá pra trocar o supino?" é pedido, não pergunta.
  const asked = /\?/.test(text) && !/^(da pra|pode|consegue|voce pode|vc pode|tem como)\b/.test(raw);
  const reads = freeReadings(t, asked);
  if (!reads.length) return again ? { ...fixOrder(again), free: true, score: 0.9 } : null;
  const [a, b] = reads;
  if (a.ask) return { ...a, free: true };
  // Duas leituras diferentes com a mesma força: pergunta (em gravação, sempre).
  if (b && b.id !== a.id && a.score - b.score < 0.1)
    return { id: a.id, values: {}, free: true, score: a.score, ask: [readingLabel(a), readingLabel(b)].map(cap) };
  return { ...a, free: true };
}

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/** "80 x 8" casa o modelo de reps × carga ao contrário: reps acima de 30 com carga até 30 é carga × reps. */
function fixOrder(m: CommandMatch): CommandMatch {
  if (m.id !== "treino-anotar" && m.id !== "conta-1rm") return m;
  const reps = m.values.reps as number | undefined;
  const carga = m.values.carga as { value: number; unit?: string } | undefined;
  if (reps != null && carga && reps > 30 && carga.value <= 30 && !carga.unit && Number.isInteger(carga.value))
    return { ...m, values: { ...m.values, reps: carga.value, carga: { value: reps } } };
  return m;
}

// ---------- Bloco B: pedido composto ----------

/** O que cada pedaço da frase é: um comando inteiro, uma consulta, uma continuação ("de costas") ou só número. */
export type PartKind = "command" | "query" | "fragment" | "number";

export interface SplitPart {
  text: string;
  kind: PartKind;
}

const SEP = /\s*(?:,|;|\be depois\b|\bdepois\b|\be tambem\b|\be\b)\s*/;
const STRONG_SEP = /,|;|\bdepois\b/;
const FRAGMENT = /^(de|do|da|dos|das|no|na|nos|nas|em|e|o|a|os|as|pro|pra|para)\b/;
const NUMBER_ONLY = /^\d+(?:[.,]\d+)?$/;

/**
 * Quebra "anota 8 com 80 e começa o descanso" em partes, só quando cada lado vira sozinho um pedido (ou é a
 * continuação do anterior: "quantas séries de peito e de costas"). "Supino e agachamento", "peito e tríceps" e
 * "arroz e feijão" não quebram. No máximo 3 partes; uma parte não entendida só vale com vírgula ou "depois".
 * `kindOf` diz se um pedaço sozinho é comando ou consulta (vem de quem chama, para não criar ciclo de import).
 */
export function splitRequest(
  text: string,
  kindOf: (s: string) => "command" | "query" | null,
): { parts: SplitPart[]; leftover?: string } | null {
  // Como o `clean`, mas guardando a vírgula e o ponto e vírgula (são separadores fortes).
  const raw = text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/(\d),(\d)/g, "$1.$2")
    .replace(/[^a-z0-9,;.%:+ ]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (!SEP.test(raw)) return null;
  const strong = STRONG_SEP.test(raw);
  const pieces = raw
    .split(SEP)
    .map((p) => p.trim().replace(/\.$/, ""))
    .filter(Boolean);
  if (pieces.length < 2) return null;
  const parts: SplitPart[] = [];
  let leftover: string | undefined;
  /** Pedaço que ainda não é pedido: espera o próximo ("que dia" + "hoje" = "que dia é hoje"). */
  let carry: string | null = null;
  for (const piece of pieces) {
    const cand: string = carry ? `${carry} e ${piece}` : piece;
    const k = kindOf(cand);
    const prev = parts[parts.length - 1];
    if (k) {
      parts.push({ text: cand, kind: k });
      carry = null;
      continue;
    }
    if (carry) {
      carry = cand;
      continue;
    }
    if (prev && (prev.kind === "command" || prev.kind === "number") && NUMBER_ONLY.test(piece)) parts.push({ text: piece, kind: "number" });
    else if (prev && (prev.kind === "query" || prev.kind === "fragment") && FRAGMENT.test(piece) && piece.split(" ").length <= 5)
      parts.push({ text: piece, kind: "fragment" });
    else if (prev && kindOf(`${prev.text} e ${piece}`))
      parts[parts.length - 1] = { text: `${prev.text} e ${piece}`, kind: kindOf(`${prev.text} e ${piece}`)! };
    else carry = piece;
  }
  if (carry) {
    const prev = parts[parts.length - 1];
    const merged = prev ? kindOf(`${prev.text} e ${carry}`) : null;
    if (prev && merged) parts[parts.length - 1] = { text: `${prev.text} e ${carry}`, kind: merged };
    else if (strong && parts.length >= 2) leftover = carry;
    else return null;
  }
  if (parts.length < 2 || parts.length > 3) return null;
  // Duas partes só de pergunta, sem comando, só quebram com vírgula, "depois" ou continuação explícita.
  if (parts.every((p) => p.kind === "query") && !strong) return null;
  return { parts, leftover };
}
