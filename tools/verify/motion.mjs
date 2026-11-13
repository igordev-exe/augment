// Movimento e contraste das peças de jogo (docs/plano-refino-visual.md, MC0/MC1), na vitrine #/kit (só no dev).
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

const port = 9383;
const proc = spawn(browserPath(), browserArgs(port, mkdtempSync(join(tmpdir(), "aug-motion-"))), { stdio: "ignore" });
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

// Dispara ligar + leitura e recompensa, e lê o estado 60 ms depois (no meio de qualquer animação de verdade).
const PROBE = `
  const click = (t) => [...document.querySelectorAll('button')].find((b) => b.textContent.trim() === t)?.click();
  click('Ligar + leitura');
  await new Promise((r) => setTimeout(r, 30));
  document.querySelectorAll('.seg-bar').forEach((b) => b.scrollIntoView({ block: 'center' }));
  click('Recompensa');
  await new Promise((r) => setTimeout(r, 60));
  const kit = document.querySelector('.fx-ligar');
  const running = document.getAnimations().filter((a) => a.playState === 'running' && (kit.contains(a.effect?.target ?? null) || a.effect?.target?.classList?.contains('pc-flash'))).length;
  const invisible = [...kit.querySelectorAll('*')].filter((e) => +getComputedStyle(e).opacity < 0.99 && e.getClientRects().length).length;
  const bars = [...document.querySelectorAll('.seg-bar .seg-fill')].map((f) => {
    const b = f.parentElement, on = +b.style.getPropertyValue('--on'), segs = +b.style.getPropertyValue('--segs');
    const want = (on / segs - 1) * b.clientWidth;
    const got = new DOMMatrix(getComputedStyle(f).transform).m41;
    return Math.abs(want - got) < 1;
  });
  return { running, invisible, barsFinal: bars.every(Boolean), flashes: document.querySelectorAll('.pc-flash').length };
`;

const lum = (rgb) => {
  const [r, g, b] = rgb.map((v) => {
    v /= 255;
    return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
const ratio = (a, b) => {
  const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p);
  return (x + 0.05) / (y + 0.05);
};
// Cor computada → [r, g, b] (o navegador devolve rgb() ou color(srgb ...)).
const RGB = `const rgb = (c) => { const n = c.match(/[\\d.]+/g).map(Number); return c.startsWith('color(') ? n.slice(0, 3).map((v) => Math.round(v * 255)) : n.slice(0, 3); };`;

let fail = 0;
const check = (ok, msg) => {
  console.log(`${ok ? "ok  " : "FALHA"} ${msg}`);
  if (!ok) fail++;
};

await send("Emulation.setDeviceMetricsOverride", { width: 390, height: 844, deviceScaleFactor: 2, mobile: true });
const open = async () => {
  await send("Page.navigate", { url: BASE + "/#/kit" });
  await send("Page.reload"); // mesma URL só muda o hash: sem recarregar, as classes do passo anterior ficariam
  await sleep(5500); // boot por cima
};

// 1a. reduzir movimento
await send("Emulation.setEmulatedMedia", { features: [{ name: "prefers-reduced-motion", value: "reduce" }] });
await open();
let r = await js(PROBE);
check(r.running === 0 && r.invisible === 0 && r.barsFinal && r.flashes === 0, `reduzir movimento: ${JSON.stringify(r)}`);

// 1b. efeitos no mínimo e no nível academia (o de academia não tem o corte global do fx-min: vale a regra das peças)
await send("Emulation.setEmulatedMedia", { features: [{ name: "prefers-reduced-motion", value: "no-preference" }] });
for (const level of ["fx-min", "fx-gym"]) {
  await open();
  await js(`document.documentElement.classList.add('${level}')`);
  r = await js(PROBE);
  check(r.running === 0 && r.invisible === 0 && r.barsFinal && r.flashes === 0, `${level}: ${JSON.stringify(r)}`);
}

// 2. sem restrição: tem que animar
await open();
r = await js(PROBE);
check(r.running > 0 && r.flashes === 1, `sem restrição anima: ${JSON.stringify(r)}`);

// 3. contraste da faixa cheia
for (const deload of [false, true]) {
  const rows = await js(`${RGB}
    document.documentElement.classList.toggle('mode-deload', ${deload});
    await new Promise((r) => setTimeout(r, 50));
    return [...document.querySelectorAll('.kit-cell')].map((c) => {
      const band = c.querySelector('.band');
      return { s: c.className.replace('kit-cell ', ''), fg: rgb(getComputedStyle(band).color), bg: rgb(getComputedStyle(band, '::before').backgroundColor) };
    });`);
  for (const row of rows) {
    const k = ratio(row.fg, row.bg);
    check(k >= 4.5, `contraste ${row.s}${deload ? " (deload)" : ""}: ${k.toFixed(2)}:1`);
  }
}

ws.close();
proc.kill();
console.log(fail ? `\n${fail} falha(s).` : "\nTudo certo.");
process.exit(fail ? 1 : 0);
