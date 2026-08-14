from pathlib import Path
import re

APP = Path("src/App.jsx")
text = APP.read_text(encoding="utf-8")

# Admin-assigned plans are grants/assignments, not Play Billing entitlements.
# Keep billing gates for the normal Pro catalog, but never gate an explicitly
# assigned custom plan behind a verified subscription.
replacements = {
    'data.entitlements.trainingPro &&\n    data.customTrainingPlan?.days?.[DAYS.indexOf(day)]': 'data.customTrainingPlan?.days?.[DAYS.indexOf(day)]',
    'data.entitlements.trainingPro &&\n    data.customTrainingPlan?.days?.[DAYS.indexOf(selectedDay)]': 'data.customTrainingPlan?.days?.[DAYS.indexOf(selectedDay)]',
    'data.customTrainingPlan && data.entitlements.trainingPro && (': 'data.customTrainingPlan && (',
    'data.customNutritionPlan && data.entitlements.nutritionPro && (': 'data.customNutritionPlan && (',
}
for old, new in replacements.items():
    if old in text:
        text = text.replace(old, new)

# Also handle the same expressions if formatting changed to one line.
text = re.sub(
    r'data\.entitlements\.trainingPro\s*&&\s*data\.customTrainingPlan\?\.days\?\.\[DAYS\.indexOf\(day\)\]',
    'data.customTrainingPlan?.days?.[DAYS.indexOf(day)]',
    text,
)
text = re.sub(
    r'data\.entitlements\.trainingPro\s*&&\s*data\.customTrainingPlan\?\.days\?\.\[DAYS\.indexOf\(selectedDay\)\]',
    'data.customTrainingPlan?.days?.[DAYS.indexOf(selectedDay)]',
    text,
)
text = text.replace(
    'data.customTrainingPlan && data.entitlements.trainingPro && (',
    'data.customTrainingPlan && (',
)
text = text.replace(
    'data.customNutritionPlan && data.entitlements.nutritionPro && (',
    'data.customNutritionPlan && (',
)

# TikTok normal pages cannot be embedded in an iframe: TikTok serves the page
# with X-Frame-Options: SAMEORIGIN. Use Capacitor's native in-app WebView so
# the normal TikTok URL is the top-level page inside a full-screen WebView.
# This is intentionally NOT TikTok's /player/v1 official player and does not
# use oEmbed/resolvers.
if 'from "@capacitor/inappbrowser"' not in text:
    text = text.replace(
        'import { App as CapApp } from "@capacitor/app";\n',
        'import { App as CapApp } from "@capacitor/app";\nimport { InAppBrowser } from "@capacitor/inappbrowser";\n',
        1,
    )

viewer_pattern = re.compile(
    r'/\* Full-screen TikTok/YouTube viewer.*?\nfunction VideoPlayer\(',
    re.S,
)
viewer_replacement = r'''/* Full-screen exercise video viewer.
   TikTok is loaded as the normal first-party page inside a native WebView.
   No /player/v1 endpoint, no oEmbed resolver, and no TikTok app deep-link.
   The WebView is fullscreen and the Android back button closes/navigates it. */
function FullScreenVideoViewer({ videoId, ar, onClose }) {
  const isTikTok = /tiktok\.com/i.test(String(videoId || "")) || /^\d+$/.test(String(videoId || ""));
  const tikTokUrl = /^\d+$/.test(String(videoId || ""))
    ? `https://www.tiktok.com/video/${videoId}`
    : String(videoId || "");
  const youtubeUrl = `https://www.youtube-nocookie.com/embed/${videoId}?autoplay=1&playsinline=1&rel=0&modestbranding=1`;

  useEffect(() => {
    registerFullScreenVideoClose(onClose);
    let closedListener = null;
    let cancelled = false;

    const open = async () => {
      if (!isTikTok) return;
      try {
        closedListener = await InAppBrowser.addListener("browserClosed", () => onClose());
        await InAppBrowser.openInWebView({
          url: tikTokUrl,
          options: {
            showURL: false,
            showToolbar: false,
            showNavigationButtons: false,
            clearCache: false,
            clearSessionCache: false,
            mediaPlaybackRequiresUserAction: false,
            android: {
              allowZoom: false,
              hardwareBack: true,
              pauseMedia: false,
            },
          },
        });
      } catch (error) {
        console.warn("[TikTok] in-app WebView open failed", error);
        if (!cancelled) {
          try { window.open(tikTokUrl, "_blank", "noopener,noreferrer"); } catch {}
          onClose();
        }
      }
    };

    open();
    return () => {
      cancelled = true;
      closedListener?.remove?.();
      registerFullScreenVideoClose(null);
    };
  }, [isTikTok, tikTokUrl, onClose]);

  if (isTikTok) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={ar ? "مشغل الفيديو" : "Video player"}
      style={{
        position: "fixed", inset: 0, zIndex: 10000, background: "#000",
        display: "flex", flexDirection: "column",
      }}
    >
      <button
        type="button"
        onClick={onClose}
        aria-label={ar ? "إغلاق" : "Close"}
        style={{
          position: "absolute", top: 14, right: 14, zIndex: 2,
          width: 42, height: 42, borderRadius: 21, border: "1px solid rgba(255,255,255,.35)",
          background: "rgba(0,0,0,.7)", color: "#fff", fontSize: 24,
        }}
      >×</button>
      <iframe
        src={youtubeUrl}
        title={ar ? "فيديو التمرين" : "Exercise video"}
        allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
        allowFullScreen
        style={{ width: "100%", height: "100%", border: 0, background: "#000" }}
      />
    </div>
  );
}

function VideoPlayer('''
text, viewer_count = viewer_pattern.subn(viewer_replacement, text, count=1)
if viewer_count != 1:
    raise SystemExit(f"Expected exactly one FullScreenVideoViewer block, found {viewer_count}")

