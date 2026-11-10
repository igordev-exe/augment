// Mede, nos pixels da captura, a folga entre a borda direita da etiqueta do banner e o capacete do robô.
// Para cada largura e cada texto possível da etiqueta: grava a captura e a caixa da etiqueta (px de tela).
import { browserArgs, browserPath } from "./browser.mjs";
import { spawn } from "node:child_process";
import { mkdtempSync, writeFileSync, mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const [URL, OUT] = process.argv.slice(2);
mkdirSync(OUT, { recursive: true });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const WIDTHS = [
  [320, 568, 2],
  [360, 740, 3],
  [375, 812, 3],
  [393, 873, 2.75],
  [412, 915, 2.625],
  [430, 932, 3],
  [820, 1180, 2],
];
const TAGS = ["Missão do dia", "Descanso hoje", "Próxima missão", "Missão trocada", "ANTIGA: Descanso hoje<br>Próx. seg, 9 nov"];

const port = 9391;
const proc = spawn(browserPath(), browserArgs(port, mkdtempSync(join(tmpdir(), "aug-tag-"))), { stdio: "ignore" });
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
const js = async (expr) =>
  (await send("Runtime.evaluate", { expression: `(async()=>{${expr}})()`, awaitPromise: true, returnByValue: true })).result?.result?.value;

const rows = [];
for (const [w, h, dpr] of WIDTHS) {
  await send("Emulation.setDeviceMetricsOverride", { width: w, height: h, deviceScaleFactor: dpr, mobile: w < 700 });
  await send("Page.navigate", { url: URL });
  await sleep(3000);
  for (const tag of TAGS) {
    const box = await js(`
      document.getAnimations().forEach(a=>{try{a.finish()}catch{}});
      const card=document.querySelector('.mission'); card.scrollIntoView({block:'start'}); scrollTo(0, scrollY-8);
      const t=card.querySelector('.mission-tag'); t.innerHTML=${JSON.stringify(tag.replace("ANTIGA: ", ""))};
      await new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)));
      const r=t.getBoundingClientRect(), c=card.getBoundingClientRect();
      return {top:r.top, bottom:r.bottom, right:r.right, cardRight:c.right, cardW:c.width};`);
    const file = `${w}-${TAGS.indexOf(tag)}.png`;
    const shot = await send("Page.captureScreenshot", { format: "png" });
    writeFileSync(join(OUT, file), Buffer.from(shot.result.data, "base64"));
    rows.push({ w, dpr, tag, file, ...box });
  }
}
writeFileSync(join(OUT, "boxes.json"), JSON.stringify(rows));
console.log("ok", rows.length);
ws.close();
proc.kill();
process.exit(0);
