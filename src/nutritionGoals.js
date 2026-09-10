import React, { useMemo, useState } from "react";
import { ChevronLeft, Check, RotateCcw, Info } from "lucide-react";

const CALORIES_MIN = 1000;
const CALORIES_MAX = 10000;

function clampPercent(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(100, Math.round(n)));
}

function macroGrams(calories, percent, kcalPerGram) {
  return Math.round((Number(calories) * Number(percent)) / 100 / kcalPerGram);
}

function normalizeTargets(data) {
  const current = data?.dailyTargets || {};
  const calories = Number(current.kcal || current.targetKcal || 2000);
  const protein = Number(current.protein || current.targetProtein || 20);
  const carbs = Number(current.carbs || current.targetCarbs || 50);
  const fat = Number(current.fat || current.targetFat || 30);

  // If the saved object already has explicit macro percentages, preserve them.
  const explicit = data?.nutritionMacroPreferences;
  if (explicit && [explicit.carbsPct, explicit.proteinPct, explicit.fatPct].every((v) => Number.isFinite(Number(v)))) {
    const sum = Number(explicit.carbsPct) + Number(explicit.proteinPct) + Number(explicit.fatPct);
    if (Math.abs(sum - 100) < 0.01) {
      return {
        calories: Math.round(calories),
        carbsPct: clampPercent(explicit.carbsPct),
        proteinPct: clampPercent(explicit.proteinPct),
        fatPct: clampPercent(explicit.fatPct),
      };
    }
  }

  // Legacy dailyTargets store grams, so derive percentages from calories.
  const carbPct = calories > 0 ? (carbs * 4 * 100) / calories : 50;
  const proteinPct = calories > 0 ? (protein * 4 * 100) / calories : 20;
  const fatPct = calories > 0 ? (fat * 9 * 100) / calories : 30;
  const total = carbPct + proteinPct + fatPct;
  if (total <= 0) return { calories: Math.round(calories), carbsPct: 50, proteinPct: 20, fatPct: 30 };
  return {
    calories: Math.round(calories),
    carbsPct: Math.round((carbPct / total) * 100),
    proteinPct: Math.round((proteinPct / total) * 100),
    fatPct: Math.max(0, 100 - Math.round((carbPct / total) * 100) - Math.round((proteinPct / total) * 100)),
  };
}

