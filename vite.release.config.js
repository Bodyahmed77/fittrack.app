import { mergeConfig, defineConfig } from "vite";
import { fileURLToPath, URL } from "node:url";
import baseConfig from "./vite.config.js";

const fiftyFitBillingEntry = fileURLToPath(
  new URL("./src/fiftyFitBilling.js", import.meta.url),
);

function forceFirstPartyBillingImport() {
  return {
    name: "fifty-fit-force-first-party-billing-import",
    enforce: "post",
    transform(code, id) {
      if (!id.endsWith("/src/billing.js")) return null;
      const legacyImport = 'await import(/* @vite-ignore */ "capacitor-billing")';
      if (!code.includes(legacyImport)) return null;
      const next = code.replace(legacyImport, 'await import("./fiftyFitBilling.js")');
      return { code: next, map: null };
    },
  };
}

export default defineConfig(() => {
  const config = mergeConfig(baseConfig, {
    plugins: [forceFirstPartyBillingImport()],
    resolve: {
      alias: {
        "capacitor-billing": fiftyFitBillingEntry,
      },
    },
  });

  const external = config?.build?.rollupOptions?.external;
  if (Array.isArray(external)) {
    config.build.rollupOptions.external = external.filter(
      (entry) => entry !== "capacitor-billing",
    );
  }

  return config;
});