# Remove the old oEmbed resolver so no TikTok oEmbed request can be made by the
# build output. Direct TikTok URLs are already present in src/config.js.
text = re.sub(
    r'async function resolveTikTokVideoId\(value\)\s*\{.*?\n\}\n\n// In-app exercise video entry',
    '// In-app exercise video entry',
    text,
    count=1,
    flags=re.S,
)

# Cardio completion fix.
# The old flow called setData() and immediately navigated back. React state is
# asynchronous, so the Workout screen could render once with the old log and
# the old cardioStartedAt, making the timer appear to keep running. Completion
# now writes an explicit finished record, clears cardioStartedAt, stops the
# local timer, and navigates only after the state update has been scheduled.
cardio_pattern = re.compile(
    r'function CardioExerciseView\(\{.*?\n\}\n\n/\* ============================== EXERCISE DETAIL SCREEN',
    re.S,
)
cardio_replacement = r'''function CardioExerciseView({
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
  const [now, setNow] = useState(() => Date.now());
  const [startedAt, setStartedAt] = useState(() => {
    const value = Number(existingLog?.cardioStartedAt || 0);
    return Number.isFinite(value) && value > 0 ? value : null;
  });
  const [saving, setSaving] = useState(false);

  const finished = !!existingLog?.finished;
  const elapsed = startedAt
    ? Math.max(0, Math.floor((now - startedAt) / 1000))
    : 0;
  const remaining = finished
    ? 0
    : Math.max(0, DURATION_SECONDS - elapsed);
  const completed = finished || remaining === 0;
  const running = !!startedAt && !finished && remaining > 0;

  useEffect(() => {
    if (!startedAt || finished) return undefined;
    const id = window.setInterval(() => setNow(Date.now()), 250);
    return () => window.clearInterval(id);
  }, [startedAt, finished]);

  const writeLog = useCallback((finishedValue, cardioStartedAt) => {
    const next = clone(data);
    if (!next.logs[logDate]) next.logs[logDate] = {};
    next.logs[logDate][exerciseId] = {
      sets: [{ weight: 0, reps: "15 min", done: finishedValue }],
      finished: finishedValue,
      cardioStartedAt: finishedValue ? null : cardioStartedAt || null,
      cardioCompletedAt: finishedValue ? Date.now() : null,
    };
    setData(next);
    return next;
  }, [data, exerciseId, logDate, setData]);

  const finish = useCallback((reason) => {
    if (saving || finished) return;
    setSaving(true);
    writeLog(true, null);
    setStartedAt(null);
    setNow(Date.now());
    try { awardXp(35); } catch {}
    showToast(
      reason === "timer"
        ? (ar ? "خلصت الـ15 دقيقة! 💪" : "15 minutes complete! 💪")
        : (ar ? "تم حفظ الكارديو!" : "Cardio saved!"),
    );
    // Give the parent state setter a render opportunity before leaving the
    // detail screen so the workout list sees finished=true immediately.
    window.setTimeout(() => back(), 120);
  }, [ar, awardXp, back, finished, saving, showToast, writeLog]);

  useEffect(() => {
    if (startedAt && remaining === 0 && !finished && !saving) {
      finish("timer");
    }
  }, [finished, finish, remaining, saving, startedAt]);

  const start = () => {
    if (running || completed || saving) return;
    const value = Date.now();
    writeLog(false, value);
    setStartedAt(value);
    setNow(value);
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
            {completed ? "00:00" : `${mm}:${ss}`}
          </div>
          <div style={{ height: 7, background: C.card2, borderRadius: 99, marginTop: 18, overflow: "hidden" }}>
            <div style={{ height: "100%", width: `${completed ? 100 : progress * 100}%`, background: C.positive, borderRadius: 99, transition: "width .25s linear" }} />
          </div>
          <div style={{ display: "flex", gap: 10, marginTop: 18 }}>
            {!running && !completed && <GreenButton onClick={start} disabled={saving} style={{ flex: 1 }}>{ar ? "ابدأ 15 دقيقة" : "Start 15 min"}</GreenButton>}
            {running && <GreenButton onClick={() => finish("skip")} disabled={saving} style={{ flex: 1 }}>{ar ? "إنهاء الآن" : "Finish now"}</GreenButton>}
            {completed && <GreenButton onClick={back} style={{ flex: 1 }}>{ar ? "تم" : "Done"}</GreenButton>}
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

/* ============================== EXERCISE DETAIL SCREEN'''
text, cardio_count = cardio_pattern.subn(cardio_replacement, text, count=1)
if cardio_count != 1:
    raise SystemExit(f"Expected exactly one CardioExerciseView block, found {cardio_count}")

APP.write_text(text, encoding="utf-8")
print("Launch-readiness patch applied to src/App.jsx")
print("Custom admin plans are no longer gated by billing entitlements")
print("TikTok uses a normal full-screen in-app WebView; no player/v1 or oEmbed")
print("Cardio completion clears the timer and persists finished=true before navigation")