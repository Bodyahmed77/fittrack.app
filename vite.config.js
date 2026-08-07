import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  // Capacitor loads the app from the local filesystem inside the Android
  // WebView, so all asset paths must be relative, not absolute.
  base: "./",
  build: {
    outDir: "dist",
    // These native-only plugins are dynamically imported at runtime and are
    // not installed in the web build. Externalize them so Vite/Rollup does
    // not try to bundle them (they resolve at runtime on device).
    rollupOptions: {
      external: ["capacitor-billing", "@capacitor-community/in-app-review"],
      output: {
        // Code-split large third-party libs into separate cacheable chunks.
        // Keeps the initial bundle small and improves first-load performance
        // on mobile — each vendor chunk is loaded lazily as needed.
        manualChunks: {
          react: ["react", "react-dom"],
          recharts: ["recharts"],
          lucide: ["lucide-react"],
          firebase: ["firebase/app", "firebase/auth", "firebase/firestore"],
        },
      },
    },
    // Recharts & Firebase are intentionally large; raise the warning threshold
    // so the build stays clean while still splitting the biggest libraries.
    chunkSizeWarningLimit: 900,
  },
});
