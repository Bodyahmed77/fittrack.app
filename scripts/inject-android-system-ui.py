#!/usr/bin/env python3
"""Patch generated Android configuration for true edge-to-edge black chrome.

MUST run after `npx cap sync` (Capacitor regenerates styles/manifest).
"""
from __future__ import annotations

import re
import shutil
import subprocess
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
STYLES = ROOT / "android" / "app" / "src" / "main" / "res" / "values" / "styles.xml"
STYLES_V31 = ROOT / "android" / "app" / "src" / "main" / "res" / "values-v31" / "styles.xml"
MANIFEST = ROOT / "android" / "app" / "src" / "main" / "AndroidManifest.xml"
VARIABLES = ROOT / "android" / "variables.gradle"
APP_GRADLE = ROOT / "android" / "app" / "build.gradle"

STATUS_ITEMS = [
    ("android:statusBarColor", "@android:color/transparent"),
    ("android:navigationBarColor", "@android:color/transparent"),
    ("android:windowBackground", "@android:color/black"),
    ("android:navigationBarDividerColor", "#000000"),
    ("android:windowLightStatusBar", "false"),
    ("android:windowLightNavigationBar", "false"),
    ("android:enforceStatusBarContrast", "false"),
    ("android:enforceNavigationBarContrast", "false"),
    ("android:windowDrawsSystemBarBackgrounds", "true"),
    ("android:windowLayoutInDisplayCutoutMode", "shortEdges"),
    ("android:fitsSystemWindows", "false"),
]


def _upsert_items_in_style_block(block: str) -> str:
    body = block
    for name, value in STATUS_ITEMS:
        item = f'<item name="{name}">{value}</item>'
        if re.search(rf'<item name="{re.escape(name)}">[^<]*</item>', body):
            body = re.sub(
                rf'<item name="{re.escape(name)}">[^<]*</item>',
                item,
                body,
            )
        else:
            body = re.sub(r"</style>", f"        {item}\n    </style>", body, count=1)
    return body


def patch_styles(path: Path) -> str:
    if not path.is_file():
        return f"{path} missing (skip)"
    text = path.read_text(encoding="utf-8")
    new_text, n = re.subn(
        r"<style\b[^>]*>[\s\S]*?</style>",
        lambda m: _upsert_items_in_style_block(m.group(0)),
        text,
    )
    if n == 0:
        return f"{path.name}: no <style> blocks"
    if new_text != text:
        path.write_text(new_text, encoding="utf-8")
        return f"{path.name}: updated {n} style block(s)"
    return f"{path.name}: already ok ({n} style block(s))"


def patch_manifest(path: Path) -> str:
    if not path.is_file():
        return "AndroidManifest missing (skip)"
    text = path.read_text(encoding="utf-8")
    original = text
    if 'android:windowSoftInputMode' not in text:
        text = text.replace(
            "android:configChanges=",
            'android:windowSoftInputMode="adjustResize" android:configChanges=',
            1,
        )
    if text != original:
        path.write_text(text, encoding="utf-8")
        return "AndroidManifest updated softInputMode"
    return "AndroidManifest already ok"


