import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: "autoUpdate",
      includeAssets: ["kivo-logo.png", "kivo-icon.svg"],
      manifest: {
        name: "Kivo",
        short_name: "Kivo",
        description: "AI study guides, smart study and tests from your notes",
        start_url: "/",
        scope: "/",
        display: "standalone",
        orientation: "portrait",
        background_color: "#f5f7ff",
        theme_color: "#7c3aed",
        icons: [
          { src: "/kivo-icon.svg", sizes: "any", type: "image/svg+xml", purpose: "any" },
          { src: "/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
          { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
          { src: "/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" }
        ]
      },
      workbox: {
        navigateFallback: "/index.html",
        globPatterns: ["**/*.{js,css,html,svg,png,ico,woff,woff2}"],
        runtimeCaching: [{
          urlPattern: ({ url }) => url.pathname.startsWith("/api/"),
          handler: "NetworkOnly"
        }]
      }
    })
  ],
  server: {
    port: 5173,
    proxy: { "/api": "http://localhost:4000", "/uploads": "http://localhost:4000" }
  }
});
