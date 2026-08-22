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
        out = out.replace('const iso = addDays(mondayOf(dateKey(0)), i);', 'const iso = addDays(dateKey(0), i - 3);');
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

        const uiMarker = 'const FIFTYFIT_BILLING_UI_V5 = true;';
        const uiAnchor = '/* ============================== PAYWALL ============================== */';
        if (!out.includes(uiMarker)) {
          const helper = `function __fiftyFitExtractBillingCodeV5(value, depth = 0, seen = new Set()) {\n  if (value == null || depth > 5) return null;\n  if (typeof value === "number" && Number.isFinite(value)) return value;\n  if (typeof value === "string") {\n    const text = value.trim();\n    if (/^-?\\d+$/.test(text)) return Number(text);\n    const match = text.match(/BillingResponseCode\\s*[=:]\\s*(-?\\d+)/i);\n    if (match) return Number(match[1]);\n    return null;\n  }\n  if (typeof value !== "object") return null;\n  if (seen.has(value)) return null;\n  seen.add(value);\n  for (const key of ["responseCode", "billingResponseCode", "subResponseCode", "code"]) {\n    const n = __fiftyFitExtractBillingCodeV5(value[key], depth + 1, seen);\n    if (n != null) return n;\n  }\n  for (const key of ["error", "response", "result", "raw"]) {\n    const n = __fiftyFitExtractBillingCodeV5(value[key], depth + 1, seen);\n    if (n != null) return n;\n  }\n  for (const key of ["debugMessage", "nativeMessage", "message"]) {\n    const n = __fiftyFitExtractBillingCodeV5(value[key], depth + 1, seen);\n    if (n != null) return n;\n  }\n  return null;\n}\n\n${uiMarker}\n`;
          if (!out.includes(uiAnchor)) throw new Error("Fifty Fit Billing UI hardening: PAYWALL anchor not found in App.jsx");
          out = out.replace(uiAnchor, uiAnchor + '\n' + helper, 1);
        }

        const catchBlocks = /const billingErr = result\?\.error \|\| \{\};[\s\S]*?const billingCode = String\([\s\S]*?\);/g;
        const catchReplacement = `const billingErr = result?.error || {};\n        const diagnostics =\n          (typeof window !== "undefined" && window.__fiftyFitBillingDiagnostics) || {};\n        const resolvedBillingCode =\n          __fiftyFitExtractBillingCodeV5(\n            billingErr.responseCode ??\n            billingErr.nativeCode ??\n            billingErr.debugMessage ??\n            billingErr.nativeMessage ??\n            billingErr.message ??\n            diagnostics,\n          );\n        const billingCode = String(\n          resolvedBillingCode ??\n          billingErr.responseCode ??\n          diagnostics.responseCode ??\n          (result?.pending ? "purchase_pending" : "NATIVE_RESPONSE_CODE_NOT_RETURNED"),\n        );`;
        if (catchBlocks.test(out)) out = out.replace(catchBlocks, catchReplacement);

        const errorCatchBlocks = /const diagnostics =\n\s*\(typeof window !== "undefined" &&\n\s*window\.__fiftyFitBillingDiagnostics\) \|\|\n\s*\{\};\n\s*const billingCode = String\([\s\S]*?\);/g;
        const errorCatchReplacement = `const diagnostics =\n        (typeof window !== "undefined" && window.__fiftyFitBillingDiagnostics) || {};\n      const resolvedBillingCode =\n        __fiftyFitExtractBillingCodeV5(\n          e?.responseCode ??\n          e?.nativeCode ??\n          e?.debugMessage ??\n          e?.nativeMessage ??\n          e?.message ??\n          diagnostics,\n        );\n      const billingCode = String(\n        resolvedBillingCode ??\n        e?.responseCode ??\n        diagnostics.responseCode ??\n        "NATIVE_RESPONSE_CODE_NOT_RETURNED",\n      );`;
        out = out.replace(errorCatchBlocks, errorCatchReplacement);
        return { code: out, map: null };
      }

      if (id.endsWith("/src/billing.js")) {
        const helperMarker = 'const FIFTYFIT_BILLING_RESULT_V5 = true;';
        const helper = `function extractBillingResponseCode(value, depth = 0, seen = new Set()) {\n  if (value == null || depth > 5) return null;\n  if (typeof value === "number" && Number.isFinite(value)) return value;\n  if (typeof value === "string") {\n    const text = value.trim();\n    if (/^-?\\d+$/.test(text)) return Number(text);\n    const match = text.match(/BillingResponseCode\\s*[=:]\\s*(-?\\d+)/i);\n    if (match) return Number(match[1]);\n    return null;\n  }\n  if (typeof value !== "object") return null;\n  if (seen.has(value)) return null;\n  seen.add(value);\n  for (const key of ["responseCode", "billingResponseCode", "subResponseCode", "code"]) {\n    const n = extractBillingResponseCode(value[key], depth + 1, seen);\n    if (n != null) return n;\n  }\n  for (const key of ["error", "response", "result", "raw"]) {\n    const n = extractBillingResponseCode(value[key], depth + 1, seen);\n    if (n != null) return n;\n  }\n  for (const key of ["debugMessage", "nativeMessage", "message"]) {\n    const n = extractBillingResponseCode(value[key], depth + 1, seen);\n    if (n != null) return n;\n  }\n  return null;\n}\n\n${helperMarker}\n`;
        if (!out.includes(helperMarker)) {
          const marker = "function billingError(e, fallbackCode = \"billing_error\") {";
          if (!out.includes(marker)) throw new Error("Fifty Fit Billing: billingError anchor not found");
          out = out.replace(marker, helper + marker, 1);
        }
        const oldBillingError = /function billingError\(e, fallbackCode = "billing_error"\) \{[\s\S]*?\n\}\n\nfunction normalizeSkuDetails/;
        const newBillingError = `function billingError(e, fallbackCode = "billing_error") {\n  const source = e?.error || e?.response || e;\n  const resolvedResponseCode = extractBillingResponseCode(e);\n  const rawMessage = source?.debugMessage || source?.message || e?.debugMessage || e?.nativeMessage || e?.message || "Google Play Billing could not complete the operation";\n  const codeFallback = source?.code ?? source?.operationCode ?? e?.operationCode ?? fallbackCode;\n  const err = new Error(String(rawMessage));\n  err.code = String(resolvedResponseCode ?? codeFallback);\n  err.operationCode = String(codeFallback);\n  err.responseCode = resolvedResponseCode;\n  err.nativeCode = resolvedResponseCode ?? source?.code ?? e?.nativeCode ?? null;\n  err.nativeMessage = String(rawMessage);\n  err.debugMessage = String(rawMessage);\n  err.billingResponseCodeName = resolvedResponseCode == null ? "UNKNOWN" : billingResponseName(resolvedResponseCode);\n  if (source?.subResponseCode != null) err.subResponseCode = String(source.subResponseCode);\n  err.raw = e;\n  try { writeBillingDiagnostics({ stage: "error_normalized_v5", code: err.code, operationCode: err.operationCode, responseCode: err.responseCode, responseName: err.billingResponseCodeName, debugMessage: err.debugMessage, subResponseCode: err.subResponseCode || null }); } catch (_) {}\n  return err;\n}\n\nfunction normalizeSkuDetails`;
        if (!oldBillingError.test(out)) throw new Error("Fifty Fit Billing: canonical billingError block not found");
        out = out.replace(oldBillingError, newBillingError);
        out = out.replace(/const responseCode =\n\s*result\?\.responseCode \|\|[\s\S]*?result\?\.response\?\.responseCode;/, 'const responseCode = extractBillingResponseCode(result);');
        out = out.replace(/const responseName = billingResponseName\(responseCode\);/, 'const responseName = responseCode == null ? "UNKNOWN" : billingResponseName(responseCode);');
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
