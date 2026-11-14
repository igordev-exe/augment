import type { Unit } from "../../data/types";
import { addDays, mondayOf } from "../dates";
import { norm } from "./intents";

// AUG.CORE — leitores de campos do chat sem chave: número (algarismo e por extenso até 999), unidade, duração e
// período. Cada leitor recebe um pedaço de texto e devolve o valor, ou undefined se o pedaço inteiro não for daquele
// tipo. Sem rede, sem dependência: só português do Brasil, do jeito que se digita no celular.

/** Texto pronto para os leitores e as frases-modelo: minúsculo, sem acento, sem pontuação (menos , . % : + - x /). */
export function clean(text: string): string {
  return norm(text)
    .replace(/[?!;"'“”()]/g, " ")
    .replace(/(\d)\s*,\s*(\d)/g, "$1,$2")
    .replace(/,(?!\d)/g, " ")
    .replace(/\.(?!\d)/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

// ---------- Número ----------

const UNITS: Record<string, number> = {
  zero: 0,
  um: 1,
  uma: 1,
  dois: 2,
  duas: 2,
  tres: 3,
  quatro: 4,
  cinco: 5,
  seis: 6,
  sete: 7,
  oito: 8,
  nove: 9,
  dez: 10,
  onze: 11,
  doze: 12,
  treze: 13,
  quatorze: 14,
  catorze: 14,
  quinze: 15,
  dezesseis: 16,
  dezessete: 17,
  dezoito: 18,
  dezenove: 19,
};
const TENS: Record<string, number> = {
  vinte: 20,
  trinta: 30,
  quarenta: 40,
  cinquenta: 50,
  sessenta: 60,
  setenta: 70,
  oitenta: 80,
  noventa: 90,
};
const HUNDREDS: Record<string, number> = {
  cem: 100,
  cento: 100,
  duzentos: 200,
  duzentas: 200,
  trezentos: 300,
  trezentas: 300,
  quatrocentos: 400,
  quatrocentas: 400,
  quinhentos: 500,
  quinhentas: 500,
  seiscentos: 600,
  seiscentas: 600,
  setecentos: 700,
  setecentas: 700,
  oitocentos: 800,
  oitocentas: 800,
  novecentos: 900,
  novecentas: 900,
};

/** Número escrito por extenso ("cento e vinte e cinco", "oitenta e dois e meio"), até 999. */
function wordsNumber(t: string): number | undefined {
  const words = t.split(" ").filter(Boolean);
  if (!words.length) return undefined;
  let total = 0;
  let last = "start"; // classe da última palavra: start, h, t, u, e
  let half = false;
  for (let i = 0; i < words.length; i++) {
    const w = words[i];
    if (w === "e") {
      if (last === "start" || last === "e") return undefined;
      last = "e";
      continue;
    }
    if ((w === "meio" || w === "meia") && last === "e") {
      if (half) return undefined;
      half = true;
      last = "half";
      continue;
    }
    if (half) return undefined;
    const cls = w in HUNDREDS ? "h" : w in TENS ? "t" : w in UNITS ? "u" : undefined;
    if (!cls) return undefined;
    // Ordem: centena > dezena > unidade, ligadas por "e" ("cento e vinte e um"); "cem" não leva continuação.
    if (last !== "start" && last !== "e") return undefined;
    if (last === "e") {
      const prev = words[i - 2];
      const prevCls = prev in HUNDREDS ? "h" : prev in TENS ? "t" : "u";
      if (prev === "cem") return undefined;
      if (prevCls === "u") return undefined;
      if (prevCls === "t" && cls !== "u") return undefined;
      if (prevCls === "t" && UNITS[w] >= 10) return undefined;
      if (prevCls === "h" && cls === "h") return undefined;
    }
    total += cls === "h" ? HUNDREDS[w] : cls === "t" ? TENS[w] : UNITS[w];
    last = cls;
  }
  if (last === "e") return undefined;
  return total + (half ? 0.5 : 0);
}

/**
 * Número inteiro do pedaço: "80", "82,4", "82.5", "oitenta", "cento e vinte", "dois e meio", "meia" (0,5),
 * "um e meio". Undefined se o pedaço tiver outra coisa.
 */
export function readNumber(text: string): number | undefined {
  const t = clean(text);
  if (!t) return undefined;
  const digits = t.match(/^(\d{1,4})(?:[.,](\d{1,3}))?(?: e (meio|meia))?$/);
  if (digits) {
    const n = Number(`${digits[1]}${digits[2] ? `.${digits[2]}` : ""}`);
    return digits[3] ? n + 0.5 : n;
  }
  if (t === "meio" || t === "meia") return 0.5;
  return wordsNumber(t);
}

// ---------- Unidade ----------

const UNIT_WORDS: Record<string, Unit> = {
  kg: "kg",
  kgs: "kg",
  k: "kg",
  quilo: "kg",
  quilos: "kg",
  kilo: "kg",
  kilos: "kg",
  kilograma: "kg",
  kilogramas: "kg",
  quilograma: "kg",
  quilogramas: "kg",
  lb: "lb",
  lbs: "lb",
  libra: "lb",
  libras: "lb",
};

export function readUnit(text: string): Unit | undefined {
  return UNIT_WORDS[clean(text)];
}

/** Carga: número com unidade opcional ("80", "80kg", "82,5 quilos", "cem libras"). */
export function readLoad(text: string): { value: number; unit?: Unit } | undefined {
  const t = clean(text).replace(/(\d)(kg|kgs|lb|lbs|k)\b/, "$1 $2");
  const m = t.match(/^(.+?)(?: (?:de )?(kg|kgs|k|quilos?|kilos?|quilogramas?|kilogramas?|lbs?|libras?))?$/);
  if (!m) return undefined;
  const value = readNumber(m[1]);
  if (value == null) return undefined;
  return { value, unit: m[2] ? readUnit(m[2]) : undefined };
}

// ---------- Duração ----------

/**
 * Duração em segundos: "90 segundos", "90s", "90", "2 min", "um minuto e meio", "1:30", "2 minutos e 30 segundos",
 * "meio minuto", "1 min e meio". Número sozinho conta como segundos.
 */
export function readDuration(text: string): number | undefined {
  const t = clean(text)
    .replace(/(\d)(s|seg|min|m)\b/g, "$1 $2")
    .replace(/\bum minuto e meio\b/, "1,5 minutos")
    .trim();
  if (!t) return undefined;
  const clock = t.match(/^(\d{1,2}):(\d{2})$/);
  if (clock) return Number(clock[1]) * 60 + Number(clock[2]);
  const SEC = "(?:s|seg|segs|segundo|segundos)";
  const MIN = "(?:m|min|mins|minuto|minutos)";
  const both = t.match(new RegExp(`^(.+?) ${MIN} e (.+?) ${SEC}$`));
  if (both) {
    const a = readNumber(both[1]);
    const b = readNumber(both[2]);
    return a != null && b != null ? Math.round(a * 60 + b) : undefined;
  }
  const minHalf = t.match(new RegExp(`^(.+?) ${MIN} e (?:meio|meia)$`));
  if (minHalf) {
    const a = readNumber(minHalf[1]);
    return a != null ? Math.round(a * 60 + 30) : undefined;
  }
  const min = t.match(new RegExp(`^(.+?) ${MIN}$`));
  if (min) {
    const a = readNumber(min[1]);
    return a != null ? Math.round(a * 60) : undefined;
  }
  const sec = t.match(new RegExp(`^(.+?) ${SEC}$`));
  if (sec) {
    const a = readNumber(sec[1]);
    return a != null ? Math.round(a) : undefined;
  }
  const bare = readNumber(t);
  return bare != null && bare >= 5 ? Math.round(bare) : undefined;
}

// ---------- Período ----------

export type PeriodKey =
  | "hoje"
  | "ontem"
  | "semana"
  | "semana-passada"
  | "mes"
  | "mes-passado"
  | "mes-nome"
  | "ultimos"
  | "ciclo"
  | "ano"
  | "ano-passado"
  | "sempre";

export interface Period {
  key: PeriodKey;
  /** Primeiro e último dia (AAAA-MM-DD, inclusive). */
  from: string;
  to: string;
  /** Como a resposta chama o período ("em outubro", "nesta semana"). */
  label: string;
}

export const MONTHS = [
  "janeiro",
  "fevereiro",
  "marco",
  "abril",
  "maio",
  "junho",
  "julho",
  "agosto",
  "setembro",
  "outubro",
  "novembro",
  "dezembro",
];
const MONTH_LABEL = [
  "janeiro",
  "fevereiro",
  "março",
  "abril",
  "maio",
  "junho",
  "julho",
  "agosto",
  "setembro",
  "outubro",
  "novembro",
  "dezembro",
];

function monthRange(year: number, m: number): { from: string; to: string } {
  const from = `${year}-${String(m + 1).padStart(2, "0")}-01`;
  const next = m === 11 ? `${year + 1}-01-01` : `${year}-${String(m + 2).padStart(2, "0")}-01`;
  return { from, to: addDays(next, -1) };
}

export interface PeriodOpts {
  today: string;
  /** Segunda de início do mesociclo atual ("esse ciclo"). */
  mesoStart?: string;
}

const THIS = "(?:essa|esta|nessa|nesta|dessa|desta|a|na|da)";
const THIS_M = "(?:esse|este|nesse|neste|desse|deste|o|no|do)";

/** Padrões de período, do mais específico para o mais geral. Cada um vira um Period com as datas de hoje. */
const PERIODS: { re: RegExp; make: (m: RegExpMatchArray, o: PeriodOpts) => Period | undefined }[] = [
  {
    re: /\b(?:nos |nas |dos |das )?ultim[oa]s (\d{1,3}|[a-z]+) (dias|semanas|meses)\b/,
    make: (m, o) => {
      const n = readNumber(m[1]);
      if (!n || n > 400) return undefined;
      const days = m[2] === "dias" ? n : m[2] === "semanas" ? n * 7 : n * 30;
      const unit = m[2] === "dias" ? "dias" : m[2] === "semanas" ? "semanas" : "meses";
      return { key: "ultimos", from: addDays(o.today, -(days - 1)), to: o.today, label: `nos últimos ${n} ${unit}` };
    },
  },
  {
    re: /\b(?:na |da |nessa |desta |dessa |nesta )?semana passada\b/,
    make: (_, o) => {
      const from = addDays(mondayOf(o.today), -7);
      return { key: "semana-passada", from, to: addDays(from, 6), label: "na semana passada" };
    },
  },
  {
    re: /\b(?:no |do |nesse |desse )?mes passado\b/,
    make: (_, o) => {
      const [y, mm] = o.today.split("-").map(Number);
      const r = mm === 1 ? monthRange(y - 1, 11) : monthRange(y, mm - 2);
      return { key: "mes-passado", ...r, label: "no mês passado" };
    },
  },
  {
    re: /\b(?:no |do )?ano passado\b/,
    make: (_, o) => {
      const y = Number(o.today.slice(0, 4)) - 1;
      return { key: "ano-passado", from: `${y}-01-01`, to: `${y}-12-31`, label: `em ${y}` };
    },
  },
  {
    re: new RegExp(`\\b(?:${THIS} )?semana(?: atual)?\\b`),
    make: (_, o) => ({ key: "semana", from: mondayOf(o.today), to: o.today, label: "nesta semana" }),
  },
  {
    re: new RegExp(`\\b(?:${THIS_M} )?mes(?: atual)?\\b(?! de [a-z])`),
    make: (_, o) => {
      const [y, mm] = o.today.split("-").map(Number);
      return { key: "mes", from: monthRange(y, mm - 1).from, to: o.today, label: "neste mês" };
    },
  },
  {
    re: /\b(?:em |de |no mes de |do mes de |no |do )?(janeiro|fevereiro|marco|abril|maio|junho|julho|agosto|setembro|outubro|novembro|dezembro)\b/,
    make: (m, o) => {
      const idx = MONTHS.indexOf(m[1]);
      const [y, mm] = o.today.split("-").map(Number);
      // O mês citado mais recente que já começou (em março, "outubro" é o do ano passado).
      const year = idx + 1 > mm ? y - 1 : y;
      const r = monthRange(year, idx);
      return { key: "mes-nome", from: r.from, to: r.to < o.today ? r.to : o.today, label: `em ${MONTH_LABEL[idx]}` };
    },
  },
  {
    re: new RegExp(`\\b(?:${THIS_M} |nesse |neste |desse |deste )?(?:ciclo|meso|mesociclo)(?: atual)?\\b`),
    make: (_, o) =>
      o.mesoStart && o.mesoStart <= o.today ? { key: "ciclo", from: o.mesoStart, to: o.today, label: "neste ciclo" } : undefined,
  },
  {
    re: new RegExp(`\\b(?:${THIS_M} |nesse |neste |desse |deste )ano\\b|\\bdo ano\\b|\\bno ano\\b`),
    make: (_, o) => ({ key: "ano", from: `${o.today.slice(0, 4)}-01-01`, to: o.today, label: "neste ano" }),
  },
  {
    re: /\bontem\b/,
    make: (_, o) => {
      const d = addDays(o.today, -1);
      return { key: "ontem", from: d, to: d, label: "ontem" };
    },
  },
  {
    re: /\bhoje\b/,
    make: (_, o) => ({ key: "hoje", from: o.today, to: o.today, label: "hoje" }),
  },
  {
    re: /\b(?:de todos os tempos|desde (?:o inicio|sempre|que comecei)|da vida|sempre)\b/,
    make: () => ({ key: "sempre", from: "0000-01-01", to: "9999-12-31", label: "desde o começo" }),
  },
];

/** Período citado em qualquer ponto do texto (o primeiro que casar, do mais específico para o mais geral). */
export function findPeriod(text: string, opts: PeriodOpts): (Period & { match: string }) | undefined {
  const t = clean(text);
  for (const p of PERIODS) {
    const m = t.match(p.re);
    if (!m) continue;
    const period = p.make(m, opts);
    if (period) return { ...period, match: m[0] };
  }
  return undefined;
}

/** O pedaço inteiro é um período ("essa semana", "em outubro", "últimos 30 dias"). */
export function readPeriod(text: string, opts: PeriodOpts): Period | undefined {
  const t = clean(text);
  const p = findPeriod(t, opts);
  if (!p) return undefined;
  const rest = t
    .replace(p.match, " ")
    .replace(/\b(em|no|na|de|do|da|nos|nas|durante|ao longo d[oa])\b/g, " ")
    .trim();
  return rest ? undefined : { key: p.key, from: p.from, to: p.to, label: p.label };
}
