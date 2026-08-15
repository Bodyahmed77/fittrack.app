"""Single deterministic, idempotent release hardening step.

This is the only Android release-time source hardening step. It keeps APK and
AAB on the exact same corrected source tree and validates every required target.
"""
from pathlib import Path
import re

APP = Path("src/App.jsx")
text = APP.read_text(encoding="utf-8")

# ---------------------------------------------------------------------------
# 1) Workout day strip: rolling 7-day window centered around today.
# ---------------------------------------------------------------------------
text = text.replace(
    "const iso = addDays(mondayOf(dateKey(0)), i);",
    "const iso = addDays(dateKey(0), i - 3);",
    1,
)
text = text.replace(
    "const isToday = offset === 0;",
    "const isToday = iso === today;",
    1,
)
if "const iso = addDays(dateKey(0), i - 3);" not in text:
    raise SystemExit("release-fixes: rolling day-window source not present")
if "const isToday = offset === 0;" in text:
    raise SystemExit("release-fixes: stale workout offset reference remains")

# Completed day labels must stay white on the green completed background.
old_color = '''color:\n                      isSelected && (isDone || isMissed)\n                        ? "#fff"\n                        : isSelected\n                        ? C.onAccent\n                        : isDone\n                        ? C.positive\n                        : isMissed\n                        ? C.danger\n                        : isToday\n                        ? C.green\n                        : C.sub,'''
new_color = '''color:\n                      isDone || isMissed\n                        ? "#fff"\n                        : isSelected\n                        ? C.onAccent\n                        : isToday\n                        ? C.green\n                        : C.sub,'''
if old_color in text:
    text = text.replace(old_color, new_color, 1)
else:
    text, count = re.subn(
        r'isSelected\s*&&\s*\(isDone\s*\|\|\s*isMissed\)\s*\?\s*"#fff"\s*:\s*isSelected\s*\?\s*C\.onAccent\s*:\s*isDone\s*\?\s*C\.positive\s*:\s*isMissed\s*\?\s*C\.danger\s*:\s*isToday\s*\?\s*C\.green\s*:\s*C\.sub,',
        'isDone || isMissed ? "#fff" : isSelected ? C.onAccent : isToday ? C.green : C.sub,',
        text,
        count=1,
    )
    if count != 1:
        raise SystemExit("release-fixes: workout day-label color target not found")

# ---------------------------------------------------------------------------
# 2) AI Coach: native resize already shrinks the visible WebView. Do not
#    subtract keyboard height a second time from the fixed drawer.
# ---------------------------------------------------------------------------
text = text.replace("          bottom: keyboardInset,", "          bottom: 0,", 1)
text = text.replace(
    '          transition: keyboardInset ? "bottom 0.15s ease-out" : "none",\n',
    '          transition: "none",\n',
    1,
)
if "          bottom: keyboardInset," in text:
    raise SystemExit("release-fixes: AI Coach still double-offsets keyboard")

# ---------------------------------------------------------------------------
# 3) TikTok: keep the full-screen player inside Fifty Fit via native WebView.
# ---------------------------------------------------------------------------
if 'import { registerPlugin } from "@capacitor/core";' not in text:
    text = text.replace(
        'import { App as CapApp } from "@capacitor/app";',
        'import { registerPlugin } from "@capacitor/core";\nimport { App as CapApp } from "@capacitor/app";',
        1,
    )
if 'const TikTokWebView = registerPlugin("TikTokWebView");' not in text:
    text = text.replace(
        'import { deleteAccountServerData } from "./deleteAccount";',
        'import { deleteAccountServerData } from "./deleteAccount";\n\nconst TikTokWebView = registerPlugin("TikTokWebView");',
        1,
    )

