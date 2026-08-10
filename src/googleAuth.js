import {
  GoogleAuthProvider,
  reauthenticateWithCredential,
  signInWithCredential,
  signInWithPopup,
} from "firebase/auth";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { auth, db } from "./firebase";
import { Capacitor } from "@capacitor/core";
import { GOOGLE_WEB_CLIENT_ID } from "./googleWebClientId";

// Must stay under 90s so the UI never sticks on "loading" forever.
const GOOGLE_SIGNIN_TIMEOUT_MS = 90000;

const PENDING_LANG_KEY = "ft_google_pending_lang";
const PENDING_FLAG_KEY = "ft_google_pending";
const PENDING_AT_KEY = "ft_google_pending_at";
const PENDING_NONCE_KEY = "ft_google_pending_nonce";
const SETTLED_EVENT = "ft-google-auth-settled";

/** Custom-scheme redirect so Chrome returns into the app (not https://localhost). */
export const GOOGLE_AUTH_REDIRECT_URI = "com.fittrack.app://google-auth";

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
  storageRemove(PENDING_NONCE_KEY);
}

function setPendingFlags(localLang, nonce) {
  storageSet(PENDING_FLAG_KEY, "1");
  storageSet(PENDING_LANG_KEY, localLang || "en");
  storageSet(PENDING_AT_KEY, String(Date.now()));
  if (nonce) storageSet(PENDING_NONCE_KEY, nonce);
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
 * success, cancel, timeout, deep-link failure, or resume-without-result.
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

function randomNonce() {
  const bytes = new Uint8Array(16);
  if (typeof crypto !== "undefined" && crypto.getRandomValues) {
    crypto.getRandomValues(bytes);
  } else {
    for (let i = 0; i < bytes.length; i++) bytes[i] = (Math.random() * 256) | 0;
  }
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

export function parseDeepLinkParams(url) {
  if (!url || typeof url !== "string") return {};
  const out = {};
  try {
    const hashIdx = url.indexOf("#");
    const queryIdx = url.indexOf("?");
    let search = "";
    if (hashIdx >= 0) search = url.slice(hashIdx + 1);
    else if (queryIdx >= 0) {
      const end = url.indexOf("#", queryIdx);
      search = url.slice(queryIdx + 1, end >= 0 ? end : undefined);
    }
    if (!search && url.includes("id_token=")) {
      const i = url.indexOf("id_token=");
      search = url.slice(i);
    }
    for (const part of search.split("&")) {
      if (!part) continue;
      const eq = part.indexOf("=");
      if (eq < 0) continue;
      const k = decodeURIComponent(part.slice(0, eq));
      const v = decodeURIComponent(part.slice(eq + 1).replace(/\+/g, " "));
      out[k] = v;
    }
  } catch (_) {
    /* ignore */
  }
  return out;
}

function buildGoogleAuthUrl(clientId, nonce) {
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: GOOGLE_AUTH_REDIRECT_URI,
    response_type: "id_token",
    scope: "openid email profile",
    nonce,
    prompt: "select_account",
  });
  return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
}

async function closeBrowserQuietly() {
  try {
    const { Browser } = await import("@capacitor/browser");
    await Browser.close();
  } catch (_) {
    /* ignore */
  }
}

export async function completeGoogleAuthFromDeepLink(url, createInitialState) {
  const params = parseDeepLinkParams(url);
  const lang = storageGet(PENDING_LANG_KEY) || "en";

  if (params.error) {
    clearPendingFlags();
    await closeBrowserQuietly();
    const cancelled =
      /access_denied|user_cancelled|cancel/i.test(params.error) ||
      /access_denied|user_cancelled|cancel/i.test(params.error_description || "");
    emitAuthSettled({
      ok: false,
      reason: cancelled ? "cancelled" : "oauth_error",
    });
    if (cancelled) {
      const err = new Error("Google Sign-In was cancelled");
      err.code = "cancelled";
      throw err;
    }
    const err = new Error(params.error_description || params.error);
    err.code = "oauth_error";
    throw err;
  }

  const idToken = params.id_token;
  if (!idToken) {
    return null;
  }

  const expectedNonce = storageGet(PENDING_NONCE_KEY);
  if (expectedNonce && params.nonce && params.nonce !== expectedNonce) {
    console.warn("[GoogleSignIn] nonce mismatch");
  }

  try {
    const credential = GoogleAuthProvider.credential(idToken);
    const userCred = await signInWithCredential(auth, credential);
    try {
      await ensureUserDoc(userCred, lang, createInitialState);
    } catch (e) {
      console.warn("[GoogleSignIn] ensureUserDoc failed", e);
    }
    clearPendingFlags();
    await closeBrowserQuietly();
    console.info(
      "[GoogleSignIn] deep-link success uid length",
      userCred.user.uid.length,
    );
    emitAuthSettled({ ok: true, reason: "deeplink_success" });
    return userCred;
  } catch (e) {
    clearPendingFlags();
    await closeBrowserQuietly();
    emitAuthSettled({ ok: false, reason: e?.code || "credential_error" });
    throw mapAuthError(e);
  }
}

