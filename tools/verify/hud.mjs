// Fotos e medidas da linha do núcleo ao vivo no HUD do treino, em várias larguras, com texto normal e a 130%,
// no Chromium e no WebKit (iPhone). Dois estados: abertura (meta) e depois de uma série fora do alvo (fala).
// Uso: node tools/verify/hud.mjs [url] [pasta]
import { chromium, webkit, devices } from "playwright";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { browserPath } from "./browser.mjs";

const here = dirname(fileURLToPath(import.meta.url));
const [BASE = "http://localhost:5173", OUT = join(here, "out", "hud")] = process.argv.slice(2);
mkdirSync(OUT, { recursive: true });
const SEED = readFileSync(join(here, "seed.js"), "utf8")
  .replace("settings: { ...settings,", "settings: { ...settings, mesoStart: '2026-09-21',")
  .replace(/\nsessions\.length;\s*$/, "\nreturn sessions.length;");
const SCALE = (k) => `(() => { const k = ${k}; if (k === 1 || window.__scaled) return; window.__scaled = true;
  const mul = (v) => v.replace(/(\\d*\\.?\\d+)px/g, (_, n) => (parseFloat(n) * k).toFixed(2) + 'px');
  document.documentElement.style.setProperty('--text-zoom', String(k));
  const walk = (rules) => { for (const r of rules) { if (r.cssRules) walk(r.cssRules); if (r.style) { const f = r.style.getPropertyValue('font-size'); if (f && /px/.test(f)) r.style.setProperty('font-size', mul(f)); for (let i = 1; i <= 6; i++) { const v = r.style.getPropertyValue('--fs-' + i); if (v) r.style.setProperty('--fs-' + i, mul(v)); } } } };
  for (const sh of document.styleSheets) { try { walk(sh.cssRules); } catch {} } })()`;
// Marca a 1ª série de trabalho do 1º exercício: 3 reps à falha (fora do alvo: gera fala e proposta de carga).
const BAD_SET = `(async () => { const D = await import('/src/lib/db.ts'); const s = await D.db.sessions.where('status').equals('active').first();
  const e = s.exercises[0]; const set = e.sets.find((x) => x.kind === 'work'); set.weight = set.weight ?? 60; set.reps = 3; set.rir = 0; set.done = true; set.doneAt = Date.now();
  await D.db.sessions.put(s); return e.exId; })()`;
const MEASURE = `(() => { const h = document.querySelector('.hud'); const c = document.querySelector('.hud-cue');
  return { hud: Math.round(h?.getBoundingClientRect().height ?? 0), cue: c?.textContent ?? '', cueH: Math.round(c?.getBoundingClientRect().height ?? 0),
    overflow: c ? c.scrollWidth > c.clientWidth + 1 : null, pageScroll: document.documentElement.scrollWidth > innerWidth + 1 }; })()`;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const report = [];

async function run(engine, label, ctxOpts, k) {
  const browser = engine === "webkit" ? await webkit.launch() : await chromium.launch({ executablePath: browserPath() });
  const ctx = await browser.newContext(ctxOpts);
  const page = await ctx.newPage();
  await page.goto(BASE + "/#/");
  await sleep(3500);
  await page.evaluate(`(async()=>{${SEED}})()`);
  await page.reload();
  await sleep(4500);
  await page.evaluate(`[...document.querySelectorAll('button')].find(b=>/Iniciar protocolo/i.test(b.textContent))?.click()`);
  await sleep(1800);
  await page.evaluate(SCALE(k));
  await page.evaluate(`document.getAnimations().forEach(a=>{try{a.finish()}catch{}})`);
  await sleep(400);
  const width = page.viewportSize().width;
  const clip = { x: 0, y: 0, width, height: 220 };
  const tag = `${engine}-${label}-${k === 1 ? "100" : "130"}`;
  report.push({ tag, estado: "abertura", ...(await page.evaluate(MEASURE)) });
  await page.screenshot({ path: join(OUT, `${tag}-abertura.png`), clip });
  await page.evaluate(BAD_SET);
  await sleep(1500);
  await page.evaluate(`document.getAnimations().forEach(a=>{try{a.finish()}catch{}})`);
  report.push({ tag, estado: "fala", ...(await page.evaluate(MEASURE)) });
  await page.screenshot({ path: join(OUT, `${tag}-fala.png`), clip });
  await page.evaluate(
    `(async()=>{ const D = await import('/src/lib/db.ts'); await D.db.sessions.where('status').equals('active').delete(); localStorage.removeItem('augment-timer'); })()`,
  );
  await browser.close();
}

for (const w of [320, 360, 375, 390, 412, 768]) {
  for (const k of [1, 1.3])
    await run(
      "chromium",
      String(w),
      { viewport: { width: w, height: w > 700 ? 1024 : 800 }, deviceScaleFactor: 2, isMobile: w < 700, hasTouch: true },
      k,
    );
}
for (const d of ["iPhone SE", "iPhone 15"]) {
  for (const k of [1, 1.3]) await run("webkit", d.replace(/\s/g, ""), { ...devices[d] }, k);
}
writeFileSync(join(OUT, "report.json"), JSON.stringify(report, null, 2));
console.table(report.map((r) => ({ ...r, cue: r.cue.slice(0, 60) })));
