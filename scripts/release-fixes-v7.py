from pathlib import Path
import re

APP = Path("src/App.jsx")
text = APP.read_text(encoding="utf-8")
original = text

# ---------- 1) CARDIO ----------
text = text.replace(
    "  const completed = !!existingLog?.finished || remaining === 0;\n",
    "  const alreadyFinished = !!existingLog?.finished;\n"
    "  const completed = alreadyFinished;\n",
)

old_persist = """  const persist = useCallback((finished, cardioStartedAt = startedAt) => {
    const next = clone(data);
    if (!next.logs[logDate]) next.logs[logDate] = {};
    next.logs[logDate][exerciseId] = {
      sets: [{ weight: 0, reps: \"15 min\", done: finished }],
      finished,
      cardioStartedAt: cardioStartedAt || null,
      cardioCompletedAt: finished ? Date.now() : null,
    };
    setData(next);
  }, [data, exerciseId, logDate, setData, startedAt]);"""

new_persist = """  const persist = useCallback(async (finished, cardioStartedAt = startedAt) => {
    const next = clone(data);
    if (!next.logs[logDate]) next.logs[logDate] = {};
    next.logs[logDate][exerciseId] = {
      sets: [{ weight: 0, reps: \"15 min\", done: !!finished }],
      finished: !!finished,
      cardioStartedAt: finished ? null : (cardioStartedAt || null),
      cardioCompletedAt: finished ? Date.now() : null,
    };
    await setData(next);
  }, [data, exerciseId, logDate, setData, startedAt]);"""

if old_persist in text:
    text = text.replace(old_persist, new_persist, 1)
elif "const persist = useCallback(async (finished" not in text:
    raise SystemExit("v7: cardio persist block not found")

old_finish = """  const finish = useCallback((reason) => {
    if (saving) return;
    setSaving(true);
    persist(true, startedAt || Date.now());
    try { awardXp(35); } catch {}
    showToast(
      reason === \"timer\"
        ? (ar ? \"خلصت الـ15 دقيقة! 💪\" : \"15 minutes complete! 💪\")
        : (ar ? \"تم حفظ الكارديو!\" : \"Cardio saved!\"),
    );
    back();
  }, [ar, awardXp, back, persist, saving, showToast, startedAt]);"""

new_finish = """  const finish = useCallback(async (reason) => {
    if (saving || alreadyFinished) return;
    setSaving(true);
    try {
      await persist(true, null);
      setStartedAt(null);
      setNow(Date.now());
      try { awardXp(35); } catch {}
      showToast(
        reason === \"timer\"
          ? (ar ? \"خلصت الـ15 دقيقة! 💪\" : \"15 minutes complete! 💪\")
          : (ar ? \"تم حفظ الكارديو!\" : \"Cardio saved!\"),
      );
      back();
    } catch (e) {
      console.error(\"cardio finish failed\", e);
      showToast(ar ? \"فشل حفظ الكارديو — حاول تاني\" : \"Could not save cardio — try again\");
      setSaving(false);
    }
  }, [alreadyFinished, ar, awardXp, back, persist, saving, showToast]);"""

if old_finish in text:
    text = text.replace(old_finish, new_finish, 1)
elif "await persist(true, null)" not in text:
    raise SystemExit("v7: cardio finish block not found")

old_init = """  const [startedAt, setStartedAt] = useState(() => {
    const value = Number(existingLog?.cardioStartedAt || 0);
    return Number.isFinite(value) && value > 0 ? value : null;
  });"""

new_init = """  const [startedAt, setStartedAt] = useState(() => {
    if (existingLog?.finished) return null;
    const value = Number(existingLog?.cardioStartedAt || 0);
    if (!Number.isFinite(value) || value <= 0) return null;
    const elapsedSec = Math.floor((Date.now() - value) / 1000);
    if (elapsedSec >= DURATION_SECONDS) return null;
    return value;
  });"""

if old_init in text:
    text = text.replace(old_init, new_init, 1)

text = text.replace(
    "  const running = !!startedAt && !completed;\n",
    "  const running = !!startedAt && !completed && remaining > 0;\n",
)

# ---------- 2) TIKTOK ----------
text = re.sub(
    r"\nasync function resolveTikTokVideoId\(value\) \{.*?\n\}\n",
    "\n",
    text,
    count=1,
    flags=re.S,
)

old_viewer = """  const looksTikTok = /tiktok\\.com/i.test(String(videoId || \"\")) || /^\\d+$/.test(String(videoId || \"\"));
  const isTikTok = looksTikTok;
  const embedSrc = isTikTok
    ? String(videoId || \"\")
    : `https://www.youtube-nocookie.com/embed/${videoId}?autoplay=1&playsinline=1&rel=0&modestbranding=1`;

  useEffect(() => {
    let cancelled = false;
    setVideoLoaded(false);
    registerFullScreenVideoClose(() => {
      onClose();
      return true;
    });
    return () => registerFullScreenVideoClose(null);
  }, [onClose]);"""

