from pathlib import Path

p = Path("src/App.jsx")
s = p.read_text(encoding="utf-8")

old = '''      (err) => {
        console.error("Firestore read failed", err);
        setLoadError({ code: String(err?.code || "firestore_read_failed") });
        // If cached account data already hydrated the UI, keep the app open and
        // treat this as a background sync problem instead of blocking the user.
        if (loaded) return;
        setLoaded(false);
      },'''
new = '''      (err) => {
        console.error("Firestore read failed", err);
        setLoadError({ code: String(err?.code || "firestore_read_failed") });
        let hasCachedAccount = false;
        try {
          hasCachedAccount = !!localStorage.getItem(`fiftyfit:account-cache:${uid}`);
        } catch (_) {}
        // Returning users continue immediately from the last known state while
        // the Firestore listener reconnects in the background.
        setLoaded(hasCachedAccount || !!data?.account?.email);
      },'''
if new not in s:
    if old not in s:
        raise SystemExit("load fallback error callback anchor not found")
    s = s.replace(old, new, 1)

old_gate = '    if (loadError && !loaded) {'
new_gate = '    if (loadError && !loaded && !data?.account?.email) {'
if new_gate not in s:
    if old_gate not in s:
        raise SystemExit("load fallback root gate anchor not found")
    s = s.replace(old_gate, new_gate, 1)

marker = "/* FIFTYFIT_LOAD_FALLBACK_V1 */"
if marker not in s:
    s = marker + "\n" + s

p.write_text(s, encoding="utf-8")
print("load fallback applied")