viewer_re = re.compile(
    r"function FullScreenVideoViewer\(\{ videoId, ar, onClose \}\) \{.*?\n\}\n\nfunction VideoPlayer",
    re.S,
)
viewer = r'''function FullScreenVideoViewer({ videoId, ar, onClose }) {
  const tikTokPostId = getTikTokPostId(videoId);
  const isTikTok = isTikTokVideoRef(videoId);
  const [nativeOpening, setNativeOpening] = useState(isTikTok && !!tikTokPostId);

  useEffect(() => {
    let alive = true;
    if (isTikTok && tikTokPostId) {
      setNativeOpening(true);
      TikTokWebView.open({ url: videoId })
        .then(() => { if (alive) onClose(); })
        .catch(() => { if (alive) setNativeOpening(false); });
    }
    return () => { alive = false; };
  }, [isTikTok, tikTokPostId, videoId, onClose]);

  const embedSrc = `https://www.youtube-nocookie.com/embed/${videoId}?autoplay=1&playsinline=1&rel=0&modestbranding=1`;
  if (isTikTok && tikTokPostId && nativeOpening) {
    return (
      <div role="dialog" aria-modal="true" style={{position:"fixed",inset:0,zIndex:4000,background:"#000",display:"flex",alignItems:"center",justifyContent:"center",color:"#fff"}}>
        <div style={{fontSize:13,fontWeight:600}}>{ar ? "جاري فتح الفيديو…" : "Opening video…"}</div>
      </div>
    );
  }
  return (
    <div role="dialog" aria-modal="true" aria-label={ar ? "مشغل الفيديو" : "Video player"} style={{position:"fixed",inset:0,zIndex:4000,background:"#000",display:"flex",flexDirection:"column",paddingTop:"env(safe-area-inset-top)",paddingBottom:"env(safe-area-inset-bottom)"}}>
      <div style={{flexShrink:0,display:"flex",alignItems:"center",justifyContent:"space-between",padding:"10px 12px",gap:8}}>
        <div style={{color:"#fff",fontWeight:700,fontSize:14}}>{ar ? "فيديو التمرين" : "Exercise video"}</div>
        <button type="button" onClick={onClose} aria-label={ar ? "إغلاق" : "Close"} style={{width:36,height:36,borderRadius:"50%",border:"none",background:"rgba(255,255,255,.15)",color:"#fff",display:"flex",alignItems:"center",justifyContent:"center"}}><X size={18} color="#fff" /></button>
      </div>
      <div style={{flex:1,minHeight:0,position:"relative",width:"100%",background:"#000"}}>
        <iframe src={embedSrc} loading="eager" title={ar ? "فيديو التمرين" : "Exercise video"} referrerPolicy="strict-origin-when-cross-origin" style={{position:"absolute",inset:0,width:"100%",height:"100%",border:"none"}} allow="autoplay; encrypted-media; fullscreen; picture-in-picture" allowFullScreen />
      </div>
    </div>
  );
}

function VideoPlayer'''
if not viewer_re.search(text):
    raise SystemExit("release-fixes: FullScreenVideoViewer target not found")
text = viewer_re.sub(viewer, text, count=1)

# ---------------------------------------------------------------------------
# 4) Admin-published training plans: a custom plan is only active after the
#    user explicitly chooses "Use This Plan". Selecting a built-in plan must
#    immediately restore that built-in schedule, even when an old custom plan
#    remains stored in Firestore.
# ---------------------------------------------------------------------------
if 'const customTrainingActive = data.activePlanId === "__custom_training__";' not in text:
    anchor = 'function getMergedExercises(data, day) {\n'
    if anchor not in text:
        raise SystemExit("release-fixes: getMergedExercises anchor not found")
    text = text.replace(
        anchor,
        anchor + '  const customTrainingActive = data.activePlanId === "__custom_training__";\n',
        1,
    )

text = text.replace(
    '  const customTrainingDay =\n    data.customTrainingPlan?.days?.[DAYS.indexOf(day)];',
    '  const customTrainingDay = customTrainingActive\n    ? data.customTrainingPlan?.days?.[DAYS.indexOf(day)]\n    : null;',
    2,
)

# WorkoutScreen directly used the custom plan as its schedule even when a
# different built-in plan was selected. Gate that lookup on the same active flag.
text = text.replace(
    '  const assignedCustomDay =\n    data.customTrainingPlan?.days?.[DAYS.indexOf(selectedDay)];',
    '  const assignedCustomDay =\n    data.activePlanId === "__custom_training__"\n      ? data.customTrainingPlan?.days?.[DAYS.indexOf(selectedDay)]\n      : null;',
    1,
)

