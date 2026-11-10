// Ponta a ponta dos achados dos testes com usuários, no app de verdade (Edge headless, 360 px).
import { browserArgs, browserPath } from "./browser.mjs";
import { spawn } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const [URL, OUT] = process.argv.slice(2);
mkdirSync(OUT, { recursive: true });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const SEED = readFileSync(join(import.meta.dirname, "seed.js"), "utf8")
  .replace("settings: { ...settings,", "settings: { ...settings, mesoStart: '2026-09-21',")
  .replace(/\nsessions\.length;\s*$/, "\nreturn sessions.length;");
const port = 9511;
const proc = spawn(browserPath(), browserArgs(port, mkdtempSync(join(tmpdir(), "aug-e2e-"))), { stdio: "ignore" });
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
const js = async (e) => {
  const r = await send("Runtime.evaluate", { expression: `(async()=>{${e}})()`, awaitPromise: true, returnByValue: true });
  if (r.result?.exceptionDetails) return "ERRO: " + r.result.exceptionDetails.exception?.description?.slice(0, 200);
  return r.result?.result?.value;
};
const shot = async (n) => {
  const s = await send("Page.captureScreenshot", { format: "png" });
  writeFileSync(join(OUT, n + ".png"), Buffer.from(s.result.data, "base64"));
};
/** Clica no primeiro botão/link cujo texto (espaços normalizados) bate com a regex. */
const click = (re) =>
  `const b=[...document.querySelectorAll('button,a')].find(x=>${re}.test(x.textContent.replace(/\\s+/g,' ').trim())); if(!b) return false; b.scrollIntoView({block:'center'}); b.click(); return true;`;
const out = [];

await send("Emulation.setDeviceMetricsOverride", { width: 360, height: 760, deviceScaleFactor: 2, mobile: true });
await send("Page.navigate", { url: URL + "#/" });
await sleep(5000);
await js(SEED);
await send("Page.reload");
await sleep(4500);

// 1. sugestões: só a próxima série mostra número; cor cinza
out.push("iniciar: " + (await js(click("/Iniciar protocolo/i"))));
await sleep(2000);
await js(click("/^Pular$/i"));
await sleep(1000);
out.push(
  "sugestões: " +
    (await js(
      `const ins=[...document.querySelectorAll('.ex.open .set .field input')]; const withNum=ins.filter(i=>i.placeholder!=='–'&&i.value==='').length; const c=getComputedStyle(ins[0],'::placeholder').color; return JSON.stringify({campos:ins.length, comNumeroSugerido:withNum, cor:c});`,
    )),
);
await js(`document.querySelector('.ex.open .set')?.scrollIntoView({block:'start'}); scrollBy(0,-120)`);
await sleep(300);
await shot("1-sugestoes");
await js(`document.querySelector('.ex.open [aria-label="Marcar série como feita"]')?.click()`);
await sleep(800);
out.push(
  "depois do ✓ (peso/reps por série): " +
    (await js(
      `const rows=[...document.querySelectorAll('.ex.open .set')]; return rows.map(r=>[...r.querySelectorAll('.field input')].map(i=>i.value||i.placeholder).join('/')).join(' | ')`,
    )),
);

// 2. − Aquecimento
const w0 = await js(`return document.querySelectorAll('.ex.open .set.warmup').length`);
out.push("botão − Aquecimento: " + (await js(click("/^− Aquecimento$/"))));
await sleep(600);
out.push(`aquecimentos: ${w0} → ` + (await js(`return document.querySelectorAll('.ex.open .set.warmup').length`)));

