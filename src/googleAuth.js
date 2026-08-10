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

// Prefer localStorage so pending flags survive in-WebView OAuth navigations.
const PENDING_LANG_KEY = "ft_google_pending_lang";
const PENDING_FLAG_KEY = "ft_google_pending";
const PENDING_AT_KEY = "ft_google_pending_at";
const SETTLED_EVENT = "ft-google-auth-settled";

function storageGet(key) {
  try {
    return localStorage.getItem(key);
  } catch (_) {
    try {
      return sessionStorage.getItem(key);
    } catch (__) {
      return null;
    }
  }
}

function storageSet(key, value) {
  try {
    localStorage.setItem(key, value);
  } catch (_) {
    try {
      sessionStorage.setItem(key, value);
    } catch (__) {
      /* ignore */
    }
  }
}

function storageRemove(key) {
  try {
    localStorage.removeItem(key);
  } catch (_) {
    /* ignore */
  }
  try {
    sessionStorage.removeItem(key);
  } catch (_) {
    /* ignore */
  }
}

function clearPendingFlags() {
  storageRemove(PENDING_FLAG_KEY);
  storageRemove(PENDING_LANG_KEY);
  storageRemove(PENDING_AT_KEY);
}

function setPendingFlags(localLang) {
  storageSet(PENDING_FLAG_KEY, "1");
  storageSet(PENDING_LANG_KEY, localLang || "en");
  storageSet(PENDING_AT_KEY, String(Date.now()));
}

function isPending() {
  return storageGet(PENDING_FLAG_KEY) === "1";
}

function emitAuthSettled(detail = {}) {
  try {
    window.dispatchEvent(
      new CustomEvent(SETTLED_EVENT, { detail: { ...detail } }),
    );
  } catch (_) {
    /* ignore */
  }
}

/**
 * Login/SignUp screens subscribe so busy/loading always clears on
 * success, cancel, timeout, redirect failure, or resume-without-result.
 */
export function subscribeGoogleAuthSettled(handler) {
  if (typeof window === "undefined" || typeof handler !== "function") {
    return () => {};
  }
  const listener = (event) => {
    try {
      handler(event?.detail || {});
    } catch (_) {
      /* ignore */
    }
  };
  window.addEventListener(SETTLED_EVENT, listener);
  return () => window.removeEventListener(SETTLED_EVENT, listener);
}

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

/**
 * Minimal user document for first-time Google users when App.jsx
 * createInitialState is not available (e.g. startup redirect path).
 * useAppData already merges missing docs with a full freshState().
 */
function minimalInitialState(lang, user) {
  return {
    onboarded: false,
    account: {
      name: user?.displayName || "",
      email: user?.email || "",
      phone: "",
      gender: "",
      age: "",
      height: "",
      weight: "",
      goal: "",
      daysPerWeek: 4,
      activityLevel: "moderate",
      photo: user?.photoURL || "",
    },
    settings: {
      theme: "dark",
      notifications: true,
      reminderTime: "18:00",
      language: lang || "en",
    },
    profile: { level: 1, xp: 0, xpMax: 500 },
    entitlements: {
      nutritionPro: false,
      trainingPro: false,
      aiCoachPro: false,
      proExpiresAt: null,
    },
    nutritionPlan: null,
    proPlan: null,
    dailyTargets: null,
    activePlanId: "beginner",
    customPlan: {},
    bodyWeight: [],
    logs: {},
    meals: {},
    createdAt: new Date().toISOString(),
  };
}

async function ensureUserDoc(userCred, localLang, createInitialState) {
  if (!userCred?.user?.uid) return;
  const ref = doc(db, "users", userCred.user.uid);
  const snap = await getDoc(ref);
  if (snap.exists()) return;

  let initial;
  if (typeof createInitialState === "function") {
    initial = createInitialState();
    initial.account = initial.account || {};
    initial.account.name =
      userCred.user.displayName || initial.account.name || "";
    initial.account.email =
      userCred.user.email || initial.account.email || "";
    initial.settings = initial.settings || {};
    initial.settings.language =
      localLang || initial.settings.language || "en";
    initial.createdAt = new Date().toISOString();
  } else {
    initial = minimalInitialState(localLang, userCred.user);
  }
  await setDoc(ref, initial);
}

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
 * Android / Capacitor: Firebase JS redirect kept INSIDE the WebView via
 * capacitor.config.json server.allowNavigation (Google + Firebase hosts).
 * That prevents the system browser from opening https://localhost after
 * OAuth ("This site can't be reached").
 */
