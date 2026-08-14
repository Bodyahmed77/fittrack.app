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

# Replace the broken TikTok iframe path with the native in-app browser surface.
# TikTok blocks/changes behavior when its normal page is embedded in an iframe;
# Android Custom Tabs are the recommended low-effort in-app browser experience
# for third-party web content.
if 'from "@capacitor/browser"' not in text:
    text = text.replace(
        'import { App as CapApp } from "@capacitor/app";\n',
        'import { App as CapApp } from "@capacitor/app";\nimport { Browser } from "@capacitor/browser";\n',
        1,
    )

viewer_pattern = re.compile(
    r'/\* Full-screen TikTok/YouTube viewer.*?\nfunction VideoPlayer\(',
    re.S,
)
viewer_replacement = r'''/* Full-screen exercise video viewer.
   TikTok is opened as a normal first-party page in Capacitor Browser/Android
   Custom Tabs instead of an iframe. This avoids TikTok's iframe/player
   loading loop while keeping the user inside the app context. */
function FullScreenVideoViewer({ videoId, ar, onClose }) {
  const isTikTok = /tiktok\\.com/i.test(String(videoId || "")) || /^\\d+$/.test(String(videoId || ""));
  const tikTokUrl = /^\\d+$/.test(String(videoId || ""))
    ? `https://www.tiktok.com/video/${videoId}`
    : String(videoId || "");
  const youtubeUrl = `https://www.youtube-nocookie.com/embed/${videoId}?autoplay=1&playsinline=1&rel=0&modestbranding=1`;

  useEffect(() => {
    registerFullScreenVideoClose(onClose);
    let finishedListener = null;
    let cancelled = false;

    const open = async () => {
      if (!isTikTok) return;
      try {
        finishedListener = await Browser.addListener("browserFinished", () => onClose());
        await Browser.open({ url: tikTokUrl, toolbarColor: "#000000" });
      } catch (error) {
        console.warn("[TikTok] native browser open failed", error);
        if (!cancelled) {
          try { window.open(tikTokUrl, "_blank", "noopener,noreferrer"); } catch {}
          onClose();
        }
      }
    };

    open();
    return () => {
      cancelled = true;
      finishedListener?.remove?.();
      registerFullScreenVideoClose(null);
    };
  }, [isTikTok, tikTokUrl, onClose]);

  if (isTikTok) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
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

APP.write_text(text, encoding="utf-8")
print("Launch-readiness patch applied to src/App.jsx")
print("Custom admin plans are no longer gated by billing entitlements")
print("TikTok iframe/oEmbed path replaced with Capacitor Browser")
