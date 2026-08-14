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

      // TikTok pages are not reliably embeddable in an iframe. The launch build
      // deliberately uses Capacitor Browser/Android Custom Tabs for the normal
      // TikTok URL, keeping the user in the app context without using TikTok's
      // official player endpoint or an oEmbed resolver.
      const videoStart = out.indexOf("function FullScreenVideoViewer");
      const exerciseVisualStart = out.indexOf("/* ============================== EXERCISE VISUAL", videoStart);
      requirePatch(videoStart >= 0 && exerciseVisualStart > videoStart, "video player section");
      const videoSegment = out.slice(videoStart, exerciseVisualStart);
      requirePatch(
        videoSegment.includes('Browser.open({ url: tikTokUrl'),
        "TikTok native browser flow",
      );
      requirePatch(
        !videoSegment.includes("tiktok.com/player/v1/"),
        "TikTok official player disabled",
      );
      requirePatch(
        !videoSegment.includes("oembed"),
        "TikTok oEmbed resolver disabled",
      );

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
