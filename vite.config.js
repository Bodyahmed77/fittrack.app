import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

function cardioScreenPlugin() {
  return {
    name: "fifty-fit-cardio-screen",
    enforce: "pre",
    transform(code, id) {
      if (!id.endsWith("/src/App.jsx") || code.includes("./cardioTimer")) return null;

      const importLine = 'import { CARDIO_IDS, CardioExerciseView } from "./cardioTimer";\n';
      const transformed = code.replace(
        'import React, {',
        importLine + 'import React, {',
      );

      const needle = '  // Persist sets against the calendar date of the selected strip day so\n';
      const branch = `  if (CARDIO_IDS.has(ex.id)) {\n    return (\n      <CardioExerciseView\n        data={data}\n        setData={setData}\n        back={back}\n        exerciseId={exerciseId}\n        logDate={logDate}\n        ex={ex}\n        ar={ar}\n        C={C}\n        showToast={showToast}\n        awardXp={awardXp}\n        TopBar={TopBar}\n        Card={Card}\n        GreenButton={GreenButton}\n      />\n    );\n  }\n\n`;

      if (!transformed.includes(needle)) {
        throw new Error("Fifty Fit cardio transform: ExerciseScreen insertion point not found");
      }

      return {
        code: transformed.replace(needle, branch + needle),
        map: null,
      };
    },
  };
}

export default defineConfig({
  plugins: [react(), cardioScreenPlugin()],
  // Capacitor loads the app from the local filesystem inside the Android
  // WebView, so all asset paths must be relative, not absolute.
  base: "./",
  build: {
    outDir: "dist",
    modulePreload: false,
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
