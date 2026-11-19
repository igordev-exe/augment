// Fluidez: o que acontece nos quadros do meio de cada troca de tela (docs/prompt-fluidez.md, Fase 0).
// Mede no BUILD DE PRODUÇÃO (npm run build + npx vite preview, porta 4173), CPU 4× mais lenta, 390 px, com os dados de
// demonstração gravados direto no IndexedDB (o seed.js usa os módulos do Vite, que não existem no build).
//
// Por transição:
//   toque→pintura  ms do toque (pointerdown de verdade) até o 1º quadro pintado com a tela nova
//   tarefa longa   maior longtask do toque até 600 ms depois do 1º quadro (só Chromium)
//   deslocamento   soma de layout-shift nos 1.500 ms seguintes (só Chromium)
//   troca de imagem <img> que muda de src ou termina de carregar depois do 1º quadro da tela nova (fotos da rede,
//                  com data-net, contam à parte em `imgNet`: chegam quando chegam, com o espaço já reservado)
//   chegou depois  elementos inseridos na tela 2+ quadros depois do 1º (lista em `late`)
//   último bloco   ms até o último bloco de `.app > .stack-lg` dentro da tela ficar com opacidade 1
//   renders        quantas vezes o componente da tela renderizou até 1,5 s depois do 1º quadro (gancho do React DevTools:
//                  funciona no build de produção e não precisa de código no app)
//
// Uso: node tools/verify/flicker.mjs [url] [chromium|webkit] [rodadas]
//   FLICKER_BUDGET=1  sai com 1 se algum número passar do orçamento (Fase 6). FLICKER_CI=1: tempos com folga e só
//                     como aviso (variam com a máquina do CI); renders, imagem, deslocamento e "chegou depois" reprovam.
//   AUDIT_API=http://localhost:8787  entra na conta de teste e mede também Perfil e Amigos logados.
// Saída: tabela no terminal e JSON em tools/verify/out/flicker-<motor>.json (mediana das rodadas).
import { browserArgs, browserPath, killBrowser } from "./browser.mjs";
import { spawn } from "node:child_process";
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const [BASE = "http://localhost:4173", ENGINE = "chromium", RUNS_ARG = "3"] = process.argv.slice(2);
const RUNS = Math.max(1, Number(RUNS_ARG) || 3);
const API = process.env.AUDIT_API;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ---------- código que roda na página ----------

/** Antes do React carregar: gancho do DevTools que conta quando o componente da tela renderiza. */
const INIT = `
(() => {
  const commits = [];
  window.__flk = { commits, screenRenders: [] };
    const isComp = (f) => f && (f.tag === 0 || f.tag === 1 || f.tag === 11 || f.tag === 14 || f.tag === 15);
  window.__REACT_DEVTOOLS_GLOBAL_HOOK__ = {
    isDisabled: false,
    supportsFiber: true,
    renderers: new Map(),
    inject() { return 1; },
    checkDCE() {},
    onScheduleFiberRoot() {},
    onCommitFiberUnmount() {},
    onPostCommitFiberRoot() {},
    onCommitFiberRoot(_id, root) {
      const now = performance.now();
      commits.push(now);
      try {
        const host = document.querySelector("main.app > *");
        if (!host) return;
        const key = Object.keys(host).find((k) => k.startsWith("__reactFiber$"));
        let f = key && host[key];
        while (f && !isComp(f)) f = f.return;
        if (!f) return;
        // Cada render cria uma lista de hooks nova; sem render, a fibra herda a mesma. Conta as listas novas.
        const F = window.__flk;
        if (F.screen !== f && F.screen !== f.alternate) { F.screen = f; F.heads = new WeakSet(); }
        for (const x of [f, f.alternate]) {
          if (x && x.memoizedState && typeof x.memoizedState === "object" && !F.heads.has(x.memoizedState)) {
            F.heads.add(x.memoizedState);
            F.screenRenders.push(now);
          }
        }
      } catch {}
    },
  };
})();
`;

