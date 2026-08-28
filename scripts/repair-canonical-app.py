#!/usr/bin/env python3
"""Recover the canonical full App.jsx and apply deterministic runtime fixes.

The repository briefly contained placeholder App.jsx commits. The last known
canonical full source is preserved in git at commit 6c9d2090... This script
restores that source only when App.jsx is clearly corrupted, then applies
idempotent fixes for language switching, restore visibility, and purchase UX.
"""
from __future__ import annotations

import re
import subprocess
from pathlib import Path

APP = Path("src/App.jsx")
CANONICAL_COMMIT = "6c9d2090f581d2ecc0e6a653379b81499361ad35"


def restore_if_corrupt() -> bool:
    current = APP.read_text(encoding="utf-8") if APP.exists() else ""
    if len(current) > 100_000 and "function PaywallScreen" in current and "function App(" in current:
        return False
    restored = subprocess.check_output(
        ["git", "show", f"{CANONICAL_COMMIT}:src/App.jsx"], text=True
    )
    if len(restored) < 100_000 or "function PaywallScreen" not in restored:
        raise SystemExit("Canonical App.jsx recovery source is unexpectedly incomplete")
    APP.parent.mkdir(parents=True, exist_ok=True)
    APP.write_text(restored, encoding="utf-8")
    print(f"Restored canonical App.jsx from {CANONICAL_COMMIT}")
    return True


def patch_language(text: str) -> str:
    old = 'const lang = data.settings.language || localLang || "en";'
    new = 'const lang = localLang || data.settings.language || "en";'
    if old in text:
        text = text.replace(old, new, 1)
    elif new not in text:
        raise SystemExit("Root language expression not found")

    if "fiftyfit-language-change" not in text:
        marker = 'const [localLang, setLocalLang] = useState(() => readStoredLanguage());'
        if marker not in text:
            raise SystemExit("localLang state declaration not found")
        listener = '''\n  useEffect(() => {\n    const onLanguageChange = (event) => {\n      const nextLang = event?.detail?.language;\n      if (nextLang !== "ar" && nextLang !== "en") return;\n      persistLanguage(nextLang);\n      setLocalLang(nextLang);\n    };\n    window.addEventListener("fiftyfit-language-change", onLanguageChange);\n    return () => window.removeEventListener("fiftyfit-language-change", onLanguageChange);\n  }, []);'''
        text = text.replace(marker, marker + listener, 1)

    # Patch the SettingsScreen language action so the current UI switches
    # immediately; localStorage is not reactive by itself.
    settings_start = text.find("function SettingsScreen(")
    if settings_start < 0:
        raise SystemExit("SettingsScreen not found")
    next_fn = text.find("\nfunction ", settings_start + 10)
    settings_end = next_fn if next_fn >= 0 else len(text)
    settings = text[settings_start:settings_end]
    if "fiftyfit-language-change" not in settings:
        old_persist = "    persistLanguage(l);\n"
        if old_persist not in settings:
            raise SystemExit("SettingsScreen language persistence line not found")
        new_persist = old_persist + '    window.dispatchEvent(new CustomEvent("fiftyfit-language-change", { detail: { language: l } }));\n'
        settings = settings.replace(old_persist, new_persist, 1)
        text = text[:settings_start] + settings + text[settings_end:]
    return text


def patch_restore_visibility(text: str) -> str:
    if "onClick={restore}" not in text:
        raise SystemExit("Restore Purchases handler not found")
    idx = text.find("onClick={restore}")
    start = text.rfind("{(data.entitlements.trainingPro ||", 0, idx)
    end = text.find("&& (", start)
    if start >= 0 and end >= 0:
        segment = text[start:end + 4]
        if "{true && (" not in segment:
            text = text[:start] + "{true && (" + text[end + 4:]
    return text


def patch_success_copy_and_close(text: str) -> str:
    replacements = {
        "خطة الأكل الخاصة بك أصبحت متاحة داخل التطبيق — هتلاقيها في تبويب الخطة الغذائية. احتجت مساعدة، كلمنا على واتساب في أي وقت.":
            "هنجهز لك خطتك المخصصة ونرسلها لك خلال 12 ساعة. هنبلغك أول ما تكون جاهزة.",
        "Your meal plan is now available inside the app — find it in the Nutrition Plan tab. Need help anytime, chat with us on WhatsApp.":
            "Your personalized plan will be prepared and sent to you within 12 hours. We'll notify you when it's ready.",
        "خطة مبنية على هدفك (":
            "خطة مبنية على هدفك (",
    }
    for old, new in replacements.items():
        if old in text:
            text = text.replace(old, new, 1)

    # Training-only success copy in this source is also a success modal; make
    # the copy consistent with the product promise.
    text = re.sub(
        r'(title: ar \? "تم تفعيل Training Pro بنجاح ✅".*?message: ar\n\s*\? )"[^"]*"\n\s*: )"[^"]*"',
        lambda m: m.group(1) + '"هنجهز لك خطتك التدريبية المخصصة ونرسلها لك خلال 12 ساعة. هنبلغك أول ما تكون جاهزة."' + m.group(2) + '"Your personalized training plan will be prepared and sent to you within 12 hours. We\'ll notify you when it\'s ready."',
        text,
        count=1,
        flags=re.DOTALL,
    )

    marker = '              <button\n                type="button"\n                onClick={successModal.onCta}'
    if marker in text and 'onClick={() => setSuccessModal(null)}' not in text:
        close_button = '''              <button\n                type="button"\n                onClick={() => setSuccessModal(null)}\n                style={{\n                  width: "100%",\n                  padding: "10px 14px",\n                  marginTop: 8,\n                  borderRadius: 12,\n                  border: `1px solid ${C.border}`,\n                  background: "transparent",\n                  color: C.text,\n                  fontWeight: 700,\n                  fontSize: 13,\n                  cursor: "pointer",\n                }}\n              >\n                {ar ? "إغلاق" : "Close"}\n              </button>\n'''
        # Insert after the CTA button's closing tag inside the success modal.
        pos = text.find(marker)
        close_pos = text.find("              </button>", pos)
        if close_pos < 0:
            raise SystemExit("Success modal CTA closing tag not found")
        close_pos += len("              </button>\n")
        text = text[:close_pos] + close_button + text[close_pos:]
    return text


def main() -> None:
    restore_if_corrupt()
    text = APP.read_text(encoding="utf-8")
    text = patch_language(text)
    text = patch_restore_visibility(text)
    text = patch_success_copy_and_close(text)
    APP.write_text(text, encoding="utf-8")

    check = APP.read_text(encoding="utf-8")
    required = [
        "function PaywallScreen",
        'const lang = localLang || data.settings.language || "en";',
        "fiftyfit-language-change",
        "onClick={restore}",
        '"هنجهز لك خطتك المخصصة ونرسلها لك خلال 12 ساعة. هنبلغك أول ما تكون جاهزة."',
        '"Your personalized plan will be prepared and sent to you within 12 hours. We\'ll notify you when it\'s ready."',
    ]
    for marker in required:
        if marker not in check:
            raise SystemExit(f"Canonical App repair assertion failed: {marker}")
    print("Canonical App.jsx repaired and runtime UX fixes verified")


if __name__ == "__main__":
    main()