def patch_main_activity() -> str:
    mains = list((ROOT / "android" / "app" / "src" / "main" / "java").rglob("MainActivity.java"))
    if not mains:
        return "MainActivity.java missing (skip)"
    path = mains[0]
    text = path.read_text(encoding="utf-8")
    original = text
    marker = "FIFTYFIT_EDGE_TO_EDGE_V2"
    if marker in text:
        return "MainActivity edge-to-edge already present"

    # Remove older V1 patch if present so we can re-inject V2
    text = re.sub(
        r"\n\s*// FIFTYFIT_EDGE_TO_EDGE_V1:.*?(?=\n\s*(?:registerPlugin|\}|$))",
        "\n",
        text,
        count=1,
        flags=re.S,
    )

    edge_block = f'''
    // {marker}: immersive sticky hide bars; swipe to reveal.
    try {{
      if (android.os.Build.VERSION.SDK_INT >= 30) {{
        getWindow().setDecorFitsSystemWindows(false);
        final android.view.WindowInsetsController c = getWindow().getInsetsController();
        if (c != null) {{
          c.hide(android.view.WindowInsets.Type.statusBars() | android.view.WindowInsets.Type.navigationBars());
          c.setSystemBarsBehavior(android.view.WindowInsetsController.BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE);
        }}
      }} else {{
        getWindow().getDecorView().setSystemUiVisibility(
          android.view.View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY
            | android.view.View.SYSTEM_UI_FLAG_LAYOUT_STABLE
            | android.view.View.SYSTEM_UI_FLAG_LAYOUT_FULLSCREEN
            | android.view.View.SYSTEM_UI_FLAG_LAYOUT_HIDE_NAVIGATION
            | android.view.View.SYSTEM_UI_FLAG_FULLSCREEN
            | android.view.View.SYSTEM_UI_FLAG_HIDE_NAVIGATION
        );
      }}
      getWindow().setStatusBarColor(0x00000000);
      getWindow().setNavigationBarColor(0x00000000);
      getWindow().getDecorView().setBackgroundColor(0xFF000000);
    }} catch (Throwable ignored) {{}}
'''

    m = re.search(r"(super\.onCreate\s*\([^;]*\);)", text)
    if not m:
        return "MainActivity: super.onCreate not found"
    text = text[: m.end()] + "\n" + edge_block + text[m.end() :]
    if text != original:
        path.write_text(text, encoding="utf-8")
        return f"MainActivity edge-to-edge injected ({path.name})"
    return "MainActivity unchanged"


def patch_android_api() -> str:
    if not VARIABLES.is_file():
        return "variables.gradle missing — cap add/sync may have failed"

    text = VARIABLES.read_text(encoding="utf-8")
    original = text
    text = re.sub(r"compileSdkVersion\s*=\s*\d+", "compileSdkVersion = 36", text)
    text = re.sub(r"targetSdkVersion\s*=\s*\d+", "targetSdkVersion = 36", text)
    if "compileSdkVersion" not in text:
        text = text.replace("ext {", "ext {\n    compileSdkVersion = 36", 1)
    if "targetSdkVersion" not in text:
        text = text.replace("ext {", "ext {\n    targetSdkVersion = 36", 1)
    if text != original:
        VARIABLES.write_text(text, encoding="utf-8")
        status = "compileSdkVersion=36 targetSdkVersion=36"
    else:
        status = "compileSdkVersion=36 targetSdkVersion=36 already set"

    sdkmanager = shutil.which("sdkmanager")
    if not sdkmanager:
        return status + "; sdkmanager not found (local build may need Android 36 installed manually)"

    try:
        subprocess.run(
            [sdkmanager, "platforms;android-36", "build-tools;36.0.0"],
            check=True,
            stdout=subprocess.PIPE,
            stderr=subprocess.STDOUT,
            text=True,
        )
        return status + "; Android 36 SDK/build-tools installed"
    except subprocess.CalledProcessError as exc:
        print(exc.stdout or "")
        raise SystemExit("Failed to install Android 36 SDK/build-tools") from exc


def patch_billing_stack() -> str:
    if not APP_GRADLE.is_file():
        return "app/build.gradle missing — cap sync may have failed"

    text = APP_GRADLE.read_text(encoding="utf-8")
    original = text

    dependency_lines = [
        "    implementation 'com.android.billingclient:billing:9.1.0'",
        "    implementation 'androidx.core:core:1.9.0'",
    ]
    if "com.android.billingclient:billing:9.1.0" not in text:
        marker = "dependencies {"
        if marker not in text:
            raise SystemExit("Cannot pin Play Billing 9.1.0: dependencies block missing")
        text = text.replace(marker, marker + "\n" + "\n".join(dependency_lines), 1)

    if text != original:
        APP_GRADLE.write_text(text, encoding="utf-8")
        return "Play Billing 9.1.0 + AndroidX Core 1.9.0 pinned"
    return "Play Billing 9.1.0 + AndroidX Core 1.9.0 already pinned"


def main() -> None:
    print(patch_android_api())
    print(patch_billing_stack())
    print(patch_styles(STYLES))
    print(patch_styles(STYLES_V31))
    print(patch_manifest(MANIFEST))
    print(patch_main_activity())


if __name__ == "__main__":
    main()