async function nativeGoogleRedirectSignIn(localLang) {
  console.info("[GoogleSignIn] start native Firebase JS redirect (in-WebView)");
  try {
    await setPersistence(auth, browserLocalPersistence);
  } catch (e) {
    console.warn("[GoogleSignIn] setPersistence failed", e);
  }

  setPendingFlags(localLang);

  const provider = new GoogleAuthProvider();
  provider.setCustomParameters({ prompt: "select_account" });

  try {
    // Navigates the Capacitor WebView to Google / Firebase auth handler.
    // With allowNavigation, the return to https://localhost stays in-app.
    await withTimeout(
      signInWithRedirect(auth, provider),
      GOOGLE_SIGNIN_TIMEOUT_MS,
      "Google Sign-In (redirect)",
    );
  } catch (e) {
    clearPendingFlags();
    emitAuthSettled({ ok: false, reason: "redirect_error" });
    throw mapAuthError(e);
  }

  // If the WebView never left this page, treat as failure.
  clearPendingFlags();
  emitAuthSettled({ ok: false, reason: "redirect_failed" });
  const err = new Error(
    "Google Sign-In redirect did not navigate — check allowNavigation and Firebase authorized domains",
  );
  err.code = "redirect_failed";
  throw err;
}

/**
 * Completes a pending Firebase redirect result.
 * Safe without createInitialState (uses minimalInitialState for new users).
 * Always emits ft-google-auth-settled so UI loading clears.
 */
export async function consumeGoogleRedirectResult(createInitialState) {
  const pending = isPending();
  const lang = storageGet(PENDING_LANG_KEY) || "en";

  let result;
  try {
    result = await getRedirectResult(auth);
  } catch (e) {
    console.warn(
      "[GoogleSignIn] getRedirectResult error",
      e?.code || "",
      String(e?.message || e).slice(0, 180),
    );
    clearPendingFlags();
    emitAuthSettled({ ok: false, reason: "redirect_result_error" });
    if (pending) throw mapAuthError(e);
    return null;
  }

  if (!result?.user) {
    if (pending) {
      console.info("[GoogleSignIn] pending redirect but no result user");
      // User may have cancelled in the Google UI and returned to the app.
      clearPendingFlags();
      emitAuthSettled({ ok: false, reason: "cancelled_or_empty" });
      const err = new Error("Google Sign-In was cancelled");
      err.code = "cancelled";
      // Do not throw on cold start with stale pending — only when actively pending.
      // Returning null + settled event is enough for UI; callers can toast.
      return null;
    }
    return null;
  }

  clearPendingFlags();
  console.info(
    "[GoogleSignIn] redirect result uid length",
    result.user.uid.length,
  );
  try {
    await ensureUserDoc(result, lang, createInitialState);
  } catch (e) {
    console.warn("[GoogleSignIn] ensureUserDoc failed", e);
    // Auth session still valid; App useAppData can create/merge the doc.
  }
  emitAuthSettled({ ok: true, reason: "redirect_success" });
  return result;
}

let appStateHookInstalled = false;

/**
 * When the app returns to foreground during a pending Google redirect,
 * try getRedirectResult again and always settle the loading UI.
 */
export async function installGoogleAuthAppStateHook() {
  if (appStateHookInstalled) return;
  if (!(await isNativePlatform())) return;
  appStateHookInstalled = true;

  try {
    const { App } = await import("@capacitor/app");
    App.addListener("appStateChange", async ({ isActive }) => {
      if (!isActive) return;
      if (!isPending()) {
        emitAuthSettled({ ok: false, reason: "resume_idle" });
        return;
      }
      console.info("[GoogleSignIn] app active with pending redirect — consume");
      try {
        await consumeGoogleRedirectResult();
      } catch (e) {
        console.warn("[GoogleSignIn] resume consume failed", e);
        clearPendingFlags();
        emitAuthSettled({ ok: false, reason: "resume_error" });
      }
    });
  } catch (e) {
    console.warn("[GoogleSignIn] app state hook unavailable", e);
  }
}

/**
 * Login + SignUp entry point.
 * - Web: popup
 * - Android/iOS Capacitor: Firebase JS redirect inside WebView
 */
export async function signInWithGoogleFlow(localLang = "en", createInitialState) {
  const native = await isNativePlatform();
  console.info("[GoogleSignIn] platform native?", native);

  try {
    if (native) {
      await nativeGoogleRedirectSignIn(localLang);
      return null;
    }

    const userCred = await webGoogleSignIn();
    await ensureUserDoc(userCred, localLang, createInitialState);
    console.info(
      "[GoogleSignIn] web success uid length",
      userCred.user.uid.length,
    );
    emitAuthSettled({ ok: true, reason: "popup_success" });
    return userCred;
  } catch (e) {
    clearPendingFlags();
    emitAuthSettled({ ok: false, reason: e?.code || "error" });
    throw mapAuthError(e);
  }
}

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
