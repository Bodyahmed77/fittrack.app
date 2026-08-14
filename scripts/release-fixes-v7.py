from pathlib import Path
import re

APP = Path('src/App.jsx')
text = APP.read_text(encoding='utf-8')

# ---------- TikTok: native in-app WebView bridge ----------
if 'from "./tiktokWebView"' not in text:
    marker = 'import { Browser } from "@capacitor/browser";\n'
    if marker not in text:
        raise SystemExit('v7: Browser import marker not found')
    text = text.replace(marker, marker + 'import { openTikTokWebView } from "./tiktokWebView";\n', 1)

video_start = text.find('function FullScreenVideoViewer')
video_end = text.find('\nfunction ', video_start + 20)
if video_start < 0 or video_end < 0:
    raise SystemExit('v7: FullScreenVideoViewer boundaries not found')
video = text[video_start:video_end]
if 'openTikTokWebView' not in video:
    pattern = re.compile(r'Browser\.open\(\{\s*url\s*:\s*([^,}]+).*?\}\);', re.S)
    video2, n = pattern.subn(r'openTikTokWebView(\1);', video, count=1)
    if n != 1:
        raise SystemExit('v7: TikTok Browser.open call not found inside FullScreenVideoViewer')
    video = video2
text = text[:video_start] + video + text[video_end:]

# ---------- Cardio: canonical durable completion ----------
cardio_start = text.find('function CardioExerciseView(')
cardio_end = text.find('\nfunction ', cardio_start + 20)
if cardio_start < 0 or cardio_end < 0:
    raise SystemExit('v7: CardioExerciseView boundaries not found')

