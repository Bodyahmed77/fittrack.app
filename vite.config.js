import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  // Capacitor loads the app from the local filesystem inside the Android
  // WebView, so all asset paths must be relative, not absolute.
  base: "./",
  build: {
    outDir: "dist",
  },
});