/** Arma os observadores; o motorista dá o toque logo depois. `hash`: troca de rota sem toque (sem link na tela). */
const ARM = (hash) => `
(() => {
  const S = (window.__flkRun = {
    t0: 0, first: 0, paint: 0, frames: 0, lastHidden: -1, firstAfterHidden: 0,
    lt: 0, cls: 0, imgSwaps: 0, imgNet: 0, late: [], shifts: [], done: false, longs: [],
  });
  const app = () => document.querySelector("main.app");
  const before = app() && app().firstElementChild;
  const lt = new PerformanceObserver((l) => l.getEntries().forEach((e) => S.longs.push([e.startTime, e.duration])));
  try { lt.observe({ type: "longtask", buffered: false }); } catch {}
  const ls = new PerformanceObserver((l) => l.getEntries().forEach((e) => { if (S.first && e.startTime >= S.first && e.startTime < S.first + 1500) {
          S.cls += e.value;
          (e.sources || []).forEach((src) =>
            S.shifts.push(
              (src.node && src.node.nodeType === 1 ? describe(src.node) : "?") +
                " " + Math.round(src.previousRect.y) + "→" + Math.round(src.currentRect.y) + " h" + Math.round(src.currentRect.height),
            ),
          );
        } }));
  try { ls.observe({ type: "layout-shift", buffered: false }); } catch {}
  const watch = new Set();
  const ready = (img) => img.complete && img.naturalWidth > 0;
  const describe = (n) => {
    const cls = (n.getAttribute && n.getAttribute("class")) || "";
    const owner = n.parentElement && n.parentElement.closest("[class]");
    return n.tagName.toLowerCase() + (cls ? "." + cls.trim().split(/\\s+/).slice(0, 2).join(".") : "") +
      (owner ? " em ." + (owner.getAttribute("class") || "").trim().split(/\\s+/)[0] : "");
  };
  const mo = new MutationObserver((list) => {
    if (!S.first) return;
    for (const m of list) {
      if (m.type === "attributes" && m.target.tagName === "IMG") { if (m.target.hasAttribute("data-net")) S.imgNet++; else S.imgSwaps++; continue; }
      if (m.type !== "childList") continue;
      for (const n of m.addedNodes) {
        if (n.nodeType !== 1) continue;
        if (S.frames >= 2) S.late.push(describe(n));
        const imgs = n.tagName === "IMG" ? [n] : [...n.querySelectorAll("img")];
        imgs.forEach((i) => { if (!ready(i)) watch.add(i); });
      }
    }
  });
  const onDown = (e) => { if (!S.t0) S.t0 = e.timeStamp; };
  addEventListener("pointerdown", onDown, true);
  addEventListener("mousedown", onDown, true);
  const tick = (now) => {
    if (S.done) return;
    const a = app();
    const cur = a && a.firstElementChild;
    if (!S.first && S.t0 && cur && cur !== before) {
      S.first = now;
      S.firstWhat = (cur.className || cur.tagName) + " " + location.hash;
      mo.observe(a, { childList: true, subtree: true, attributes: true, attributeFilter: ["src"] });
      a.querySelectorAll("img").forEach((i) => { if (!ready(i)) watch.add(i); });
      const ch = new MessageChannel();
      ch.port1.onmessage = () => { S.paint = performance.now(); };
      ch.port2.postMessage(0);
    }
    if (S.first) {
      S.frames++;
      for (const i of [...watch]) if (ready(i)) {
        watch.delete(i);
        // Foto da rede (data-net) chega quando chega: o espaço já está reservado. Conta à parte.
        if (S.frames > 1) i.hasAttribute("data-net") ? S.imgNet++ : S.imgSwaps++;
      }
    }
    // Visibilidade dos blocos: só nos quadros depois da 1ª pintura da tela nova (antes dela nada aparece mesmo).
    if (S.paint && a) {
      const blocks = [...a.querySelectorAll(":scope > .stack-lg > *")].filter((b) => {
        const r = b.getBoundingClientRect();
        return r.top < innerHeight && r.bottom > 0 && r.height > 0;
      });
      const root = a.querySelector(":scope > .stack-lg");
      const hidden = (root && parseFloat(getComputedStyle(root).opacity) < 0.99) || blocks.some((b) => {
        if (parseFloat(getComputedStyle(b).opacity) < 0.99) return true;
        return [...b.children].some((c) => {
          const r = c.getBoundingClientRect();
          return r.top < innerHeight && r.height > 0 && parseFloat(getComputedStyle(c).opacity) < 0.99;
        });
      });
      if (hidden) { S.lastHidden = now; S.firstAfterHidden = 0; }
      else if (!S.firstAfterHidden) S.firstAfterHidden = now;
    }
    requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
  S.stop = () => {
    S.done = true; mo.disconnect(); lt.disconnect(); ls.disconnect();
    removeEventListener("pointerdown", onDown, true); removeEventListener("mousedown", onDown, true);
  };
  ${hash ? `S.t0 = performance.now(); location.hash = ${JSON.stringify(hash)};` : ""}
  return true;
})()
`;

