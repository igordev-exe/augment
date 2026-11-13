// Confere o que cada @keyframes anima (docs/plano-refino-visual.md, 3A: "só transform e opacity em movimento").
// Permitido: transform (e translate/scale/rotate), opacity e cor. Qualquer outra propriedade é acusada.
//
//   node tools/verify/keyframes.mjs                 todas as folhas de src/styles (relatório; sai com 1 se houver)
//   node tools/verify/keyframes.mjs 15-pecas.css    só os arquivos citados
//
// Saída: arquivo, nome da animação e as propriedades fora da lista.
import fs from "node:fs";
import path from "node:path";

const DIR = "src/styles";
const ALLOWED = new Set([
  "transform",
  "translate",
  "scale",
  "rotate",
  "opacity",
  "color",
  "background-color",
  "border-color",
  "outline-color",
  "fill",
  "stroke",
]);

// Exceções declaradas: áreas que o plano proíbe mexer (boot, barra de abas, treino em andamento). Aparecem no relatório.
const EXEMPT = {
  "boot-draw": "boot (abertura do app)",
  "boot-reveal": "boot (abertura do app)",
  "boot-glitch": "boot (abertura do app)",
  "nav-glitch": "barra de abas",
  "nav-light": "barra de abas",
  "term-type": "log de fim de treino (SessionView)",
  "term-fill": "log de fim de treino (SessionView)",
  "term-sweep": "log de fim de treino (SessionView)",
};

const only = process.argv.slice(2).map((f) => path.basename(f));
const files = fs
  .readdirSync(DIR)
  .filter((f) => f.endsWith(".css") && f !== "index.css")
  .filter((f) => only.length === 0 || only.includes(f))
  .sort();

/** Acha o bloco que fecha a chave aberta em `start` (índice do "{"). */
function blockEnd(css, start) {
  let depth = 0;
  for (let i = start; i < css.length; i++) {
    if (css[i] === "{") depth++;
    else if (css[i] === "}" && --depth === 0) return i;
  }
  return css.length;
}

let total = 0;
let bad = 0;
let exempt = 0;
for (const file of files) {
  const css = fs.readFileSync(path.join(DIR, file), "utf8").replace(/\/\*[\s\S]*?\*\//g, "");
  const re = /@keyframes\s+([\w-]+)\s*\{/g;
  let m;
  while ((m = re.exec(css))) {
    total++;
    const open = m.index + m[0].length - 1;
    const body = css.slice(open + 1, blockEnd(css, open));
    const props = new Set([...body.matchAll(/([a-z-]+)\s*:/g)].map((p) => p[1]));
    const off = [...props].filter((p) => !ALLOWED.has(p));
    if (off.length && EXEMPT[m[1]]) {
      exempt++;
      console.log(`${file}  @keyframes ${m[1]}  →  ${off.join(", ")}  (exceção: ${EXEMPT[m[1]]})`);
    } else if (off.length) {
      bad++;
      console.log(`${file}  @keyframes ${m[1]}  →  ${off.join(", ")}`);
    }
  }
}
console.log(
  `\n${total} @keyframes em ${files.length} arquivo(s); ${bad} animam algo fora de transform, opacity e cor; ${exempt} exceções declaradas.`,
);
process.exit(bad ? 1 : 0);