# The custom plan card needs a real activation action. Replace its simple
# "open workout" behavior with an explicit Use This Plan action and leave the
# built-in Plans list available below it.
custom_card_pattern = re.compile(
    r'''\{data\.customTrainingPlan && \(\n\s*<div style=\{\{ padding: "0 18px 10px" \}\}>\n\s*<Card\n\s*onClick=\{\(\) => go\("workout"\)\}\n\s*style=\{\{\n\s*background: C\.greenSoft,\n\s*border: `1\.5px solid \$\{C\.green\}66`,\n\s*cursor: "pointer",\n\s*\}\}\n\s*>\n\s*<div style=\{\{ color: C\.sub, fontSize: 10, fontWeight: 900, letterSpacing: 0\.6 \}\}>\n\s*\{ar \? "خطة تدريب مخصصة" : "PERSONALIZED TRAINING"\}\n\s*</div>\n\s*<div style=\{\{ color: C\.text, fontSize: 15, fontWeight: 900, marginTop: 4 \}\}>\n\s*🏋️ \{ar \? \(data\.customTrainingPlan\.titleAr \|\| "خطة التدريب المخصصة"\) : \(data\.customTrainingPlan\.title \|\| "Personal Training Plan"\)\}\n\s*</div>\n\s*<div style=\{\{ color: C\.sub, fontSize: 11\.5, marginTop: 4 \}\}>\n\s*\{ar \? `تبدأ \$\{data\.customTrainingPlan\.startDate \|\| dateKey\(0\)\}` : `Starts \$\{data\.customTrainingPlan\.startDate \|\| dateKey\(0\)\}`\}\n\s*</div>\n\s*<div style=\{\{ color: C\.text, fontSize: 11\.5, fontWeight: 800, marginTop: 9 \}\}>\n\s*\{ar \? "فتح خطة التدريب ←" : "Open Training Plan →"\}\n\s*</div>\n\s*</Card>\n\s*</div>\n\s*\)}''',
    re.S,
)
custom_card_replacement = '''{data.customTrainingPlan && (
        <div style={{ padding: "0 18px 10px" }}>
          <Card
            style={{
              background: C.greenSoft,
              border: `1.5px solid ${C.green}66`,
            }}
          >
            <div style={{ color: C.sub, fontSize: 10, fontWeight: 900, letterSpacing: 0.6 }}>
              {ar ? "خطة تدريب مخصصة" : "PERSONALIZED TRAINING"}
            </div>
            <div style={{ color: C.text, fontSize: 15, fontWeight: 900, marginTop: 4 }}>
              🏋️ {ar ? (data.customTrainingPlan.titleAr || "خطة التدريب المخصصة") : (data.customTrainingPlan.title || "Personal Training Plan")}
            </div>
            <div style={{ color: C.sub, fontSize: 11.5, marginTop: 4 }}>
              {ar ? `تبدأ ${data.customTrainingPlan.startDate || dateKey(0)}` : `Starts ${data.customTrainingPlan.startDate || dateKey(0)}`}
            </div>
            <div style={{ color: C.sub, fontSize: 11.5, marginTop: 8 }}>
              {data.activePlanId === "__custom_training__"
                ? (ar ? "الخطة دي مستخدمة حاليًا" : "This plan is active")
                : (ar ? "الخطة متاحة لك — اختر استخدامها لتحديث تمارينك" : "Available to you — use it to replace your current workout plan")}
            </div>
            <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
              <GreenButton
                onClick={() => {
                  const next = clone(data);
                  next.activePlanId = "__custom_training__";
                  next.workoutStartDate = dateKey(0);
                  setData(next);
                  showToast(ar ? "تم استخدام خطة التدريب المخصصة" : "Personalized training plan is now active");
                  go("workout");
                }}
                disabled={data.activePlanId === "__custom_training__"}
                style={{ flex: 1 }}
              >
                {data.activePlanId === "__custom_training__"
                  ? (ar ? "دي خطتك الحالية" : "Active Plan")
                  : (ar ? "استخدم الخطة دي" : "Use This Plan")}
              </GreenButton>
              <GreenButton
                variant="outline"
                onClick={() => go("workout")}
                style={{ flex: 1 }}
              >
                {ar ? "فتح التمرين" : "Open Workout"}
              </GreenButton>
            </div>
          </Card>
        </div>
      )}'''
if custom_card_pattern.search(text):
    text = custom_card_pattern.sub(custom_card_replacement, text, count=1)
else:
    raise SystemExit("release-fixes: custom training plan card target not found")

# PlanDetail built-in switching must deactivate a previously active custom plan.
# The existing use() already writes activePlanId=planId; with the merge gating
# above this is enough to switch the displayed workouts immediately.

# ---------------------------------------------------------------------------
# 5) Startup animation must exist and remain visible long enough to be seen.
#    main.jsx is the source of truth; this check prevents a release from
#    silently reverting to an invisible/zero-duration startup shell.
# ---------------------------------------------------------------------------
main = Path("src/main.jsx")
main_text = main.read_text(encoding="utf-8")
if "function StartupGate" not in main_text:
    raise SystemExit("release-fixes: StartupGate is missing")
if "setTimeout(() => setMinimumTimeElapsed(true), 1600)" not in main_text:
    raise SystemExit("release-fixes: startup animation minimum duration is not 1600ms")
if "animation: \"fiftyLogoIn 1.15s" not in main_text:
    raise SystemExit("release-fixes: startup logo animation is missing")

APP.write_text(text, encoding="utf-8")

# Final source assertions.
final = APP.read_text(encoding="utf-8")
assert 'const customTrainingActive = data.activePlanId === "__custom_training__";' in final
assert 'data.activePlanId === "__custom_training__"\n      ? data.customTrainingPlan' in final
assert 'next.activePlanId = "__custom_training__";' in final
assert 'استخدم الخطة دي' in final
assert "const iso = addDays(dateKey(0), i - 3);" in final
assert "const isToday = offset === 0;" not in final
assert "          bottom: keyboardInset," not in final
assert 'const TikTokWebView = registerPlugin("TikTokWebView");' in final
assert 'TikTokWebView.open({ url: videoId })' in final
print("release-fixes: consolidated release source fixes applied")
print("release-fixes: workout day strip rolls daily and keeps completed labels visible")
print("release-fixes: AI Coach drawer sits directly above native keyboard")
print("release-fixes: TikTok remains in-app via native WebView")
print("release-fixes: admin custom training plan is opt-in and built-in plan switching overrides old custom plans")
print("release-fixes: startup animation is enforced at 1600ms")
