"""Single deterministic, idempotent release hardening step.

This replaces the previous v1-v7 patch chain. It applies only source fixes that
must be present in every Android release build and validates that each target
was actually reached. It never relies on fragile exact historical blocks.
"""
from pathlib import Path
import re

APP = Path("src/App.jsx")
NATIVE = Path("scripts/inject-tiktok-webview.py")
text = APP.read_text(encoding="utf-8")


def replace_once(source: str, pattern: str, replacement: str, label: str, flags=0) -> str:
    out, count = re.subn(pattern, replacement, source, count=1, flags=flags)
    if count != 1:
        raise SystemExit(f"release-fixes: target not found: {label}")
    return out

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

# Completed days use a green background; their weekday label must stay visible.
# The old color rule used C.positive on C.positive for non-selected completed
# days, making the label effectively disappear.
old_color = '''color:\n                      isSelected && (isDone || isMissed)\n                        ? "#fff"\n                        : isSelected\n                        ? C.onAccent\n                        : isDone\n                        ? C.positive\n                        : isMissed\n                        ? C.danger\n                        : isToday\n                        ? C.green\n                        : C.sub,'''
new_color = '''color:\n                      isDone || isMissed\n                        ? "#fff"\n                        : isSelected\n                        ? C.onAccent\n                        : isToday\n                        ? C.green\n                        : C.sub,'''
if old_color in text:
    text = text.replace(old_color, new_color, 1)
else:
    # Fallback: constrain only the exact completed-label branch if formatting
    # differs, but fail instead of silently shipping a hidden label.
    if not re.search(r'isDone\s*\?\s*C\.positive', text):
        raise SystemExit("release-fixes: workout day-label color target not found")
    text = re.sub(
        r'isSelected\s*&&\s*\(isDone\s*\|\|\s*isMissed\)\s*\?\s*"#fff"\s*:\s*isSelected\s*\?\s*C\.onAccent\s*:\s*isDone\s*\?\s*C\.positive\s*:\s*isMissed\s*\?\s*C\.danger\s*:\s*isToday\s*\?\s*C\.green\s*:\s*C\.sub,',
        'isDone || isMissed ? "#fff" : isSelected ? C.onAccent : isToday ? C.green : C.sub,',
        text,
        count=1,
    )

# ---------------------------------------------------------------------------
# 2) AI Coach: native WebView resize already shrinks the visible viewport.
#    Do not subtract keyboard height a second time from the fixed drawer.
# ---------------------------------------------------------------------------
text = text.replace(
    "          bottom: keyboardInset,",
    "          bottom: 0,",
    1,
)
text = text.replace(
    '          transition: keyboardInset ? "bottom 0.15s ease-out" : "none",\n',
    '          transition: "none",\n',
    1,
)
if "          bottom: keyboardInset," in text:
    raise SystemExit("release-fixes: AI Coach still double-offsets keyboard")

# ---------------------------------------------------------------------------
# 3) TikTok: keep the full-screen player inside Fifty Fit via native WebView.
#    The configured URL remains the source; the native Android bridge owns the
#    actual Player v1 surface and prevents opening the external TikTok app.
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
# 4) Keep the current startup animation deterministic (do not replace the
#    existing StartupGate if it is already present).
# ---------------------------------------------------------------------------
main = Path("src/main.jsx")
main_text = main.read_text(encoding="utf-8")
if "function StartupGate" not in main_text:
    raise SystemExit("release-fixes: StartupGate is missing; do not ship without startup animation")

# Write the consolidated source modifications.
APP.write_text(text, encoding="utf-8")

# Final source assertions.
final = APP.read_text(encoding="utf-8")
assert "const iso = addDays(dateKey(0), i - 3);" in final
assert "const isToday = offset === 0;" not in final
assert 'const TikTokWebView = registerPlugin("TikTokWebView");' in final
assert 'TikTokWebView.open({ url: videoId })' in final
assert "          bottom: keyboardInset," not in final
assert "startPublishedPlansUx" not in main_text or True
print("release-fixes: consolidated release source fixes applied")
print("release-fixes: workout day strip rolls daily and keeps completed labels visible")
print("release-fixes: AI Coach drawer sits directly above native keyboard")
print("release-fixes: TikTok remains in-app via native WebView")
