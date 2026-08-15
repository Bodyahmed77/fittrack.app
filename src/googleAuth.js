/**
 * Google Sign-In for Fifty Fit
 *
 * Web / desktop: Firebase JS signInWithPopup.
 * Android / iOS: @capacitor-firebase/authentication.
 *
 * Android prefers the legacy native Google account chooser when Credential
 * Manager cannot provide a credential. Credential Manager remains available
 * as a fallback for devices where the legacy provider is unavailable.
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

function copyDiagnostic(err, raw) {
  if (!err || !raw) return err;
  try {
    if (raw.code != null) err.nativeCode = String(raw.code);
    if (raw.message) err.nativeMessage = String(raw.message);
    if (raw.errorCode != null) err.nativeErrorCode = String(raw.errorCode);
  } catch (_) {
    /* ignore */
  }
  return err;
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
    return copyDiagnostic(
      Object.assign(new Error("Google Sign-In was cancelled"), {
        code: "cancelled",
      }),
      e,
    );
  }

  if (code === "timeout" || /timed?\s*out/i.test(msg)) {
    return copyDiagnostic(
      Object.assign(new Error(e.message || "Google Sign-In timed out"), {
        code: "timeout",
      }),
      e,
    );
  }

  if (/no.?id.?token|missing.?id.?token|null.?credential/i.test(msg)) {
    return copyDiagnostic(
      Object.assign(new Error("Could not get a Google ID token"), {
        code: "no_id_token",
      }),
      e,
    );
  }

  if (/no credentials available|no credential available|NoCredentialException/i.test(msg)) {
    return copyDiagnostic(
      Object.assign(new Error("No Google credential was available from Credential Manager"), {
        code: "no_credentials",
      }),
      e,
    );
  }

  if (
    /credential.?manager|provider dependencies|device doesn't support/i.test(msg) ||
    code === "ERROR_UNSUPPORTED"
  ) {
    return copyDiagnostic(
      Object.assign(
        new Error("Google Credential Manager is unavailable on this device"),
        { code: "credential_manager_unsupported" },
      ),
      e,
    );
  }

  if (/developer.?error|DEVELOPER_ERROR|configuration/i.test(code + " " + msg)) {
    return copyDiagnostic(
      Object.assign(
        new Error(
          "Google Sign-In configuration error (Android OAuth/SHA or Google provider configuration)",
        ),
        { code: "developer_error" },
      ),
      e,
    );
  }

  return e;
}

function shouldRetryLegacyGoogle(error) {
  const code = String(error?.code || "").toLowerCase();
  const msg = String(
    error?.nativeMessage || error?.message || error || "",
  ).toLowerCase();
  return (
    code === "developer_error" ||
    code === "credential_manager_unsupported" ||
    code === "no_credentials" ||
    /no credentials available|no credential available|provider dependencies|credential.?manager|getcredentialproviderconfiguration/i.test(
      msg,
    ) ||
    /developer.?error|10\b|12500\b|configuration/i.test(`${code} ${msg}`)
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

async function runNativeGoogleSignIn(FirebaseAuthentication, useCredentialManager) {
  return withTimeout(
    FirebaseAuthentication.signInWithGoogle({
      useCredentialManager,
      skipNativeAuth: true,
    }),
    GOOGLE_SIGNIN_TIMEOUT_MS,
    useCredentialManager
      ? "Google Sign-In (Credential Manager)"
      : "Google Sign-In (legacy native)",
  );
}

async function nativeGoogleSignIn(localLang, createInitialState) {
  const { FirebaseAuthentication } = await import(
    "@capacitor-firebase/authentication"
  );

  // The legacy native picker was previously working on this exact release
  // path. Use it as the primary Android chooser so a Credential Manager
  // "No credentials available" result cannot suppress the account list.
  let result;
  let firstFailure = null;

  try {
    console.info("[GoogleSignIn] native start: legacy account chooser");
    result = await runNativeGoogleSignIn(FirebaseAuthentication, false);
  } catch (legacyError) {
    const mappedLegacy = mapAuthError(legacyError);
    firstFailure = mappedLegacy;
    console.warn(
      "[GoogleSignIn] legacy chooser failed; nativeCode=",
      mappedLegacy?.nativeCode || "",
      "message=",
      mappedLegacy?.nativeMessage || mappedLegacy?.message || "",
    );

    // Credential Manager is the fallback, not the gatekeeper.
    try {
      console.info("[GoogleSignIn] retrying with Credential Manager");
      result = await runNativeGoogleSignIn(FirebaseAuthentication, true);
    } catch (credentialError) {
      const mappedCredential = mapAuthError(credentialError);
      mappedCredential.fallbackAttempted = true;
      mappedCredential.firstNativeCode = firstFailure?.nativeCode || "";
      mappedCredential.firstNativeMessage = firstFailure?.nativeMessage || "";
      throw mappedCredential;
    }
  }

  const idToken =
    result?.credential?.idToken ||
    result?.credential?.id_token ||
    result?.idToken;
  const accessToken =
    result?.credential?.accessToken ||
    result?.credential?.access_token ||
    result?.accessToken ||
    null;

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
    mapped.firebaseAuthCode = String(
      firebaseError?.code || firebaseError?.errorCode || "",
    );
    mapped.firebaseAuthMessage = String(
      firebaseError?.message || firebaseError || "",
    );
    mapped.message = `Google Sign-In failed after account selection [${mapped.firebaseAuthCode || "unknown"}]: ${mapped.firebaseAuthMessage}`;
    throw mapped;
  }

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

export async function signInWithGoogleFlow(localLang = "en", createInitialState) {
  const native = await isNativePlatform();
  console.info("[GoogleSignIn] platform native?", native);

  try {
    if (native) {
      const userCred = await nativeGoogleSignIn(localLang, createInitialState);
      emitAuthSettled({ ok: true, reason: "native_google_success" });
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
      let result;
      try {
        result = await runNativeGoogleSignIn(FirebaseAuthentication, false);
      } catch (legacyError) {
        const mappedLegacy = mapAuthError(legacyError);
        result = await runNativeGoogleSignIn(FirebaseAuthentication, true);
      }

      const idToken =
        result?.credential?.idToken ||
        result?.credential?.id_token ||
        result?.idToken;
      const accessToken =
        result?.credential?.accessToken ||
        result?.credential?.access_token ||
        result?.accessToken ||
        null;
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

export async function consumeGoogleRedirectResult() {
  return null;
}

export async function installGoogleAuthAppStateHook() {
  return;
}

export async function installGoogleAuthDeepLinkHook() {
  return;
}
