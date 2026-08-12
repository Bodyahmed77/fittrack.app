from pathlib import Path

APP = Path("src/App.jsx")
CONFIG = Path("src/config.js")
ADMIN = Path("admin/cardio.js")

CARDIO_COMPONENT = r'''function CardioExerciseView({
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

  const elapsed = startedAt ? Math.max(0, Math.floor((now - startedAt) / 1000)) : 0;
  const remaining = Math.max(0, DURATION_SECONDS - elapsed);
  const completed = !!existingLog?.finished || remaining === 0;
  const running = !!startedAt && !completed;

  useEffect(() => {
    if (!startedAt || completed) return undefined;
    const id = window.setInterval(() => setNow(Date.now()), 250);
    return () => window.clearInterval(id);
  }, [startedAt, completed]);

  const persist = useCallback((finished, cardioStartedAt = startedAt) => {
    const next = clone(data);
    if (!next.logs[logDate]) next.logs[logDate] = {};
    next.logs[logDate][exerciseId] = {
      sets: [{ weight: 0, reps: "15 min", done: finished }],
      finished,
      cardioStartedAt: cardioStartedAt || null,
      cardioCompletedAt: finished ? Date.now() : null,
    };
    setData(next);
  }, [data, exerciseId, logDate, setData, startedAt]);

  const finish = useCallback((reason) => {
    if (saving) return;
    setSaving(true);
    persist(true, startedAt || Date.now());
    try { awardXp(35); } catch {}
    showToast(
      reason === "timer"
        ? (ar ? "خلصت الـ15 دقيقة! 💪" : "15 minutes complete! 💪")
        : (ar ? "تم حفظ الكارديو!" : "Cardio saved!"),
    );
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
'''

s = APP.read_text()
marker = '/* ============================== EXERCISE DETAIL SCREEN ============================== */'
if 'function CardioExerciseView({' not in s:
    if marker not in s:
        raise SystemExit('Exercise detail marker not found')
    s = s.replace(marker, CARDIO_COMPONENT + '\n' + marker, 1)

needle = '  const existingLog = data.logs[logDate]?.[exerciseId];\n'
branch = '''  const isCardio = ["treadmill", "bike", "jump_rope", "burpees"].includes(ex.id);\n  if (isCardio) {\n    return (\n      <CardioExerciseView\n        data={data}\n        setData={setData}\n        back={back}\n        exerciseId={exerciseId}\n        logDate={logDate}\n        ex={ex}\n        ar={ar}\n        C={C}\n        showToast={showToast}\n        awardXp={awardXp}\n      />\n    );\n  }\n\n'''
if 'const isCardio = ["treadmill", "bike", "jump_rope", "burpees"]' not in s:
    if needle not in s:
        raise SystemExit('ExerciseScreen insertion point not found')
    s = s.replace(needle, branch + needle, 1)

# TikTok short-link resolution via official oEmbed endpoint.
helper = r'''function extractTikTokVideoId(value) {
  if (!value) return "";
  const raw = String(value).trim();
  if (/^\d+$/.test(raw)) return raw;
  const match = raw.match(/\/video\/(\d+)/);
  return match ? match[1] : "";
}

async function resolveTikTokVideoId(value) {
  const direct = extractTikTokVideoId(value);
  if (direct) return direct;
  if (!/tiktok\.com/i.test(String(value || ""))) return "";
  const response = await fetch(`https://www.tiktok.com/oembed?url=${encodeURIComponent(value)}`);
  if (!response.ok) throw new Error(`TikTok oEmbed ${response.status}`);
  const payload = await response.json();
  const html = String(payload?.html || "");
  const id = html.match(/data-video-id=["'](\d+)["']/i)?.[1];
  return id || "";
}

'''
if 'async function resolveTikTokVideoId' not in s:
    anchor = '// In-app exercise video entry — button only on the Exercise Screen.\n'
    if anchor not in s:
        raise SystemExit('VideoPlayer anchor not found')
    s = s.replace(anchor, helper + anchor, 1)

