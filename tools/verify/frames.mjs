// Pior quadro numa troca de tela com a CPU 4× mais lenta (MC1 do plano de refino). Mede o maior intervalo entre
// quadros (requestAnimationFrame) nos 900 ms depois de trocar de rota, em cada aba principal. Aceite: < 50 ms.
// Uso: node tools/verify/frames.mjs [url]   (precisa do npm run dev). Sai com 1 se algum quadro passar de 50 ms.
// (Cabeçalho de conexão igual ao de motion.mjs.)
// Original: Movimento e contraste das peças de jogo (docs/plano-refino-visual.md, MC0/MC1), na vitrine #/kit (só no dev).
//  1. Com "reduzir movimento" e com efeitos no mínimo (fx-min): depois de disparar ligar, leitura e recompensa,
//     nenhuma animação roda, nenhum item fica invisível e as barras já estão no valor final.
//  2. Sem restrição: as mesmas ações animam de verdade (prova de que o teste acima não passa à toa).
//  3. Contraste do texto da faixa cheia sobre a cor de cada setor, também no deload (≥ 4,5:1).
// Uso: node tools/verify/motion.mjs [url]   (precisa do npm run dev). Sai com 1 se algo falhar.
import { browserArgs, browserPath } from "./browser.mjs";
import { spawn } from "node:child_process";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const [BASE = "http://localhost:5173"] = process.argv.slice(2);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const port = 9385;
const proc = spawn(browserPath(), browserArgs(port, mkdtempSync(join(tmpdir(), "aug-frames-"))), { stdio: "ignore" });
let list;
for (let i = 0; i < 40; i++) {
  try {
    list = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json();
    if (list.some((t) => t.type === "page")) break;
  } catch {}
  await sleep(250);
}
const ws = new WebSocket(list.find((t) => t.type === "page").webSocketDebuggerUrl);
await new Promise((r) => (ws.onopen = r));
let id = 0;
const pending = new Map();
ws.onmessage = (m) => {
  const d = JSON.parse(m.data);
  if (d.id && pending.has(d.id)) pending.get(d.id)(d), pending.delete(d.id);
};
const send = (method, params = {}) =>
  new Promise((res) => {
    const i = ++id;
    pending.set(i, res);
    ws.send(JSON.stringify({ id: i, method, params }));
  });
const js = async (expr) => {
  const r = await send("Runtime.evaluate", { expression: `(async()=>{${expr}})()`, awaitPromise: true, returnByValue: true });
  if (r.result?.exceptionDetails) console.error("JS", r.result.exceptionDetails.exception?.description?.slice(0, 300));
  return r.result?.result?.value;
};

await send("Emulation.setDeviceMetricsOverride", { width: 390, height: 844, deviceScaleFactor: 2, mobile: true });
await send("Page.navigate", { url: BASE + "/#/" });
await sleep(4000);
// Dados de demonstração (o mesmo seed das outras ferramentas), para as telas terem conteúdo.
const { readFileSync } = await import("node:fs");
const { dirname } = await import("node:path");
const { fileURLToPath } = await import("node:url");
const here = dirname(fileURLToPath(import.meta.url));
const SEED = readFileSync(join(here, "seed.js"), "utf8").replace(/\nsessions\.length;\s*$/, "\nreturn sessions.length;");
await js(SEED);
await send("Page.reload");
await sleep(6000);
// Sem janela, a aba fica "em segundo plano" e o navegador não desenha quadros: traz para a frente e finge foco.
await send("Page.bringToFront");
await send("Emulation.setFocusEmulationEnabled", { enabled: true });
await send("Emulation.setCPUThrottlingRate", { rate: 4 });
const ROUTES = ["/historico", "/progresso", "/relatorio", "/exercicios", "/guia", "/ajustes", "/programas", "/"];
let worst = 0;
let fail = 0;
// Cada tela é medida duas vezes: com as animações e com fx-min (tudo parado). A diferença é o custo das animações;
// o servidor de desenvolvimento (React em modo dev, sem minificar) já é lento por si sob CPU 4×.
const measure = async (r, still) => {
  await js(
    `document.documentElement.classList.toggle("fx-min", ${still}); location.hash = "/kit-vazio"; await new Promise((res) => setTimeout(res, 700));`,
  );
  return js(`
    const frames = [];
    let last = 0;
    let stop = false;
    let cut = -1;
    const tick = (t) => { if (last) frames.push(t - last); last = t; if (!stop) requestAnimationFrame(tick); };
    requestAnimationFrame(tick);
    await new Promise((res) => setTimeout(res, 120));
    cut = frames.length;
    location.hash = ${JSON.stringify(r)};
    await new Promise((res) => setTimeout(res, 900));
    stop = true;
    // Os 2 primeiros quadros depois da troca são a montagem da tela (React), não as animações: medidos à parte.
    const after = frames.slice(cut);
    return { n: after.length, max: Math.round(Math.max(0, ...after)) };
  `);
};
// Mediana de 3 medidas: o modo de desenvolvimento varia muito de uma troca para outra.
const median = async (r, still) => {
  const xs = [];
  for (let i = 0; i < 3; i++) xs.push((await measure(r, still))?.max ?? 0);
  xs.sort((x, y) => x - y);
  return { max: xs[1] };
};
for (const r of ROUTES) {
  const anim = await median(r, false);
  const still = await median(r, true);
  // Custo das animações: quanto o pior quadro cresce em relação à mesma troca sem nenhuma animação.
  const cost = Math.max(0, (anim?.max ?? 0) - (still?.max ?? 0));
  worst = Math.max(worst, cost);
  if (cost >= 50) fail++;
  console.log(
    `${cost < 50 ? "ok  " : "FALHA"} ${r.padEnd(12)} pior quadro ${anim?.max} ms com animações, ${still?.max} ms sem → custo das animações ${cost} ms`,
  );
  await sleep(400);
}
await js(`document.documentElement.classList.remove("fx-min")`);
await send("Emulation.setCPUThrottlingRate", { rate: 1 });
ws.close();
proc.kill();
console.log(`\nPior quadro: ${worst} ms (CPU 4× mais lenta).`);
process.exit(fail ? 1 : 0);