const COLLECT = `
(async () => {
  const S = window.__flkRun;
  // Espera a tela nova pintar (com a CPU lenta pode passar de 4 s) e mais 1,5 s de quadros depois dela.
  const t = performance.now();
  while (performance.now() - t < 15000 && !(S.paint && performance.now() > S.paint + 1500)) await new Promise((r) => setTimeout(r, 100));
  S.stop();
  const t0 = S.t0;
  // Maior tarefa longa entre o toque e 600 ms depois do 1º quadro da tela nova.
  const lt = Math.max(0, ...S.longs.filter(([s]) => s >= t0 - 5 && s < (S.first || t0) + 600).map(([, d]) => d));
  // Janela de 1,5 s a partir do 1º quadro da tela nova: pega o 2º render que chega quando a consulta ao banco volta.
  const end = (S.first || t0) + 1500;
  const renders = window.__flk.screenRenders.filter((t) => t >= t0 && t < end).length;
  const commits = window.__flk.commits.filter((t) => t >= t0 && t < end).length;
  const lastBlock = S.paint ? Math.round(Math.max(S.paint, S.firstAfterHidden || 0) - t0) : null;
  return {
    hash: location.hash,
    firstWhat: S.firstWhat,
    t0: Math.round(t0),
    first: Math.round(S.first),
    tapToPaint: S.paint ? Math.round(S.paint - t0) : null,
    longTask: Math.round(lt),
    cls: Math.round(S.cls * 1000) / 1000,
    imgSwaps: S.imgSwaps,
    imgNet: S.imgNet,
    late: S.late.length,
    lateList: [...new Set(S.late)].slice(0, 8),
    shiftList: [...new Set(S.shifts)].slice(0, 6),
    lastBlock,
    renders,
    commits,
    libItems: location.hash === "#/exercicios" ? document.querySelectorAll('main.app a[href^="#/exercicios/"]').length : undefined,
  };
})()
`;

/** Espera a tela assentar: 12 quadros seguidos com menos de 60 ms entre eles (a CPU lenta monta devagar). */
const SETTLE = `
(async () => {
  const t = performance.now();
  let ok = 0, last = 0;
  while (ok < 12 && performance.now() - t < 15000) {
    const now = await new Promise((r) => requestAnimationFrame(r));
    ok = last && now - last < 60 ? ok + 1 : 0;
    last = now;
  }
  return Math.round(performance.now() - t);
})()
`;

/** Centro do alvo do toque (rolando até ele). null = não achou. */
const TARGET = (sel, text) => `
(() => {
  const all = [...document.querySelectorAll(${JSON.stringify(sel)})];
  const re = ${text ? `new RegExp(${JSON.stringify(text)}, "i")` : "null"};
  const el = all.find((e) => !re || re.test(e.textContent || ""));
  if (!el) return null;
  el.scrollIntoView({ block: "center" });
  const r = el.getBoundingClientRect();
  return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
})()
`;