new_viewer = """  const raw = String(videoId || \"\").trim();
  const isTikTok = /tiktok\\.com/i.test(raw) || /^\\d{8,}$/.test(raw);
  const embedSrc = isTikTok
    ? \"\"
    : /^https?:\\/\\//i.test(raw)
      ? raw
      : `https://www.youtube-nocookie.com/embed/${raw}?autoplay=1&playsinline=1&rel=0&modestbranding=1`;
  const tikTokUrl = isTikTok
    ? (/^https?:\\/\\//i.test(raw) ? raw : `https://www.tiktok.com/video/${raw}`)
    : \"\";

  useEffect(() => {
    let cancelled = false;
    setVideoLoaded(false);
    registerFullScreenVideoClose(() => {
      onClose();
      return true;
    });
    (async () => {
      if (!isTikTok || !tikTokUrl) return;
      try {
        const { Capacitor } = await import(\"@capacitor/core\");
        if (Capacitor.isNativePlatform()) {
          const { Browser } = await import(\"@capacitor/browser\");
          await Browser.open({
            url: tikTokUrl,
            presentationStyle: \"fullscreen\",
            toolbarColor: \"#000000\",
          });
          if (!cancelled) onClose();
          return;
        }
      } catch (e) {
        console.warn(\"[VIDEO] Capacitor Browser unavailable\", e);
      }
      try {
        const w = window.open(tikTokUrl, \"_blank\", \"noopener,noreferrer\");
        if (!w) window.location.assign(tikTokUrl);
      } catch (_) {}
      if (!cancelled) onClose();
    })();
    return () => {
      cancelled = true;
      registerFullScreenVideoClose(null);
      import(\"@capacitor/browser\").then(({ Browser }) => Browser.close?.()).catch(() => {});
    };
  }, [onClose, isTikTok, tikTokUrl]);"""

if old_viewer in text:
    text = text.replace(old_viewer, new_viewer, 1)
elif "Browser.open" not in text:
    print("v7 WARNING: FullScreenVideoViewer block not exact match")

needle_iframe = """        <iframe
          src={embedSrc}
          onLoad={() => setVideoLoaded(true)}
          loading=\"eager\"
          fetchPriority=\"high\"
          title={ar ? \"فيديو التمرين\" : \"Exercise video\"}
          referrerPolicy=\"strict-origin-when-cross-origin\"
          style={{
            position: \"absolute\",
            inset: 0,
            width: \"100%\",
            height: \"100%\",
            border: \"none\",
          }}
          allow=\"accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture\"
          allowFullScreen
        />"""

repl_iframe = """        {!isTikTok && embedSrc ? (
        <iframe
          src={embedSrc}
          onLoad={() => setVideoLoaded(true)}
          loading=\"eager\"
          fetchPriority=\"high\"
          title={ar ? \"فيديو التمرين\" : \"Exercise video\"}
          referrerPolicy=\"strict-origin-when-cross-origin\"
          style={{
            position: \"absolute\",
            inset: 0,
            width: \"100%\",
            height: \"100%\",
            border: \"none\",
          }}
          allow=\"accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture\"
          allowFullScreen
        />
        ) : isTikTok ? (
          <div style={{ position: \"absolute\", inset: 0, display: \"flex\", alignItems: \"center\", justifyContent: \"center\", color: \"#fff\", fontSize: 13, fontWeight: 600, padding: 24, textAlign: \"center\" }}>
            {ar ? \"جاري فتح الفيديو…\" : \"Opening video…\"}
          </div>
        ) : null}"""

if needle_iframe in text:
    text = text.replace(needle_iframe, repl_iframe, 1)

text = text.replace(
    "{data.customTrainingPlan && data.entitlements.trainingPro && (",
    "{data.customTrainingPlan && (",
)
text = text.replace(
    "{data.customNutritionPlan && data.entitlements.nutritionPro && (",
    "{data.customNutritionPlan && (",
)

if "const persist = useCallback(async (finished" not in text:
    raise SystemExit("v7: async persist missing after patch")
if "await persist(true, null)" not in text:
    raise SystemExit("v7: await persist missing after patch")
if "tiktok.com/oembed" in text:
    raise SystemExit("v7: oembed still present after patch")
if "const completed = !!existingLog?.finished || remaining === 0" in text:
    raise SystemExit("v7: buggy completed derivation still present")

APP.write_text(text, encoding="utf-8")
print("Release fixes v7 applied successfully" if text != original else "Release fixes v7: already applied")
print("Cardio: async persist + finished-only completion")
print("TikTok: original URL via Capacitor Browser; no oEmbed")
