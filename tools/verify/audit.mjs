// Varredura de layout: todas as telas × vários aparelhos. Procura vazamento horizontal, texto cortado, letra < 11 px
// e alvo de toque pequeno. Edge headless por CDP, com dados de demonstração.
import { browserArgs, browserPath } from "./browser.mjs";
import { loginScript } from "./login.mjs";
import { spawn } from "node:child_process";
import { mkdtempSync, readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
// Uso: node tools/verify/audit.mjs [url] [pasta de saída] [escala do texto] [telas]
//   ex.: node tools/verify/audit.mjs http://localhost:5173 tools/verify/out 1.3 320,360
// Sai com código 1 se achar algo (para o CI).
const [BASE = "http://localhost:5173", OUT = join(dirname(fileURLToPath(import.meta.url)), "out"), SCALE_ARG, ONLY] = process.argv.slice(2);
const SCALE = +(SCALE_ARG || 1);
mkdirSync(OUT, { recursive: true });
const SEED = readFileSync(join(here, "seed.js"), "utf8")
  .replace("settings: { ...settings,", "settings: { ...settings, mesoStart: '2026-09-21',")
  .replace(/\nsessions\.length;\s*$/, "\nreturn sessions.length;");
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const FONT_SCALE = `
  const k = ${SCALE};
  if (k !== 1) {
    const mul = (v) => v.replace(/(\\d*\\.?\\d+)px/g, (_, n) => (parseFloat(n) * k).toFixed(2) + 'px');
    if (!window.__scaled) {
      window.__scaled = true;
      document.documentElement.style.setProperty('--text-zoom', String(k));
      const walk = (rules) => { for (const r of rules) { if (r.cssRules) walk(r.cssRules); if (r.style) { const f = r.style.getPropertyValue('font-size'); if (f && /px/.test(f)) r.style.setProperty('font-size', mul(f), r.style.getPropertyPriority('font-size')); for (let i = 1; i <= 6; i++) { const v = r.style.getPropertyValue('--fs-' + i); if (v) r.style.setProperty('--fs-' + i, mul(v)); } } } };
      for (const sh of document.styleSheets) { try { walk(sh.cssRules); } catch {} }
    }
    for (const e of document.querySelectorAll('[style*="font-size"]')) { if (!e.dataset.scaled) { e.dataset.scaled = '1'; e.style.fontSize = mul(e.style.fontSize); } }
  }`;
const SCREENS = [
  ["320", 320, 568, 2, true],
  ["360", 360, 740, 3, true],
  ["393", 393, 873, 2.75, true],
  ["430", 430, 932, 3, true],
  ["deitado", 873, 393, 2.75, true],
  ["tablet", 820, 1180, 2, false],
];

const SCAN = `
const vw = innerWidth, out = [];
const desc = (e) => (e.tagName.toLowerCase() + (e.className && typeof e.className === 'string' ? '.' + e.className.trim().split(/\\s+/).slice(0,2).join('.') : '')).slice(0, 60);
const txt = (e) => (e.innerText || e.getAttribute('aria-label') || '').replace(/\\s+/g, ' ').trim().slice(0, 50);
const hiddenDeco = (e) => e.closest('[aria-hidden="true"], .sr-only'); // .sr-only: texto só para o leitor de tela
const clippedBy = (e) => { for (let p = e.parentElement; p && p !== document.body; p = p.parentElement) { const cs = getComputedStyle(p); if (/(hidden|auto|scroll|clip)/.test(cs.overflowX)) return p; } return null; };
if (document.documentElement.scrollWidth > vw + 1) out.push({ k: 'pagina-larga', d: 'html', t: 'scrollWidth ' + document.documentElement.scrollWidth + ' > ' + vw });
for (const e of document.querySelectorAll('#root *')) {
  const cs = getComputedStyle(e);
  if (cs.display === 'none' || cs.visibility === 'hidden' || +cs.opacity === 0) continue;
  const r = e.getBoundingClientRect();
  if (!r.width || !r.height) continue;
  if (e instanceof SVGElement && e.tagName.toLowerCase() !== 'svg') continue;
  // vaza para fora da tela e nada recorta
  if ((r.right > vw + 1 || r.left < -1) && !clippedBy(e) && !hiddenDeco(e) && cs.position !== 'fixed') out.push({ k: 'vaza-tela', d: desc(e), t: txt(e), x: Math.round(r.left) + '..' + Math.round(r.right) });
  const ownText = [...e.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim().length > 1);
  if (ownText && !hiddenDeco(e)) {
    if (e.scrollWidth > e.clientWidth && /(hidden|clip)/.test(cs.overflowX) && cs.textOverflow !== 'ellipsis') out.push({ k: 'texto-cortado', d: desc(e), t: txt(e) });
    if (cs.textOverflow === "ellipsis" && e.scrollWidth > e.clientWidth) out.push({ k: 'reticencias', d: desc(e), t: txt(e) });
    if (parseFloat(cs.fontSize) < 10.9 && !(e instanceof SVGElement)) out.push({ k: 'letra-pequena', d: desc(e), t: txt(e), f: cs.fontSize });
  }
  if (e.matches('button, a[href], input, select, [role=button]') && !hiddenDeco(e) && (r.height < 28 || r.width < 28) && txt(e)) out.push({ k: 'alvo-pequeno', d: desc(e), t: txt(e), s: Math.round(r.width) + 'x' + Math.round(r.height) });
}
// textos vizinhos LADO A LADO (mesma linha de uma flex em linha ou grid) que se sobrepõem ou ficam a menos de 2 px
const textBox = (el) => {
  const er = el.getBoundingClientRect();
  const r = document.createRange(); r.selectNodeContents(el);
  const rs = [...r.getClientRects()].filter((x) => x.width > 0.5 && x.height > 0.5 && x.top >= er.top - 1 && x.bottom <= er.bottom + 1 && x.left >= er.left - 1 && x.right <= er.right + 1);
  if (!rs.length) return null;
  return { l: Math.min(...rs.map((x) => x.left)), r: Math.max(...rs.map((x) => x.right)), t: Math.min(...rs.map((x) => x.top)), b: Math.max(...rs.map((x) => x.bottom)) };
};
for (const c of document.querySelectorAll('#root *')) {
  const cs = getComputedStyle(c);
  const row = (/flex/.test(cs.display) && !cs.flexDirection.startsWith('column')) || /grid/.test(cs.display);
  if (!row || hiddenDeco(c) || c.matches('.timer-clock')) continue;
  const kids = [...c.children].filter((k) => (k.innerText || '').trim() && getComputedStyle(k).position !== 'absolute' && !k.closest('[aria-hidden="true"]') && !k.matches('details:not([open]) > :not(summary)'));
  const boxes = kids.map((k) => [k, k.getBoundingClientRect(), textBox(k)]).filter(([, , b]) => b);
  for (let i = 0; i < boxes.length; i++) for (let j = i + 1; j < boxes.length; j++) {
    const [ka, ra, a] = boxes[i], [kb, rb, b] = boxes[j];
    const sameLine = Math.min(ra.bottom, rb.bottom) - Math.max(ra.top, rb.top) > 4 && Math.min(a.b, b.b) - Math.max(a.t, b.t) > 2;
    if (!sameLine) continue;
    const hGap = Math.max(b.l - a.r, a.l - b.r);
    if (hGap < 2) out.push({ k: 'encostado', d: desc(ka) + ' + ' + desc(kb), t: txt(ka).slice(0, 20) + ' | ' + txt(kb).slice(0, 20), x: 'folga ' + hGap.toFixed(1) });
  }
}
// R4 (plano de refino): no máximo 1 botão de AÇÃO vermelho cheio no mesmo quadro. Perigo (.btn-danger, de segurar) é
// outro sinal e não conta; a barra de abas também não.
const reds = [...document.querySelectorAll('.btn-primary')].filter((b) => !b.closest('.danger-zone, .nav, [aria-hidden="true"]')).map((b) => [b, b.getBoundingClientRect()]).filter(([b, r]) => r.width && getComputedStyle(b).visibility !== 'hidden');
for (let y = 0; y < document.documentElement.scrollHeight; y += Math.round(innerHeight / 2)) {
  const inView = reds.filter(([, r]) => r.top + scrollY < y + innerHeight && r.bottom + scrollY > y);
  if (inView.length > 1) { out.push({ k: 'vermelho-demais', d: 'quadro em y=' + y, t: inView.map(([b]) => txt(b).slice(0, 18)).join(' | ') }); break; }
}
// R6: todo recolhível usa o padrão (linha da lista agrupada ou a seta única); o treino em andamento fica de fora.
for (const d of document.querySelectorAll('details:not(.fold-row, .how, .plan-more, .eg-why, .mod, .ob-others, .fm-zones, .rec-row, .small, .tiny)')) out.push({ k: 'details-fora-do-padrao', d: desc(d), t: txt(d.querySelector('summary') || d).slice(0, 40) });
return out;`;

async function main() {
  const port = 9381;
  const proc = spawn(browserPath(), browserArgs(port, mkdtempSync(join(tmpdir(), "aug-audit-"))), { stdio: "ignore" });
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
    if (r.result?.exceptionDetails) console.error("JS", r.result.exceptionDetails.exception?.description?.slice(0, 200));
    return r.result?.result?.value;
  };
  const go = async (hash) => {
    await js(`location.hash=${JSON.stringify(hash)}`);
    await sleep(1300);
    await js(FONT_SCALE);
    await js(
      `document.getAnimations().forEach(a=>{try{a.finish()}catch{}}); document.querySelectorAll('button[aria-expanded="false"]').forEach(b=>{ if(!b.closest('nav')) try{b.click()}catch{} }); await new Promise(r=>setTimeout(r,300)); document.querySelectorAll('details.mod').forEach(d=>d.open=true); await new Promise(r=>setTimeout(r,450)); document.getAnimations().forEach(a=>{try{a.finish()}catch{}});`,
    );
  };

  await send("Emulation.setDeviceMetricsOverride", { width: 360, height: 740, deviceScaleFactor: 2, mobile: true });
  await send("Page.navigate", { url: BASE + "/#/" });
  await sleep(3500);
  console.log("seed", await js(SEED));
  // Com AUDIT_API (servidor local de teste, `npm run server`), entra numa conta para medir também as telas logadas.
  if (process.env.AUDIT_API) {
    console.log("conta", await js(loginScript(process.env.AUDIT_API)));
  }
  await send("Page.reload");
  await sleep(3000);
  // ids para as telas de detalhe
  await go("/exercicios");
  const exHref = await js(`return [...document.querySelectorAll('a[href^="#/exercicios/"]')][0]?.getAttribute('href')`);
  const routes = [
    "/",
    "/historico",
    "/progresso",
    "/relatorio",
    "/exercicios",
    exHref?.slice(1),
    "/guia",
    "/ajustes",
    "/programas",
    "/programas/ppl-v2",
    "/treinador",
    "/online",
    "/amigos",
    "/privacidade",
  ].filter(Boolean);
  // AUDIT_ROUTES=/kit,/guia mede só essas rotas (ex.: a vitrine #/kit, que só existe no dev).
  if (process.env.AUDIT_ROUTES) routes.splice(0, routes.length, ...process.env.AUDIT_ROUTES.split(","));

  await js(FONT_SCALE);
  console.log("fonte do corpo depois da escala:", await js(`return getComputedStyle(document.body).fontSize`));
  const all = {};
  for (const [name, w, h, dpr, mobile] of SCREENS.filter((x) => !ONLY || ONLY.split(",").includes(x[0]))) {
    await send("Emulation.setDeviceMetricsOverride", { width: w, height: h, deviceScaleFactor: dpr, mobile });
    await send("Page.reload");
    await sleep(2500);
    const record = async (r) => {
      const found = (await js(SCAN)) || [];
      for (const f of found) {
        const key = `${r} | ${f.k} | ${f.d} | ${f.t}`;
        (all[key] ??= { ...f, route: r, screens: [] }).screens.push(name);
      }
    };
    for (const r of routes) {
      await go(r);
      await record(r);
    }
    // assistente de primeiro uso: cada passo
    await go("/primeiro-uso");
    await record("/primeiro-uso");
    await js(`[...document.querySelectorAll('.ob button')].find(b=>/^Começar$/.test(b.textContent.trim()))?.click()`);
    for (let step = 1; step <= 4; step++) {
      await sleep(350);
      await js(FONT_SCALE);
      await js(`document.querySelectorAll('.ob details').forEach(d=>d.open=true)`);
      await record("/primeiro-uso#" + step);
      await js(`document.querySelector('.ob-step > .ob-choice')?.click()`);
    }
    // treino em andamento
    await go("/");
    await js(`[...document.querySelectorAll('button')].find(b=>/Iniciar protocolo/i.test(b.textContent))?.click()`);
    await sleep(1800);
    await js(`[...document.querySelectorAll('button')].find(b=>/^Pular$/i.test(b.textContent.trim()))?.click()`);
    await sleep(800);
    await js(`document.querySelector('[aria-label="Marcar série como feita"]')?.click()`);
    await sleep(900);
    await js(FONT_SCALE);
    await sleep(200);
    const found = (await js(SCAN)) || [];
    for (const f of found) {
      const key = `/treino | ${f.k} | ${f.d} | ${f.t}`;
      (all[key] ??= { ...f, route: "/treino", screens: [] }).screens.push(name);
    }
    const shot = await send("Page.captureScreenshot", { format: "png" });
    writeFileSync(join(OUT, `treino-${name}.png`), Buffer.from(shot.result.data, "base64"));
    await js(`[...document.querySelectorAll('button')].find(b=>/Descartar/i.test(b.textContent))`); // não descarta: só segue
    await js(
      `(async()=>{ const D = await import('/src/lib/db.ts'); await D.db.sessions.where('status').equals('active').delete(); localStorage.removeItem('augment-timer'); })()`,
    );
  }
  const rows = Object.values(all).sort((a, b) => a.k.localeCompare(b.k) || a.route.localeCompare(b.route));
  const text = rows
    .map((f) => `${f.k.padEnd(13)} ${f.route.padEnd(26)} [${f.screens.join(",")}] ${f.d} :: ${f.t} ${f.x ?? f.s ?? f.f ?? ""}`)
    .join("\n");
  writeFileSync(join(OUT, "audit.txt"), text);
  console.log(rows.length + " achados" + (rows.length ? ":\n" + text : ""));
  ws.close();
  proc.kill();
  process.exit(rows.length ? 1 : 0);
}
main();
