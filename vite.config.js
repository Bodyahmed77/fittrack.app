import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

function fiftyFitHardeningPlugin() {
  return {
    name: "fifty-fit-hardening",
    enforce: "pre",
    transform(code, id) {
      if (!id.endsWith("/src/App.jsx")) return null;

      let out = code;

      const requirePatch = (condition, label) => {
        if (!condition) {
          throw new Error(`Fifty Fit source hardening patch target not found: ${label}`);
        }
      };

      // Goal IDs must point at real built-in plan IDs. The old values
      // fatloss/hypertrophy did not exist in PLAN_TEMPLATES, so selecting those
      // goals could silently fall back to the free beginner plan.
      out = out.replace('planId: "fatloss",', 'planId: "four_day",');
      out = out.replace('planId: "hypertrophy",', 'planId: "five_day",');
      requirePatch(
        out.includes('planId: "four_day",') && out.includes('planId: "five_day",'),
        "goal plan IDs",
      );

      // Remove the fragile bare global lookup for Paywall plan IDs by defining
      // the catalog in the module scope. The legacy index.html global may still
      // exist for old previews, but the app source no longer depends on it.
      if (!out.includes('const planIds = ["training", "nutrition", "both", "ai"];')) {
        const marker = "function PaywallScreen(";
        requirePatch(out.includes(marker), "PaywallScreen declaration");
        out = out.replace(
          marker,
          'const planIds = ["training", "nutrition", "both", "ai"];\n\n' + marker,
        );
      }

      // Nutrition Pro can legitimately exist before an admin-created
      // customNutritionPlan is available. Guard that card before reading
      // startDate/days from null. The following `pro && plan` branch can then
      // continue to handle the legacy/local nutritionPlan shape.
      const nutritionBranch = `{pro ? (\n          <Card\n            onClick={() => go("nutritionPlan")}`;
      const guardedNutritionBranch = `{pro && customNutritionPlan ? (\n          <Card\n            onClick={() => go("nutritionPlan")}`;
      if (out.includes(nutritionBranch)) {
        out = out.replace(nutritionBranch, guardedNutritionBranch);
      }
      requirePatch(
        out.includes("{pro && customNutritionPlan ? ("),
        "Nutrition Pro null guard",
      );

      // The free tier intentionally gets four built-in exercises; custom
      // exercises added by the user stay available and are NOT counted toward
      // that four-exercise built-in allowance.
      const exerciseHelperStart = out.indexOf("function getUsableExercises");
      const sharedUiStart = out.indexOf("/* ============================== SHARED UI", exerciseHelperStart);
      requirePatch(exerciseHelperStart >= 0 && sharedUiStart > exerciseHelperStart, "exercise entitlement helper");
      const helperSegment = out.slice(exerciseHelperStart, sharedUiStart);
      requirePatch(
        helperSegment.includes("return { list: [...freeBase, ...customAdded], lockedCount }"),
        "custom exercise allowance",
      );

      // Free history is limited to the current month. Pro keeps the complete
      // body-weight history. Multiple weight entries on the same day remain
      // intact for both tiers.
      const homeStart = out.indexOf("function HomeScreen(");
      const homeEnd = out.indexOf("function greeting(", homeStart);
      requirePatch(homeStart >= 0 && homeEnd > homeStart, "HomeScreen body");
      let homeSegment = out.slice(homeStart, homeEnd);
      homeSegment = homeSegment.replace(
        "const bw = normalizeBodyWeightEntries(data.bodyWeight);",
        "const bw = normalizeBodyWeightEntries(data.bodyWeight).filter((w) =>\n    data.entitlements.trainingPro || monthKey(w.date) === monthKey(today),\n  );",
      );
      requirePatch(
        homeSegment.includes("data.entitlements.trainingPro || monthKey(w.date) === monthKey(today)"),
        "HomeScreen free body-weight history gate",
      );
      out = out.slice(0, homeStart) + homeSegment + out.slice(homeEnd);

      const bodyWeightStart = out.indexOf("function BodyWeightScreen(");
      const mealsStart = out.indexOf("/* ============================== MEALS SCREEN", bodyWeightStart);
      requirePatch(bodyWeightStart >= 0 && mealsStart > bodyWeightStart, "BodyWeightScreen body");
      let bodyWeightSegment = out.slice(bodyWeightStart, mealsStart);
      bodyWeightSegment = bodyWeightSegment.replace(
        "() => normalizeBodyWeightEntries(data.bodyWeight),\n    [data.bodyWeight],",
        "() => normalizeBodyWeightEntries(data.bodyWeight).filter((w) =>\n      pro || monthKey(w.date) === monthKey(dateKey(0)),\n    ),\n    [data.bodyWeight, pro],",
      );
      requirePatch(
        bodyWeightSegment.includes("pro || monthKey(w.date) === monthKey(dateKey(0))"),
        "BodyWeightScreen free history gate",
      );
      out = out.slice(0, bodyWeightStart) + bodyWeightSegment + out.slice(mealsStart);

      // TikTok numeric IDs and full TikTok video URLs must use the official
      // player URL inside the WebView, never the raw URL/ID in an iframe.
      const videoStart = out.indexOf("function FullScreenVideoViewer");
      const exerciseVisualStart = out.indexOf("/* ============================== EXERCISE VISUAL", videoStart);
      requirePatch(videoStart >= 0 && exerciseVisualStart > videoStart, "video player section");
      let videoSegment = out.slice(videoStart, exerciseVisualStart);
      videoSegment = videoSegment.replace(
        "const embedSrc = isTikTok\n    ? String(videoId || \"\")\n    : `https://www.youtube-nocookie.com/embed/${videoId}?autoplay=1&playsinline=1&rel=0&modestbranding=1`;",
        "const tikTokId = extractTikTokVideoId(videoId);\n  const embedSrc = isTikTok && tikTokId\n    ? `https://www.tiktok.com/player/v1/${tikTokId}?controls=1&autoplay=1&playsinline=1&description=0&music_info=0`\n    : isTikTok\n    ? String(videoId || \"\")\n    : `https://www.youtube-nocookie.com/embed/${videoId}?autoplay=1&playsinline=1&rel=0&modestbranding=1`;",
      );
      videoSegment = videoSegment.replace(
        'const isTikTok = /^\\d+$/.test(videoId);',
        'const isTikTok = /tiktok\\.com/i.test(String(videoId || "")) || /^\\d+$/.test(String(videoId || ""));',
      );
      requirePatch(
        videoSegment.includes("https://www.tiktok.com/player/v1/${tikTokId}"),
        "TikTok official player URL",
      );
      out = out.slice(0, videoStart) + videoSegment + out.slice(exerciseVisualStart);

      // Keep native Android keyboard resize as the single source of truth. The
      // AI drawer already uses the WebView resize behavior; avoid stale manual
      // bottom insets from legacy listeners.
      out = out.replace(
        /const \[keyboardInset, setKeyboardInset\] = useState\([^)]*\);/,
        'const [keyboardInset, setKeyboardInset] = useState(0);',
      );

      // Do not turn real Google Play billing errors into fake preview purchases.
      // The billing wrapper already distinguishes preview/web from native errors.
      out = out.replace(
        /const result = await billingPurchase\(planId, durationId\)\.catch\(\(\) => \(\{\n\s*success: false,\n\s*preview: true,\n\s*\}\)\);/,
        'const result = await billingPurchase(planId, durationId);',
      );

      // Home weight chart was previously increased to 280x150 and rendered as a
      // real continuous line. Keep that stable sizing rather than reintroducing
      // the old tiny 220x112 chart.
      requirePatch(
        homeSegment.includes('width: 280, height: 150'),
        "Home weight chart sizing",
      );

      return { code: out, map: null };
    },
  };
}

export default defineConfig({
  plugins: [fiftyFitHardeningPlugin(), react()],
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