cardio_fn = r'''function CardioExerciseView({
  data,
  setData,
  back,
  exerciseId,
  logDate,
  ex,
  ar,
  C,
  showToast,
  awardXp,
}) {
  const DURATION_SECONDS = 15 * 60;
  const existingLog = data.logs[logDate]?.[exerciseId] || null;
  // A cardio entry is truly completed only when it has both the canonical
  // finished flag and a completion timestamp. Old buggy records that only had
  // finished=true are treated as stale and reset to IDLE.
  const alreadyFinished = existingLog?.finished === true && !!existingLog?.cardioCompletedAt;
  const existingStartedAt = Number(existingLog?.cardioStartedAt || 0);
  const existingElapsed = existingStartedAt > 0 ? Math.floor((Date.now() - existingStartedAt) / 1000) : 0;
  const resumableStartedAt = !alreadyFinished && existingStartedAt > 0 && existingElapsed < DURATION_SECONDS
    ? existingStartedAt
    : null;

  const [now, setNow] = useState(() => Date.now());
  const [startedAt, setStartedAt] = useState(resumableStartedAt);
  const [saving, setSaving] = useState(false);

  const elapsed = startedAt ? Math.max(0, Math.floor((now - startedAt) / 1000)) : 0;
  const remaining = Math.max(0, DURATION_SECONDS - elapsed);
  const phase = alreadyFinished ? "COMPLETED" : startedAt ? "RUNNING" : "IDLE";
  const completed = phase === "COMPLETED";
  const running = phase === "RUNNING";

  // Repair stale completion records created by the previous buggy timer logic.
  useEffect(() => {
    if (!auth.currentUser?.uid) return;
    if (existingLog?.finished === true && !existingLog?.cardioCompletedAt) {
      const cleaned = clone(data);
      cleaned.logs[logDate] = { ...(cleaned.logs[logDate] || {}) };
      cleaned.logs[logDate][exerciseId] = {
        ...(cleaned.logs[logDate][exerciseId] || {}),
        finished: false,
        cardioStartedAt: null,
        cardioCompletedAt: null,
        sets: [{ weight: 0, reps: "15 min", done: false }],
      };
      setData(cleaned);
      setStartedAt(null);
    }
  }, []);

  useEffect(() => {
    if (existingStartedAt > 0 && !resumableStartedAt && !alreadyFinished) {
      setStartedAt(null);
    }
  }, [existingStartedAt, resumableStartedAt, alreadyFinished]);

  useEffect(() => {
    if (phase !== "RUNNING") return undefined;
    const id = window.setInterval(() => setNow(Date.now()), 250);
    return () => window.clearInterval(id);
  }, [phase]);

  const persist = useCallback(
    async (finished, cardioStartedAt = startedAt) => {
      if (!auth.currentUser?.uid) throw new Error("Not authenticated");
      const next = clone(data);
      if (!next.logs[logDate]) next.logs[logDate] = {};
      next.logs[logDate][exerciseId] = {
        sets: [{ weight: 0, reps: "15 min", done: finished }],
        finished,
        cardioStartedAt: finished ? null : cardioStartedAt || null,
        cardioCompletedAt: finished ? new Date().toISOString() : null,
      };
      // Write the canonical user document before navigation. This avoids the
      // old race where React state changed and back() ran before Firestore saved.
      await setDoc(doc(db, "users", auth.currentUser.uid), next, { merge: true });
      setData(next);
    },
    [data, exerciseId, logDate, setData, startedAt],
  );

  const finish = useCallback(
    async (reason) => {
      if (saving || completed) return;
      setSaving(true);
      try {
        await persist(true, null);
        setStartedAt(null);
        setNow(Date.now());
        try { awardXp(35); } catch {}
        showToast(
          reason === "timer"
            ? (ar ? "خلصت الـ15 دقيقة! 💪" : "15 minutes complete! 💪")
            : (ar ? "تم حفظ الكارديو!" : "Cardio saved!"),
        );
        back();
      } catch (error) {
        console.error("[Cardio] completion save failed", error);
        showToast(ar ? "تعذر حفظ الكارديو، حاول مرة أخرى." : "Cardio could not be saved. Please try again.");
      } finally {
        setSaving(false);
      }
    },
    [ar, awardXp, back, completed, persist, saving, showToast],
  );

  useEffect(() => {
    if (phase === "RUNNING" && remaining <= 0 && !saving) finish("timer");
  }, [finish, phase, remaining, saving]);

  const start = async () => {
    if (saving || phase !== "IDLE") return;
    const value = Date.now();
    setStartedAt(value);
    setNow(value);
    setSaving(true);
    try {
      await persist(false, value);
    } catch (error) {
      console.error("[Cardio] start save failed", error);
      setStartedAt(null);
      showToast(ar ? "تعذر بدء المؤقت، حاول مرة أخرى." : "Could not start the timer. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  const skip = () => finish("skip");
  const mm = String(Math.floor(remaining / 60)).padStart(2, "0");
  const ss = String(remaining % 60).padStart(2, "0");
  const progress = Math.min(1, elapsed / DURATION_SECONDS);

  return (
    <div dir={ar ? "rtl" : "ltr"}>
      <TopBar title={ar ? ex.nameAr || ex.name : ex.name} onBack={back} />
      <div style={{ padding: "0 18px 24px" }}>
        <Card style={{ marginBottom: 14, overflow: "hidden" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
            <div style={{ width: 64, height: 64, borderRadius: 16, background: C.card2, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
              <Target size={28} color={C.green} />
            </div>
            <div style={{ minWidth: 0 }}>
              <div style={{ color: C.sub, fontSize: 12 }}>{ar ? "المدة" : "Duration"}</div>
              <div style={{ color: C.text, fontWeight: 800, fontSize: 18 }}>{ar ? "15 دقيقة" : "15 minutes"}</div>
              <div style={{ color: C.sub, fontSize: 11.5, marginTop: 3 }}>{ar ? "كارديو بدون مجموعات أو عدات" : "Time-based cardio — no sets or reps"}</div>
            </div>
          </div>
        </Card>
        <VideoPlayer videoId={ex.vid} ar={ar} />
        <Card style={{ marginTop: 14, textAlign: "center", padding: "24px 18px" }}>
          <div style={{ color: C.sub, fontSize: 12, fontWeight: 700, marginBottom: 8 }}>
            {completed ? (ar ? "تم الإنجاز" : "Completed") : running ? (ar ? "الوقت المتبقي" : "Time remaining") : (ar ? "جاهز؟" : "Ready?")}
          </div>
          <div style={{ fontSize: 52, lineHeight: 1, fontWeight: 900, letterSpacing: 1.5, color: completed ? C.positive : C.text, fontVariantNumeric: "tabular-nums" }}>
            {completed ? "15:00" : `${mm}:${ss}`}
          </div>
          <div style={{ height: 7, background: C.card2, borderRadius: 99, marginTop: 18, overflow: "hidden" }}>
            <div style={{ height: "100%", width: `${completed ? 100 : progress * 100}%`, background: C.positive, borderRadius: 99, transition: "width .25s linear" }} />
          </div>
          <div style={{ display: "flex", gap: 10, marginTop: 18 }}>
            {phase === "IDLE" && <GreenButton onClick={start} disabled={saving} style={{ flex: 1 }}>{saving ? (ar ? "جاري البدء…" : "Starting…") : (ar ? "ابدأ 15 دقيقة" : "Start 15 min")}</GreenButton>}
            {phase === "RUNNING" && <GreenButton onClick={() => finish("skip")} disabled={saving} style={{ flex: 1 }}>{saving ? (ar ? "جاري الحفظ…" : "Saving…") : (ar ? "إنهاء الآن" : "Finish now")}</GreenButton>}
            {phase === "COMPLETED" && <GreenButton onClick={back} style={{ flex: 1 }}>{ar ? "تم" : "Done"}</GreenButton>}
          </div>
          {!completed && (
            <button onClick={skip} disabled={saving} style={{ marginTop: 12, width: "100%", padding: "11px 0", borderRadius: 12, border: `1px dashed ${C.border}`, background: "transparent", color: C.sub, fontWeight: 700, fontSize: 12.5, cursor: saving ? "default" : "pointer" }}>
              {ar ? "تخطي المؤقت وإنهاء الكارديو" : "Skip timer & finish cardio"}
            </button>
          )}
        </Card>
      </div>
    </div>
  );
}
'''
text = text[:cardio_start] + cardio_fn + text[cardio_end:]

