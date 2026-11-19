// Acha um navegador Chromium para rodar sem janela (Edge ou Chrome). BROWSER_PATH manda, se definido.
import { existsSync } from "node:fs";
import { execSync } from "node:child_process";

const CANDIDATES = [
  "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",
  "C:/Program Files/Microsoft/Edge/Application/msedge.exe",
  "C:/Program Files/Google/Chrome/Application/chrome.exe",
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  "/usr/bin/google-chrome",
  "/usr/bin/google-chrome-stable",
  "/usr/bin/chromium",
  "/usr/bin/chromium-browser",
];

export function browserPath() {
  if (process.env.BROWSER_PATH) return process.env.BROWSER_PATH;
  const found = CANDIDATES.find((p) => existsSync(p));
  if (found) return found;
  try {
    return execSync("which google-chrome || which chromium", { encoding: "utf8" }).trim().split("\n")[0];
  } catch {
    throw new Error("Não achei Edge nem Chrome. Defina BROWSER_PATH com o caminho do navegador.");
  }
}

/** Opções comuns do navegador sem janela (no CI do Linux o sandbox precisa sair). */
export function browserArgs(port, profileDir) {
  return [
    "--headless=new",
    `--remote-debugging-port=${port}`,
    `--user-data-dir=${profileDir}`,
    "--no-first-run",
    "--hide-scrollbars",
    // Extensões instaladas no aparelho (ex.: corretor ortográfico) entram até em perfil novo e pesam em cada toque.
    "--disable-extensions",
    "--disable-component-extensions-with-background-pages",
    ...(process.env.CI ? ["--no-sandbox", "--disable-gpu"] : []),
    "about:blank",
  ];
}

/**
 * Fecha o navegador inteiro pelo protocolo de depuração (Browser.close). No Windows o msedge.exe que a gente inicia
 * passa o trabalho a outro processo, então matar o processo (nem a árvore) não fecha nada: os filhos ficam vivos
 * rodando o app e, depois de algumas execuções, somam centenas e distorcem qualquer medição.
 */
export async function killBrowser(proc, port) {
  if (port) {
    try {
      const { webSocketDebuggerUrl } = await (await fetch(`http://127.0.0.1:${port}/json/version`)).json();
      const ws = new WebSocket(webSocketDebuggerUrl);
      await new Promise((res, rej) => ((ws.onopen = res), (ws.onerror = rej), setTimeout(rej, 2000)));
      ws.send(JSON.stringify({ id: 1, method: "Browser.close" }));
      await new Promise((res) => ((ws.onclose = res), setTimeout(res, 2000)));
    } catch {}
  }
  if (process.platform === "win32" && proc?.pid) {
    try {
      execSync(`taskkill /pid ${proc.pid} /T /F`, { stdio: "ignore" });
    } catch {}
  }
  try {
    proc?.kill();
  } catch {}
}