/** Dados de demonstração no IndexedDB, sem os módulos do Vite (mesma geração do seed.js). */
const SEED = `
(async () => {
  localStorage.clear();
  const db = await new Promise((res, rej) => { const r = indexedDB.open("augment"); r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); });
  const req = (r) => new Promise((res, rej) => { r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); });
  const t = db.transaction(["kv", "programs"], "readonly");
  const settings = (await req(t.objectStore("kv").get("settings")))?.value ?? {};
  const programs = await req(t.objectStore("programs").getAll());
  const prog = programs.find((p) => p.id === settings.activeProgramId) ?? programs[0];
  const days = prog.days;
  let seed = 7;
  const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  const sessions = [];
  const start = new Date("2026-09-21T12:00:00");
  let k = 0;
  for (let d = new Date(start); d < new Date("2026-11-05T12:00:00"); d.setDate(d.getDate() + 1)) {
    const wd = d.getDay();
    if (wd === 0 || wd === 6) continue;
    if (rnd() < 0.12) continue;
    const day = days[k % days.length];
    k++;
    const iso = d.toISOString().slice(0, 10);
    const wk = Math.floor((d - start) / (7 * 864e5)) + 1;
    sessions.push({
      id: "demo" + iso, dayId: day.id, date: iso, week: Math.min(wk, 7), status: "done",
      startedAt: +d, finishedAt: +d + 3600e3, day,
      checkin: { sleep: ["ruim", "ok", "bom"][k % 3], energy: "ok", pain: "nenhuma" },
      exercises: day.exercises.map((ex, i) => ({
        exId: ex.id, unit: "kg", snap: ex, feedback: { pump: "bom", volume: "ok", joint: "ok" },
        sets: Array.from({ length: 3 }, (_, j) => ({
          id: "s" + iso + i + j, kind: "work", weight: 40 + i * 7.5 + wk * 2.5, reps: 8 + ((j + wk) % 4), done: true, rir: (j + i) % 5,
        })),
      })),
    });
  }
  const body = [];
  for (let i = 0; i < 60; i++) {
    const d = new Date("2026-09-05T12:00:00");
    d.setDate(d.getDate() + i);
    body.push({ id: "b" + i, date: d.toISOString().slice(0, 10), weightKg: +(95.5 - i * 0.05 + Math.sin(i) * 0.4).toFixed(1) });
  }
  const w = db.transaction(["kv", "sessions"], "readwrite");
  w.objectStore("sessions").clear();
  sessions.forEach((s) => w.objectStore("sessions").put(s));
  w.objectStore("kv").put({ key: "body-log", value: body });
  w.objectStore("kv").put({ key: "settings", value: { ...settings, mesoStart: "2026-09-21", onboarded: true,
    bodyGoal: { mode: "perder", targetKg: 86 }, lastBackupAt: "2026-10-10", backupDismissed: undefined, reportSeen: undefined } });
  await new Promise((res, rej) => { w.oncomplete = res; w.onerror = () => rej(w.error); });
  db.close();
  return sessions.length;
})()
`;

/** Entra na conta de teste pela API, gravando o estado "online" direto no kv (sem os módulos do Vite). */
const LOGIN = (api) => `
(async () => {
  const post = (p, b, token) => fetch(${JSON.stringify(api)} + p, { method: "POST", headers: { "Content-Type": "application/json", ...(token ? { Authorization: "Bearer " + token } : {}) }, body: JSON.stringify(b) }).then((r) => r.json());
  let r = await post("/auth/login", { username: "auditoria", password: "senha-teste-123" });
  if (!r.token) r = await post("/auth/register", { username: "auditoria", password: "senha-teste-123", displayName: "Auditoria", sharePercentiles: true, shareActivity: true });
  if (!r.token) return "falhou";
  // Dois amigos do seed-server.mjs (eles aceitam) para Amigos ter feed, ranking e comparação.
  for (const name of ["lara1", "joana3"]) {
    await post("/friends/request", { username: name }, r.token).catch(() => {});
    const other = await post("/auth/login", { username: name, password: "senha-teste-123" }).catch(() => ({}));
    if (other.token) await post("/friends/accept", { userId: r.user.id }, other.token).catch(() => {});
  }
  localStorage.setItem("augment-api-url", ${JSON.stringify(api)});
  localStorage.setItem("augment-online-token", r.token);
  const db = await new Promise((res) => { const q = indexedDB.open("augment"); q.onsuccess = () => res(q.result); });
  const w = db.transaction(["kv"], "readwrite");
  w.objectStore("kv").put({ key: "online", value: { user: r.user } });
  await new Promise((res) => (w.oncomplete = res));
  db.close();
  return r.user.username;
})()
`;

// ---------- transições ----------

/** De onde sai, o que tocar (seletor + texto) e, sem alvo, a rota por hash. */
const TABS = [
  ["/", "/historico"],
  ["/historico", "/progresso"],
  ["/progresso", "/exercicios"],
  ["/exercicios", "/perfil"],
  ["/perfil", "/exercicios"],
  ["/exercicios", "/progresso"],
  ["/progresso", "/historico"],
  ["/historico", "/"],
];
const ALL_TRANSITIONS = [
  ...TABS.map(([from, to]) => ({ name: `${from} → ${to}`, from, sel: `nav a[href="#${to}"]` })),
  { name: "/exercicios → detalhe", from: "/exercicios", sel: 'main.app a[href^="#/exercicios/"]' },
  { name: "/progresso → /relatorio", from: "/progresso", sel: 'main.app a[href="#/relatorio"]' },
  { name: "/ → /ajustes", from: "/", sel: 'main.app a[href="#/ajustes"]' },
  { name: "/ → /treinador", from: "/", sel: 'main.app a[href="#/treinador"]' },
  ...(API ? [{ name: "/perfil → /amigos", from: "/perfil", sel: 'main.app a[href="#/amigos"]', hash: "/amigos" }] : []),
  // Por último: cria o treino do dia (grava no banco).
  // 2 renders: ao abrir, o treino grava a 1ª fala do núcleo (liveLog) e a tela recebe o treino atualizado.
  { name: "/ → treino", from: "/", sel: "main.app .btn-dock button", budget: { renders: 2 } },
];

