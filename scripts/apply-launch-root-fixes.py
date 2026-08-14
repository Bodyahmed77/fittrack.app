from pathlib import Path
import re
import subprocess

APP = Path("src/App.jsx")
INDEX = Path("index.html")
WORKFLOW = Path(".github/workflows/build-android.yml")

text = APP.read_text(encoding="utf-8")

# ---------- Imports ----------
if 'from "@capacitor/browser"' not in text:
    text = text.replace('import { auth, db } from "./firebase";\n', 'import { auth, db } from "./firebase";\nimport { Browser } from "@capacitor/browser";\n', 1)

# ---------- TikTok / video viewer ----------
viewer_pattern = re.compile(
    r'// In-app exercise video player\..*?/\* ============================== EXERCISE VISUAL ============================== \*/',
    re.S,
)
viewer_replacement = r'''// In-app exercise video player.
// TikTok watch pages must NOT be embedded in an iframe; TikTok blocks framing
// and can return a 404 fallback. TikTok URLs therefore open through the native
// Capacitor Browser surface using the original configured URL. YouTube Shorts
// retain the existing full-screen iframe viewer.
let __closeFullScreenVideo = null;
function registerFullScreenVideoClose(fn) {
  __closeFullScreenVideo = fn;
}

function isTikTokVideoRef(value) {
  const raw = String(value || "").trim();
  return /(?:^|https?:\/\/)(?:www\.|m\.|vt\.)?tiktok\.com/i.test(raw) || /^\d+$/.test(raw);
}

function FullScreenVideoViewer({ videoId, ar, onClose }) {
  const [videoLoaded, setVideoLoaded] = useState(false);
  const embedSrc = `https://www.youtube-nocookie.com/embed/${videoId}?autoplay=1&playsinline=1&rel=0&modestbranding=1`;

  useEffect(() => {
    setVideoLoaded(false);
    registerFullScreenVideoClose(() => {
      onClose();
      return true;
    });
    return () => registerFullScreenVideoClose(null);
  }, [onClose, videoId]);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={ar ? "مشغل الفيديو" : "Video player"}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 4000,
        background: "#000",
        display: "flex",
        flexDirection: "column",
        paddingTop: "env(safe-area-inset-top)",
        paddingBottom: "env(safe-area-inset-bottom)",
      }}
    >
      <div style={{
        flexShrink: 0,
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "10px 12px",
        gap: 8,
      }}>
        <div style={{ color: "#fff", fontWeight: 700, fontSize: 14 }}>
          {ar ? "فيديو التمرين" : "Exercise video"}
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label={ar ? "إغلاق" : "Close"}
          style={{
            width: 36,
            height: 36,
            borderRadius: "50%",
            border: "none",
            background: "rgba(255,255,255,0.15)",
            color: "#fff",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <X size={18} color="#fff" />
        </button>
      </div>
      <div style={{ flex: 1, minHeight: 0, position: "relative", width: "100%", background: "#000" }}>
        {!videoLoaded && (
          <div style={{
            position: "absolute",
            inset: 0,
            zIndex: 1,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            background: "#000",
            color: "#fff",
            fontSize: 13,
            fontWeight: 600,
          }}>
            {ar ? "جاري تحميل الفيديو…" : "Loading video…"}
          </div>
        )}
        <iframe
          src={embedSrc}
          onLoad={() => setVideoLoaded(true)}
          loading="eager"
          fetchPriority="high"
          title={ar ? "فيديو التمرين" : "Exercise video"}
          referrerPolicy="strict-origin-when-cross-origin"
          style={{ position: "absolute", inset: 0, width: "100%", height: "100%", border: "none" }}
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
        />
      </div>
    </div>
  );
}

async function openTikTokVideo(tikTokUrl, ar) {
  const raw = String(tikTokUrl || "").trim();
  if (!raw) return;
  try {
    await Browser.open({
      url: raw,
      presentationStyle: "fullscreen",
      toolbarColor: "#000000",
    });
  } catch (error) {
    console.error("[TikTok] Browser.open failed", error);
    // Do not launch the TikTok native app. Keep the failure inside the app.
    throw new Error(ar ? "تعذر فتح فيديو التمرين داخل التطبيق." : "Could not open the exercise video inside the app.");
  }
}

function VideoPlayer({ videoId, ar }) {
  const { C } = useUI();
  const [open, setOpen] = useState(false);

  const close = useCallback(() => setOpen(false), []);
  if (!videoId) return null;

  const isTikTok = isTikTokVideoRef(videoId);
  const handleWatch = async () => {
    if (isTikTok) {
      try {
        await openTikTokVideo(String(videoId), ar);
      } catch (error) {
        // Keep the error in the app; do not redirect to a native/social app.
        console.warn(error);
      }
      return;
    }
    setOpen(true);
  };

  return (
    <>
      <div style={{ marginBottom: 14, width: "100%", display: "flex", justifyContent: "center" }}>
        <button
          type="button"
          onClick={handleWatch}
          style={{
            width: "100%",
            maxWidth: 360,
            aspectRatio: "9/16",
            background: C.card2,
            border: `1px solid ${C.border}`,
            borderRadius: 14,
            cursor: "pointer",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            gap: 10,
            overflow: "hidden",
            position: "relative",
          }}
        >
          {!isTikTok && (
            <img
              src={`https://img.youtube.com/vi/${videoId}/mqdefault.jpg`}
              alt=""
              style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover", opacity: 0.6 }}
            />
          )}
          <div style={{
            position: "relative",
            width: 52,
            height: 52,
            borderRadius: "50%",
            background: "rgba(255,255,255,0.9)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}>
            <div style={{ width: 0, height: 0, borderTop: "11px solid transparent", borderBottom: "11px solid transparent", borderLeft: "18px solid #000", marginLeft: 4 }} />
          </div>
          <span style={{ position: "relative", color: "#fff", fontSize: 13, fontWeight: 700, textShadow: "0 1px 4px rgba(0,0,0,0.8)" }}>
            {ar ? "دوس على الشورت لمشاهدة الفيديو" : "Watch Short Demo"}
          </span>
        </button>
      </div>
      {open && <FullScreenVideoViewer videoId={videoId} ar={ar} onClose={close} />}
    </>
  );
}

/* ============================== EXERCISE VISUAL ============================== */'''
text, changed_viewer = viewer_pattern.subn(viewer_replacement, text, count=1)
if changed_viewer != 1:
    raise SystemExit("launch migration: expected video viewer block not found")

