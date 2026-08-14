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

      // Goal IDs must point at real built-in plan IDs.
      out = out.replace('planId: "fatloss",', 'planId: "four_day",');
      out = out.replace('planId: "hypertrophy",', 'planId: "five_day",');
      requirePatch(
        out.includes('planId: "four_day",') && out.includes('planId: "five_day",'),
        "goal plan IDs",
      );

      // Keep the paywall catalog defined in module scope instead of relying on
      // a bare global injected by index.html.
      if (!out.includes('const planIds = ["training", "nutrition", "both", "ai"];')) {
        const marker = "function PaywallScreen(";
        requirePatch(out.includes(marker), "PaywallScreen declaration");
        out = out.replace(
          marker,
          'const planIds = ["training", "nutrition", "both", "ai"];\n\n' + marker,
        );
      }

      const nutritionBranch = `{pro ? (\n          <Card\n            onClick={() => go("nutritionPlan")}`;
      const guardedNutritionBranch = `{pro && customNutritionPlan ? (\n          <Card\n            onClick={() => go("nutritionPlan")}`;
      if (out.includes(nutritionBranch)) out = out.replace(nutritionBranch, guardedNutritionBranch);
      requirePatch(
        out.includes("{pro && customNutritionPlan ? ("),
        "Nutrition Pro null guard",
      );

      const exerciseHelperStart = out.indexOf("function getUsableExercises");
      const sharedUiStart = out.indexOf("/* ============================== SHARED UI", exerciseHelperStart);
      requirePatch(exerciseHelperStart >= 0 && sharedUiStart > exerciseHelperStart, "exercise entitlement helper");
      const helperSegment = out.slice(exerciseHelperStart, sharedUiStart);
      requirePatch(
        helperSegment.includes("return { list: [...freeBase, ...customAdded], lockedCount }"),
        "custom exercise allowance",
      );

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

      // The current workout week source has one stale reference left from the
      // old rolling-window implementation. It crashes the Workout tab at
      // runtime because `offset` no longer exists in the callback scope.
      // Normalize it at the same source-transform stage used for the existing
      // release hardening so the built APK/AAB cannot ship that crash.
      out = out.replace(
        "const isToday = offset === 0;",
        "const isToday = iso === today;",
      );
      requirePatch(
        !out.includes("const isToday = offset === 0;"),
        "Workout calendar stale offset reference removed",
      );

      // Keep TikTok completely inside Fifty Fit. The configured URL is the
      // original normal TikTok URL; open it through the injected native WebView
      // activity instead of TikTok Player v1, an iframe, Custom Tabs, or the
      // external TikTok app. The native activity keeps http(s) navigation in-app.
      const videoStart = out.indexOf("function FullScreenVideoViewer");
      const exerciseVisualStart = out.indexOf("/* ============================== EXERCISE VISUAL", videoStart);
      requirePatch(videoStart >= 0 && exerciseVisualStart > videoStart, "video player section");
      const videoSegmentStart = videoStart;
      const videoSegmentEnd = exerciseVisualStart;
      let videoSegment = out.slice(videoSegmentStart, videoSegmentEnd);
      videoSegment = videoSegment.replace(
        "  const tikTokPostId = getTikTokPostId(videoId);\n  const embedSrc = tikTokPostId\n    ? `https://www.tiktok.com/player/v1/${tikTokPostId}?autoplay=1&controls=1&progress_bar=1&play_button=1&volume_control=1&fullscreen_button=1&timestamp=1&music_info=0&description=0&rel=0&native_context_menu=0`\n    : `https://www.youtube-nocookie.com/embed/${videoId}?autoplay=1&playsinline=1&rel=0&modestbranding=1`;",
        "  const isTikTok = isTikTokVideoRef(videoId);\n  const embedSrc = isTikTok\n    ? String(videoId)\n    : `https://www.youtube-nocookie.com/embed/${videoId}?autoplay=1&playsinline=1&rel=0&modestbranding=1`;",
      );
      videoSegment = videoSegment.replace(
        "  const handleWatch = () => setOpen(true);",
        "  const handleWatch = async () => {\n    if (isTikTok) {\n      try {\n        const { openTikTokWebView } = await import(\"./tiktokWebView\");\n        await openTikTokWebView(String(videoId));\n      } catch (error) {\n        console.error(\"[TikTok] in-app WebView failed\", error);\n      }\n      return;\n    }\n    setOpen(true);\n  };",
      );
      out = out.slice(0, videoSegmentStart) + videoSegment + out.slice(videoSegmentEnd);
      requirePatch(
        !videoSegment.includes("tiktok.com/player/v1/"),
        "TikTok official player disabled",
      );
      requirePatch(
        videoSegment.includes("openTikTokWebView(String(videoId))"),
        "TikTok native WebView flow",
      );
      requirePatch(!/tiktok\.com\/oembed/i.test(videoSegment), "TikTok oEmbed resolver disabled");

      // AI Coach keyboard: validate real keyboard tracking; do not rewrite
      // the source back to a dead zero inset during the production build.
      requirePatch(
        !/const keyboardInset = 0;/.test(out) && /\[keyboardInset, setKeyboardInset\] = useState/.test(out),
        "AI Coach keyboard inset must be tracked, not hardcoded",
      );

      // Do not turn real Google Play billing errors into fake preview purchases.
      out = out.replace(
        /const result = await billingPurchase\(planId, durationId\)\.catch\(\(\) => \(\{\n\s*success: false,\n\s*preview: true,\n\s*\}\)\);/,
        'const result = await billingPurchase(planId, durationId);',
      );

      requirePatch(homeSegment.includes('width: 280, height: 150'), "Home weight chart sizing");

      return { code: out, map: null };
    },
  };
}

export default defineConfig({
  plugins: [fiftyFitHardeningPlugin(), react()],
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
