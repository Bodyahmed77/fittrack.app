/**
 * Google Sign-In for Fifty Fit
 *
 * Web / desktop: Firebase JS signInWithPopup.
 * Android / iOS: @capacitor-firebase/authentication.
 *
 * Android uses the current Credential Manager path first. The legacy native
 * chooser is only a compatibility fallback for the documented no-credential
 * case; a Google developer error (status 10) is never hidden by retrying the
 * same broken configuration through another chooser.
 */
import {
  GoogleAuthProvider,
  reauthenticateWithCredential,
  signInWithCredential,
  signInWithPopup,
} from "firebase/auth";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { Capacitor } from "@capacitor/core";
import { FirebaseAuthentication } from "@capacitor-firebase/authentication";
import { auth, db } from "./firebase";

const GOOGLE_SIGNIN_TIMEOUT_MS = 90000;
const SETTLED_EVENT = "ft-google-auth-settled";

function emitAuthSettled(detail = {}) {
  try {
    window.dispatchEvent(new CustomEvent(SETTLED_EVENT, { detail: { ...detail } }));
  } catch (_) {}
}

export function subscribeGoogleAuthSettled(handler) {
  if (typeof window === "undefined" || typeof handler !== "function") return () => {};
  const listener = (event) => {
    try { handler(event?.detail || {}); } catch (_) {}
  };
  window.addEventListener(SETTLED_EVENT, listener);
  return () => {
    try { window.removeEventListener(SETTLED_EVENT, listener); } catch (_) {}
  };
}

function withTimeout(promise, ms, label) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      const err = new Error(`${label} timed out after ${ms}ms`);
      err.code = "timeout";
      reject(err);
    }, ms);
    promise.then(
      (value) => { clearTimeout(timer); resolve(value); },
      (error) => { clearTimeout(timer); reject(error); },
    );
  });
}

function copyDiagnostic(err, raw) {
  if (!err || !raw) return err;
  try {
    if (raw.code != null) err.nativeCode = String(raw.code);
    if (raw.message) err.nativeMessage = String(raw.message);
    if (raw.errorCode != null) err.nativeErrorCode = String(raw.errorCode);
  } catch (_) {}
  return err;
}

function mapAuthError(error) {
  if (!error) return error;
  const code = String(error.code || error.errorCode || "");
  const message = String(error.message || error).toLowerCase();
  const numericCode = String(error.code ?? error.errorCode ?? "");

  if (
    numericCode === "10" ||
    code === "10" ||
    /developer.?error|developer_error/.test(`${code} ${numericCode} ${message}`)
  ) {
    return copyDiagnostic(
      Object.assign(
        new Error(
          "Google Sign-In developer error (10): Android OAuth configuration does not match the certificate/package used by this release build",
        ),
        { code: "developer_error", googleStatusCode: "10" },
      ),
      error,
    );
  }

  if (
    code === "auth/popup-closed-by-user" ||
    code === "auth/cancelled-popup-request" ||
    code === "ERROR_CANCELLED" ||
    code === "canceled" ||
    code === "cancelled" ||
    /cancel|cancell?ed|user.?denied|access.?denied/i.test(message)
  ) {
    return copyDiagnostic(Object.assign(new Error("Google Sign-In was cancelled"), { code: "cancelled" }), error);
  }

  if (code === "timeout" || /timed?\s*out/i.test(message)) {
    return copyDiagnostic(Object.assign(new Error(error.message || "Google Sign-In timed out"), { code: "timeout" }), error);
  }

  if (/no.?id.?token|missing.?id.?token|null.?credential/i.test(message)) {
    return copyDiagnostic(Object.assign(new Error("Could not get a Google ID token"), { code: "no_id_token" }), error);
  }

  return error;
}

function isNoCredentialError(error) {
  const code = String(error?.code ?? error?.errorCode ?? "").toLowerCase();
  const nativeCode = String(error?.nativeCode ?? error?.nativeErrorCode ?? "").toLowerCase();
  const message = String(error?.message || error?.nativeMessage || error || "").toLowerCase();
  return (
    code.includes("no_credential") ||
    code.includes("no-credential") ||
    nativeCode.includes("no_credential") ||
    nativeCode.includes("no-credential") ||
    message.includes("no credentials available") ||
    message.includes("no matching credentials") ||
    message.includes("no credential")
  );
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
    entitlements: {
      trainingPro: false,
      nutritionPro: false,
      aiCoachPro: false,
      proExpiresAt: null,
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
    if (!existing.account?.email && user.email) patch["account.email"] = user.email;
    if (!existing.account?.name && user.displayName) patch["account.name"] = user.displayName;
    if (!existing.settings?.language && (localLang === "ar" || localLang === "en")) {
      patch["settings.language"] = localLang;
    }
    if (!Object.keys(patch).length) return;
    await setDoc(
      ref,
      { ...patch, updatedAt: new Date().toISOString() },
      { merge: true },
    );
    return;
  }

  const initial = typeof createInitialState === "function"
    ? createInitialState(user, localLang)
    : minimalInitialState(user, localLang);
  initial.entitlements = {
    trainingPro: false,
    nutritionPro: false,
    aiCoachPro: false,
    proExpiresAt: null,
  };
  initial.updatedAt = new Date().toISOString();
  await setDoc(ref, initial, { merge: true });
}

function isNativePlatform() {
  try { return Capacitor.isNativePlatform(); } catch (_) { return false; }
}

