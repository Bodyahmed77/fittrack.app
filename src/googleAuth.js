import {
  GoogleAuthProvider,
  browserLocalPersistence,
  getRedirectResult,
  reauthenticateWithCredential,
  setPersistence,
  signInWithPopup,
  signInWithRedirect,
} from "firebase/auth";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { auth, db } from "./firebase";
import { Capacitor } from "@capacitor/core";

// Must stay under 90s so the UI never sticks on "loading" forever.
const GOOGLE_SIGNIN_TIMEOUT_MS = 90000;

// sessionStorage keys used to finish user-doc creation after redirect return
const PENDING_LANG_KEY = "ft_google_pending_lang";
const PENDING_FLAG_KEY = "ft_google_pending";

async function isNativePlatform() {
  try {
    return Capacitor.isNativePlatform();
  } catch (e) {
    return false;
  }
}

function withTimeout(promise, ms, label) {
  let timer;
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => {
      const err = new Error(
        `${label} timed out — Google account picker did not complete`,
      );
      err.code = "timeout";
      reject(err);
    }, ms);
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}

function mapAuthError(e) {
  const raw = String(e?.message || e || "");
  const code = String(e?.code || "");
  if (
    code === "auth/popup-closed-by-user" ||
    code === "auth/cancelled-popup-request" ||
    /cancelled|canceled/i.test(raw + code)
  ) {
    const err = new Error("Google Sign-In was cancelled");
    err.code = "cancelled";
    return err;
  }
  if (code === "auth/popup-blocked") {
    const err = new Error("Google Sign-In popup was blocked");
    err.code = "popup_blocked";
    return err;
  }
  if (code === "timeout" || e?.code === "timeout") {
    const err = new Error(raw || "Google Sign-In timed out");
    err.code = "timeout";
    return err;
  }
  if (e && typeof e === "object" && !e.code) {
    e.code = code || "auth_error";
  }
  return e instanceof Error ? e : new Error(raw || "Google Sign-In failed");
}

async function ensureUserDoc(userCred, localLang, createInitialState) {
  if (!userCred?.user?.uid) return;
  const ref = doc(db, "users", userCred.user.uid);
  const snap = await getDoc(ref);
  if (snap.exists()) return;
  if (typeof createInitialState !== "function") return;
  const initial = createInitialState();
  initial.account = initial.account || {};
  initial.account.name = userCred.user.displayName || initial.account.name || "";
  initial.account.email = userCred.user.email || initial.account.email || "";
  initial.settings = initial.settings || {};
  initial.settings.language =
    localLang || initial.settings.language || "en";
  initial.createdAt = new Date().toISOString();
  await setDoc(ref, initial);
}

/**
 * Desktop / browser: Firebase popup (already works).
 */
async function webGoogleSignIn() {
  console.info("[GoogleSignIn] start web popup");
  const provider = new GoogleAuthProvider();
  provider.setCustomParameters({ prompt: "select_account" });
  return withTimeout(
    signInWithPopup(auth, provider),
    GOOGLE_SIGNIN_TIMEOUT_MS,
    "Google Sign-In (web)",
  );
}

/**
 * Android / Capacitor: Firebase JS redirect flow.
 * Does NOT call @capacitor-firebase/authentication or play-services-auth
 * GoogleSignInClient. The system / WebView opens Google's account chooser
 * via Firebase Auth's web OAuth handler, then returns into the app.
 * Session is completed by consumeGoogleRedirectResult() on next launch.
 */
