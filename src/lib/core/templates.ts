import { clean } from "./readers";

// AUG.CORE — frases-modelo no estilo do hassil (Home Assistant): `[opcional]`, `(a|b)`, `{campo}` e `<regra>`.
// Interpretador próprio, pequeno: cada modelo vira uma expressão regular uma vez (na primeira consulta) e o texto da
// pessoa passa por `clean` (minúsculo, sem acento, sem pontuação) antes de casar. Campos capturam um pedaço e um
// leitor confere se o pedaço é daquele tipo; se não for, o modelo não casa.
//
//   "(abre|abra|mostra) [o|a] <tela>"           → casa "abre o historico", "mostra progresso"
//   "descanso de {duracao}"                     → casa "descanso de 90 segundos" com duracao = "90 segundos"
//   "anota {reps} [reps] (com|x) {carga}"       → casa "anota 8 com 80kg"

/** Leitor de campo: devolve o valor ou undefined (o modelo então não casa). */
export type FieldReader = (raw: string) => unknown;

export interface Compiled {
  source: string;
  re: RegExp;
  /** Nome do campo de cada grupo de captura, na ordem. */
  fields: string[];
}

/** Palavras de cortesia e chamamento que não mudam o pedido ("ei, abre o historico por favor"). */
const FILLERS = /\b(por favor|pfv|pf|porfa|porfavor|pfvr|ai|ae|ei|eii|hey|opa|nucleo|aug|augment|core|mano|cara|vei|parca|rapidinho|ja)\b/g;

/** Texto pronto para casar com os modelos. */
export function prepare(text: string): string {
  return clean(text).replace(FILLERS, " ").replace(/\s+/g, " ").trim();
}

function escapeWord(w: string): string {
  return w.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Corta o modelo em alternativas do nível de cima, respeitando ( ) e [ ]. */
function splitTop(s: string): string[] {
  const out: string[] = [];
  let depth = 0;
  let cur = "";
  for (const ch of s) {
    if (ch === "(" || ch === "[") depth++;
    if (ch === ")" || ch === "]") depth--;
    if (ch === "|" && depth === 0) {
      out.push(cur);
      cur = "";
    } else cur += ch;
  }
  out.push(cur);
  return out;
}

function closing(s: string, i: number): number {
  const open = s[i];
  const close = open === "(" ? ")" : open === "[" ? "]" : open === "<" ? ">" : "}";
  let depth = 0;
  for (let j = i; j < s.length; j++) {
    if (s[j] === open) depth++;
    else if (s[j] === close && --depth === 0) return j;
  }
  throw new Error(`frase-modelo sem fechamento: ${s}`);
}

function compileSeq(s: string, rules: Record<string, string>, fields: string[], depth: number, gl = false, gr = false): string {
  if (depth > 12) throw new Error("regra recursiva demais");
  const alts = splitTop(s);
  if (alts.length > 1) return `(?:${alts.map((a) => compileSeq(a, rules, fields, depth, gl, gr)).join("|")})`;
  let out = "";
  let i = 0;
  while (i < s.length) {
    const ch = s[i];
    if (ch === " ") {
      out += "\\s*";
      i++;
      continue;
    }
    if (ch === "(" || ch === "[" || ch === "<" || ch === "{") {
      const j = closing(s, i);
      const inner = s.slice(i + 1, j);
      const igl = i > 0 ? !" ([|".includes(s[i - 1]) : gl;
      const igr = j + 1 < s.length ? !" )]|".includes(s[j + 1]) : gr;
      if (ch === "(") out += `(?:${compileSeq(inner, rules, fields, depth + 1, igl, igr)})`;
      else if (ch === "[") out += `(?:${compileSeq(inner, rules, fields, depth + 1, igl, igr)})?`;
      else if (ch === "<") {
        const rule = rules[inner];
        if (rule == null) throw new Error(`regra desconhecida: <${inner}>`);
        out += `(?:${compileSeq(rule, rules, fields, depth + 1, igl, igr)})`;
      } else {
        fields.push(inner);
        out += "(.+?)";
      }
      i = j + 1;
      continue;
    }
    // Palavra literal: com borda de palavra, para "para" não casar dentro de "parar".
    let j = i;
    while (j < s.length && !" ([<{|)]>}".includes(s[j])) j++;
    const word = s.slice(i, j);
    const w = escapeWord(clean(word));
    // Borda só onde a palavra acaba de fato: "quant(os|as)" continua dentro da mesma palavra.
    const glueLeft = i > 0 ? !" ([|".includes(s[i - 1]) : gl;
    const glueRight = j < s.length ? !" )]|".includes(s[j]) : gr;
    out += `${/^\w/.test(w) && !glueLeft ? "\\b" : ""}${w}${/\w$/.test(w) && !glueRight ? "\\b" : ""}`;
    i = j;
  }
  return out;
}

/** Compila um modelo (com as regras dadas) numa expressão regular inteira (começo e fim do texto). */
export function compileTemplate(source: string, rules: Record<string, string> = {}): Compiled {
  const fields: string[] = [];
  const body = compileSeq(source.trim(), rules, fields, 0);
  return { source, re: new RegExp(`^\\s*${body}\\s*$`), fields };
}

export interface TemplateMatch {
  source: string;
  /** Valor lido de cada campo. */
  values: Record<string, unknown>;
  /** Pedaço cru de cada campo. */
  raw: Record<string, string>;
}

/**
 * Casa o texto (já `prepare`) com o modelo. O tipo do campo é o nome antes do sufixo: `{carga}`, `{carga_2}`.
 * Campo sem leitor aceita qualquer pedaço.
 */
export function matchTemplate(c: Compiled, text: string, readers: Record<string, FieldReader>): TemplateMatch | null {
  const m = text.match(c.re);
  if (!m) return null;
  const values: Record<string, unknown> = {};
  const raw: Record<string, string> = {};
  for (let k = 0; k < c.fields.length; k++) {
    const name = c.fields[k];
    const piece = (m[k + 1] ?? "").trim();
    const reader = readers[name.replace(/_\d+$/, "")];
    const v = reader ? reader(piece) : piece;
    if (v == null || v === "") return null;
    values[name] = v;
    raw[name] = piece;
  }
  return { source: c.source, values, raw };
}

/** Conjunto de modelos compilado sob demanda (uma vez, na primeira consulta: abertura do treinador). */
export function templateSet<T>(entries: { id: T; templates: string[] }[], rules: Record<string, string>) {
  let compiled: { id: T; c: Compiled }[] | null = null;
  return {
    all(): { id: T; c: Compiled }[] {
      if (!compiled) compiled = entries.flatMap((e) => e.templates.map((t) => ({ id: e.id, c: compileTemplate(t, rules) })));
      return compiled;
    },
    /** Primeiro modelo que casa, na ordem da lista. */
    match(text: string, readers: Record<string, FieldReader>): (TemplateMatch & { id: T }) | null {
      const t = prepare(text);
      if (!t) return null;
      for (const { id, c } of this.all()) {
        const m = matchTemplate(c, t, readers);
        if (m) return { ...m, id };
      }
      return null;
    },
  };
}
