import { defineConfig } from "vite";

const base = process.env.VITE_BASE?.trim() || "./";

export default defineConfig({
  base,
  server: { host: true, port: 5173 },
  preview: { host: true, port: 4173 },
  build: { target: "es2022", chunkSizeWarningLimit: 2500 },
});