// 3. adicionar exercício hoje
out.push("abrir seletor: " + (await js(click("/Adicionar exercício hoje/i"))));
await sleep(600);
out.push(
  "escolhido: " +
    (await js(
      `const b=document.querySelector('.pe-lib li button'); const n=b?.querySelector('strong')?.textContent; b?.click(); return n;`,
    )),
);
await sleep(1200);
out.push(
  "extra no treino: " +
    (await js(
      `const t=[...document.querySelectorAll('.ex-name')].find(x=>/extra hoje/.test(x.textContent)); return t ? t.textContent : 'não achou'`,
    )),
);
out.push(
  "sugestão do extra: " +
    (await js(
      `const ex=[...document.querySelectorAll('.ex')].find(x=>/extra hoje/.test(x.textContent)); const i=ex?.querySelector('.set .field input'); return i ? 'peso '+i.placeholder : 'sem campos'`,
    )),
);
await js(
  `[...document.querySelectorAll('.ex-name')].find(x=>/extra hoje/.test(x.textContent))?.scrollIntoView({block:'start'}); scrollBy(0,-60)`,
);
await sleep(300);
await shot("2-extra");
await js(
  `const D=await import('/src/lib/db.ts'); await D.db.sessions.where('status').equals('active').delete(); localStorage.removeItem('augment-timer');`,
);

// 4. mapa de fadiga: antebraço e sem traço solto
await send("Page.navigate", { url: URL + "#/progresso" });
await sleep(2500);
out.push(
  "fadiga: " +
    (await js(
      `const z=[...document.querySelectorAll('.fm-zone-list *')].some(e=>/Antebraço/i.test(e.textContent)); const before=getComputedStyle(document.querySelector('.fm-body'),'::before').display; const st=document.querySelector('.fm-status')?.innerText.replace(/\\s+/g,' '); return JSON.stringify({antebracoNaLista:z, tracoSolto:before, status:st});`,
    )),
);
await js(`document.querySelector('.fm-status')?.scrollIntoView({block:'start'})`);
await sleep(300);
await shot("3-fadiga");

// 5. adicionar ao programa pela página do exercício
await send("Page.navigate", { url: URL + "#/exercicios/db-Cable_Wrist_Curl" });
await sleep(2500);
out.push(
  "dia escolhido: " +
    (await js(
      `const c=[...document.querySelectorAll('.add-to-program .toggle-chip')]; const free=c.find(x=>!x.disabled); free?.click(); return free?.textContent`,
    )),
);
await sleep(300);
out.push("adicionar: " + (await js(click("/^Adicionar ao /"))));
await sleep(1200);
out.push(
  "no programa: " +
    (await js(
      `const D=await import('/src/lib/db.ts'); const st=await D.loadSettings(); const p=await D.db.programs.get(st.activeProgramId); return p.name+' / '+p.days.filter(d=>d.exercises.some(e=>e.lib==='db-Cable_Wrist_Curl')).map(d=>d.name+': '+d.exercises.find(e=>e.lib==='db-Cable_Wrist_Curl').muscles).join(', ')`,
    )),
);
await js(`document.querySelector('.add-to-program')?.scrollIntoView({block:'start'})`);
await sleep(300);
await shot("4-adicionar");

// 6. guia com atalhos para os exercícios
await send("Page.navigate", { url: URL + "#/guia" });
await sleep(2000);
out.push("guia atalhos: " + (await js(`return [...document.querySelectorAll('a.chip.go')].map(a=>a.textContent).slice(0,4).join(' | ')`)));

// 7. treinador sem chave
await send("Page.navigate", { url: URL + "#/treinador" });
await sleep(3000);
out.push(
  "treinador: " +
    (await js(
      `const h=[...document.querySelectorAll('h2')].find(x=>/Sem chave/i.test(x.textContent)); return h ? h.textContent + ' | botões: ' + [...h.parentElement.querySelectorAll('button')].map(b=>b.textContent+(b.disabled?'(off)':'')).join(', ') : 'não achou'`,
    )),
);
out.push(
  "documento: " +
    (await js(
      `const H=await import('/src/lib/coach/handoff.ts'); const D=await import('/src/lib/db.ts'); const s=await D.db.sessions.toArray(); const t=H.coachHandoffText({sessions:s, settings: await D.loadSettings(), today:'2026-11-09', bodyLog:[]}); return Math.round(t.length/1000)+' mil caracteres; '+(t.match(/## /g)||[]).length+' seções'`,
    )),
);
await shot("5-treinador");
console.log(out.join("\n"));
ws.close();
proc.kill();
process.exit(0);
