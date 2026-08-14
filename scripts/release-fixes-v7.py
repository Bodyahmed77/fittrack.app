from pathlib import Path
import re

APP = Path('src/App.jsx')
NATIVE = Path('scripts/inject-tiktok-webview.py')
text = APP.read_text(encoding='utf-8')

# Native TikTok plugin bridge.
if 'import { registerPlugin } from "@capacitor/core";' not in text:
    anchor = 'import { App as CapApp } from "@capacitor/app";'
    if anchor not in text: raise SystemExit('v7: Capacitor import anchor missing')
    text = text.replace(anchor, 'import { registerPlugin } from "@capacitor/core";\n' + anchor, 1)
if 'const TikTokWebView = registerPlugin("TikTokWebView");' not in text:
    anchor = 'import { deleteAccountServerData } from "./deleteAccount";'
    if anchor not in text: raise SystemExit('v7: import block anchor missing')
    text = text.replace(anchor, anchor + '\n\nconst TikTokWebView = registerPlugin("TikTokWebView");', 1)

# Replace the whole viewer deterministically. TikTok numeric posts use the
# native full-screen activity; YouTube keeps the existing iframe viewer.
viewer_re = re.compile(r'function FullScreenVideoViewer\(\{ videoId, ar, onClose \}\) \{.*?\n\}\n\nfunction VideoPlayer', re.S)
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
    return <div role="dialog" aria-modal="true" style={{position:"fixed",inset:0,zIndex:4000,background:"#000",display:"flex",alignItems:"center",justifyContent:"center",color:"#fff"}}><div style={{fontSize:13,fontWeight:600}}>{ar ? "جاري فتح الفيديو…" : "Opening video…"}</div></div>;
  }
  return (
    <div role="dialog" aria-modal="true" aria-label={ar ? "مشغل الفيديو" : "Video player"} style={{position:"fixed",inset:0,zIndex:4000,background:"#000",display:"flex",flexDirection:"column",paddingTop:"env(safe-area-inset-top)",paddingBottom:"env(safe-area-inset-bottom)"}}>
      <div style={{flexShrink:0,display:"flex",alignItems:"center",justifyContent:"space-between",padding:"10px 12px"}}>
        <div style={{color:"#fff",fontWeight:700,fontSize:14}}>{ar ? "فيديو التمرين" : "Exercise video"}</div>
        <button type="button" onClick={onClose} aria-label={ar ? "إغلاق" : "Close"} style={{width:36,height:36,borderRadius:"50%",border:"none",background:"rgba(255,255,255,0.15)",color:"#fff",display:"flex",alignItems:"center",justifyContent:"center"}}><X size={18} color="#fff" /></button>
      </div>
      <div style={{flex:1,minHeight:0,position:"relative",width:"100%",background:"#000"}}>
        <iframe src={embedSrc} loading="eager" title={ar ? "فيديو التمرين" : "Exercise video"} referrerPolicy="strict-origin-when-cross-origin" style={{position:"absolute",inset:0,width:"100%",height:"100%",border:"none"}} allow="autoplay; encrypted-media; fullscreen; picture-in-picture" allowFullScreen />
      </div>
    </div>
  );
}

