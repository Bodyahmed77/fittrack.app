import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { resolve } from "node:path";

export default defineConfig({
  root: resolve(process.cwd(), "web-demo"),
  plugins: [react()],
  base: "./",
  build: {
    outDir: resolve(process.cwd(), "dist-web-demo"),
    emptyOutDir: true,
    sourcemap: false,
    rollupOptions: {
      input: resolve(process.cwd(), "web-demo/index.html"),
    },
  },
});
