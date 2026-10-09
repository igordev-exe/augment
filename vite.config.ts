import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";

// BASE: "/<nome-do-repo>/" no GitHub Pages. O workflow define VITE_BASE automaticamente.
const base = process.env.VITE_BASE ?? "/";

export default defineConfig({
  base,
  plugins: [
    react(),
    VitePWA({
      registerType: "autoUpdate",
      includeAssets: ["icon.svg", "apple-touch-icon.png"],
      manifest: {
        name: "AUGMENT",
        short_name: "AUGMENT",
        description: "Protocolo de hipertrofia: ficha, cargas, timer, histórico, recordes e guia científico.",
        lang: "pt-BR",
        theme_color: "#0c0e11",
        background_color: "#0c0e11",
        display: "standalone",
        orientation: "portrait",
        start_url: base,
        scope: base,
        icons: [
          { src: "icon-192.png", sizes: "192x192", type: "image/png" },
          { src: "icon-512.png", sizes: "512x512", type: "image/png" },
          { src: "icon-512-maskable.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
        ],
      },
      workbox: {
        globPatterns: ["**/*.{js,css,html,svg,png,webp,woff,woff2}"],
      },
    }),
  ],
  test: {
    environment: "node",
  },
});
