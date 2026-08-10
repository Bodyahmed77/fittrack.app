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

const GOOGLE_SIGNIN_TIMEOUT_MS = 90000;
const DEEP_LINK_SCHEME = "com.fittrack.app";
const DEEP_LINK_HOST = "google-auth";
const REDIRECT_URI = `${DEEP_LINK_SCHEME}://${DEEP_LINK_HOST}`;

const PENDING_LANG_KEY = "ft_google_pending_lang";
const PENDING_FLAG_KEY = "ft_google_pending";
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
    } catch (__) {}
  }
}

function storageRemove(key) {
  try {
    localStorage.removeItem(key);
  } catch (_) {}
  try {
    sessionStorage.removeItem(key);
  } catch (_) {}
}

function clearPendingFlags() {
  storageRemove(PENDING_FLAG_KEY);
  storageRemove(PENDING_LANG_KEY);
}

function setPendingFlags(localLang) {
  storageSet(PENDING_FLAG_KEY, "1");
  storageSet(PENDING_LANG_KEY, localLang || "en");
}

function isPending() {
  return storageGet(PENDING_FLAG_KEY) === "1";
}

function emitAuthSettled(detail = {}) {
  try {
    window.dispatchEvent(new CustomEvent(SETTLED_EVENT, { detail }));
  } catch (_) {}
}

