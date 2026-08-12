import React, { useCallback, useEffect, useState } from "react";
import { Target } from "lucide-react";

export const CARDIO_IDS = new Set(["treadmill", "bike", "jump_rope", "burpees"]);

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function extractTikTokVideoId(value) {
  if (!value) return "";
  const raw = String(value).trim();
  if (/^\d+$/.test(raw)) return raw;
  return raw.match(/\/video\/(\d+)/)?.[1] || "";
}

async function resolveTikTokVideoId(value) {
  const direct = extractTikTokVideoId(value);
  if (direct) return direct;
  if (!/tiktok\.com/i.test(String(value || ""))) return "";
  const response = await fetch(`https://www.tiktok.com/oembed?url=${encodeURIComponent(value)}`);
  if (!response.ok) throw new Error(`TikTok oEmbed ${response.status}`);
  const payload = await response.json();
  return String(payload?.html || "").match(/data-video-id=["'](\d+)["']/i)?.[1] || "";
}

export function CardioExerciseView({
  data, setData, back, exerciseId, logDate, ex, ar, C, showToast, awardXp,
  TopBar, Card, GreenButton,
}) {
  const DURATION_SECONDS = 15 * 60;
  const existingLog = data.logs[logDate]?.[exerciseId] || null;
  const [now, setNow] = useState(() => Date.now());
  const [startedAt, setStartedAt] = useState(() => Number(existingLog?.cardioStartedAt || 0) || null);
  const [videoId, setVideoId] = useState(() => extractTikTokVideoId(ex.vid));
  const [videoError, setVideoError] = useState(false);
  const [saving, setSaving] = useState(false);

  const elapsed = startedAt ? Math.max(0, Math.floor((now - startedAt) / 1000)) : 0;
  const remaining = Math.max(0, DURATION_SECONDS - elapsed);
  const completed = !!existingLog?.finished || remaining === 0;
  const running = !!startedAt && !completed;

  useEffect(() => {
    if (!startedAt || completed) return undefined;
    const id = window.setInterval(() => setNow(Date.now()), 250);
    return () => window.clearInterval(id);
  }, [startedAt, completed]);

  useEffect(() => {
    let cancelled = false;
    setVideoError(false);
    const direct = extractTikTokVideoId(ex.vid);
    setVideoId(direct);
    if (!direct) {
      resolveTikTokVideoId(ex.vid)
        .then((id) => { if (!cancelled) setVideoId(id); })
        .catch(() => { if (!cancelled) setVideoError(true); });
    }
    return () => { cancelled = true; };
  }, [ex.vid]);

  const persist = useCallback((finished, startValue = startedAt) => {
    const next = clone(data);
    if (!next.logs[logDate]) next.logs[logDate] = {};
    next.logs[logDate][exerciseId] = {
      sets: [{ weight: 0, reps: "15 min", done: finished }],
      finished,
      cardioStartedAt: startValue || null,
      cardioCompletedAt: finished ? Date.now() : null,
    };
    setData(next);
  }, [data, exerciseId, logDate, setData, startedAt]);

  const finish = useCallback((reason) => {
    if (saving) return;
    setSaving(true);
    persist(true, startedAt || Date.now());
    try { awardXp(35); } catch {}
    showToast(reason === "timer"
      ? (ar ? "خلصت الـ15 دقيقة! 💪" : "15 minutes complete! 💪")
      : (ar ? "تم حفظ الكارديو!" : "Cardio saved!"));
    back();
  }, [ar, awardXp, back, persist, saving, showToast, startedAt]);

  useEffect(() => {
    if (startedAt && remaining === 0 && !existingLog?.finished) finish("timer");
  }, [existingLog?.finished, finish, remaining, startedAt]);

  const start = () => {
    if (running || completed) return;
    const value = Date.now();
    setStartedAt(value);
    persist(false, value);
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
        <Card style={{ marginBottom: 14 }}>
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

        <Card style={{ marginBottom: 14, overflow: "hidden", padding: 0 }}>
          {videoId ? (
            <iframe
              src={`https://www.tiktok.com/player/v1/${videoId}?controls=1&autoplay=0&description=0&music_info=0&rel=0`}
              title={ar ? "فيديو الكارديو" : "Cardio video"}
              loading="lazy"
              allow="fullscreen"
              style={{ width: "100%", height: 430, border: 0, display: "block" }}
            />
          ) : (
            <div style={{ padding: 24, textAlign: "center", color: C.sub, fontSize: 13 }}>
              {videoError ? (ar ? "تعذر تحميل فيديو TikTok" : "Could not load the TikTok video") : (ar ? "جاري تحميل الفيديو..." : "Loading video...")}
            </div>
          )}
        </Card>

        <Card style={{ textAlign: "center", padding: "24px 18px" }}>
          <div style={{ color: C.sub, fontSize: 12, fontWeight: 700, marginBottom: 8 }}>
            {completed ? (ar ? "تم الإنجاز" : "Completed") : running ? (ar ? "الوقت المتبقي" : "Time remaining") : (ar ? "جاهز؟" : "Ready?")}
          </div>
          <div style={{ fontSize: 52, lineHeight: 1, fontWeight: 900, letterSpacing: 1.5, color: completed ? C.positive : C.text, fontVariantNumeric: "tabular-nums" }}>
            {completed ? "15:00" : `${mm}:${ss}`}
          </div>
          <div style={{ height: 7, background: C.card2, borderRadius: 99, marginTop: 18, overflow: "hidden" }}>
            <div style={{ height: "100%", width: `${completed ? 100 : progress * 100}%`, background: C.positive, borderRadius: 99 }} />
          </div>
          <div style={{ display: "flex", gap: 10, marginTop: 18 }}>
            {!running && !completed && <GreenButton onClick={start} style={{ flex: 1 }}>{ar ? "ابدأ 15 دقيقة" : "Start 15 min"}</GreenButton>}
            {running && <GreenButton onClick={skip} style={{ flex: 1 }}>{ar ? "إنهاء الآن" : "Finish now"}</GreenButton>}
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
