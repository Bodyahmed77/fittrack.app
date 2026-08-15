from pathlib import Path

PKG = "com.bodyahmed77.fiftyfit"
ROOT = Path("android/app/src/main/java") / Path(PKG.replace('.', '/'))
ROOT.mkdir(parents=True, exist_ok=True)

(ROOT / "TikTokWebViewPlugin.java").write_text(r'''package com.bodyahmed77.fiftyfit;

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
        TikTokWebViewActivity.open(getContext(), url);
        JSObject result = new JSObject();
        result.put("opened", true);
        call.resolve(result);
    }
}
''', encoding='utf-8')

(ROOT / "TikTokWebViewActivity.java").write_text(r'''package com.bodyahmed77.fiftyfit;

import android.app.Activity;
import android.content.Context;
import android.content.Intent;
import android.graphics.Color;
import android.net.Uri;
import android.os.Bundle;
import android.view.Gravity;
import android.view.View;
import android.view.Window;
import android.webkit.CookieManager;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceRequest;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.FrameLayout;
import android.widget.TextView;

public class TikTokWebViewActivity extends Activity {
    public static final String EXTRA_URL = "url";
    private WebView webView;

    public static void open(Context context, String url) {
        Intent intent = new Intent(context, TikTokWebViewActivity.class);
        intent.putExtra(EXTRA_URL, url);
        context.startActivity(intent);
    }

    @Override
    protected void onCreate(Bundle state) {
        super.onCreate(state);
        requestWindowFeature(Window.FEATURE_NO_TITLE);
        Window window = getWindow();
        window.setStatusBarColor(Color.BLACK);
        window.setNavigationBarColor(Color.BLACK);

        FrameLayout root = new FrameLayout(this);
        root.setBackgroundColor(Color.BLACK);

        webView = new WebView(this);
        WebSettings settings = webView.getSettings();
        settings.setJavaScriptEnabled(true);
        settings.setDomStorageEnabled(true);
        settings.setDatabaseEnabled(true);
        settings.setMediaPlaybackRequiresUserGesture(false);
        settings.setSupportMultipleWindows(false);
        settings.setJavaScriptCanOpenWindowsAutomatically(false);
        settings.setBuiltInZoomControls(false);
        settings.setDisplayZoomControls(false);
        settings.setSupportZoom(false);
        settings.setLoadWithOverviewMode(false);
        settings.setUseWideViewPort(false);
        settings.setMixedContentMode(WebSettings.MIXED_CONTENT_NEVER_ALLOW);

        CookieManager.getInstance().setAcceptCookie(true);
        CookieManager.getInstance().setAcceptThirdPartyCookies(webView, true);

        webView.setWebChromeClient(new WebChromeClient());
        webView.setWebViewClient(new WebViewClient() {
            @Override
            public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                Uri uri = request.getUrl();
                String scheme = uri.getScheme();
                if (scheme == null) return true;
                // Keep every normal web URL inside Fifty Fit. Do not hand
                // TikTok/app-deep links to Android's external intent resolver.
                return !("http".equalsIgnoreCase(scheme) || "https".equalsIgnoreCase(scheme));
            }

            @Override
            public boolean shouldOverrideUrlLoading(WebView view, String url) {
                Uri uri = Uri.parse(url);
                String scheme = uri.getScheme();
                if (scheme == null) return true;
                return !("http".equalsIgnoreCase(scheme) || "https".equalsIgnoreCase(scheme));
            }
        });

        root.addView(webView, new FrameLayout.LayoutParams(-1, -1));

        TextView close = new TextView(this);
        close.setText("×");
        close.setTextColor(Color.WHITE);
        close.setTextSize(30);
        close.setGravity(Gravity.CENTER);
        close.setBackgroundColor(0x66000000);
        close.setContentDescription("Close");
        close.setOnClickListener(v -> finish());
        FrameLayout.LayoutParams closeLp = new FrameLayout.LayoutParams(56, 56, Gravity.TOP | Gravity.END);
        closeLp.topMargin = 18;
        closeLp.rightMargin = 8;
        root.addView(close, closeLp);

        setContentView(root);
        String url = getIntent().getStringExtra(EXTRA_URL);
        if (url != null && (url.startsWith("https://") || url.startsWith("http://"))) {
            // Crucially, this is the exact URL stored in EXERCISE_VIDEOS.
            // No oEmbed lookup and no player/v1 URL rewriting.
            webView.loadUrl(url);
        } else {
            finish();
        }
    }

    @Override
    public void onBackPressed() {
        if (webView != null && webView.canGoBack()) {
            webView.goBack();
            return;
        }
        super.onBackPressed();
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

print('Injected in-app TikTok WebView using the original configured URL')