async function webGoogleSignIn() {
  const provider = new GoogleAuthProvider();
  provider.setCustomParameters({ prompt: "select_account" });
  provider.addScope("profile");
  provider.addScope("email");
  return withTimeout(signInWithPopup(auth, provider), GOOGLE_SIGNIN_TIMEOUT_MS, "Google Sign-In (popup)");
}

async function runNativeGoogleSignIn(useCredentialManager = true) {
  return withTimeout(
    FirebaseAuthentication.signInWithGoogle({
      useCredentialManager,
      skipNativeAuth: true,
    }),
    GOOGLE_SIGNIN_TIMEOUT_MS,
    `Google Sign-In (native, credentialManager=${useCredentialManager})`,
  );
}

async function nativeGoogleSignIn(localLang, createInitialState) {
  let result;
  let usedCredentialManager = true;
  try {
    console.info("[GoogleSignIn] native start: Credential Manager");
    result = await runNativeGoogleSignIn(true);
  } catch (nativeError) {
    const mapped = mapAuthError(nativeError);
    if (!isNoCredentialError(mapped)) {
      try {
        window.__fiftyFitGoogleAuthDiagnostics = {
          stage: "native_sign_in_credential_manager",
          code: mapped?.code || "unknown",
          googleStatusCode: mapped?.googleStatusCode || mapped?.nativeCode || mapped?.nativeErrorCode || null,
          nativeCode: mapped?.nativeCode || null,
          nativeErrorCode: mapped?.nativeErrorCode || null,
          nativeMessage: mapped?.nativeMessage || null,
          message: mapped?.message || String(mapped || ""),
          updatedAt: new Date().toISOString(),
        };
      } catch (_) {}
      console.error("[GoogleSignIn] Credential Manager failed", mapped?.code || mapped?.nativeCode || "", mapped?.message || "");
      throw mapped;
    }

    console.warn("[GoogleSignIn] no authorized Credential Manager credential; using legacy chooser");
    usedCredentialManager = false;
    result = await runNativeGoogleSignIn(false);
  }

  const idToken = result?.credential?.idToken || result?.credential?.id_token || result?.idToken;
  const accessToken = result?.credential?.accessToken || result?.credential?.access_token || result?.accessToken || null;
  if (!idToken) {
    const err = new Error("Could not get a Google ID token from native sign-in");
    err.code = "no_id_token";
    throw err;
  }

  const credential = GoogleAuthProvider.credential(idToken, accessToken || undefined);
  let userCred;
  try {
    userCred = await signInWithCredential(auth, credential);
  } catch (firebaseError) {
    const mapped = mapAuthError(firebaseError);
    mapped.firebaseAuthCode = String(firebaseError?.code || firebaseError?.errorCode || "");
    mapped.firebaseAuthMessage = String(firebaseError?.message || firebaseError || "");
    mapped.message = `Google Sign-In failed after account selection [${mapped.firebaseAuthCode || "unknown"}]: ${mapped.firebaseAuthMessage}`;
    throw mapped;
  }

  await ensureUserDoc(userCred, localLang, createInitialState);
  console.info("[GoogleSignIn] native success", { credentialManager: usedCredentialManager });
  return userCred;
}

export async function signInWithGoogleFlow(localLang = "en", createInitialState) {
  const native = isNativePlatform();
  console.info("[GoogleSignIn] platform native?", native);
  try {
    if (native) {
      const userCred = await nativeGoogleSignIn(localLang, createInitialState);
      emitAuthSettled({ ok: true, reason: "native_google_success" });
      return userCred;
    }
    const userCred = await webGoogleSignIn();
    await ensureUserDoc(userCred, localLang, createInitialState);
    emitAuthSettled({ ok: true, reason: "popup_success" });
    return userCred;
  } catch (error) {
    const mapped = mapAuthError(error);
    emitAuthSettled({ ok: false, reason: mapped?.code || error?.code || "error" });
    throw mapped;
  }
}

export async function reauthenticateWithGoogleFlow(user) {
  const native = isNativePlatform();
  try {
    if (native) {
      let result;
      try {
        result = await runNativeGoogleSignIn(true);
      } catch (firstError) {
        const mapped = mapAuthError(firstError);
        if (!isNoCredentialError(mapped)) throw mapped;
        result = await runNativeGoogleSignIn(false);
      }
      const idToken = result?.credential?.idToken || result?.credential?.id_token || result?.idToken;
      const accessToken = result?.credential?.accessToken || result?.credential?.access_token || result?.accessToken || null;
      if (!idToken) {
        const err = new Error("Could not get Google credential for reauth");
        err.code = "no_id_token";
        throw err;
      }
      const credential = GoogleAuthProvider.credential(idToken, accessToken || undefined);
      return reauthenticateWithCredential(user, credential);
    }

    const provider = new GoogleAuthProvider();
    provider.setCustomParameters({ prompt: "select_account" });
    const result = await withTimeout(signInWithPopup(auth, provider), GOOGLE_SIGNIN_TIMEOUT_MS, "Google reauth");
    const credential = GoogleAuthProvider.credentialFromResult(result);
    if (!credential) {
      const err = new Error("Could not get Google credential for reauth");
      err.code = "no_id_token";
      throw err;
    }
    return reauthenticateWithCredential(user, credential);
  } catch (error) {
    throw mapAuthError(error);
  }
}

export async function consumeGoogleRedirectResult() { return null; }
export async function installGoogleAuthAppStateHook() { return; }
export async function installGoogleAuthDeepLinkHook() { return; }
