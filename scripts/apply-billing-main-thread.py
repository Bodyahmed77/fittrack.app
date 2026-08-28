from pathlib import Path
import re
import subprocess

PLUGIN = Path("android/app/src/main/java/com/bodyahmed77/fiftyfit/billing/FiftyFitBillingPlugin.java")
MAIN = Path("android/app/src/main/java/com/bodyahmed77/fiftyfit/MainActivity.java")

if not PLUGIN.exists():
    raise SystemExit(f"Missing generated Fifty Fit billing plugin: {PLUGIN}")

# Generate the in-app TikTok player before touching MainActivity. The app's
# React layer calls TikTokWebView, so the native plugin must exist in every
# release build.
tiktok_script = Path("scripts/inject-tiktok-webview.py")
if not tiktok_script.is_file():
    raise SystemExit(f"Missing TikTok WebView injector: {tiktok_script}")
subprocess.run(["python3", str(tiktok_script)], check=True)

text = PLUGIN.read_text(encoding="utf-8")

# The generated bridge may already contain the main-thread wrapper. Make this
# patch idempotent so a later release cannot fail merely because the desired
# state is already present.
if "getActivity().runOnUiThread" not in text:
    pattern = re.compile(
        r'(?ms)^\s*BillingResult launch = client\.launchBillingFlow\(getActivity\(\), flow\);\s*'
        r'if \(launch\.getResponseCode\(\) != BillingClient\.BillingResponseCode\.OK\) \{\s*'
        r'activePurchaseCall = null;\s*'
        r'activePurchaseClient = null;\s*'
        r'fail\(call, launch, "launchBillingFlow_result", client\);\s*'
        r'\}'
    )
    replacement = '''                final BillingClient launchClient = client;
                final BillingFlowParams launchParams = flow;
                getActivity().runOnUiThread(() -> {
                    BillingResult launch = launchClient.launchBillingFlow(getActivity(), launchParams);
                    if (launch.getResponseCode() != BillingClient.BillingResponseCode.OK) {
                        activePurchaseCall = null;
                        activePurchaseClient = null;
                        fail(call, launch, "launchBillingFlow_result", launchClient);
                    }
                });'''
    updated, count = pattern.subn(replacement, text, count=1)
    if count != 1:
        raise SystemExit("Expected unwrapped Billing launch block not found; refusing unsafe patch")
    text = updated

if "getActivity().runOnUiThread" not in text:
    raise SystemExit("Billing launch is not marshalled onto Android main thread")

if 'FIFTYFIT_BILLING_MAIN_THREAD_V1' not in text:
    marker_match = re.search(r'public static final String MARKER = "FIFTYFIT_NATIVE_BILLING_V(?:6|7)";', text)
    if not marker_match:
        raise SystemExit("Billing marker declaration not found")
    marker = marker_match.group(0)
    text = text.replace(
        marker,
        marker + '\n    public static final String MAIN_THREAD_MARKER = "FIFTYFIT_BILLING_MAIN_THREAD_V1";',
        1,
    )

PLUGIN.write_text(text, encoding="utf-8")

if not MAIN.exists():
    raise SystemExit(f"Missing MainActivity: {MAIN}")
main = MAIN.read_text(encoding="utf-8")

# Ensure both custom plugins are registered before BridgeActivity.onCreate.
imports = [
    "import com.bodyahmed77.fiftyfit.billing.FiftyFitBillingPlugin;",
    "import com.bodyahmed77.fiftyfit.TikTokWebViewPlugin;",
    "import android.graphics.Color;",
    "import android.os.Build;",
    "import android.view.View;",
    "import android.view.WindowInsets;",
    "import android.view.WindowInsetsController;",
]
for imp in imports:
    if imp not in main:
        pkg = re.search(r"^package\s+[\w.]+;\s*$", main, re.MULTILINE)
        if not pkg:
            raise SystemExit("MainActivity package declaration missing")
        main = main[:pkg.end()] + "\n\n" + imp + main[pkg.end():]

# Replace the native activity implementation with a deterministic version if
# it has not already been hardened. The custom plugins are registered before
# super.onCreate; system bars are then made immersive and transient-on-swipe.
if "configureFiftyFitSystemBars" not in main:
    class_match = re.search(r"public class MainActivity extends BridgeActivity\s*\{", main)
    if not class_match:
        raise SystemExit("MainActivity class declaration missing")
    prefix = main[:class_match.end()]
    suffix = main[class_match.end():]
    # Preserve package/imports but replace the class body.
    main = prefix + r'''
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        registerPlugin(FiftyFitBillingPlugin.class);
        registerPlugin(TikTokWebViewPlugin.class);
        super.onCreate(savedInstanceState);
        configureFiftyFitSystemBars();
    }

    @Override
    protected void onResume() {
        super.onResume();
        configureFiftyFitSystemBars();
    }

    @Override
    public void onWindowFocusChanged(boolean hasFocus) {
        super.onWindowFocusChanged(hasFocus);
        if (hasFocus) configureFiftyFitSystemBars();
    }

    private void configureFiftyFitSystemBars() {
        try {
            final android.view.Window window = getWindow();
            window.setStatusBarColor(Color.TRANSPARENT);
            window.setNavigationBarColor(Color.TRANSPARENT);
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                window.setStatusBarContrastEnforced(false);
                window.setNavigationBarContrastEnforced(false);
            }

            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
                WindowInsetsController controller = window.getInsetsController();
                if (controller != null) {
                    controller.setSystemBarsBehavior(
                        WindowInsetsController.BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE
                    );
                    controller.hide(WindowInsets.Type.systemBars());
                }
            } else {
                window.getDecorView().setSystemUiVisibility(
                    View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY
                    | View.SYSTEM_UI_FLAG_FULLSCREEN
                    | View.SYSTEM_UI_FLAG_HIDE_NAVIGATION
                    | View.SYSTEM_UI_FLAG_LAYOUT_FULLSCREEN
                    | View.SYSTEM_UI_FLAG_LAYOUT_HIDE_NAVIGATION
                    | View.SYSTEM_UI_FLAG_LAYOUT_STABLE
                );
            }
        } catch (Exception ignored) {
            // Keep the app usable if a device OEM rejects one of the flags.
        }
    }
}
'''

# Validate plugin registration order.
pos_billing = main.find("registerPlugin(FiftyFitBillingPlugin.class);")
pos_tiktok = main.find("registerPlugin(TikTokWebViewPlugin.class);")
pos_super = main.find("super.onCreate(savedInstanceState);")
if min(pos_billing, pos_tiktok) < 0 or pos_super < 0 or pos_billing > pos_super or pos_tiktok > pos_super:
    raise SystemExit("Custom plugin registration must occur before BridgeActivity.onCreate")
if "BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE" not in main:
    raise SystemExit("Immersive transient-by-swipe system UI configuration missing")

MAIN.write_text(main, encoding="utf-8")
print("Billing main-thread patch + TikTok WebView injection + immersive system bars verified")