# ---------- Firestore setData: return a real success/failure value ----------
setdata_pattern = re.compile(
    r'  const setData = useCallback\(\n    async \(next\) => \{\n.*?\n    \},\n    \[uid\],\n  \);',
    re.S,
)
setdata_replacement = '''  const setData = useCallback(
    async (next) => {
      verifiedEntitlementsRef.current = next.entitlements;
      setDataRaw(next);
      if (!uid) return true;
      try {
        const persisted = Object.fromEntries(
          Object.entries(next).filter(
            ([key]) =>
              key !== "entitlements" &&
              key !== "customTrainingPlan" &&
              key !== "customNutritionPlan",
          ),
        );
        await setDoc(
          doc(db, "users", uid),
          { ...persisted, updatedAt: new Date().toISOString() },
          { merge: true },
        );
        return true;
      } catch (e) {
        console.error("save failed", e);
        return false;
      }
    },
    [uid],
  );'''
text, changed_setdata = setdata_pattern.subn(setdata_replacement, text, count=1)
if changed_setdata != 1:
    raise SystemExit("launch migration: setData block not found")

# ---------- Cardio: explicit IDLE/RUNNING/COMPLETED state machine ----------
cardio_pattern = re.compile(
    r'function CardioExerciseView\(\{.*?\n\}\n\n/\* ============================== EXERCISE DETAIL SCREEN ============================== \*/',
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
  const alreadyFinished = existingLog?.finished === true;
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

  useEffect(() => {
    if (alreadyFinished || !existingStartedAt || resumableStartedAt || !uidSafe()) return;
    // A stale unfinished timer should reset to IDLE instead of auto-completing.
    if (existingElapsed >= DURATION_SECONDS) {
      setStartedAt(null);
    }
  }, [alreadyFinished, existingStartedAt, resumableStartedAt, existingElapsed]);

  useEffect(() => {
    if (phase !== "RUNNING") return undefined;
    const id = window.setInterval(() => setNow(Date.now()), 250);
    return () => window.clearInterval(id);
  }, [phase]);

  const persist = useCallback(
    async (finished, cardioStartedAt = startedAt) => {
      const next = clone(data);
      if (!next.logs[logDate]) next.logs[logDate] = {};
      next.logs[logDate][exerciseId] = {
        sets: [{ weight: 0, reps: "15 min", done: finished }],
        finished,
        cardioStartedAt: finished ? null : cardioStartedAt || null,
        cardioCompletedAt: finished ? Date.now() : null,
      };
      const ok = await setData(next);
      if (ok === false) throw new Error("Cardio persistence failed");
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
    if (phase === "RUNNING" && remaining <= 0 && !saving) {
      finish("timer");
    }
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
            {phase === "RUNNING" && <GreenButton onClick={skip} disabled={saving} style={{ flex: 1 }}>{saving ? (ar ? "جاري الحفظ…" : "Saving…") : (ar ? "إنهاء الآن" : "Finish now")}</GreenButton>}
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

/* ============================== EXERCISE DETAIL SCREEN ============================== */'''
# remove accidental helper reference if present in replacement by making it local-safe
cardio_replacement = cardio_replacement.replace(' && !uidSafe()', '')
text, changed_cardio = cardio_pattern.subn(cardio_replacement, text, count=1)
if changed_cardio != 1:
    raise SystemExit("launch migration: expected CardioExerciseView block not found")

# ---------- Custom admin-assigned plans are independent of billing ----------
text = re.sub(r'data\.customTrainingPlan\s*&&\s*data\.entitlements\.trainingPro\s*&&', 'data.customTrainingPlan &&', text)
text = re.sub(r'data\.customNutritionPlan\s*&&\s*data\.entitlements\.nutritionPro\s*&&', 'data.customNutritionPlan &&', text)
text = re.sub(r'data\.entitlements\.trainingPro\s*&&\s*data\.customTrainingPlan\?\.days\?\.', 'data.customTrainingPlan?.days?.', text)
text = re.sub(r'data\.entitlements\.nutritionPro\s*&&\s*data\.customNutritionPlan\?\.', 'data.customNutritionPlan?.', text)

APP.write_text(text, encoding="utf-8")

# ---------- index.html: remove obsolete TikTok DOM fallback ----------
html = INDEX.read_text(encoding="utf-8")
html = re.sub(r'\n\s*<link rel="preconnect" href="https://www\.tiktok\.com" crossorigin />', '', html, count=1)
html = re.sub(r'\n\s*var shownTikTok = new WeakSet\(\);\n\s*function keepTikTokInsideViewer\(\) \{.*?\n\s*\}\n\n\s*try \{\n\s*var vv = window\.visualViewport;', '\n\n        try {\n          var vv = window.visualViewport;', html, count=1, flags=re.S)
html = html.replace('            syncAiDrawer();\n            keepTikTokInsideViewer();\n', '            syncAiDrawer();\n', 1)
html = html.replace('          setTimeout(keepTikTokInsideViewer, 0);\n', '', 1)
INDEX.write_text(html, encoding="utf-8")

# ---------- one-time migration: remove itself and its workflow hook ----------
workflow = WORKFLOW.read_text(encoding="utf-8")
hook_pattern = re.compile(r'\n      # BEGIN ONE-TIME LAUNCH ROOT FIX MIGRATION.*?# END ONE-TIME LAUNCH ROOT FIX MIGRATION\n', re.S)
workflow = hook_pattern.sub('\n', workflow, count=1)
WORKFLOW.write_text(workflow, encoding="utf-8")

# Remove the migration script from the working tree after applying it so this
# does not become another permanent release-fix layer.
Path(__file__).unlink()

# Validate the intended source-level contracts before committing.
updated_app = APP.read_text(encoding="utf-8")
updated_index = INDEX.read_text(encoding="utf-8")
assert 'Browser.open({\n      url: raw' in updated_app or 'Browser.open({' in updated_app
assert 'tiktok.com/oembed' not in updated_app.lower()
assert 'resolveTikTokVideoId' not in updated_app
assert 'phase === "RUNNING"' in updated_app
assert 'phase === "COMPLETED"' in updated_app
assert 'await setData(next)' in updated_app
assert 'clearInterval' in updated_app
assert 'keepTikTokInsideViewer' not in updated_index

subprocess.run(["git", "config", "user.name", "github-actions[bot]"], check=True)
subprocess.run(["git", "config", "user.email", "41898282+github-actions[bot]@users.noreply.github.com"], check=True)
subprocess.run(["git", "add", "src/App.jsx", "index.html", "scripts/apply-launch-root-fixes.py", ".github/workflows/build-android.yml"], check=True)
subprocess.run(["git", "commit", "-m", "fix: land Claude root-cause fixes [skip ci]"], check=True)
subprocess.run(["git", "push", "origin", "HEAD:main"], check=True)
print("Claude root-cause fixes applied to source and pushed to main")