export default function NutritionGoalsScreen({ data, setData, back, showToast }) {
  const ar = data?.settings?.language === "ar";
  const initial = useMemo(() => normalizeTargets(data), [data]);
  const [calories, setCalories] = useState(String(initial.calories));
  const [carbsPct, setCarbsPct] = useState(String(initial.carbsPct));
  const [proteinPct, setProteinPct] = useState(String(initial.proteinPct));
  const [fatPct, setFatPct] = useState(String(initial.fatPct));
  const [error, setError] = useState("");

  const c = data?.settings?.theme === "light"
    ? { bg: "#ffffff", card: "#ffffff", card2: "#f2f2f2", border: "rgba(0,0,0,.22)", text: "#000", sub: "#5c5c5c", accent: "#000", onAccent: "#fff", danger: "#dc2626", green: "#16a34a" }
    : { bg: "#000", card: "#000", card2: "#161616", border: "rgba(255,255,255,.35)", text: "#fff", sub: "#a3a3a3", accent: "#fff", onAccent: "#000", danger: "#ef4444", green: "#22c55e" };

  const total = Number(carbsPct || 0) + Number(proteinPct || 0) + Number(fatPct || 0);
  const calorieValue = Number(calories || 0);
  const preview = {
    carbs: macroGrams(calorieValue, carbsPct, 4),
    protein: macroGrams(calorieValue, proteinPct, 4),
    fat: macroGrams(calorieValue, fatPct, 9),
  };

  const recommended = Number(data?.account?.age || 0) > 0 && Number(data.account.age) < 18
    ? { carbs: [55, 65], protein: [15, 20], fat: [20, 35], label: ar ? "نطاق إرشادي شائع للرياضيين الشباب" : "Common guidance range for young athletes" }
    : { carbs: [45, 65], protein: [10, 35], fat: [20, 35], label: ar ? "نطاقات إرشادية عامة" : "General reference ranges" };

  const fieldStyle = {
    width: "100%",
    boxSizing: "border-box",
    background: c.card2,
    border: `1px solid ${c.border}`,
    color: c.text,
    borderRadius: 11,
    padding: "11px 10px",
    fontSize: 17,
    fontWeight: 800,
    textAlign: "center",
    outline: "none",
  };

  const setRemainingProtein = () => {
    const next = Math.max(0, 100 - clampPercent(carbsPct) - clampPercent(fatPct));
    setProteinPct(String(next));
    setError("");
  };

  const applyPreset = (cPct, pPct, fPct) => {
    setCarbsPct(String(cPct));
    setProteinPct(String(pPct));
    setFatPct(String(fPct));
    setError("");
  };

  const save = async () => {
    const kcal = Math.round(calorieValue);
    const cp = clampPercent(carbsPct);
    const pp = clampPercent(proteinPct);
    const fp = clampPercent(fatPct);
    if (!Number.isFinite(kcal) || kcal < CALORIES_MIN || kcal > CALORIES_MAX) {
      setError(ar ? `السعرات لازم تكون بين ${CALORIES_MIN} و${CALORIES_MAX}.` : `Calories must be between ${CALORIES_MIN} and ${CALORIES_MAX}.`);
      return;
    }
    if (cp + pp + fp !== 100) {
      setError(ar ? `النسب لازم مجموعها يكون 100% (دلوقتي ${cp + pp + fp}%).` : `Macro percentages must total 100% (currently ${cp + pp + fp}%).`);
      return;
    }
    if (cp < 0 || pp < 0 || fp < 0) return;

    const next = JSON.parse(JSON.stringify(data));
    next.nutritionMacroPreferences = {
      calories: kcal,
      carbsPct: cp,
      proteinPct: pp,
      fatPct: fp,
      source: "user_custom",
      updatedAt: new Date().toISOString(),
    };
    next.dailyTargets = {
      ...(next.dailyTargets || {}),
      kcal,
      carbs: macroGrams(kcal, cp, 4),
      protein: macroGrams(kcal, pp, 4),
      fat: macroGrams(kcal, fp, 9),
    };
    const saved = await setData(next);
    if (saved === false) {
      setError(ar ? "تعذر حفظ الأهداف. حاول مرة تانية." : "Could not save your nutrition goals. Please try again.");
      return;
    }
    showToast(ar ? "تم حفظ أهداف السعرات والماكروز" : "Nutrition goals saved");
    back();
  };

  const reset = () => {
    const base = normalizeTargets({ ...data, nutritionMacroPreferences: null, dailyTargets: null });
    setCalories(String(base.calories || 2000));
    setCarbsPct("50");
    setProteinPct("20");
    setFatPct("30");
    setError("");
  };

  const outsideGuidance =
    cpOutside(carbsPct, recommended.carbs) ||
    cpOutside(proteinPct, recommended.protein) ||
    cpOutside(fatPct, recommended.fat);

  return (
    <div dir={ar ? "rtl" : "ltr"} style={{ minHeight: "100vh", background: c.bg, color: c.text, paddingBottom: 28 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "18px 18px 14px" }}>
        <button onClick={back} style={{ width: 36, height: 36, borderRadius: 10, border: `1px solid ${c.border}`, background: c.card2, color: c.text, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <ChevronLeft size={20} style={{ transform: ar ? "scaleX(-1)" : "none" }} />
        </button>
        <div style={{ fontSize: 18, fontWeight: 900 }}>{ar ? "أهداف التغذية" : "Nutrition Goals"}</div>
      </div>

      <div style={{ padding: "0 18px" }}>
        <div style={{ background: c.card, border: `1px solid ${c.border}`, borderRadius: 16, padding: 16, marginBottom: 12 }}>
          <div style={{ color: c.sub, fontSize: 12, fontWeight: 700 }}>{ar ? "السعرات اليومية" : "DAILY CALORIES"}</div>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 8 }}>
            <input type="number" min={CALORIES_MIN} max={CALORIES_MAX} value={calories} onChange={(e) => setCalories(e.target.value)} style={{ ...fieldStyle, flex: 1 }} />
            <span style={{ color: c.sub, fontSize: 13 }}>{ar ? "سعرة" : "kcal"}</span>
          </div>
          <div style={{ color: c.sub, fontSize: 11, marginTop: 7, lineHeight: 1.5 }}>
            {ar ? "ده هدفك اليومي؛ التطبيق هيحسب جرامات البروتين والكارب والدهون تلقائيًا من النسب اللي تختارها." : "This is your daily calorie target. Grams for protein, carbs and fat are calculated from your chosen percentages."}
          </div>
        </div>

        <div style={{ background: c.card, border: `1px solid ${c.border}`, borderRadius: 16, padding: 16, marginBottom: 12 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
            <div>
              <div style={{ color: c.text, fontWeight: 900, fontSize: 15 }}>{ar ? "توزيع الماكروز" : "Macro distribution"}</div>
              <div style={{ color: c.sub, fontSize: 11.5, marginTop: 3 }}>{ar ? "غيّر أي نسبة براحتك — المطلوب فقط إن المجموع = 100%." : "Change any ratio you want — the only rule is that the total equals 100%."}</div>
            </div>
            <div style={{ color: total === 100 ? c.green : c.danger, fontSize: 13, fontWeight: 900 }}>{total}%</div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 8, marginTop: 14 }}>
            <MacroField label={ar ? "كارب" : "Carbs"} value={carbsPct} setValue={setCarbsPct} suffix="%" c={c} />
            <MacroField label={ar ? "بروتين" : "Protein"} value={proteinPct} setValue={setProteinPct} suffix="%" c={c} />
            <MacroField label={ar ? "دهون" : "Fat"} value={fatPct} setValue={setFatPct} suffix="%" c={c} />
          </div>

          <button type="button" onClick={setRemainingProtein} style={{ width: "100%", marginTop: 10, padding: "10px 12px", borderRadius: 11, border: `1px dashed ${c.border}`, background: "transparent", color: c.text, fontWeight: 800, fontSize: 12.5 }}>
            <Check size={14} style={{ verticalAlign: "-2px", marginInlineEnd: 5 }} />
            {ar ? "خلّي البروتين = الباقي" : "Set protein to the remainder"}
          </button>

          <div style={{ marginTop: 14, display: "flex", height: 10, borderRadius: 99, overflow: "hidden", background: c.card2 }}>
            <div style={{ width: `${Math.max(0, Math.min(100, Number(carbsPct) || 0))}%`, background: "#f59e0b" }} />
            <div style={{ width: `${Math.max(0, Math.min(100, Number(proteinPct) || 0))}%`, background: "#60a5fa" }} />
            <div style={{ width: `${Math.max(0, Math.min(100, Number(fatPct) || 0))}%`, background: "#fb923c" }} />
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 8, marginTop: 12 }}>
            <MacroPreview label={ar ? "كارب" : "Carbs"} grams={preview.carbs} c={c} />
            <MacroPreview label={ar ? "بروتين" : "Protein"} grams={preview.protein} c={c} />
            <MacroPreview label={ar ? "دهون" : "Fat"} grams={preview.fat} c={c} />
          </div>
        </div>

        <div style={{ background: c.card2, border: `1px solid ${c.border}`, borderRadius: 14, padding: 13, marginBottom: 12 }}>
          <div style={{ display: "flex", gap: 8, alignItems: "flex-start" }}>
            <Info size={16} color={c.sub} style={{ marginTop: 2, flexShrink: 0 }} />
            <div style={{ color: c.sub, fontSize: 11.5, lineHeight: 1.6 }}>
              <b style={{ color: c.text }}>{recommended.label}:</b> {recommended.carbs[0]}–{recommended.carbs[1]}% {ar ? "كارب" : "carbs"}, {recommended.protein[0]}–{recommended.protein[1]}% {ar ? "بروتين" : "protein"}, {recommended.fat[0]}–{recommended.fat[1]}% {ar ? "دهون" : "fat"}.
              {ar ? " دي إرشادات وليست قيدًا على اختيارك؛ لو عندك خطة من مختص اتبعها." : " These are guardrails, not a forced limit; follow a clinician/dietitian plan when you have one."}
            </div>
          </div>
        </div>

        {outsideGuidance && (
          <div style={{ background: "rgba(234,179,8,.12)", border: "1px solid rgba(234,179,8,.45)", color: c.text, borderRadius: 14, padding: 12, marginBottom: 12, fontSize: 11.5, lineHeight: 1.55 }}>
            {ar ? "التوزيع اللي اخترته خارج النطاق الإرشادي المعروض فوق. مش همنعك منه، لكن راجع إنه مناسب لهدفك وحالتك، خصوصًا لو أنت أقل من 18 سنة." : "Your distribution is outside the reference range shown above. We won't block it, but make sure it fits your goal and circumstances, especially if you're under 18."}
          </div>
        )}

        <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 7, marginBottom: 14 }}>
          <Preset label={ar ? "متوازن" : "Balanced"} value="50/20/30" onClick={() => applyPreset(50,20,30)} c={c} />
          <Preset label={ar ? "كارب أعلى" : "Higher Carb"} value="60/20/20" onClick={() => applyPreset(60,20,20)} c={c} />
          <Preset label={ar ? "رياضي شباب" : "Youth Athlete"} value="65/15/20" onClick={() => applyPreset(65,15,20)} c={c} />
        </div>

        {error && <div style={{ color: c.danger, fontSize: 12, fontWeight: 700, marginBottom: 10 }}>{error}</div>}

        <button onClick={save} style={{ width: "100%", border: "none", borderRadius: 13, padding: "14px 16px", background: c.accent, color: c.onAccent, fontWeight: 900, fontSize: 14 }}>
          {ar ? "حفظ أهداف التغذية" : "Save Nutrition Goals"}
        </button>
        <button onClick={reset} style={{ width: "100%", marginTop: 9, border: `1px solid ${c.border}`, borderRadius: 13, padding: "11px 16px", background: "transparent", color: c.sub, fontWeight: 800, fontSize: 12.5 }}>
          <RotateCcw size={14} style={{ verticalAlign: "-2px", marginInlineEnd: 5 }} />
          {ar ? "إرجاع التوزيع الافتراضي" : "Reset to default distribution"}
        </button>
      </div>
    </div>
  );
}

