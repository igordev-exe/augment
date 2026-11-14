// Mede o balão do núcleo (components/CoreBubble.tsx) na vitrine #/kit: em cada largura, escala de texto e tom,
// com e sem a TimerBar, confere que o balão fica inteiro na tela, acima da nav e do timer, com texto sem corte,
// letra ≥ 11 px e botões ≥ 44 px. Também grava uma foto de cada tom em 390 px.
// Uso: node tools/verify/bubble.mjs [url] [pasta] [chromium|webkit]
import { chromium, webkit } from "playwright";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const [BASE = "http://localhost:5173", OUT = join(here, "out", "balao"), ENGINE = "chromium"] = process.argv.slice(2);
mkdirSync(OUT, { recursive: true });
const auditSrc = readFileSync(join(here, "audit.mjs"), "utf8");
const fsStart = auditSrc.indexOf("const FONT_SCALE = `") + "const FONT_SCALE = `".length;
const FONT_SCALE_SRC = auditSrc.slice(fsStart, auditSrc.indexOf("}`;", fsStart) + 1).replace(/\\\\/g, "\\");
const fontScale = (k) => FONT_SCALE_SRC.replace("${SCALE}", String(k));

const WIDTHS = (process.env.BUBBLE_WIDTHS ?? "320,360,375,390,412,768,820").split(",").map(Number);
const TONES = ["info", "ok", "warn", "danger", "reward"];
const fin = `document.getAnimations().forEach(a=>{try{a.finish()}catch{}})`;
// TimerBar falsa com as classes reais (mesmo CSS): duas linhas, como no treino.
const TIMER = `(()=>{ const t=document.createElement('div'); t.className='timer'; t.id='fake-timer';
  t.innerHTML='<div class="timer-inner" data-augmented-ui="tl-clip br-clip border"><div class="timer-top">DESCANSO · SUPINO RETO COM BARRA</div><div class="timer-row"><span class="timer-clock">1:45</span><span class="timer-actions"><button class="btn">+30 s</button><button class="btn">Pular</button></span></div></div>';
  document.body.appendChild(t); })()`;

const MEASURE = `(() => {
  const b = document.querySelector('.core-bubble'); if (!b) return ['sem-balao'];
  const out = [], r = b.getBoundingClientRect(), vw = innerWidth;
  if (r.left < -0.5 || r.right > vw + 0.5) out.push('vaza-tela ' + Math.round(r.left) + '..' + Math.round(r.right));
  let floor = innerHeight;
  document.querySelectorAll('.nav, .timer-inner').forEach((e) => { const q = e.getBoundingClientRect(); if (q.height && q.top < floor) floor = q.top; });
  if (r.bottom > floor - 4) out.push('sobre-rodape ' + Math.round(r.bottom) + ' > ' + Math.round(floor));
  if (r.top < 0) out.push('sai-pelo-topo');
  for (const e of b.querySelectorAll('.cb-title, .cb-text, .cb-act')) {
    const cs = getComputedStyle(e);
    if (e.scrollWidth > e.clientWidth + 1) out.push('texto-cortado ' + e.className);
    if (parseFloat(cs.fontSize) < 10.9) out.push('letra-pequena ' + e.className + ' ' + cs.fontSize);
  }
  for (const e of b.querySelectorAll('button')) { const q = e.getBoundingClientRect(); if (q.height < 44 || q.width < 44) out.push('alvo-pequeno ' + Math.round(q.width) + 'x' + Math.round(q.height)); }
  const t = b.querySelector('.cb-text'); const lh = parseFloat(getComputedStyle(t).lineHeight);
  const lines = Math.round(t.getBoundingClientRect().height / lh);
  return out.concat(lines > 3 ? ['mais-de-3-linhas ' + lines] : []).concat(['@linhas=' + lines]);
})()`;

const launcher = ENGINE === "webkit" ? webkit : chromium;
const browser = await launcher.launch(ENGINE === "webkit" ? {} : { channel: "msedge" });
const rows = [];
let bad = 0;
for (const scale of [1, 1.3]) {
  for (const w of WIDTHS) {
    const ctx = await browser.newContext({ viewport: { width: w, height: w >= 768 ? 1024 : 740 }, deviceScaleFactor: 2 });
    const page = await ctx.newPage();
    for (const timer of [false, true]) {
      for (const tone of TONES) {
        await page.goto(`${BASE}/?t=${Date.now()}#/kit?balao=${tone}&botoes=1`);
        await page.waitForTimeout(scale === 1 && w === WIDTHS[0] && !timer && tone === TONES[0] ? 5000 : 1500);
        await page.evaluate(`(()=>{${fontScale(scale)}})()`);
        if (timer) await page.evaluate(TIMER);
        // O balão mede o rodapé de novo a cada segundo (a TimerBar pode aparecer depois).
        await page.waitForTimeout(timer ? 1200 : 300);
        await page.evaluate(`document.querySelector('.boot')?.remove(); ${fin}`);
        const found = await page.evaluate(MEASURE);
        const lines = found.find((f) => f.startsWith("@linhas="))?.slice(8);
        const issues = found.filter((f) => !f.startsWith("@"));
        bad += issues.length;
        rows.push({ engine: ENGINE, scale, width: w, timer, tone, lines: Number(lines), issues });
        if (w === 390 && scale === 1 && !timer)
          await page.locator(".core-bubble").screenshot({ path: join(OUT, `balao-${tone}-${ENGINE}.png`) });
        if (w === 320 && scale === 1.3 && timer && tone === "danger")
          await page.screenshot({ path: join(OUT, `balao-320-130-timer-${ENGINE}.png`) });
      }
    }
    await ctx.close();
  }
}
await browser.close();
writeFileSync(join(OUT, `balao-${ENGINE}.json`), JSON.stringify(rows, null, 2));
const table = {};
for (const r of rows) {
  const k = `${r.scale}× ${r.timer ? "com timer" : "sem timer"}`;
  table[k] ??= {};
  table[k][r.width] = (table[k][r.width] ?? 0) + r.issues.length;
}
console.log(`${ENGINE}: achados por largura (5 tons cada)`);
console.table(table);
console.log("linhas de texto (máx):", Math.max(...rows.map((r) => r.lines)));
for (const r of rows.filter((x) => x.issues.length)) console.log(r.scale, r.width, r.timer ? "timer" : "", r.tone, r.issues.join("; "));
process.exit(bad ? 1 : 0);
