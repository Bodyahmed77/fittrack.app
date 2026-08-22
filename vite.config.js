import { defineConfig } from "vite";

function fiftyFitReleaseCompatibility() {
  return {
    name: "fifty-fit-release-compatibility",
    enforce: "pre",
    transform(code, id) {
      if (!id.endsWith("/src/App.jsx") && !id.endsWith("/src/billing.js")) return null;
      let out = code;

      if (id.endsWith("/src/App.jsx")) {
        out = out.replace(/planId:\s*"fatloss"/g, 'planId: "four_day"');
        out = out.replace(/planId:\s*"hypertrophy"/g, 'planId: "five_day"');

        out = out.replace(
          '{pro ? (\n          <Card\n            onClick={() => go("nutritionPlan")}',
          '{pro && customNutritionPlan ? (\n          <Card\n            onClick={() => go("nutritionPlan")}',
        );

        out = out.replace(
          'const bw = normalizeBodyWeightEntries(data.bodyWeight);',
          'const bw = normalizeBodyWeightEntries(data.bodyWeight).filter((w) =>\n    data.entitlements.trainingPro || monthKey(w.date) === monthKey(today),\n  );',
        );
        out = out.replace(
          '() => normalizeBodyWeightEntries(data.bodyWeight),\n    [data.bodyWeight],',
          '() => normalizeBodyWeightEntries(data.bodyWeight).filter((w) =>\n      pro || monthKey(w.date) === monthKey(dateKey(0)),\n    ),\n    [data.bodyWeight, pro],',
        );

        out = out.replace(
          'const iso = addDays(mondayOf(dateKey(0)), i);',
          'const iso = addDays(dateKey(0), i - 3);',
        );
        out = out.replace('const isToday = offset === 0;', 'const isToday = iso === today;');

        out = out.replace(
          'style={{ paddingBottom: selected ? "calc(200px + var(--ff-keyboard-height, 0px))" : 0 }}',
          'style={{ paddingBottom: selected ? 20 : 0 }}',
        );
        out = out.replace('bottom: "var(--ff-keyboard-height, 0px)",', 'bottom: 0,');

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

        out = out.replace(
          /const result = await billingPurchase\(planId, durationId\)\.catch\(\(\) => \(\{\n\s*success: false,\n\s*preview: true,\n\s*\}\)\);/,
          'const result = await billingPurchase(planId, durationId);',
        );

        const uiHelperAnchor = '/* ============================== PAYWALL ============================== */';
        const uiHelper = `function __fiftyFitExtractBillingCode(value) {\n  if (value == null) return null;\n  if (typeof value === "number" && Number.isFinite(value)) return value;\n  const text = String(value);\n  if (/^-?\\d+$/.test(text.trim())) return Number(text.trim());\n  const match = text.match(/BillingResponseCode\\s*[=:]\\s*(-?\\d+)/i);\n  return match ? Number(match[1]) : null;\n}\n\nconst FIFTYFIT_BILLING_UI_V3 = true;\n\n`;
        if (!out.includes('const FIFTYFIT_BILLING_UI_V3 = true;')) {
          if (!out.includes(uiHelperAnchor)) throw new Error("Fifty Fit Billing UI hardening: PAYWALL anchor not found in App.jsx");
          out = out.replace(uiHelperAnchor, uiHelperAnchor + '\n' + uiHelper, 1);
        }

        const billingAssignments = /const billingCode = String\(([\s\S]*?)\);/g;
        let assignmentCount = 0;
        out = out.replace(billingAssignments, (full) => {
          if (!full.includes("billingErr.code") && !full.includes("e?.code")) return full;
          assignmentCount += 1;
          if (full.includes("billingErr.code")) {
            return `const billingCode = String(\n          billingErr.responseCode ??\n          billingErr.nativeCode ??\n          __fiftyFitExtractBillingCode(billingErr.debugMessage || billingErr.nativeMessage || billingErr.message) ??\n          diagnostics.responseCode ??\n          __fiftyFitExtractBillingCode(diagnostics.debugMessage || diagnostics.message || diagnostics.raw) ??\n          billingErr.code ??\n          diagnostics.code ??\n          (result?.pending ? "purchase_pending" : "billing_flow_failed")\n        );`;
          }
          return `const billingCode = String(\n        e?.responseCode ??\n        e?.nativeCode ??\n        __fiftyFitExtractBillingCode(e?.debugMessage || e?.nativeMessage || e?.message) ??\n        diagnostics.responseCode ??\n        __fiftyFitExtractBillingCode(diagnostics.debugMessage || diagnostics.message || diagnostics.raw) ??\n        e?.code ??\n        diagnostics.code ??\n        "billing_flow_failed"\n      );`;
        });
        if (assignmentCount < 2) {
          throw new Error(`Fifty Fit Billing UI hardening: expected 2 billingCode assignments, patched ${assignmentCount}`);
        }

        return { code: out, map: null };
      }

      if (id.endsWith("/src/billing.js")) {
        if (!out.includes("function extractBillingResponseCode(value) {")) {
          const helper = `function extractBillingResponseCode(value) {\n  if (value == null) return null;\n  if (typeof value === "number" && Number.isFinite(value)) return value;\n  const text = String(value);\n  if (/^-?\\d+$/.test(text.trim())) return Number(text.trim());\n  const match = text.match(/BillingResponseCode\\s*[=:]\\s*(-?\\d+)/i);\n  return match ? Number(match[1]) : null;\n}\n\n`;
          const marker = "function billingResponseName(code) {";
          if (!out.includes(marker)) throw new Error("Fifty Fit Billing normalization: billingResponseName anchor not found in src/billing.js");
          out = out.replace(marker, helper + marker, 1);
        }

        const oldBlock = `  const err = new Error(message);\n  err.code = String(code);\n  err.responseCode =\n    source?.responseCode ?? source?.billingResponseCode ?? e?.responseCode ?? null;\n  err.nativeCode =\n    source?.code ??\n    source?.responseCode ??\n    source?.billingResponseCode ??\n    e?.nativeCode ??\n    null;`;
        const newBlock = `  const resolvedResponseCode =\n    extractBillingResponseCode(\n      source?.responseCode ??\n      source?.billingResponseCode ??\n      source?.error?.responseCode ??\n      source?.error?.billingResponseCode ??\n      source?.error?.code ??\n      source?.code ??\n      e?.responseCode ??\n      e?.nativeCode ??\n      e?.error?.responseCode ??\n      e?.error?.billingResponseCode ??\n      e?.error?.code ??\n      message,\n    );\n  const err = new Error(message);\n  err.code = String(resolvedResponseCode ?? code);\n  err.operationCode = String(code);\n  err.responseCode = resolvedResponseCode;\n  err.nativeCode = resolvedResponseCode ?? source?.code ?? e?.nativeCode ?? null;`;
        if (!out.includes(oldBlock)) throw new Error("Fifty Fit Billing normalization: billingError response-code block not found");
        out = out.replace(oldBlock, newBlock, 1);

        const oldResult = `const responseCode =\n      result?.responseCode ??\n      result?.billingResponseCode ??\n      result?.response?.responseCode;`;
        const newResult = `const responseCode =\n      extractBillingResponseCode(\n        result?.responseCode ??\n        result?.billingResponseCode ??\n        result?.code ??\n        result?.error?.responseCode ??\n        result?.error?.billingResponseCode ??\n        result?.error?.code ??\n        result?.response?.responseCode ??\n        result?.response?.code,\n      );`;
        if (!out.includes(oldResult)) throw new Error("Fifty Fit Billing result normalization: launchBillingFlow response-code block not found");
        out = out.replace(oldResult, newResult, 1);

        if (!out.includes('const FIFTYFIT_BILLING_RESULT_V3 = true;')) {
          out = 'const FIFTYFIT_BILLING_RESULT_V3 = true;\n' + out;
        }
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
