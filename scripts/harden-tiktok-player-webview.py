from pathlib import Path
import re

path = Path('android/app/src/main/java/com/bodyahmed77/fiftyfit/TikTokWebViewActivity.java')
if not path.is_file():
    raise SystemExit(f'Missing generated TikTok activity: {path}')

text = path.read_text(encoding='utf-8')

# TikTok's official Player API is specified as an embedded player (iframe).
# Loading the player URL as a top-level WebView page is less reliable on
# Android WebView, so render the official player URL inside a local HTML host.
if 'FIFTYFIT_TIKTOK_IFRAME_V1' not in text:
    helper = r'''
    // FIFTYFIT_TIKTOK_IFRAME_V1
    private static String playerHtml(String playerUrl) {
        String escaped = playerUrl.replace("&", "&amp;").replace("\"", "&quot;");
        return "<!doctype html><html><head><meta name=\"viewport\" content=\"width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no\"></head>"
            + "<body style=\"margin:0;background:#000;overflow:hidden;\">"
            + "<iframe src=\"" + escaped + "\" style=\"position:fixed;inset:0;width:100%;height:100%;border:0;background:#000;\""
            + " allow=\"autoplay; fullscreen; picture-in-picture\" allowfullscreen></iframe>"
            + "</body></html>";
    }
'''
    marker = '    @Override\n    protected void onCreate(Bundle state) {'
    if marker not in text:
        raise SystemExit('TikTok onCreate marker not found')
    text = text.replace(marker, helper + '\n' + marker, 1)

# Replace initial top-level player load with an iframe host.
text = text.replace(
    'webView.loadUrl(officialPlayerUrl(u));',
    'String player = officialPlayerUrl(u);\n                if (player != null && player.matches("https://www\\\\.tiktok\\\\.com/player/v1/\\\\d{15,}.*")) {\n                    view.loadDataWithBaseURL("https://www.tiktok.com/", playerHtml(player), "text/html", "UTF-8", null);\n                } else {\n                    view.loadUrl(player);\n                }',
)
text = text.replace(
    'view.loadUrl(officialPlayerUrl(url));',
    'String player = officialPlayerUrl(url);\n                if (player != null && player.matches("https://www\\\\.tiktok\\\\.com/player/v1/\\\\d{15,}.*")) {\n                    view.loadDataWithBaseURL("https://www.tiktok.com/", playerHtml(player), "text/html", "UTF-8", null);\n                } else {\n                    view.loadUrl(player);\n                }',
)

# The main app can remain portrait-oriented. The secondary player activity must
# not advertise portrait as a required device feature, because that can exclude
# landscape-only automotive/TV configurations from Google Play compatibility.
manifest = Path('android/app/src/main/AndroidManifest.xml')
if manifest.is_file():
    manifest_text = manifest.read_text(encoding='utf-8')
    manifest_text = re.sub(
        r'(<activity\s+android:name="\.TikTokWebViewActivity"[^>]*?)\s+android:screenOrientation="portrait"',
        r'\1',
        manifest_text,
    )
    manifest.write_text(manifest_text, encoding='utf-8')

path.write_text(text, encoding='utf-8')
print('TikTok embedded player hardened without an implicit portrait requirement')