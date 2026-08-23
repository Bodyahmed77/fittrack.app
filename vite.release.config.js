import { mergeConfig, defineConfig } from "vite";
import { fileURLToPath, URL } from "node:url";
import baseConfig from "./vite.config.js";

const fiftyFitBillingEntry = fileURLToPath(
  new URL("./src/fiftyFitBilling.js", import.meta.url),
);

export default defineConfig(() => {
  const config = mergeConfig(baseConfig, {
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
