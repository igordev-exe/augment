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
    ...(process.env.CI ? ["--no-sandbox", "--disable-gpu"] : []),
    "about:blank",
  ];
}