# ---------- Nutrition Plan: selectable days + published targets ----------
nut_start = text.find('function NutritionPlanScreen(')
nut_end = text.find('\nfunction FoodPickerScreen', nut_start + 20)
if nut_start < 0 or nut_end < 0:
    raise SystemExit('v7: NutritionPlanScreen boundaries not found')

nutrition_fn = r'''function NutritionPlanScreen({ data, back }) {
  const { C, lang } = useUI();
  const ar = lang === "ar";
  const plan = data.customNutritionPlan;
  const today = dateKey(0);
  const [log, setLog] = useState(() => data.customNutritionLog || {});
  const [saving, setSaving] = useState(false);
  const [requested, setRequested] = useState(!!data.nutritionPlanRequestedAt);

  const parseItems = (items, mealId) => Array.isArray(items)
    ? items.map((x, i) => ({
        id: x.id || `${mealId}-${i}`,
        name: x.name || x.title || `Food ${i + 1}`,
        nameAr: x.nameAr || x.name || x.titleAr || x.title || `أكلة ${i + 1}`,
        quantity: x.quantity ?? x.amount ?? x.grams ?? "",
        kcal: Number(x.kcal ?? x.calories ?? 0),
        protein: Number(x.protein ?? x.p ?? 0),
        carbs: Number(x.carbs ?? x.c ?? 0),
        fat: Number(x.fat ?? x.f ?? 0),
      }))
    : String(items || "").split(/\n+/).map(x => x.trim()).filter(Boolean).map((line, i) => {
        const a = line.split("|").map(x => x.trim());
        return {
          id: `${mealId}-${i}-${a[0]}`,
          name: a[0], nameAr: a[0], quantity: a[1] || "",
          kcal: Number(a[2] || 0), protein: Number(a[3] || 0), carbs: Number(a[4] || 0), fat: Number(a[5] || 0),
        };
      });

  if (!plan) {
    const request = async () => {
      if (requested || !auth.currentUser) return;
      setRequested(true);
      try {
        await setDoc(doc(db, "users", auth.currentUser.uid), {
          nutritionPlanRequestedAt: new Date().toISOString(),
          nutritionPlanRequestStatus: "pending",
        }, { merge: true });
      } catch {
        setRequested(false);
      }
    };
    return <div dir={ar ? "rtl" : "ltr"}>
      <TopBar title={ar ? "خطتك الغذائية" : "Your Nutrition Plan"} onBack={back} />
      <div style={{ padding: "0 18px 28px" }}>
        <Card style={{ background: C.greenSoft, border: `1px solid ${C.green}55`, padding: 22, textAlign: "center" }}>
          <div style={{ fontSize: 42 }}>🍽️</div>
          <div style={{ color: C.text, fontSize: 20, fontWeight: 900, marginTop: 8 }}>{ar ? "خطتك الغذائية الخاصة" : "Your Personalized Nutrition Plan"}</div>
          <div style={{ color: C.sub, fontSize: 13, lineHeight: 1.6, margin: "8px 0 18px" }}>{ar ? "فريق Fifty Fit هيجهز لك خطة مناسبة لهدفك وتظهر هنا داخل التطبيق." : "The Fifty Fit team will prepare your personalized plan and deliver it directly inside the app."}</div>
          <button onClick={request} disabled={requested} style={{ width: "100%", border: "none", borderRadius: 14, padding: "13px 16px", background: requested ? C.card2 : C.green, color: requested ? C.sub : C.onAccent, fontWeight: 900 }}>{requested ? (ar ? "✓ تم إرسال الطلب" : "✓ Request sent") : (ar ? "اطلب خطتك الغذائية" : "Request my nutrition plan")}</button>
          {requested && <div style={{ color: C.sub, fontSize: 11, marginTop: 10 }}>{ar ? "هنبلغك أول ما خطتك تجهز." : "We'll let you know when your plan is ready."}</div>}
        </Card>
      </div>
    </div>;
  }

  const start = plan.startDate || today;
  const diff = Math.max(0, Math.floor((new Date(today + "T00:00:00") - new Date(start + "T00:00:00")) / 86400000));
  const todayIndex = Math.min(6, Number.isFinite(diff) ? diff % 7 : 0);
  const [selectedDayIndex, setSelectedDayIndex] = useState(todayIndex);
  useEffect(() => { setSelectedDayIndex(todayIndex); }, [plan.startDate, todayIndex]);

  const day = plan.days?.[selectedDayIndex] || plan.days?.[0] || { meals: [] };
  const selectedDate = addDays(start, selectedDayIndex);
  const checked = log[selectedDate] || {};
  const meals = day.meals || [];
  const foods = meals.flatMap(m => parseItems(m.items, m.id));
  const consumed = foods.filter(f => checked[f.id]).reduce((a, f) => ({
    kcal: a.kcal + f.kcal, protein: a.protein + f.protein, carbs: a.carbs + f.carbs, fat: a.fat + f.fat,
  }), { kcal: 0, protein: 0, carbs: 0, fat: 0 });

  const pickNumber = (...values) => {
    for (const value of values) {
      const n = Number(value);
      if (Number.isFinite(n) && n > 0) return n;
    }
    return 0;
  };
  const targets = {
    kcal: pickNumber(day.targetKcal, day.kcalTarget, day.targetCalories, day.totalCalories, day.calories, day.kcal),
    protein: pickNumber(day.targetProtein, day.proteinTarget, day.totalProtein, day.protein),
    carbs: pickNumber(day.targetCarbs, day.carbsTarget, day.totalCarbs, day.carbs),
    fat: pickNumber(day.targetFat, day.fatTarget, day.totalFat, day.fat),
  };
  const pct = (v, t) => t > 0 ? Math.min(100, Math.round(v / t * 100)) : 0;

  const toggle = async id => {
    if (!auth.currentUser || saving) return;
    const next = { ...log, [selectedDate]: { ...(log[selectedDate] || {}), [id]: !checked[id] } };
    if (!next[selectedDate][id]) delete next[selectedDate][id];
    setLog(next);
    setSaving(true);
    try {
      await setDoc(doc(db, "users", auth.currentUser.uid), { customNutritionLog: next }, { merge: true });
    } catch {
      setLog(log);
    } finally {
      setSaving(false);
    }
  };

  return <div dir={ar ? "rtl" : "ltr"}>
    <TopBar title={ar ? "خطتك الغذائية" : "Your Nutrition Plan"} onBack={back} />
    <div style={{ padding: "0 18px 28px" }}>
      <Card style={{ background: C.greenSoft, border: `1px solid ${C.green}55`, marginBottom: 12 }}>
        <div style={{ color: C.text, fontSize: 19, fontWeight: 900 }}>{ar ? (plan.titleAr || "خطتك الغذائية") : (plan.title || "Your Nutrition Plan")}</div>
        <div style={{ color: C.sub, fontSize: 12, marginTop: 5 }}>{ar ? "خطة مخصصة لك من فريق Fifty Fit" : "A plan prepared for you by the Fifty Fit team"}</div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(2,1fr)", gap: 8, marginTop: 14 }}>
          {[["🔥", ar ? "السعرات" : "Calories", consumed.kcal, targets.kcal, "kcal"], ["💪", ar ? "البروتين" : "Protein", consumed.protein, targets.protein, "g"], ["🍞", ar ? "الكارب" : "Carbs", consumed.carbs, targets.carbs, "g"], ["🥑", ar ? "الدهون" : "Fat", consumed.fat, targets.fat, "g"]].map(([icon, label, value, target, unit]) => (
            <div key={label} style={{ background: C.card2, borderRadius: 12, padding: 11 }}>
              <div style={{ color: C.sub2, fontSize: 10, fontWeight: 800 }}>{icon} {label}</div>
              <div style={{ color: C.text, fontSize: 16, fontWeight: 900, marginTop: 3 }}>{Math.round(value)}{unit === "kcal" ? "" : "g"} <span style={{ color: C.sub2, fontSize: 10 }}>/ {target || "—"}{target ? (unit === "kcal" ? " kcal" : "g") : ""}</span></div>
              <div style={{ height: 5, background: C.border, borderRadius: 99, marginTop: 7, overflow: "hidden" }}><div style={{ width: `${pct(value, target)}%`, height: "100%", background: C.green, borderRadius: 99, transition: "width .25s ease" }} /></div>
            </div>
          ))}
        </div>
      </Card>

      <div style={{ display: "flex", gap: 6, overflowX: "auto", paddingBottom: 8 }}>
        {(plan.days || []).map((d, i) => (
          <button key={i} type="button" onClick={() => setSelectedDayIndex(i)} style={{ minWidth: 72, padding: "9px 7px", borderRadius: 11, border: "none", cursor: "pointer", background: i === selectedDayIndex ? C.green : C.card2, color: i === selectedDayIndex ? C.onAccent : C.sub, textAlign: "center", fontSize: 11, fontWeight: 800 }}>
            {ar ? (d.titleAr || `اليوم ${i + 1}`) : (d.title || `Day ${i + 1}`)}
          </button>
        ))}
      </div>

      {meals.map(meal => {
        const items = parseItems(meal.items, meal.id);
        if (!items.length) return null;
        return <Card key={meal.id} style={{ marginBottom: 10 }}>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 10 }}>
            <div>
              <div style={{ color: C.text, fontWeight: 900, fontSize: 15 }}>{ar ? (meal.titleAr || meal.title) : meal.title}</div>
              {meal.note && <div style={{ color: C.sub, fontSize: 11, marginTop: 3 }}>{meal.note}</div>}
            </div>
            <span style={{ color: C.sub2, fontSize: 11 }}>{items.length} {ar ? "عناصر" : "items"}</span>
          </div>
          {items.map(food => {
            const done = !!checked[food.id];
            return <button key={food.id} type="button" onClick={() => toggle(food.id)} style={{ width: "100%", display: "flex", alignItems: "center", gap: 11, padding: "11px 4px", border: "none", borderTop: `1px solid ${C.border}`, background: "transparent", color: C.text, textAlign: ar ? "right" : "left", cursor: "pointer" }}>
              <div style={{ width: 24, height: 24, borderRadius: 7, border: `1.5px solid ${done ? C.green : C.border}`, background: done ? C.green : "transparent", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>{done && <Check size={15} color={C.onAccent} strokeWidth={3} />}</div>
              <div style={{ flex: 1, opacity: done ? .65 : 1 }}>
                <div style={{ fontWeight: 800, fontSize: 13.5, textDecoration: done ? "line-through" : "none" }}>{ar ? food.nameAr : food.name}</div>
                <div style={{ color: C.sub, fontSize: 10.5, marginTop: 2 }}>{food.quantity}{food.kcal ? ` · ${food.kcal} kcal · P ${food.protein}g · C ${food.carbs}g · F ${food.fat}g` : ""}</div>
              </div>
            </button>;
          })}
        </Card>;
      })}
      <div style={{ color: C.sub2, fontSize: 10.5, textAlign: "center", padding: "8px 12px" }}>{ar ? "علّم على كل أكلة أكلتها فعلاً — الحساب بيتحدث تلقائيًا." : "Check only the food you actually ate — your daily totals update automatically."}</div>
    </div>
  </div>;
}
'''
text = text[:nut_start] + nutrition_fn + text[nut_end:]