// FLICKER_ONLY=progresso mede só as transições cujo nome contém o texto.
const TRANSITIONS = process.env.FLICKER_ONLY ? ALL_TRANSITIONS.filter((t) => t.name.includes(process.env.FLICKER_ONLY)) : ALL_TRANSITIONS;

// ---------- motoristas ----------

async function chromium() {
  const port = 9391 + Math.floor(Math.random() * 400);
  const proc = spawn(browserPath(), browserArgs(port, mkdtempSync(join(tmpdir(), "aug-flicker-"))), { stdio: "ignore" });
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
  const evaluate = async (expr) => {
    const r = await send("Runtime.evaluate", { expression: expr, awaitPromise: true, returnByValue: true });
    if (r.result?.exceptionDetails) console.error("JS", r.result.exceptionDetails.exception?.description?.slice(0, 300));
    return r.result?.result?.value;
  };
  await send("Page.enable");
  await send("Page.addScriptToEvaluateOnNewDocument", { source: INIT });
  await send("Emulation.setDeviceMetricsOverride", { width: 390, height: 844, deviceScaleFactor: 2, mobile: true });
  await send("Page.bringToFront");
  await send("Emulation.setFocusEmulationEnabled", { enabled: true });
  return {
    evaluate,
    goto: (url) => send("Page.navigate", { url }),
    reload: () => send("Page.reload"),
    throttle: (rate) => send("Emulation.setCPUThrottlingRate", { rate }),
    tap: async (x, y) => {
      await send("Input.dispatchMouseEvent", { type: "mouseMoved", x, y });
      await send("Input.dispatchMouseEvent", { type: "mousePressed", x, y, button: "left", clickCount: 1 });
      await send("Input.dispatchMouseEvent", { type: "mouseReleased", x, y, button: "left", clickCount: 1 });
    },
    close: async () => {
      ws.close();
      await killBrowser(proc, port);
    },
  };
}

async function webkitDriver() {
  const { webkit, devices } = await import("playwright");
  const browser = await webkit.launch();
  const ctx = await browser.newContext({ ...devices["iPhone 13"], hasTouch: false, isMobile: false });
  const page = await ctx.newPage();
  await page.addInitScript(INIT);
  return {
    evaluate: (expr) => page.evaluate(expr),
    goto: (url) => page.goto(url),
    reload: () => page.reload(),
    throttle: async () => {},
    tap: (x, y) => page.mouse.click(x, y),
    close: () => browser.close(),
  };
}

// ---------- rodada ----------

async function runOnce() {
  const d = ENGINE === "webkit" ? await webkitDriver() : await chromium();
  await d.goto(BASE + "/#/");
  await sleep(4500);
  const n = await d.evaluate(SEED);
  if (API) console.log("  conta:", await d.evaluate(LOGIN(API)));
  await d.reload();
  // O boot completo (~3,6 s) cobre a 1ª abertura do dia.
  await sleep(6000);
  await d.throttle(4);
  const out = {};
  for (const t of TRANSITIONS) {
    await d.evaluate(`location.hash = ${JSON.stringify(t.from)}`);
    await sleep(300);
    await d.evaluate(SETTLE);
    const pos = await d.evaluate(TARGET(t.sel, t.text));
    await sleep(250);
    if (!pos && !t.hash) {
      out[t.name] = { missing: true };
      continue;
    }
    await d.evaluate(ARM(pos ? null : t.hash));
    if (pos) {
      // O scrollIntoView pode ter mexido: lê de novo a posição, já sem rolar.
      const again = (await d.evaluate(TARGET(t.sel, t.text))) ?? pos;
      await d.tap(again.x, again.y);
    }
    out[t.name] = await d.evaluate(COLLECT);
    await sleep(300);
  }
  await d.throttle(1);
  await d.close();
  return { sessions: n, out };
}

