import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig(({ mode }) => ({
  base: "/m/",
  plugins: [
    react(),
    VitePWA({
      registerType: "autoUpdate",
      includeAssets: ["favicon.svg"],
      manifest: {
        name: "ORBIS.ID Wallet",
        short_name: "ORBIS Wallet",
        description: "Self-Sovereign Identity Wallet",
        theme_color: "#0B1020",
        background_color: "#0B1020",
        display: "standalone",
        scope: "/m/",
        start_url: "/m/",
        icons: [
          { src: "/m/favicon.svg", sizes: "any", type: "image/svg+xml", purpose: "any maskable" },
          { src: "/m/icon-192.png", sizes: "192x192", type: "image/png" },
          { src: "/m/icon-512.png", sizes: "512x512", type: "image/png" },
        ],
      },
      workbox: {
        globPatterns: ["**/*.{js,css,html,svg,png,ico}"],
        runtimeCaching: [
          { urlPattern: /^https?:\/\/.*\/api\//, handler: "NetworkFirst", options: { cacheName: "api-cache", expiration: { maxEntries: 50, maxAgeSeconds: 300 } } },
        ],
      },
    }),
  ],
  resolve: {
    alias: { "~": "/src" },
  },
  build: {
    outDir: "dist",
    sourcemap: mode !== "production",
  },
  server: {
    port: 4001,
    proxy: { "/api": { target: "http://localhost:3001", changeOrigin: true } },
  },
}));