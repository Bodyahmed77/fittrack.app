import { defineConfig } from "vite";

function fiftyFitReleaseCompatibility() {
  return {
    name: "fifty-fit-release-compatibility",
    enforce: "pre",
    transform(code, id) {
      if (!id.endsWith("/src/App.jsx") && !id.endsWith("/src/billing.js")) return null;
      let out = code;

      if (id.endsWith("/src/App.jsx")) {
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
        out = out.replace(
          'style={{ paddingBottom: selected ? "calc(200px + var(--ff-keyboard-height, 0px))" : 0 }}',
          'style={{ paddingBottom: selected ? 20 : 0 }}',
        );
        out = out.replace(
          'bottom: "var(--ff-keyboard-height, 0px)",',
          'bottom: 0,',
        );

        // TikTok: keep the user inside Fifty Fit.
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
      }

      // Canonical runtime normalization for native Capacitor billing errors.
      // Native BillingPlugin may place the numeric BillingResponseCode in `code`,
      // `responseCode`, or only inside the diagnostic message. Normalize all
      // of those forms before App.jsx receives the error.
      if (id.endsWith("/src/billing.js")) {
        if (!out.includes("function extractBillingResponseCode(value) {")) {
          const helper = `function extractBillingResponseCode(value) {
  if (value == null) return null;
  if (typeof value === "number" && Number.isFinite(value)) return value;
  const text = String(value);
  if (/^-?\\d+$/.test(text.trim())) return Number(text.trim());
  const match = text.match(/BillingResponseCode\\s*[=:]\\s*(-?\\d+)/i);
  return match ? Number(match[1]) : null;
}

`;
          const marker = "function billingResponseName(code) {";
          if (out.includes(marker)) out = out.replace(marker, helper + marker, 1);
        }

        const oldBlock = `  const err = new Error(message);
  err.code = String(code);
  err.responseCode =
    source?.responseCode ?? source?.billingResponseCode ?? e?.responseCode ?? null;
  err.nativeCode =
    source?.code ??
    source?.responseCode ??
    source?.billingResponseCode ??
    e?.nativeCode ??
    null;`;
        const newBlock = `  const resolvedResponseCode =
    extractBillingResponseCode(
      source?.responseCode ??
      source?.billingResponseCode ??
      source?.code ??
      e?.responseCode ??
      e?.nativeCode ??
      message,
    );
  const err = new Error(message);
  err.code = String(code);
  err.responseCode = resolvedResponseCode;
  err.nativeCode = resolvedResponseCode ?? source?.code ?? e?.nativeCode ?? null;`;
        if (out.includes(oldBlock)) out = out.replace(oldBlock, newBlock, 1);

        // Always carry the normalized response code and raw native text into
        // the diagnostics object used by the Paywall toast.
        out = out.replace(
          'err.billingResponseCodeName = billingResponseName(err.responseCode ?? err.code);',
          'err.billingResponseCodeName = billingResponseName(err.responseCode ?? err.code);\n  err.debugMessage = err.nativeMessage || message;\n  try { writeBillingDiagnostics({ stage: "error_normalized", responseCode: err.responseCode, responseName: err.billingResponseCodeName, debugMessage: err.debugMessage, nativeCode: err.nativeCode }); } catch (_) {}',
        );

        return { code: out, map: null };
      }

      return null;
    },
  };
}

export default defineConfig({
  plugins: [fiftyFitReleaseCompatibility()],
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
