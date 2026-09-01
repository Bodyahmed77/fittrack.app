from pathlib import Path
import re

APP = Path("src/App.jsx")
text = APP.read_text(encoding="utf-8")

# 1) Never allow the authenticated data gate to block the whole app forever.
# The app keeps syncing after the fallback; this only releases the UI gate.
if "FIFTYFIT_BOOT_TIMEOUT_V1" not in text:
    pattern = re.compile(r'(const\s+\[loaded,\s*setLoaded\]\s*=\s*useState\(false\);)')
    m = pattern.search(text)
    if not m:
        raise SystemExit("production hardening: loaded state declaration not found")
    patch = '''\\1
  // FIFTYFIT_BOOT_TIMEOUT_V1: Firestore/auth recovery must never leave the
  // customer on an infinite splash screen. Data continues syncing in the
  // background after this bounded UI fallback.
  useEffect(() => {
    const startedAt = Date.now();
    const timer = setTimeout(() => {
      setLoaded((current) => {
        if (!current && typeof window !== "undefined") {
          try {
            window.__fiftyFitBootDiagnostics = {
              ...(window.__fiftyFitBootDiagnostics || {}),
              fallbackReleasedAt: new Date().toISOString(),
              elapsedMs: Date.now() - startedAt,
              reason: "data_load_timeout",
            };
          } catch (_) {}
        }
        return true;
      });
    }, 12000);
    return () => clearTimeout(timer);
  }, []);'''
    text = pattern.sub(patch, text, count=1)

# 2) Do not lock the entire product to a 430px phone-width shell.
# The internal cards remain readable; the shell expands on tablets.
text = re.sub(r'maxWidth:\s*430\b', 'maxWidth: "min(100%, 920px)"', text)
text = re.sub(r'max-width:\s*430px', 'max-width: min(100%, 920px)', text)

# 3) Add stable diagnostic marker for post-release support.
if "FIFTYFIT_PRODUCTION_HARDENING_V1" not in text:
    marker = '/* FIFTYFIT_PRODUCTION_HARDENING_V1 */\n'
    text = marker + text

APP.write_text(text, encoding="utf-8")
print("production hardening patch applied")