const runs = [];
for (let i = 0; i < RUNS; i++) {
  console.log(`rodada ${i + 1}/${RUNS} (${ENGINE})…`);
  runs.push(await runOnce());
  await sleep(500);
}

const med = (xs) => {
  const v = xs.filter((x) => typeof x === "number").sort((a, b) => a - b);
  return v.length ? v[Math.floor((v.length - 1) / 2)] : null;
};
const KEYS = ["tapToPaint", "longTask", "cls", "imgSwaps", "imgNet", "late", "lastBlock", "renders", "commits"];
const table = {};
for (const t of TRANSITIONS) {
  const rs = runs.map((r) => r.out[t.name]).filter((x) => x && !x.missing);
  if (!rs.length) {
    table[t.name] = { missing: true };
    continue;
  }
  const row = {};
  for (const k of KEYS) row[k] = med(rs.map((r) => r[k]));
  row.lateList = [...new Set(rs.flatMap((r) => r.lateList))].slice(0, 8);
  if (rs[0].libItems != null) row.libItems = rs[0].libItems;
  table[t.name] = row;
}

const ci = !!process.env.FLICKER_CI;
const BUDGET = {
  tapToPaint: ci ? 200 : 100,
  longTask: ci ? 100 : 50,
  cls: 0.01,
  imgSwaps: 0,
  late: 0,
  lastBlock: 150,
  renders: 1,
};
const pad = (s, n) => String(s ?? "—").padStart(n);
console.log(
  `\n${"transição".padEnd(26)}${pad("toque→pint", 11)}${pad("t.longa", 8)}${pad("desloc", 8)}${pad("img", 5)}${pad("depois", 7)}${pad("últ.bloco", 10)}${pad("renders", 8)}`,
);
const over = [];
const warn = [];
const TIMES = ["tapToPaint", "longTask", "lastBlock"];
for (const [name, r] of Object.entries(table)) {
  if (r.missing) {
    console.log(`${name.padEnd(26)} (alvo não achado)`);
    continue;
  }
  const flag = (k) => {
    if (r[k] == null) return "";
    if (ENGINE === "webkit" && (k === "longTask" || k === "cls")) return "";
    const limit = TRANSITIONS.find((t) => t.name === name)?.budget?.[k] ?? BUDGET[k];
    if (r[k] > limit) {
      // No CI, os tempos (que dependem da máquina) só avisam; o que é estrutural (renders, imagem, deslocamento,
      // elemento que chega depois) reprova.
      if (ci && TIMES.includes(k)) {
        warn.push(`${name}: ${k} ${r[k]} > ${limit}`);
        return "~";
      }
      over.push(`${name}: ${k} ${r[k]} > ${limit}`);
      return "*";
    }
    return "";
  };
  console.log(
    `${name.padEnd(26)}${pad(r.tapToPaint + flag("tapToPaint"), 11)}${pad(r.longTask + flag("longTask"), 8)}${pad(r.cls + flag("cls"), 8)}${pad(r.imgSwaps + flag("imgSwaps"), 5)}${pad(r.late + flag("late"), 7)}${pad(r.lastBlock + flag("lastBlock"), 10)}${pad(r.renders + flag("renders"), 8)}` +
      (r.lateList.length ? `  ← ${r.lateList.slice(0, 3).join(" | ")}` : "") +
      (r.imgNet ? `  [${r.imgNet} fotos da rede]` : "") +
      (r.libItems != null ? `  [${r.libItems} itens na lista]` : ""),
  );
}
mkdirSync(join(here, "out"), { recursive: true });
const file = join(here, "out", `flicker-${ENGINE}.json`);
writeFileSync(file, JSON.stringify({ base: BASE, engine: ENGINE, runs: RUNS, table, raw: runs }, null, 2));
console.log(
  `\n${over.length ? `${over.length} acima do orçamento (*).` : "Tudo dentro do orçamento."}` +
    (warn.length ? ` ${warn.length} tempos acima do alvo (~: no CI, só aviso).` : "") +
    ` JSON: ${file}`,
);
if (process.env.FLICKER_BUDGET && over.length) {
  over.forEach((o) => console.log("  " + o));
  process.exit(1);
}