function VideoPlayer'''
if not viewer_re.search(text): raise SystemExit('v7: FullScreenVideoViewer block missing')
text = viewer_re.sub(viewer, text, 1)

# Keyboard.resize=native already shrinks the WebView. The old sheet counted the
# keyboard height a second time, pushing the selected-food card toward the top.
old = 'style={{ paddingBottom: selected ? "calc(200px + var(--ff-keyboard-height, 0px))" : 0 }}'
if old not in text: raise SystemExit('v7: FoodPicker root anchor missing')
text = text.replace(old, 'style={{ paddingBottom: selected ? 20 : 0 }}', 1)
old = 'bottom: "var(--ff-keyboard-height, 0px)",'
if old not in text: raise SystemExit('v7: FoodPicker bottom anchor missing')
text = text.replace(old, 'bottom: 0,', 1)

# Rolling 7-day window: move one day at a time instead of freezing the strip
# on the current Monday-Sunday week.
old = 'const iso = addDays(mondayOf(dateKey(0)), i);'
if old not in text: raise SystemExit('v7: Monday day-strip anchor missing')
text = text.replace(old, 'const iso = addDays(dateKey(0), i - 3);', 1)
old = 'const isToday = offset === 0;'
if old not in text: raise SystemExit('v7: stale offset check missing')
text = text.replace(old, 'const isToday = iso === today;', 1)
APP.write_text(text, encoding='utf-8')

# Native activity: convert normal/short TikTok URLs to official Player v1 once
# a numeric /video/<id> is seen. Short vt.tiktok.com links therefore stay
# inside the app and get upgraded after redirect instead of opening TikTok.
n = NATIVE.read_text(encoding='utf-8')
if 'private static String officialPlayerUrl' not in n:
    anchor = '    private WebView webView;\n'
    helper = '''    private static String officialPlayerUrl(String raw) {
        if (raw == null) return null;
        String id = raw.matches("\\\\d{15,}") ? raw : null;
        if (id == null) {
            Matcher m = Pattern.compile("/video/(\\\\d{15,})", Pattern.CASE_INSENSITIVE).matcher(raw);
            if (m.find()) id = m.group(1);
        }
        if (id == null) return raw;
        return "https://www.tiktok.com/player/v1/" + id
            + "?autoplay=1&controls=1&progress_bar=1&play_button=1"
            + "&volume_control=1&fullscreen_button=1&timestamp=1"
            + "&music_info=0&description=0&rel=0&native_context_menu=0";
    }

'''
    if anchor not in n: raise SystemExit('v7: native field anchor missing')
    n = n.replace(anchor, anchor + helper, 1)
if 'import java.util.regex.Matcher;' not in n:
    n = n.replace('import android.widget.TextView;\n', 'import android.widget.TextView;\nimport java.util.regex.Matcher;\nimport java.util.regex.Pattern;\n', 1)
n = n.replace('String u = request.getUrl().toString();\n                // Keep all web navigation inside the app.', 'String u = request.getUrl().toString();\n                String player = officialPlayerUrl(u);\n                // Keep all web navigation inside the app.', 1)
n = n.replace('view.loadUrl(u);\n                return true;', 'view.loadUrl(player);\n                return true;', 1)
n = n.replace('view.loadUrl(url);\n                return true;', 'view.loadUrl(officialPlayerUrl(url));\n                return true;', 1)
n = n.replace('webView.loadUrl(url);', 'webView.loadUrl(officialPlayerUrl(url));', 1)

# Make the plugin promise resolve only when the full-screen activity closes.
old_open = '''        Intent intent = new Intent(getContext(), TikTokWebViewActivity.class);
        intent.putExtra(TikTokWebViewActivity.EXTRA_URL, url);
        getContext().startActivity(intent);
        JSObject result = new JSObject();
        result.put("opened", true);
        call.resolve(result);'''
new_open = '''        Intent intent = new Intent(getContext(), TikTokWebViewActivity.class);
        intent.putExtra(TikTokWebViewActivity.EXTRA_URL, url);
        startActivityForResult(call, intent, "handleOpenResult");'''
if old_open in n:
    n = n.replace(old_open, new_open, 1)
    if 'import com.getcapacitor.ActivityResult;' not in n:
        n = n.replace('import com.getcapacitor.PluginMethod;\n', 'import com.getcapacitor.PluginMethod;\nimport com.getcapacitor.ActivityResult;\n', 1)
    callback = '''
    @com.getcapacitor.annotation.ActivityCallback
    private void handleOpenResult(PluginCall call, ActivityResult result) {
        JSObject out = new JSObject();
        out.put("opened", true);
        call.resolve(out);
    }
'''
    pos = n.find('\n}\n\n', n.find('public class TikTokWebViewPlugin'))
    if pos < 0: raise SystemExit('v7: plugin class closing brace missing')
    n = n[:pos] + callback + n[pos:]
NATIVE.write_text(n, encoding='utf-8')

final = APP.read_text(encoding='utf-8')
assert 'const iso = addDays(dateKey(0), i - 3);' in final
assert 'const isToday = iso === today;' in final
assert 'bottom: 0,' in final
assert 'TikTokWebView.open({ url: videoId })' in final
print('Release fixes v7 applied successfully')
print('TikTok: native in-app official Player v1; no TikTok app/browser handoff')
print('Food picker: selected-food sheet pinned above native keyboard')
print('Workout days: rolling 7-day window advances daily')
