import type { CapacitorConfig } from "@capacitor/cli";

// APK Android (Capacitor): o mesmo app web, empacotado. Build: `npm run build:android` (gera dist com base "./" e
// copia para android/). O APK é montado pelo GitHub Actions (.github/workflows/android.yml).
const config: CapacitorConfig = {
  appId: "io.github.igordevexe.augment",
  appName: "AUGMENT",
  webDir: "dist",
  backgroundColor: "#0c0e11",
  android: {
    backgroundColor: "#0c0e11",
  },
  plugins: {
    // Tela de ponta a ponta: o CSS já usa env(safe-area-inset-*) com viewport-fit=cover; ícones claros na barra.
    SystemBars: {
      insetsHandling: "css",
      initialViewportFitValueHint: "cover",
      style: "DARK",
    },
  },
};

export default config;