# ---------- AI Coach keyboard: move composer above Android soft keyboard exactly ----------
if 'const [keyboardInset, setKeyboardInset] = useState(0);' not in text:
    text = text.replace('  const keyboardInset = 0;\n  const listRef = useRef(null);', '  const [keyboardInset, setKeyboardInset] = useState(0);\n  const listRef = useRef(null);', 1)
    hook = '''\n  useEffect(() => {\n    let alive = true;\n    let showListener;\n    let hideListener;\n    (async () => {\n      try {\n        const { Keyboard } = await import("@capacitor/keyboard");\n        await Keyboard.setResizeMode?.({ mode: "none" });\n        showListener = await Keyboard.addListener("keyboardWillShow", (event) => {\n          if (alive) setKeyboardInset(Math.max(0, Number(event?.keyboardHeight || 0)));\n        });\n        hideListener = await Keyboard.addListener("keyboardWillHide", () => {\n          if (alive) setKeyboardInset(0);\n        });\n      } catch {}\n    })();\n    return () => {\n      alive = false;\n      showListener?.remove?.();\n      hideListener?.remove?.();\n      import("@capacitor/keyboard").then(({ Keyboard }) => Keyboard.setResizeMode?.({ mode: "native" })).catch(() => {});\n    };\n  }, [open]);\n'''
    anchor = '  useEffect(() => {\n    if (listRef.current)\n      listRef.current.scrollTop = listRef.current.scrollHeight;'
    if anchor not in text:
        raise SystemExit('v7: AI scroll effect anchor not found')
    text = text.replace(anchor, hook + '\n' + anchor, 1)

# Move the side panel itself above the keyboard; no extra safe-area gap.
text = text.replace('          bottom: 0,\n          width: "min(360px, 92vw)",', '          bottom: `${keyboardInset}px`,\n          width: "min(360px, 92vw)",', 1)

APP.write_text(text, encoding='utf-8')

# Idempotent validation: fail only when the intended runtime code is absent.
assert 'openTikTokWebView' in text
assert 'function CardioExerciseView' in text and 'await persist(true, null)' in text
assert 'function NutritionPlanScreen' in text and 'setSelectedDayIndex' in text
assert 'const [keyboardInset, setKeyboardInset] = useState(0);' in text
assert 'bottom: `${keyboardInset}px`' in text
print('release-fixes-v7: applied TikTok native WebView, cardio persistence, nutrition day selection/targets, and AI keyboard fixes')