old = '''function FullScreenVideoViewer({ videoId, ar, onClose }) {
  const [videoLoaded, setVideoLoaded] = useState(false);
  const isTikTok = /^\\d+$/.test(videoId);
  const embedSrc = isTikTok
    ? `https://www.tiktok.com/player/v1/${videoId}?controls=1&autoplay=0&description=0&music_info=0&rel=0`
    : `https://www.youtube-nocookie.com/embed/${videoId}?autoplay=1&playsinline=1&rel=0&modestbranding=1`;
'''
new = '''function FullScreenVideoViewer({ videoId, ar, onClose }) {
  const [videoLoaded, setVideoLoaded] = useState(false);
  const [resolvedTikTokId, setResolvedTikTokId] = useState(() => extractTikTokVideoId(videoId));
  const [videoResolveError, setVideoResolveError] = useState(false);
  const looksTikTok = /tiktok\\.com/i.test(String(videoId || "")) || /^\\d+$/.test(String(videoId || ""));
  const isTikTok = looksTikTok;
  const embedSrc = isTikTok
    ? (resolvedTikTokId ? `https://www.tiktok.com/player/v1/${resolvedTikTokId}?controls=1&autoplay=0&description=0&music_info=0&rel=0` : "about:blank")
    : `https://www.youtube-nocookie.com/embed/${videoId}?autoplay=1&playsinline=1&rel=0&modestbranding=1`;
'''
if old not in s:
    raise SystemExit('FullScreenVideoViewer header not found')
s = s.replace(old, new, 1)

old_effect = '''  useEffect(() => {
    setVideoLoaded(false);
    registerFullScreenVideoClose(() => {'''
new_effect = '''  useEffect(() => {
    let cancelled = false;
    setVideoLoaded(false);
    setVideoResolveError(false);
    setResolvedTikTokId(extractTikTokVideoId(videoId));
    if (looksTikTok && !extractTikTokVideoId(videoId)) {
      resolveTikTokVideoId(videoId)
        .then((id) => { if (!cancelled) setResolvedTikTokId(id); })
        .catch(() => { if (!cancelled) setVideoResolveError(true); });
    }
    registerFullScreenVideoClose(() => {'''
if old_effect not in s:
    raise SystemExit('FullScreenVideoViewer effect not found')
s = s.replace(old_effect, new_effect, 1)

# Keep the existing iframe, but make the resolution failure visible over the blank player.
needle_overlay = '''        <iframe
          src={embedSrc}'''
if needle_overlay in s and 'videoResolveError' not in s[s.index(needle_overlay):s.index(needle_overlay)+1000]:
    s = s.replace(needle_overlay, '''        {videoResolveError && (
          <div style={{ position: "absolute", inset: 0, zIndex: 2, display: "grid", placeItems: "center", padding: 24, textAlign: "center", background: C.card2, color: C.sub, fontSize: 13 }}>
            {ar ? "تعذر تحميل فيديو TikTok" : "Could not load the TikTok video"}
          </div>
        )}
        <iframe
          src={embedSrc}''', 1)

# Config: use the exact TikTok URLs supplied by the product owner.
c = CONFIG.read_text()
for oldv, newv in {
    'treadmill: "KyXBjRmE-W8", // YouTube': 'treadmill: "https://vt.tiktok.com/ZS4T2HfCY/", // TikTok',
    'bike: "zSNSNSBN8Og", // YouTube': 'bike: "https://vt.tiktok.com/ZS4T249MW/", // TikTok',
    'jump_rope: "FJmRQ5iTXKE", // YouTube': 'jump_rope: "https://www.tiktok.com/@tiboinshape/video/7358498825012661537", // TikTok',
    'burpees: "dZgVxmf6jkA", // YouTube': 'burpees: "https://vt.tiktok.com/ZS4TjS16a/", // TikTok',
}.items():
    if oldv not in c:
        raise SystemExit(f'Config mapping not found: {oldv}')
    c = c.replace(oldv, newv, 1)

# Admin: cardio is a fixed 15-minute activity, not a set/rep editor.
a = ADMIN.read_text()
old_duration = '''          <label>Duration (minutes)
            <input id="ff-cardio-minutes" type="number" min="1" max="300" step="1" value="15" inputmode="numeric" />
          </label>'''
new_duration = '''          <div style="padding:10px 12px;border:1px solid rgba(255,255,255,.10);border-radius:10px;background:#080b09;color:#dce4df;font-size:13px">Duration: <strong>15 minutes</strong> (fixed)</div>'''
if old_duration not in a:
    raise SystemExit('Admin duration control not found')
a = a.replace(old_duration, new_duration, 1)
a = a.replace('''      const minutes = Math.max(1, Math.min(300, Number(modal.querySelector("#ff-cardio-minutes").value) || 15));
      addCardio(type, minutes);''', '''      const minutes = 15;
      addCardio(type, minutes);''', 1)
a = a.replace('    modal.querySelector("#ff-cardio-minutes").focus();\n', '', 1)

APP.write_text(s)
CONFIG.write_text(c)
ADMIN.write_text(a)
print('cardio patch applied')