async function nativeGoogleExternalBrowserSignIn(localLang, createInitialState) {
  const clientId = (GOOGLE_WEB_CLIENT_ID || "").trim();
  if (
    !clientId ||
    clientId.startsWith("REPLACE_WITH_") ||
    !clientId.includes(".apps.googleusercontent.com")
  ) {
    const err = new Error(
      "Google Web client ID is not configured for external browser sign-in",
    );
    err.code = "developer_error";
    throw err;
  }

  console.info("[GoogleSignIn] start native external browser OAuth");

  const nonce = randomNonce();
  setPendingFlags(localLang, nonce);

  const authUrl = buildGoogleAuthUrl(clientId, nonce);

  let settled = false;
  let resolveDone;
  let rejectDone;
  const done = new Promise((resolve, reject) => {
    resolveDone = resolve;
    rejectDone = reject;
  });

  const finish = (fn, value) => {
    if (settled) return;
    settled = true;
    clearTimeout(timer);
    fn(value);
  };

  const timer = setTimeout(async () => {
    clearPendingFlags();
    await closeBrowserQuietly();
    emitAuthSettled({ ok: false, reason: "timeout" });
    const err = new Error(
      "Google Sign-In timed out — Google account picker did not complete",
    );
    err.code = "timeout";
    finish(rejectDone, err);
  }, GOOGLE_SIGNIN_TIMEOUT_MS);

  let urlListener;
  let browserFinishedListener;
  try {
    const { App } = await import("@capacitor/app");
    const { Browser } = await import("@capacitor/browser");

    urlListener = await App.addListener("appUrlOpen", async ({ url }) => {
      if (!url || !String(url).includes("google-auth")) return;
      console.info("[GoogleSignIn] appUrlOpen google-auth");
      try {
        const cred = await completeGoogleAuthFromDeepLink(
          url,
          createInitialState,
        );
        if (cred) finish(resolveDone, cred);
      } catch (e) {
        finish(rejectDone, e);
      }
    });

    browserFinishedListener = await Browser.addListener(
      "browserFinished",
      async () => {
        setTimeout(() => {
          if (settled) return;
          if (!isPending()) return;
          clearPendingFlags();
          emitAuthSettled({ ok: false, reason: "cancelled" });
          const err = new Error("Google Sign-In was cancelled");
          err.code = "cancelled";
          finish(rejectDone, err);
        }, 600);
      },
    );

    await Browser.open({
      url: authUrl,
      presentationStyle: "popover",
      toolbarColor: "#000000",
    });
  } catch (e) {
    clearPendingFlags();
    clearTimeout(timer);
    emitAuthSettled({ ok: false, reason: e?.code || "browser_error" });
    if (urlListener) {
      try {
        await urlListener.remove();
      } catch (_) {}
    }
    if (browserFinishedListener) {
      try {
        await browserFinishedListener.remove();
      } catch (_) {}
    }
    throw mapAuthError(e);
  }

  try {
    return await done;
  } finally {
    if (urlListener) {
      try {
        await urlListener.remove();
      } catch (_) {}
    }
    if (browserFinishedListener) {
      try {
        await browserFinishedListener.remove();
      } catch (_) {}
    }
  }
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

/** Legacy no-op: external-browser flow uses appUrlOpen, not getRedirectResult. */
export async function consumeGoogleRedirectResult(_createInitialState) {
  return null;
}

let appStateHookInstalled = false;
let deepLinkHookInstalled = false;

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
      setTimeout(() => {
        if (!isPending()) return;
        console.info(
          "[GoogleSignIn] resume still pending — treating as cancelled",
        );
        clearPendingFlags();
        emitAuthSettled({ ok: false, reason: "cancelled_or_empty" });
      }, 1500);
    });
  } catch (e) {
    console.warn("[GoogleSignIn] app state hook unavailable", e);
  }
}

export async function installGoogleAuthDeepLinkHook(createInitialState) {
  if (deepLinkHookInstalled) return;
  if (!(await isNativePlatform())) return;
  deepLinkHookInstalled = true;

  try {
    const { App } = await import("@capacitor/app");
    App.addListener("appUrlOpen", async ({ url }) => {
      if (!url || !String(url).includes("google-auth")) return;
      if (!isPending() && !String(url).includes("id_token=")) return;
      console.info("[GoogleSignIn] global appUrlOpen google-auth");
      try {
        await completeGoogleAuthFromDeepLink(url, createInitialState);
      } catch (e) {
        console.warn(
          "[GoogleSignIn] global deep-link complete failed",
          e?.code || "",
          String(e?.message || e).slice(0, 160),
        );
      }
    });
  } catch (e) {
    console.warn("[GoogleSignIn] deep-link hook unavailable", e);
  }
}

export async function signInWithGoogleFlow(localLang = "en", createInitialState) {
  const native = await isNativePlatform();
  console.info("[GoogleSignIn] platform native?", native);

  try {
    if (native) {
      return await nativeGoogleExternalBrowserSignIn(
        localLang,
        createInitialState,
      );
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
  const native = await isNativePlatform();
  if (native) {
    const result = await nativeGoogleExternalBrowserSignIn("en");
    if (result?.user && result.user.uid === user?.uid) return result;
    const err = new Error(
      "Please sign in with Google again to confirm this action",
    );
    err.code = "reauth_required";
    throw err;
  }

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
