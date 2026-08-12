import fs from 'node:fs';
const p='src/App.jsx';
let s=fs.readFileSync(p,'utf8');
s=s.replace('          customPlan: parsed.customPlan || {},\n          customTrainingPlan: parsed.customTrainingPlan || null,\n          customNutritionPlan: parsed.customNutritionPlan || null,\n          customTrainingPlan: parsed.customTrainingPlan || null,\n          customNutritionPlan: parsed.customNutritionPlan || null,', '          customPlan: parsed.customPlan || {},\n          customTrainingPlan: parsed.customTrainingPlan || null,\n          customNutritionPlan: parsed.customNutritionPlan || null,');
fs.writeFileSync(p,s);
try { fs.rmSync('scripts/cleanup-release-fix.mjs'); } catch {}
try { fs.rmSync('.github/workflows/cleanup-release-fix.yml'); } catch {}
