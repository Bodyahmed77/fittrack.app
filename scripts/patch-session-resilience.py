#!/usr/bin/env python3
from pathlib import Path
import re

APP = Path("src/App.jsx")
MAIN = Path("src/main.jsx")

MARKER = "FIFTYFIT_SESSION_RESILIENCE_V1"

def once(text: str, old: str, new: str, label: str) -> str:
    if new in text:
        return text
    n = text.count(old)
    if n != 1:
        raise SystemExit(f"session-resilience: {label}: expected exactly 1 match, found {n}")
    return text.replace(old, new, 1)


def patch_app():
    s = APP.read_text(encoding="utf-8")
    if MARKER in s:
        return

    # Wait for Auth persistence before accepting the first observer value.
    s = once(
        s,
        'import { auth, db } from "./firebase";',
        'import { auth, db, authPersistenceReady } from "./firebase";',
        "firebase import",
    )

    old_auth = '''function useFirebaseSession() {
  const [firebaseUser, setFirebaseUser] = useState(undefined); // undefined = not checked yet, null = signed out
  useEffect(
    () => onAuthStateChanged(auth, (u) => setFirebaseUser(u || null)),
    [],
  );
  return firebaseUser;
}'''
    new_auth = '''function useFirebaseSession() {
  const [firebaseUser, setFirebaseUser] = useState(undefined); // undefined = auth state not settled
  useEffect(() => {
    let alive = true;
    let unsubscribe = null;
    authPersistenceReady
      .catch(() => null)
      .finally(() => {
        if (!alive) return;
        try {
          unsubscribe = onAuthStateChanged(auth, (u) => {
            if (alive) setFirebaseUser(u || null);
          });
        } catch (error) {
          console.error("[Firebase Auth] observer setup failed", error);
          if (alive) setFirebaseUser(auth.currentUser || null);
        }
      });
    return () => {
      alive = false;
      try { unsubscribe?.(); } catch (_) {}
    };
  }, []);
  return firebaseUser;
}'''
    s = once(s, old_auth, new_auth, "auth persistence gate")

    # Never block the app shell behind a Firestore write. The UI should remain
    # usable with the last known local state while the write retries in background.
    s = once(
        s,
        '    if (!loaded || writePending) return;\n    if (saveError) return;',
        '    if (!loaded) return;',
        "phase write/save gate",
    )

    # Android can report a transient offline state while waking a suspended app.
    # Authenticated users already have cached Firestore state, so do not replace
    # their whole app with the offline screen during that transient window.
    s = once(
        s,
        '  if (!online && phase !== "language") {',
        '  if (!online && firebaseUser === null && phase !== "language") {',
        "offline gate",
    )

    # Do not let a missing start date silently map a newly created account to
    # the calendar weekday. Repair it once as soon as the account is loaded.
    start_repair = '''  useEffect(() => {
    if (!firebaseUser || !loaded || !data.onboarded || data.workoutStartDate) return;
    const repaired = clone(data);
    repaired.workoutStartDate = dateKey(0);
    setData(repaired);
  }, [firebaseUser, loaded, data.onboarded, data.workoutStartDate, setData]);

'''
    anchor = '  // Keep selection on the device\'s REAL local calendar day when appropriate.\n'
    s = once(s, anchor, start_repair + anchor, "workout start-date repair")

    # Resume recovery: re-check auth token without signing the user out. This
    # handles long Android background/sleep periods and token refresh edges.
    resume = '''  useEffect(() => {
    let alive = true;
    const refreshAuthSilently = async () => {
      try {
        await authPersistenceReady.catch(() => null);
        if (!alive || !auth.currentUser) return;
        await auth.currentUser.getIdToken(false);
        try {
          await auth.currentUser.reload();
        } catch (_) {}
      } catch (error) {
        // A transient token/network failure must NOT force logout.
        console.warn("[Firebase Auth] silent resume check failed", error);
      }
    };
    refreshAuthSilently();
    const visibility = () => {
      if (document.visibilityState === "visible") refreshAuthSilently();
    };
    document.addEventListener("visibilitychange", visibility);
    let resumeHandle = null;
    try {
      resumeHandle = CapApp.addListener("resume", refreshAuthSilently);
    } catch (_) {}
    return () => {
      alive = false;
      document.removeEventListener("visibilitychange", visibility);
      try { resumeHandle?.remove?.(); } catch (_) {}
    };
  }, []);

'''
    anchor2 = '  const showToast = useCallback((msg, duration = 2200) => {'
    s = once(s, anchor2, resume + anchor2, "resume auth recovery")

    # Correct the actual Android package in Google Play subscription management links.
    s = s.replace(
        "https://play.google.com/store/account/subscriptions?package=com.fittrack.app",
        "https://play.google.com/store/account/subscriptions?package=com.bodyahmed77.fiftyfit",
    )

    # Leave a small diagnostic marker for support/debug builds.
    s = f"/* {MARKER} */\n" + s
    APP.write_text(s, encoding="utf-8")


def patch_main():
    s = MAIN.read_text(encoding="utf-8")
    if MARKER in s:
        return

    # Keep first paint deterministic. React itself still waits for auth/data, but
    # this gives us a bounded watchdog rather than an unending blank/loading state.
    watchdog = '''\n/* FIFTYFIT_SESSION_RESILIENCE_V1 */\nif (typeof window !== "undefined") {\n  window.__fiftyFitStartupDiagnostics = {\n    ...(window.__fiftyFitStartupDiagnostics || {}),\n    launchedAt: new Date().toISOString(),\n    visibility: document.visibilityState,\n  };\n  const markVisible = () => {\n    try { window.__fiftyFitStartupDiagnostics.visibility = document.visibilityState; } catch (_) {}\n  };\n  document.addEventListener("visibilitychange", markVisible, { passive: true });\n}\n'''
    anchor = 'const App = React.lazy(() => import("./App.jsx"));'
    s = once(s, anchor, watchdog + '\n' + anchor, "startup diagnostics")
    MAIN.write_text(s, encoding="utf-8")


def main():
    patch_main()
    patch_app()
    print("session/auth resilience patch applied")

if __name__ == "__main__":
    main()
