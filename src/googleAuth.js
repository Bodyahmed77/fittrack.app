/**
 * Google Sign-In for FitTrack
 *
 * - Web / desktop: Firebase JS signInWithPopup
 * - Android / iOS (Capacitor): @capacitor-firebase/authentication
 *   signInWithGoogle() → Android Credential Manager account picker →
 *   ID token → Firebase JS signInWithCredential
 *
 * No custom OAuth redirect URIs, no Browser.open(), no signInWithRedirect,
 * no external Chrome OAuth, no https://localhost callback.
 */
import {
  GoogleAuthProvider,
  reauthenticateWithCredential,
  signInWithCredential,
  signInWithPopup,
} from "firebase/auth";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { auth, db } from "./firebase";
import { Capacitor } from "@capacitor/core";

const GOOGLE_SIGNIN_TIMEOUT_MS = 90000;
const SETTLED_EVENT = "ft-google-auth-settled";

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
 * success, cancel, timeout, or error.
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
  return () => {
    try {
      window.removeEventListener(SETTLED_EVENT, listener);
    } catch (_) {
      /* ignore */
    }
  };
}

async function isNativePlatform() {
  try {
    return Capacitor.isNativePlatform();
  } catch (_) {
    return false;
  }
}

function withTimeout(promise, ms, label) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      const err = new Error(`${label} timed out after ${ms}ms`);
      err.code = "timeout";
      reject(err);
    }, ms);
    promise.then(
      (v) => {
        clearTimeout(timer);
        resolve(v);
      },
      (e) => {
        clearTimeout(timer);
        reject(e);
      },
    );
  });
}

function mapAuthError(e) {
  if (!e) return e;
  const code = e.code || e.errorCode || "";
  const msg = String(e.message || e).toLowerCase();

  if (
    code === "auth/popup-closed-by-user" ||
    code === "auth/cancelled-popup-request" ||
    code === "ERROR_CANCELLED" ||
    code === "canceled" ||
    code === "cancelled" ||
    /cancel|cancell?ed|user.?denied|access.?denied/i.test(msg)
  ) {
    const err = new Error("Google Sign-In was cancelled");
    err.code = "cancelled";
    return err;
  }
  if (code === "timeout" || /timed?\s*out/i.test(msg)) {
    const err = new Error(e.message || "Google Sign-In timed out");
    err.code = "timeout";
    return err;
  }
  if (
    /developer.?error|10\b|DEVELOPER_ERROR|configuration/i.test(code + " " + msg)
  ) {
    const err = new Error(
      "Google Sign-In configuration error (check SHA-1 / Web Client ID in Firebase)",
    );
    err.code = "developer_error";
    return err;
  }
  if (/no.?id.?token|missing.?id.?token|null.?credential/i.test(msg)) {
    const err = new Error("Could not get a Google ID token");
    err.code = "no_id_token";
    return err;
  }
  if (
    /credential.?manager|device doesn't support/i.test(msg) ||
    code === "ERROR_UNSUPPORTED"
  ) {
    const err = new Error(
      "This device does not support Google Credential Manager",
    );
    err.code = "credential_manager_unsupported";
    return err;
  }
  return e;
}

function minimalInitialState(user, localLang) {
  return {
    account: {
      name: user?.displayName || "",
      email: user?.email || "",
      phone: "",
      photoURL: user?.photoURL || "",
      createdAt: Date.now(),
    },
    settings: {
      language: localLang === "ar" ? "ar" : "en",
      theme: "dark",
      units: "metric",
    },
    onboarded: false,
    programStartDate: null,
  };
}

async function ensureUserDoc(userCred, localLang, createInitialState) {
  const user = userCred?.user;
  if (!user?.uid) return;

  const ref = doc(db, "users", user.uid);
  const snap = await getDoc(ref);
  if (snap.exists()) {
    const existing = snap.data() || {};
    const patch = {};
    if (!existing.account?.email && user.email) {
      patch["account.email"] = user.email;
    }
    if (!existing.account?.name && user.displayName) {
      patch["account.name"] = user.displayName;
    }
    if (Object.keys(patch).length) {
      try {
        await setDoc(ref, patch, { merge: true });
      } catch (e) {
        console.warn("[GoogleSignIn] ensureUserDoc patch failed", e);
      }
    }
    return;
  }

  const initial =
    typeof createInitialState === "function"
      ? createInitialState(user, localLang)
      : minimalInitialState(user, localLang);

  try {
    await setDoc(ref, initial, { merge: true });
  } catch (e) {
    console.warn("[GoogleSignIn] ensureUserDoc create failed", e);
  }
}

