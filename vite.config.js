import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

function fiftyFitReleaseCompatibility() {
  return {
    name: "fifty-fit-release-compatibility",
    enforce: "pre",
    transform(code, id) {
      if (!id.endsWith("/src/App.jsx")) return null;
      let out = code;

      // Keep legacy goal selections mapped to real built-in plan IDs.
      out = out.replace(/planId:\s*"fatloss"/g, 'planId: "four_day"');
      out = out.replace(/planId:\s*"hypertrophy"/g, 'planId: "five_day"');

      // A custom nutrition plan assigned by Admin is not a Play Billing entitlement.
      out = out.replace(
        '{pro ? (\n          <Card\n            onClick={() => go("nutritionPlan")}',
        '{pro && customNutritionPlan ? (\n          <Card\n            onClick={() => go("nutritionPlan")}',
      );

      // Free users keep current-month body-weight history; Pro keeps full history.
      out = out.replace(
        'const bw = normalizeBodyWeightEntries(data.bodyWeight);',
        'const bw = normalizeBodyWeightEntries(data.bodyWeight).filter((w) =>\n    data.entitlements.trainingPro || monthKey(w.date) === monthKey(today),\n  );',
      );
      out = out.replace(
        '() => normalizeBodyWeightEntries(data.bodyWeight),\n    [data.bodyWeight],',
        '() => normalizeBodyWeightEntries(data.bodyWeight).filter((w) =>\n      pro || monthKey(w.date) === monthKey(dateKey(0)),\n    ),\n    [data.bodyWeight, pro],',
      );

      // Workout day strip: rolling 7-day window, centered around today.
      out = out.replace(
        'const iso = addDays(mondayOf(dateKey(0)), i);',
        'const iso = addDays(dateKey(0), i - 3);',
      );
      out = out.replace(
        'const isToday = offset === 0;',
        'const isToday = iso === today;',
      );

      // Food picker: Capacitor Keyboard.resize=native already resizes the WebView.
      // Do not add the keyboard height a second time; pin the selected-food sheet
      // to the visible viewport bottom so it sits exactly above the IME.
      out = out.replace(
        'style={{ paddingBottom: selected ? "calc(200px + var(--ff-keyboard-height, 0px))" : 0 }}',
        'style={{ paddingBottom: selected ? 20 : 0 }}',
      );
      out = out.replace(
        'bottom: "var(--ff-keyboard-height, 0px)",',
        'bottom: 0,',
      );

      // TikTok: keep the user inside Fifty Fit. We use the native in-app WebView
      // activity so the normal/original configured URL never hands off to TikTok
      // or Chrome. The native activity upgrades it to the official embedded player.
      if (!out.includes('import { openTikTokWebView } from "./tiktokWebView";')) {
        const marker = 'import { deleteAccountServerData } from "./deleteAccount";';
        if (out.includes(marker)) {
          out = out.replace(marker, marker + '\nimport { openTikTokWebView } from "./tiktokWebView";', 1);
        }
      }
      out = out.replace(
        'const handleWatch = () => setOpen(true);',
        'const handleWatch = async () => {\n    if (isTikTok) {\n      try {\n        await openTikTokWebView(String(videoId));\n      } catch (error) {\n        console.error("[TikTok] in-app player failed", error);\n      }\n      return;\n    }\n    setOpen(true);\n  };',
      );

      // Never turn real Billing failures into preview purchases.
      out = out.replace(
        /const result = await billingPurchase\(planId, durationId\)\.catch\(\(\) => \(\{\n\s*success: false,\n\s*preview: true,\n\s*\}\)\);/,
        'const result = await billingPurchase(planId, durationId);',
      );

      return { code: out, map: null };
    },
  };
}

export default defineConfig({
  plugins: [fiftyFitReleaseCompatibility(), react()],
  base: "./",
  build: {
    outDir: "dist",
    modulePreload: false,
    rollupOptions: {
      external: ["capacitor-billing", "@capacitor-community/in-app-review"],
      output: {
        manualChunks: {
          react: ["react", "react-dom"],
          recharts: ["recharts"],
          lucide: ["lucide-react"],
          firebase: ["firebase/app", "firebase/auth", "firebase/firestore"],
        },
      },
    },
    chunkSizeWarningLimit: 900,
  },
});