function MacroField({ label, value, setValue, suffix, c }) {
  return (
    <label style={{ minWidth: 0 }}>
      <div style={{ color: c.sub, fontSize: 10.5, fontWeight: 800, marginBottom: 5 }}>{label}</div>
      <div style={{ position: "relative" }}>
        <input type="number" min="0" max="100" inputMode="numeric" value={value} onChange={(e) => setValue(e.target.value)} style={{ width: "100%", boxSizing: "border-box", background: c.card2, border: `1px solid ${c.border}`, color: c.text, borderRadius: 11, padding: "11px 20px 11px 7px", fontSize: 16, fontWeight: 900, textAlign: "center", outline: "none" }} />
        <span style={{ position: "absolute", right: 6, top: "50%", transform: "translateY(-50%)", color: c.sub, fontSize: 11, pointerEvents: "none" }}>{suffix}</span>
      </div>
    </label>
  );
}

function MacroPreview({ label, grams, c }) {
  return <div style={{ background: c.card2, borderRadius: 10, padding: 9, textAlign: "center" }}><div style={{ color: c.sub2 || c.sub, fontSize: 9.5, fontWeight: 800 }}>{label}</div><div style={{ color: c.text, fontSize: 14, fontWeight: 900, marginTop: 2 }}>{grams}g</div></div>;
}

function Preset({ label, value, onClick, c }) {
  return <button type="button" onClick={onClick} style={{ border: `1px solid ${c.border}`, borderRadius: 11, background: "transparent", color: c.text, padding: "9px 5px", fontSize: 10.5, fontWeight: 800 }}><div>{label}</div><div style={{ color: c.sub, marginTop: 2 }}>{value}</div></button>;
}

function cpOutside(value, range) {
  const n = Number(value);
  return Number.isFinite(n) && (n < range[0] || n > range[1]);
}
