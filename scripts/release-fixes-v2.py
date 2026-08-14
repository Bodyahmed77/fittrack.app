from pathlib import Path
import re

APP = Path('src/App.jsx')
text = APP.read_text(encoding='utf-8')

# Admin-assigned custom plans are assignments, not Play Billing entitlements.
text = text.replace('data.customTrainingPlan && data.entitlements.trainingPro && (', 'data.customTrainingPlan && (')
text = text.replace('data.customNutritionPlan && data.entitlements.nutritionPro && (', 'data.customNutritionPlan && (')
text = re.sub(r'data\.entitlements\.trainingPro\s*&&\s*data\.customTrainingPlan\?\.days\?\.\[DAYS\.indexOf\(day\)\]', 'data.customTrainingPlan?.days?.[DAYS.indexOf(day)]', text)
text = re.sub(r'data\.entitlements\.trainingPro\s*&&\s*data\.customTrainingPlan\?\.days\?\.\[DAYS\.indexOf\(selectedDay\)\]', 'data.customTrainingPlan?.days?.[DAYS.indexOf(selectedDay)]', text)
text = text.replace('const customTrainingDay =\n    data.entitlements.trainingPro &&\n    data.customTrainingPlan?.days?.[DAYS.indexOf(day)];', 'const customTrainingDay =\n    data.customTrainingPlan?.days?.[DAYS.indexOf(day)];')
text = text.replace('const customTrainingDay =\n    data.entitlements.trainingPro &&\n    data.customTrainingPlan?.days?.[DAYS.indexOf(selectedDay)];', 'const customTrainingDay =\n    data.customTrainingPlan?.days?.[DAYS.indexOf(selectedDay)];')

# Keep TikTok inside Fifty Fit. Do not use @capacitor/browser or Custom Tabs.
text = text.replace('import { Browser } from "@capacitor/browser";\n', '')
viewer_pattern = re.compile(r'function FullScreenVideoViewer\(\{ videoId, ar, onClose \}\) \{.*?\n\}\n\nfunction extractTikTokVideoId', re.S)
viewer_replacement = r'''function FullScreenVideoViewer({ videoId, ar, onClose }) {
  const [videoLoaded, setVideoLoaded] = useState(false);
  const raw = String(videoId || '').trim();
  const isTikTok = /tiktok\.com/i.test(raw) || /^\d+$/.test(raw);
  const tikTokUrl = /^\d+$/.test(raw) ? `https://www.tiktok.com/video/${raw}` : raw;
  const embedSrc = isTikTok ? tikTokUrl : `https://www.youtube-nocookie.com/embed/${raw}?autoplay=1&playsinline=1&rel=0&modestbranding=1`;

  useEffect(() => {
    setVideoLoaded(false);
    registerFullScreenVideoClose(() => { onClose(); return true; });
    return () => registerFullScreenVideoClose(null);
  }, [onClose, embedSrc]);

  return (
    <div role='dialog' aria-modal='true' aria-label={ar ? 'مشغل الفيديو' : 'Video player'} style={{ position:'fixed', inset:0, zIndex:4000, background:'#000', display:'flex', flexDirection:'column' }}>
      <div style={{ flexShrink:0, display:'flex', alignItems:'center', justifyContent:'space-between', padding:'10px 12px' }}>
        <div style={{ color:'#fff', fontWeight:700, fontSize:14 }}>{ar ? 'فيديو التمرين' : 'Exercise video'}</div>
        <button type='button' onClick={onClose} aria-label={ar ? 'إغلاق' : 'Close'} style={{ width:36, height:36, borderRadius:'50%', border:'none', background:'rgba(255,255,255,.15)', color:'#fff', display:'flex', alignItems:'center', justifyContent:'center' }}><X size={18} color='#fff' /></button>
      </div>
      <div style={{ flex:1, minHeight:0, position:'relative', width:'100%', background:'#000' }}>
        {!videoLoaded && <div style={{ position:'absolute', inset:0, zIndex:1, display:'flex', alignItems:'center', justifyContent:'center', background:'#000', color:'#fff', fontSize:13, fontWeight:600 }}>{ar ? 'جاري تحميل الفيديو…' : 'Loading video…'}</div>}
        <iframe src={embedSrc} onLoad={() => setVideoLoaded(true)} loading='eager' title={ar ? 'فيديو التمرين' : 'Exercise video'} referrerPolicy='strict-origin-when-cross-origin' style={{ position:'absolute', inset:0, width:'100%', height:'100%', border:'none' }} allow='autoplay; fullscreen; encrypted-media; picture-in-picture' allowFullScreen />
      </div>
    </div>
  );
}

function extractTikTokVideoId'''
text, count = viewer_pattern.subn(lambda _m: viewer_replacement, text, count=1)
if count != 1:
    raise SystemExit(f'FullScreenVideoViewer block not found: {count}')

# Cardio finish/skip is a real exercise completion. Clear the start timestamp
# so the timestamp-based timer can never resume after completion.
old = 'cardioStartedAt: cardioStartedAt || null,\n      cardioCompletedAt: finished ? Date.now() : null,'
new = 'cardioStartedAt: finished ? null : (cardioStartedAt || null),\n      cardioCompletedAt: finished ? Date.now() : null,'
if old not in text:
    raise SystemExit('Cardio persistence block not found')
text = text.replace(old, new, 1)
old = 'persist(true, startedAt || Date.now());\n    try { awardXp(35); } catch {}'
new = 'persist(true, null);\n    setStartedAt(null);\n    setNow(Date.now());\n    try { awardXp(35); } catch {}'
if old not in text:
    raise SystemExit('Cardio finish block not found')
text = text.replace(old, new, 1)

APP.write_text(text, encoding='utf-8')
print('Release fixes v2 applied successfully')
