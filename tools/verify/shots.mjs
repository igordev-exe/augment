// Fotografa cada tela do app (390 × 844, 2×, com dados de demonstração) para revisão de design.
// Uso: node tools/verify/shots.mjs [url] [pasta] [rotas separadas por vírgula]
import { browserArgs, browserPath } from "./browser.mjs";
import { spawn } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const [BASE = "http://localhost:5173", OUT = join(here, "out", "shots"), ONLY] = process.argv.slice(2);
mkdirSync(OUT, { recursive: true });
const SEED = readFileSync(join(here, "seed.js"), "utf8")
  .replace("settings: { ...settings,", "settings: { ...settings, mesoStart: '2026-09-21',")
  .replace(/\nsessions\.length;\s*$/, "\nreturn sessions.length;");
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const ROUTES = (ONLY ?? "/,/historico,/progresso,/relatorio,/exercicios,/guia,/ajustes,/programas,/treinador,/online,/amigos").split(",");

const port = 9393;
const proc = spawn(browserPath(), browserArgs(port, mkdtempSync(join(tmpdir(), "aug-shots-"))), { stdio: "ignore" });
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
  return r.result?.result?.value;
};
const shot = async (name, full) => {
  const metrics = full ? (await send("Page.getLayoutMetrics")).result : null;
  const h = metrics ? Math.min(4000, Math.ceil(metrics.cssContentSize.height)) : 844;
  if (full) await send("Emulation.setDeviceMetricsOverride", { width: 390, height: h, deviceScaleFactor: 2, mobile: true });
  await sleep(300);
  const s = await send("Page.captureScreenshot", { format: "png" });
  writeFileSync(join(OUT, `${name}.png`), Buffer.from(s.result.data, "base64"));
  if (full) await send("Emulation.setDeviceMetricsOverride", { width: 390, height: 844, deviceScaleFactor: 2, mobile: true });
};

await send("Emulation.setDeviceMetricsOverride", { width: 390, height: 844, deviceScaleFactor: 2, mobile: true });
await send("Page.navigate", { url: BASE + "/#/" });
await sleep(3500);
console.log("seed", await js(SEED));
await send("Page.reload");
await sleep(4500);
await shot("boot", false);
await sleep(1500);
for (const r of ROUTES) {
  await js(`location.hash=${JSON.stringify(r)}`);
  await sleep(1400);
  if (!process.env.SHOTS_RAW) await js(`document.getAnimations().forEach(a=>{try{a.finish()}catch{}})`);
  else await sleep(1200);
  const name = r === "/" ? "hoje" : r.replace(/^\//, "").replace(/\//g, "-");
  await shot(name, true);
}
// treino em andamento
await js(`location.hash="/"`);
await sleep(1200);
await js(`[...document.querySelectorAll('button')].find(b=>/Iniciar protocolo/i.test(b.textContent))?.click()`);
await sleep(1500);
await shot("treino", true);
await js(
  `(async()=>{ const D = await import('/src/lib/db.ts'); await D.db.sessions.where('status').equals('active').delete(); localStorage.removeItem('augment-timer'); })()`,
);
console.log("ok", OUT);
ws.close();
proc.kill();
process.exit(0);