async function webGoogleSignIn() {
  const provider = new GoogleAuthProvider();
  provider.setCustomParameters({ prompt: "select_account" });
  provider.addScope("profile");
  provider.addScope("email");
  return withTimeout(
    signInWithPopup(auth, provider),
    GOOGLE_SIGNIN_TIMEOUT_MS,
    "Google Sign-In (popup)",
  );
}

/**
 * Native Google Sign-In via @capacitor-firebase/authentication.
 * Uses Android Credential Manager (plugin default since v7).
 * Returns a Firebase UserCredential after signInWithCredential.
 */
async function nativeGoogleCredentialManagerSignIn(
  localLang,
  createInitialState,
) {
  console.info("[GoogleSignIn] start native Credential Manager flow");

  const { FirebaseAuthentication } = await import(
    "@capacitor-firebase/authentication"
  );

  // useCredentialManager defaults to true on plugin 7.2+; set explicitly.
  const result = await withTimeout(
    FirebaseAuthentication.signInWithGoogle({
      useCredentialManager: true,
      skipNativeAuth: true,
    }),
    GOOGLE_SIGNIN_TIMEOUT_MS,
    "Google Sign-In (Credential Manager)",
  );

  const idToken =
    result?.credential?.idToken ||
    result?.credential?.id_token ||
    result?.idToken;

  if (!idToken) {
    const err = new Error("Could not get a Google ID token from native sign-in");
    err.code = "no_id_token";
    throw err;
  }

  const credential = GoogleAuthProvider.credential(idToken);
  const userCred = await signInWithCredential(auth, credential);

  try {
    await ensureUserDoc(userCred, localLang, createInitialState);
  } catch (e) {
    console.warn("[GoogleSignIn] ensureUserDoc after native sign-in", e);
  }

  console.info(
    "[GoogleSignIn] native success uid length",
    userCred.user?.uid?.length || 0,
  );
  return userCred;
}

/**
 * Login + SignUp entry point.
 * - Web: popup
 * - Android/iOS Capacitor: Credential Manager via plugin → Firebase credential
 */
export async function signInWithGoogleFlow(localLang = "en", createInitialState) {
  const native = await isNativePlatform();
  console.info("[GoogleSignIn] platform native?", native);

  try {
    if (native) {
      const userCred = await nativeGoogleCredentialManagerSignIn(
        localLang,
        createInitialState,
      );
      emitAuthSettled({ ok: true, reason: "credential_manager_success" });
      return userCred;
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
    const mapped = mapAuthError(e);
    emitAuthSettled({
      ok: false,
      reason: mapped?.code || e?.code || "error",
    });
    throw mapped;
  }
}

export async function reauthenticateWithGoogleFlow(user) {
  const native = await isNativePlatform();
  try {
    if (native) {
      const { FirebaseAuthentication } = await import(
        "@capacitor-firebase/authentication"
      );
      const result = await withTimeout(
        FirebaseAuthentication.signInWithGoogle({
          useCredentialManager: true,
          skipNativeAuth: true,
        }),
        GOOGLE_SIGNIN_TIMEOUT_MS,
        "Google reauth (Credential Manager)",
      );
      const idToken =
        result?.credential?.idToken ||
        result?.credential?.id_token ||
        result?.idToken;
      if (!idToken) {
        const err = new Error("Could not get Google credential for reauth");
        err.code = "no_id_token";
        throw err;
      }
      const credential = GoogleAuthProvider.credential(idToken);
      return reauthenticateWithCredential(user, credential);
    }

    const provider = new GoogleAuthProvider();
    provider.setCustomParameters({ prompt: "select_account" });
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

/**
 * No-ops kept so older main.jsx / call sites that still import them
 * do not break. Credential Manager does not need redirect consumption
 * or deep-link handlers.
 */
export async function consumeGoogleRedirectResult() {
  return null;
}

export async function installGoogleAuthAppStateHook() {
  return;
}

export async function installGoogleAuthDeepLinkHook() {
  return;
}
