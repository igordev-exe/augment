import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
// Fontes empacotadas com o app: funcionam offline na academia.
import "@fontsource/orbitron/latin-600.css";
import "@fontsource/orbitron/latin-800.css";
import "@fontsource/orbitron/latin-900.css";
import "@fontsource/share-tech-mono/latin-400.css";
import "@fontsource/exo-2/latin-400.css";
import "@fontsource/exo-2/latin-500.css";
import "@fontsource/exo-2/latin-600.css";
import "@fontsource/exo-2/latin-700.css";
// augmented-ui: cantos chanfrados com borda (biblioteca cyberpunk de CSS, BSD-2).
import "augmented-ui/augmented-ui.min.css";
import "./styles.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

// Service worker: deixa o app funcionando offline e instalável.
if ("serviceWorker" in navigator && import.meta.env.PROD) {
  import("virtual:pwa-register")
    .then(({ registerSW }) => registerSW({ immediate: true }))
    .catch(() => {
      /* ambiente sem SW (ex.: prévia): segue sem */
    });
}

// Pede ao navegador para não apagar os dados do IndexedDB por falta de espaço.
navigator.storage?.persist?.().catch(() => {});
