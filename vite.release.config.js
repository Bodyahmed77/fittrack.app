import { mergeConfig, defineConfig } from "vite";
import baseConfig from "./vite.config.js";

// Billing is now a first-party static source import in src/billing.js.
// No alias, dynamic-import rewrite, or externalization is required.
export default defineConfig(() => mergeConfig(baseConfig, {}));
