import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";

// PWA config: installable, standalone/fullscreen, offline-capable.
// Icon + colors are placeholders themed to the app (gold on dark navy) — easy to swap.
export default defineConfig({
  // Served from GitHub Pages at https://dhruvc0110.github.io/Optionality/
  base: "/Optionality/",
  plugins: [
    react(),
    VitePWA({
      registerType: "autoUpdate",
      injectRegister: "auto",
      includeAssets: ["icon.svg"],
      manifest: {
        name: "Moolah — Options, demystified",
        short_name: "Moolah",
        description:
          "Construct, monitor, and understand a risk-hedged options portfolio.",
        display: "standalone",
        display_override: ["fullscreen", "standalone"],
        orientation: "portrait",
        background_color: "#080b11",
        theme_color: "#080b11",
        start_url: "/Optionality/",
        scope: "/Optionality/",
        icons: [
          {
            src: "icon.svg",
            sizes: "any",
            type: "image/svg+xml",
            purpose: "any",
          },
          {
            src: "icon.svg",
            sizes: "any",
            type: "image/svg+xml",
            purpose: "maskable",
          },
        ],
      },
      workbox: {
        globPatterns: ["**/*.{js,css,html,svg,woff2}"],
      },
    }),
  ],
});