export function subscribeGoogleAuthSettled(handler) {
  if (typeof window === "undefined" || typeof handler !== "function") {
    return () => {};
  }
  const listener = (event) => {
    try {
      handler(event?.detail || {});
    } catch (_) {}
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
  if (snap.exists()) {
    // Backfill name/email from Google if profile fields are empty
    const data = snap.data() || {};
    const account = { ...(data.account || {}) };
    let changed = false;
    if (!account.name && userCred.user.displayName) {
      account.name = userCred.user.displayName;
      changed = true;
    }
    if (!account.email && userCred.user.email) {
      account.email = userCred.user.email;
      changed = true;
    }
    if (changed) {
      await setDoc(ref, { account }, { merge: true });
    }
    return;
  }

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

function parseDeepLinkParams(url) {
  // Supports com.fittrack.app://google-auth#id_token=...&state=...
  // and com.fittrack.app://google-auth?id_token=...
  const normalized = String(url || "").replace(
    `${DEEP_LINK_SCHEME}://`,
    "https://callback/",
  );
  let parsed;
  try {
    parsed = new URL(normalized);
  } catch (_) {
    return new URLSearchParams();
  }
  const fromQuery = new URLSearchParams(parsed.search || "");
  const hash = (parsed.hash || "").replace(/^#/, "");
  const fromHash = new URLSearchParams(hash);
  // Prefer hash (implicit id_token flow), fall back to query
  if ([...fromHash.keys()].length) return fromHash;
  return fromQuery;
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
 * Android: open Google OAuth in the *system browser* (Chrome Custom Tabs)
 * so the user can pick accounts already saved in Chrome — not an in-app WebView.
 * Return path: com.fittrack.app://google-auth with id_token → Firebase credential.
 */
async function nativeGoogleExternalBrowserSignIn(localLang, createInitialState) {
  console.info("[GoogleSignIn] start external browser OAuth");
  const clientId = (GOOGLE_WEB_CLIENT_ID || "").trim();
  if (!clientId) {
    const err = new Error(
      "Google Web Client ID missing — rebuild after CI extracts it from google-services.json",
    );
    err.code = "developer_error";
    throw err;
  }

  const { Browser } = await import("@capacitor/browser");
  const { App } = await import("@capacitor/app");

  setPendingFlags(localLang);

  return new Promise(async (resolve, reject) => {
    let settled = false;
    let urlHandle;
    let browserHandle;

    const cleanup = async () => {
      clearPendingFlags();
      try {
        await urlHandle?.remove?.();
      } catch (_) {}
      try {
        await browserHandle?.remove?.();
      } catch (_) {}
      try {
        await Browser.close();
      } catch (_) {}
    };

    const finish = async (err, userCred) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      await cleanup();
      if (err) {
        emitAuthSettled({ ok: false, reason: err?.code || "error" });
        reject(mapAuthError(err));
      } else {
        emitAuthSettled({ ok: true, reason: "browser_success" });
        resolve(userCred);
      }
    };

    const timer = setTimeout(() => {
      const err = new Error("Google Sign-In timed out");
      err.code = "timeout";
      finish(err);
    }, GOOGLE_SIGNIN_TIMEOUT_MS);

    try {
      urlHandle = await App.addListener("appUrlOpen", async ({ url }) => {
        try {
          if (!url || !String(url).startsWith(`${DEEP_LINK_SCHEME}://`)) return;
          if (!String(url).includes(DEEP_LINK_HOST)) return;

          const params = parseDeepLinkParams(url);
          const oauthError = params.get("error");
          if (oauthError) {
            const err = new Error(oauthError);
            err.code =
              oauthError === "access_denied" ? "cancelled" : "auth_error";
            await finish(err);
            return;
          }

          const idToken = params.get("id_token");
          if (!idToken) {
            const err = new Error("No ID token in Google OAuth callback");
            err.code = "no_id_token";
            await finish(err);
            return;
          }

          const credential = GoogleAuthProvider.credential(idToken);
          const userCred = await signInWithCredential(auth, credential);
          await ensureUserDoc(
            userCred,
            storageGet(PENDING_LANG_KEY) || localLang,
            createInitialState,
          );
          console.info(
            "[GoogleSignIn] browser success uid length",
            userCred.user.uid.length,
          );
          await finish(null, userCred);
        } catch (e) {
          await finish(e);
        }
      });

      // User closed Chrome without completing OAuth
      browserHandle = await Browser.addListener("browserFinished", () => {
        setTimeout(() => {
          if (!settled && isPending()) {
            const err = new Error("Google Sign-In was cancelled");
            err.code = "cancelled";
            finish(err);
          }
        }, 400);
      });

      const nonce =
        Math.random().toString(36).slice(2) +
        Date.now().toString(36) +
        Math.random().toString(36).slice(2);

      const oauthUrl =
        "https://accounts.google.com/o/oauth2/v2/auth" +
        `?client_id=${encodeURIComponent(clientId)}` +
        `&redirect_uri=${encodeURIComponent(REDIRECT_URI)}` +
        "&response_type=id_token" +
        `&scope=${encodeURIComponent("openid email profile")}` +
        `&nonce=${encodeURIComponent(nonce)}` +
        "&prompt=select_account";

      console.info("[GoogleSignIn] opening system browser for Google OAuth");
      await Browser.open({ url: oauthUrl });
    } catch (e) {
      await finish(e);
    }
  });
}

/** @deprecated retained no-op for older main.jsx callers */
export async function consumeGoogleRedirectResult() {
  return null;
}

/** @deprecated retained no-op for older main.jsx callers */
export async function installGoogleAuthAppStateHook() {
  // External-browser flow uses appUrlOpen inside signInWithGoogleFlow.
  // Still emit settle on resume if a stale pending flag exists.
  if (!(await isNativePlatform())) return;
  try {
    const { App } = await import("@capacitor/app");
    App.addListener("appStateChange", ({ isActive }) => {
      if (isActive && isPending()) {
        // Pending is cleared by deep-link success or browserFinished cancel.
        // If user left Chrome without closing it, do not force-cancel here.
      }
    });
  } catch (_) {}
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
  if (await isNativePlatform()) {
    // Re-run external browser flow and ensure same uid
    const result = await nativeGoogleExternalBrowserSignIn("en");
    if (result?.user?.uid && result.user.uid !== user.uid) {
      const err = new Error("Reauth used a different Google account");
      err.code = "auth_error";
      throw err;
    }
    return result;
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
