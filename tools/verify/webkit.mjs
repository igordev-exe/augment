// Mesma varredura do audit.mjs, no WebKit (motor do Safari/iPhone), com perfis de iPhone do Playwright.
// Também grava capturas do banner e caixas da etiqueta para a medição de folga (tagmeasure.py).
import { webkit, devices } from "playwright";
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const [BASE, OUT] = process.argv.slice(2);
mkdirSync(OUT, { recursive: true });
const auditSrc = readFileSync(join(here, "audit.mjs"), "utf8");
const scanStart = auditSrc.indexOf("const SCAN = `") + "const SCAN = `".length;
const scanEnd = auditSrc.indexOf("return out;`;", scanStart) + "return out;".length;
const SCAN = auditSrc.slice(scanStart, scanEnd).replace(/\\\\/g, "\\");
const SEED = readFileSync(join(here, "seed.js"), "utf8")
  .replace("settings: { ...settings,", "settings: { ...settings, mesoStart: '2026-09-21',")
  .replace(/\nsessions\.length;\s*$/, "\nreturn sessions.length;");
const PHONES = ["iPhone SE", "iPhone 13 Mini", "iPhone 15", "iPhone 15 Pro Max"];
const TAGS = ["Missão do dia", "Descanso hoje", "Próxima missão", "Missão trocada"];
const fin = `document.getAnimations().forEach(a=>{try{a.finish()}catch{}})`;

const browser = await webkit.launch();
const all = {};
const boxes = [];
for (const name of PHONES) {
  const ctx = await browser.newContext({ ...devices[name] });
  const page = await ctx.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(String(e).slice(0, 160)));
  await page.goto(BASE + "/#/");
  await page.waitForTimeout(3000);
  await page.evaluate(`(async()=>{${SEED}})()`);
  await page.reload();
  await page.waitForTimeout(2500);
  const ex = await page.evaluate(
    `(async()=>{ location.hash='/exercicios'; await new Promise(r=>setTimeout(r,1200)); return document.querySelector('a[href^="#/exercicios/"]')?.getAttribute('href'); })()`,
  );
  const routes = [
    "/",
    "/historico",
    "/progresso",
    "/relatorio",
    "/exercicios",
    ex?.slice(1),
    "/guia",
    "/ajustes",
    "/programas",
    "/programas/ppl-v2",
    "/treinador",
    "/online",
    "/amigos",
    "/primeiro-uso",
  ].filter(Boolean);
  for (const r of routes) {
    await page.evaluate(`location.hash=${JSON.stringify(r)}`);
    await page.waitForTimeout(1300);
    await page.evaluate(
      `(async()=>{ ${fin}; document.querySelectorAll('button[aria-expanded="false"]').forEach(b=>{ if(!b.closest('nav')) try{b.click()}catch{} }); await new Promise(r=>setTimeout(r,450)); ${fin}; })()`,
    );
    const found = (await page.evaluate(`(()=>{${SCAN}})()`)) || [];
    for (const f of found) (all[`${r} | ${f.k} | ${f.d} | ${f.t}`] ??= { ...f, route: r, screens: [] }).screens.push(name);
  }
  // Banner: etiqueta × capacete
  await page.evaluate(`location.hash='/'`);
  await page.waitForTimeout(1500);
  const dpr = devices[name].deviceScaleFactor;
  for (const tag of TAGS) {
    const b =
      await page.evaluate(`(async()=>{ ${fin}; const card=document.querySelector('.mission'); card.scrollIntoView({block:'start'}); scrollTo(0, scrollY-8);
      const t=card.querySelector('.mission-tag'); t.textContent=${JSON.stringify(tag)};
      await new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)));
      const r=t.getBoundingClientRect(), c=card.getBoundingClientRect();
      return {top:r.top, bottom:r.bottom, right:r.right, cardRight:c.right, cardW:c.width}; })()`);
    const file = `${name.replace(/\s+/g, "-")}-${TAGS.indexOf(tag)}.png`;
    await page.screenshot({ path: join(OUT, file) });
    boxes.push({ w: devices[name].viewport.width, dpr, tag, file, ...b });
  }
  // Treino em andamento
  await page.evaluate(`[...document.querySelectorAll('button')].find(b=>/Iniciar protocolo/i.test(b.textContent))?.click()`);
  await page.waitForTimeout(1800);
  await page.evaluate(`[...document.querySelectorAll('button')].find(b=>/^Pular$/i.test(b.textContent.trim()))?.click()`);
  await page.waitForTimeout(800);
  await page.evaluate(`document.querySelector('[aria-label="Marcar série como feita"]')?.click()`);
  await page.waitForTimeout(900);
  const found = (await page.evaluate(`(()=>{${SCAN}})()`)) || [];
  for (const f of found) (all[`/treino | ${f.k} | ${f.d} | ${f.t}`] ??= { ...f, route: "/treino", screens: [] }).screens.push(name);
  await page.screenshot({ path: join(OUT, `treino-${name.replace(/\s+/g, "-")}.png`) });
  if (errors.length) console.log(name, "erros JS:", errors.slice(0, 3));
  await ctx.close();
}
await browser.close();
writeFileSync(join(OUT, "boxes.json"), JSON.stringify(boxes));
const rows = Object.values(all);
writeFileSync(
  join(OUT, "audit.txt"),
  rows
    .map((f) => `${f.k.padEnd(13)} ${f.route.padEnd(26)} [${f.screens.join(",")}] ${f.d} :: ${f.t} ${f.x ?? f.s ?? f.f ?? ""}`)
    .join("\n"),
);
console.log(rows.length + " achados (WebKit)");
