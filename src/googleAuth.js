/**
 * Google Sign-In for Fifty Fit
 *
 * Web / desktop: Firebase JS signInWithPopup.
 * Android / iOS: @capacitor-firebase/authentication.
 *
 * Android uses Credential Manager as the primary, modern sign-in path.
 * The legacy native Google account chooser is a fallback only, used when
 * Credential Manager genuinely cannot provide a credential.
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

  // Credential Manager is the primary, modern Android sign-in path (the
  // @capacitor-firebase/authentication plugin itself defaults
  // useCredentialManager to true since v7.2.0). The legacy native account
  // chooser is a fallback only, for devices/situations where Credential
  // Manager genuinely cannot provide a credential. A version skew between
  // androidx.credentials:credentials and its documented-required matched
  // companion androidx.credentials:credentials-play-services-auth (they
  // must always share the same version — see android/variables.gradle in
  // the CI workflow) is the most likely explanation for the earlier
  // "no_credentials" failures, though not yet confirmed on a real
  // release build. Routing around Credential Manager was not a fix for
  // that regardless — it only masked whatever the underlying cause was.
  let result;
  let firstFailure = null;

  try {
    console.info("[GoogleSignIn] native start: Credential Manager");
    result = await runNativeGoogleSignIn(FirebaseAuthentication, true);
  } catch (credentialManagerError) {
    const mappedCredentialManager = mapAuthError(credentialManagerError);
    firstFailure = mappedCredentialManager;
    console.warn(
      "[GoogleSignIn] Credential Manager failed; nativeCode=",
      mappedCredentialManager?.nativeCode || "",
      "message=",
      mappedCredentialManager?.nativeMessage || mappedCredentialManager?.message || "",
    );

    // Legacy native picker is the fallback, not the primary path.
    try {
      console.info("[GoogleSignIn] retrying with legacy account chooser");
      result = await runNativeGoogleSignIn(FirebaseAuthentication, false);
    } catch (legacyError) {
      const mappedLegacy = mapAuthError(legacyError);
      mappedLegacy.fallbackAttempted = true;
      mappedLegacy.firstNativeCode = firstFailure?.nativeCode || "";
      mappedLegacy.firstNativeMessage = firstFailure?.nativeMessage || "";
      throw mappedLegacy;
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
        result = await runNativeGoogleSignIn(FirebaseAuthentication, true);
      } catch (credentialManagerError) {
        const mappedCredentialManager = mapAuthError(credentialManagerError);
        console.warn(
          "[GoogleSignIn] reauth Credential Manager failed; nativeCode=",
          mappedCredentialManager?.nativeCode || "",
        );
        result = await runNativeGoogleSignIn(FirebaseAuthentication, false);
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
