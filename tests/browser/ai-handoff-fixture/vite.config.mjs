import { fileURLToPath, URL } from "node:url";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
export default defineConfig({
  root: fileURLToPath(new URL("./", import.meta.url)), plugins: [react()],
  // Multiple QA fixtures can run together without invalidating each other's dependencies.
  cacheDir: fileURLToPath(new URL("../../../node_modules/.vite-ai-handoff", import.meta.url)),
  server: {host: "127.0.0.1", port: 4197, strictPort: true, fs: {allow: [fileURLToPath(new URL("../../../", import.meta.url))]}}
});
