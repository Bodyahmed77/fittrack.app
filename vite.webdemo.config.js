import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  base: "/fittrack.app/",
  plugins: [react()],
  build: {
    outDir: "dist-web-demo",
    emptyOutDir: true,
    rollupOptions: {
      input: "web-demo/index.html",
    },
  },
});
