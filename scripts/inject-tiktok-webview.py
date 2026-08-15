from pathlib import Path

PKG = "com.bodyahmed77.fiftyfit"
ROOT = Path("android/app/src/main/java") / Path(PKG.replace('.', '/'))
ROOT.mkdir(parents=True, exist_ok=True)

(ROOT / "TikTokWebViewPlugin.java").write_text(r'''package com.bodyahmed77.fiftyfit;

import android.content.Intent;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.PluginMethod;

@CapacitorPlugin(name = "TikTokWebView")
public class TikTokWebViewPlugin extends Plugin {
    @PluginMethod
    public void open(PluginCall call) {
        String url = call.getString("url");
        if (url == null || !(url.startsWith("https://") || url.startsWith("http://"))) {
            call.reject("A valid http(s) URL is required");
            return;
        }
        Intent intent = new Intent(getContext(), TikTokWebViewActivity.class);
        intent.putExtra(TikTokWebViewActivity.EXTRA_URL, url);
        getContext().startActivity(intent);
        JSObject result = new JSObject();
        result.put("opened", true);
        call.resolve(result);
    }
}
''', encoding='utf-8')

(ROOT / "TikTokWebViewActivity.java").write_text(r'''package com.bodyahmed77.fiftyfit;

import android.app.Activity;
import android.graphics.Color;
import android.os.Bundle;
import android.view.Gravity;
import android.view.Window;
import android.webkit.CookieManager;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceError;
import android.webkit.WebResourceRequest;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.FrameLayout;
import android.widget.TextView;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

public class TikTokWebViewActivity extends Activity {
    public static final String EXTRA_URL = "url";
    private WebView webView;

    private static String officialPlayerUrl(String raw) {
        if (raw == null) return null;
        String id = null;
        if (raw.matches("https://www\\.tiktok\\.com/player/v1/\\d{15,}.*")) return raw;
        if (raw.matches("\\d{15,}")) {
            id = raw;
        } else {
            Matcher m = Pattern.compile("/video/(\\d{15,})", Pattern.CASE_INSENSITIVE).matcher(raw);
            if (m.find()) id = m.group(1);
        }
        if (id == null) return raw;
        return "https://www.tiktok.com/player/v1/" + id
            + "?autoplay=1&controls=1&progress_bar=1&play_button=1"
            + "&volume_control=1&fullscreen_button=1&timestamp=1"
            + "&music_info=1&description=1&rel=0&native_context_menu=0";
    }

    @Override
    protected void onCreate(Bundle state) {
        super.onCreate(state);
        requestWindowFeature(Window.FEATURE_NO_TITLE);
        Window w = getWindow();
        w.setStatusBarColor(Color.BLACK);
        w.setNavigationBarColor(Color.BLACK);

        FrameLayout root = new FrameLayout(this);
        root.setBackgroundColor(Color.BLACK);

        webView = new WebView(this);
        WebSettings s = webView.getSettings();
        s.setJavaScriptEnabled(true);
        s.setDomStorageEnabled(true);
        s.setDatabaseEnabled(true);
        s.setMediaPlaybackRequiresUserGesture(false);
        s.setSupportMultipleWindows(false);
        s.setJavaScriptCanOpenWindowsAutomatically(false);
        s.setBuiltInZoomControls(false);
        s.setDisplayZoomControls(false);
        s.setSupportZoom(false);
        s.setLoadWithOverviewMode(false);
        s.setUseWideViewPort(false);
        s.setUserAgentString(
            "Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 " +
            "(KHTML, like Gecko) Chrome/128.0.0.0 Mobile Safari/537.36"
        );
        CookieManager.getInstance().setAcceptCookie(true);
        CookieManager.getInstance().setAcceptThirdPartyCookies(webView, true);

        webView.setWebChromeClient(new WebChromeClient());
        webView.setWebViewClient(new WebViewClient() {
            @Override
            public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                String u = request.getUrl().toString();
                if (!(u.startsWith("http://") || u.startsWith("https://"))) return true;
                view.loadUrl(officialPlayerUrl(u));
                return true;
            }

            @Override
            public boolean shouldOverrideUrlLoading(WebView view, String url) {
                if (!(url.startsWith("http://") || url.startsWith("https://"))) return true;
                view.loadUrl(officialPlayerUrl(url));
                return true;
            }

            @Override
            public void onReceivedError(WebView view, WebResourceRequest request, WebResourceError error) {
                if (request.isForMainFrame()) {
                    view.loadDataWithBaseURL(
                        "https://www.tiktok.com/",
                        "<html><body style='background:#000;color:#fff;font-family:sans-serif;padding:24px'>" +
                        "<h3>Video could not be loaded</h3><p>Please check your internet connection and try again.</p>" +
                        "</body></html>",
                        "text/html", "UTF-8", null
                    );
                }
            }
        });

        root.addView(webView, new FrameLayout.LayoutParams(-1, -1));

        TextView close = new TextView(this);
        close.setText("×");
        close.setTextColor(Color.WHITE);
        close.setTextSize(30);
        close.setGravity(Gravity.CENTER);
        close.setBackgroundColor(0x66000000);
        close.setOnClickListener(v -> finish());
        FrameLayout.LayoutParams closeLp = new FrameLayout.LayoutParams(56, 56, Gravity.TOP | Gravity.END);
        closeLp.topMargin = 18;
        closeLp.rightMargin = 8;
        root.addView(close, closeLp);

        setContentView(root);
        String url = getIntent().getStringExtra(EXTRA_URL);
        if (url != null && (url.startsWith("https://") || url.startsWith("http://"))) {
            webView.loadUrl(officialPlayerUrl(url));
        }
    }

    @Override
    public void onBackPressed() {
        if (webView != null && webView.canGoBack()) {
            webView.goBack();
        } else {
            super.onBackPressed();
        }
    }

    @Override
    protected void onDestroy() {
        if (webView != null) {
            webView.stopLoading();
            webView.loadUrl("about:blank");
            webView.removeAllViews();
            webView.destroy();
            webView = null;
        }
        super.onDestroy();
    }
}
''', encoding='utf-8')

main = ROOT / "MainActivity.java"
main.write_text(r'''package com.bodyahmed77.fiftyfit;

import android.os.Bundle;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(TikTokWebViewPlugin.class);
        super.onCreate(savedInstanceState);
    }
}
''', encoding='utf-8')

manifest = Path("android/app/src/main/AndroidManifest.xml")
text = manifest.read_text(encoding="utf-8")
if 'TikTokWebViewActivity' not in text:
    marker = text.find('</application>')
    if marker < 0:
        raise SystemExit('AndroidManifest application closing tag not found')
    activity = '        <activity android:name=".TikTokWebViewActivity" android:exported="false" android:screenOrientation="portrait"/>\n'
    text = text[:marker] + activity + text[marker:]
    manifest.write_text(text, encoding='utf-8')

print('Injected deterministic in-app TikTok Player WebView')
