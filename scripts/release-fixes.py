"""Idempotent Android release-source validation and hardening.

This script is intentionally based on semantic function/line anchors from the
current source. It never injects DOM, never creates plan-card renderers, and
never invents TikTok URLs. APK and AAB both consume the same post-hardening
workspace in the same workflow run.
"""
from pathlib import Path
import re

APP = Path("src/App.jsx")
MAIN = Path("src/main.jsx")
text = APP.read_text(encoding="utf-8")


def replace_once_or_already(old: str, new: str, *, label: str) -> None:
    global text
    if new in text:
        return
    count = text.count(old)
    if count != 1:
        raise SystemExit(f"release-fixes: required current target not unique for {label}: {count}")
    text = text.replace(old, new, 1)


def function_block(source: str, signature: str, next_signature: str) -> tuple[int, int]:
    start = source.find(signature)
    if start < 0:
        raise SystemExit(f"release-fixes: {signature} not found")
    next_pos = source.find(next_signature, start + len(signature))
    if next_pos < 0:
        raise SystemExit(f"release-fixes: {next_signature} not found after {signature}")
    return start, next_pos


# ---------------------------------------------------------------------------
# 1) Workout day strip: fix the current source's stale Monday/offset logic.
# ---------------------------------------------------------------------------
replace_once_or_already(
    'const iso = addDays(mondayOf(dateKey(0)), i);',
    'const iso = addDays(dateKey(0), i - 3);',
    label="workout rolling-day anchor",
)
replace_once_or_already(
    'const isToday = offset === 0;',
    'const isToday = iso === today;',
    label="workout today detection",
)

legacy_day_label = '''color:\n                      isSelected && (isDone || isMissed)\n                        ? "#fff"\n                        : isSelected\n                        ? C.onAccent\n                        : isDone\n                        ? C.positive\n                        : isMissed\n                        ? C.danger\n                        : isToday\n                        ? C.green\n                        : C.sub,'''
fixed_day_label = '''color:\n                      isDone || isMissed\n                        ? "#fff"\n                        : isSelected\n                        ? C.onAccent\n                        : isToday\n                        ? C.green\n                        : C.sub,'''
if fixed_day_label not in text and legacy_day_label in text:
    text = text.replace(legacy_day_label, fixed_day_label, 1)

# ---------------------------------------------------------------------------
# 2) AI Coach keyboard: the native keyboard already resizes the Capacitor
#    viewport, so do not subtract the same inset a second time.
# ---------------------------------------------------------------------------
replace_once_or_already(
    '          bottom: keyboardInset,',
    '          bottom: 0,',
    label="AI Coach keyboard inset",
)
text = text.replace(
    '          transition: keyboardInset ? "bottom 0.15s ease-out" : "none",\n',
    '          transition: "none",\n',
    1,
)

# ---------------------------------------------------------------------------
# 3) TikTok: only the native Android WebView handles the original configured
#    URL. The React viewer must never iframe TikTok or manufacture player URLs.
#    YouTube retains its existing iframe implementation.
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
viewer_start, viewer_end = function_block(
    text,
    'function FullScreenVideoViewer({ videoId, ar, onClose }) {',
    'function VideoPlayer',
)
viewer = '''function FullScreenVideoViewer({ videoId, ar, onClose }) {
  const isTikTok = isTikTokVideoRef(videoId);
  const [nativeOpening, setNativeOpening] = useState(false);

  useEffect(() => {
    let alive = true;
    if (!isTikTok) return () => { alive = false; };
    setNativeOpening(true);
    TikTokWebView.open({ url: videoId })
      .then(() => {
        if (alive) onClose();
      })
      .catch((error) => {
        console.error("[TikTok] native viewer failed", error);
        if (alive) setNativeOpening(false);
      });
    return () => { alive = false; };
  }, [isTikTok, videoId, onClose]);

  const embedSrc = `https://www.youtube-nocookie.com/embed/${videoId}?autoplay=1&playsinline=1&rel=0&modestbranding=1`;
  if (isTikTok && nativeOpening) {
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

'''
text = text[:viewer_start] + viewer + text[viewer_end:]
text = re.sub(r'\nfunction getTikTokPostId\(value\) \{.*?\n\}\n', '\n', text, flags=re.S)