async function nativeGoogleRedirectSignIn(localLang) {
  console.info("[GoogleSignIn] start native Firebase JS redirect");
  try {
    await setPersistence(auth, browserLocalPersistence);
  } catch (e) {
    console.warn("[GoogleSignIn] setPersistence failed", e);
  }
  try {
    sessionStorage.setItem(PENDING_FLAG_KEY, "1");
    sessionStorage.setItem(PENDING_LANG_KEY, localLang || "en");
  } catch (_) {
    /* private mode / storage blocked — still attempt redirect */
  }

  const provider = new GoogleAuthProvider();
  provider.setCustomParameters({ prompt: "select_account" });

  // signInWithRedirect navigates away. If the promise hangs without
  // navigation (misconfigured auth domain / WebView block), timeout fires.
  await withTimeout(
    signInWithRedirect(auth, provider),
    GOOGLE_SIGNIN_TIMEOUT_MS,
    "Google Sign-In (redirect)",
  );

  // Normally the WebView has left this page. If we are still here, treat as failure.
  const err = new Error(
    "Google Sign-In redirect did not navigate — check Firebase authorized domains and authDomain",
  );
  err.code = "redirect_failed";
  throw err;
}

/**
 * Call once on app startup (main.jsx). Completes a pending redirect result
 * after the user returns from Google into the Capacitor WebView.
 * Auth state listener will then route the user; user doc is created if missing.
 */
export async function consumeGoogleRedirectResult(createInitialState) {
  let pending = false;
  let lang = "en";
  try {
    pending = sessionStorage.getItem(PENDING_FLAG_KEY) === "1";
    lang = sessionStorage.getItem(PENDING_LANG_KEY) || "en";
  } catch (_) {
    /* ignore */
  }

  let result;
  try {
    result = await getRedirectResult(auth);
  } catch (e) {
    console.warn(
      "[GoogleSignIn] getRedirectResult error",
      e?.code || "",
      String(e?.message || e).slice(0, 180),
    );
    try {
      sessionStorage.removeItem(PENDING_FLAG_KEY);
      sessionStorage.removeItem(PENDING_LANG_KEY);
    } catch (_) {}
    // Only surface if we expected a redirect; otherwise ignore noise on cold start.
    if (pending) throw mapAuthError(e);
    return null;
  }

  try {
    sessionStorage.removeItem(PENDING_FLAG_KEY);
    sessionStorage.removeItem(PENDING_LANG_KEY);
  } catch (_) {}

  if (!result?.user) {
    if (pending) {
      console.info("[GoogleSignIn] pending redirect but no result user");
    }
    return null;
  }

  console.info(
    "[GoogleSignIn] redirect result uid length",
    result.user.uid.length,
  );
  await ensureUserDoc(result, lang, createInitialState);
  return result;
}

/**
 * Login + SignUp entry point.
 * - Web: popup
 * - Android/iOS Capacitor: Firebase JS redirect (no legacy native Google Sign-In)
 */
export async function signInWithGoogleFlow(localLang = "en", createInitialState) {
  const native = await isNativePlatform();
  console.info("[GoogleSignIn] platform native?", native);

  try {
    if (native) {
      await nativeGoogleRedirectSignIn(localLang);
      // Unreachable when redirect succeeds (page navigates away).
      return null;
    }

    const userCred = await webGoogleSignIn();
    await ensureUserDoc(userCred, localLang, createInitialState);
    console.info(
      "[GoogleSignIn] web success uid length",
      userCred.user.uid.length,
    );
    return userCred;
  } catch (e) {
    throw mapAuthError(e);
  }
}

/**
 * Re-auth before sensitive actions (e.g. account delete).
 * Uses web popup on all platforms (redirect is awkward for immediate credential use).
 * Does not call the legacy native Google Sign-In plugin.
 */
export async function reauthenticateWithGoogleFlow(user) {
  const provider = new GoogleAuthProvider();
  provider.setCustomParameters({ prompt: "select_account" });
  try {
    const result = await withTimeout(
      signInWithPopup(auth, provider),
      GOOGLE_SIGNIN_TIMEOUT_MS,
      "Google reauth",
    );
    const credential = GoogleAuthProvider.credentialFromResult(result);
    if (!credential) {
      const err = new Error("Could not get Google credential for reauth");
      err.code = "no_id_token";
      throw err;
    }
    return reauthenticateWithCredential(user, credential);
  } catch (e) {
    throw mapAuthError(e);
  }
}