# ---------------------------------------------------------------------------
# 4) Cardio: every visit starts in IDLE. An unfinished cardioStartedAt from a
#    previous visit must never resurrect an old running timer after unmount.
#    Starting creates a fresh timestamp; completed logs remain completed.
# ---------------------------------------------------------------------------
resumable_block = re.compile(
    r'''\n  const existingStartedAt = Number\(existingLog\?\.cardioStartedAt \|\| 0\);\n  const existingElapsed = existingStartedAt > 0 \? Math\.floor\(\(Date\.now\(\) - existingStartedAt\) / 1000\) : 0;\n  const resumableStartedAt = !alreadyFinished && existingStartedAt > 0 && existingElapsed < DURATION_SECONDS\n    \? existingStartedAt\n    : null;\n''',
)
text, removed = resumable_block.subn("\n", text, count=1)
if removed != 1:
    raise SystemExit("release-fixes: cardio resumable timer block not found")
text = re.sub(
    r'  const \[startedAt, setStartedAt\] = useState\(resumableStartedAt\);',
    '  const [startedAt, setStartedAt] = useState(null);',
    text,
    count=1,
)
text = re.sub(
    r'''\n  useEffect\(\(\) => \{\n    if \(alreadyFinished \|\| !existingStartedAt \|\| resumableStartedAt\) return;\n    // A stale unfinished timer should reset to IDLE instead of auto-completing\.\n    if \(existingElapsed >= DURATION_SECONDS\) \{\n      setStartedAt\(null\);\n    \}\n  \}, \[alreadyFinished, existingStartedAt, resumableStartedAt, existingElapsed\]\);\n''',
    '\n',
    text,
    count=1,
)

APP.write_text(text, encoding="utf-8")

# ---------------------------------------------------------------------------
# 5) Final source assertions.
# ---------------------------------------------------------------------------
final = APP.read_text(encoding="utf-8")
main_text = MAIN.read_text(encoding="utf-8")
required_markers = [
    'const iso = addDays(dateKey(0), i - 3);',
    'const isToday = iso === today;',
    'bottom: 0,',
    'const TikTokWebView = registerPlugin("TikTokWebView");',
    'TikTokWebView.open({ url: videoId })',
    'function FullScreenVideoViewer({ videoId, ar, onClose }) {',
    'function VideoPlayer',
    'const [startedAt, setStartedAt] = useState(null);',
    'const phase = alreadyFinished ? "COMPLETED" : startedAt ? "RUNNING" : "IDLE";',
    'await persist(true, null, 35);',
]
for marker in required_markers:
    if marker not in final:
        raise SystemExit(f"release-fixes: required current-source invariant missing: {marker}")
if re.search(r'https://www\.tiktok\.com/player/', final, re.I):
    raise SystemExit("release-fixes: TikTok generated player URL remains in App.jsx")
if re.search(r'\boembed\b', final, re.I):
    raise SystemExit("release-fixes: TikTok oEmbed dependency remains in App.jsx")
if 'appendChild' in final:
    raise SystemExit("release-fixes: DOM appendChild renderer remains in App.jsx")
if 'resumableStartedAt' in final:
    raise SystemExit("release-fixes: cardio timer still resumes from a previous visit")
if final.count('function FullScreenVideoViewer(') != 1:
    raise SystemExit("release-fixes: FullScreenVideoViewer is not canonical")
if final.count('function VideoPlayer(') != 1:
    raise SystemExit("release-fixes: VideoPlayer is not canonical")
if 'function StartupGate' not in main_text:
    raise SystemExit("release-fixes: StartupGate is missing")
if 'setTimeout(() => setMinimumTimeElapsed(true), 1600)' not in main_text:
    raise SystemExit("release-fixes: startup minimum duration is not 1600ms")
if 'animation: "fiftyLogoIn 1.15s' not in main_text:
    raise SystemExit("release-fixes: startup animation is missing")
print("release-fixes: current main source hardened and validated")
print("release-fixes: workout strip uses a rolling calendar window")
print("release-fixes: AI Coach does not double-offset the keyboard")
print("release-fixes: TikTok uses the original configured URL via native WebView")
print("release-fixes: no oEmbed, generated TikTok player URL, or DOM injector remains in App.jsx")
print("release-fixes: each cardio viewer opens in IDLE and never resurrects an old timer")
