/**
 * Google Sign-In for Fifty Fit
 *
 * Web / desktop: Firebase JS signInWithPopup.
 * Android / iOS: @capacitor-firebase/authentication.
 *
 * Android deliberately uses the native Google account chooser without
 * Credential Manager for the current Android release line. The
 * @capacitor-firebase/authentication 7.x line documents Credential Manager
 * as the default modern path, but its maintainers added an explicit
 * disable switch after production issues with Credential Manager; Android
 * 36 / "no credentials" failures are also documented in the project's
 * issue tracker. Using one native path avoids the previous double-attempt
 * flow where Credential Manager failed first and the legacy chooser then
 * failed as a second operation, producing only "fallback attempted".
 */
import {
  GoogleAuthProvider,
  reauthenticateWithCredential,
  signInWithCredential,
  signInWithPopup,
} from "firebase/auth";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { Capacitor } from "@capacitor/core";
import { auth, db } from "./firebase";

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

function withTimeout(promise, ms, label) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      const err = new Error(`${label} timed out after ${ms}ms`);
      err.code = "timeout";
      reject(err);
    }, ms);
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (error) => {
        clearTimeout(timer);
        reject(error);
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

function mapAuthError(error) {
  if (!error) return error;
  const code = String(error.code || error.errorCode || "");
  const message = String(error.message || error).toLowerCase();

  if (
    code === "auth/popup-closed-by-user" ||
    code === "auth/cancelled-popup-request" ||
    code === "ERROR_CANCELLED" ||
    code === "canceled" ||
    code === "cancelled" ||
    /cancel|cancell?ed|user.?denied|access.?denied/i.test(message)
  ) {
    return copyDiagnostic(
      Object.assign(new Error("Google Sign-In was cancelled"), {
        code: "cancelled",
      }),
      error,
    );
  }

  if (code === "timeout" || /timed?\s*out/i.test(message)) {
    return copyDiagnostic(
      Object.assign(new Error(error.message || "Google Sign-In timed out"), {
        code: "timeout",
      }),
      error,
    );
  }

  if (/no.?id.?token|missing.?id.?token|null.?credential/i.test(message)) {
    return copyDiagnostic(
      Object.assign(new Error("Could not get a Google ID token"), {
        code: "no_id_token",
      }),
      error,
    );
  }

  if (/developer.?error|DEVELOPER_ERROR|configuration/i.test(`${code} ${message}`)) {
    return copyDiagnostic(
      Object.assign(
        new Error(
          "Google Sign-In configuration error (Android OAuth/SHA or Google provider configuration)",
        ),
        { code: "developer_error" },
      ),
      error,
    );
  }

  return error;
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
      } catch (error) {
        console.warn("[GoogleSignIn] ensureUserDoc patch failed", error);
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
  } catch (error) {
    console.warn("[GoogleSignIn] ensureUserDoc create failed", error);
  }
}

async function isNativePlatform() {
  try {
    return Capacitor.isNativePlatform();
  } catch (_) {
    return false;
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

async function runNativeGoogleSignIn(FirebaseAuthentication) {
  return withTimeout(
    FirebaseAuthentication.signInWithGoogle({
      useCredentialManager: false,
      skipNativeAuth: true,
    }),
    GOOGLE_SIGNIN_TIMEOUT_MS,
    "Google Sign-In (native)",
  );
}

async function nativeGoogleSignIn(localLang, createInitialState) {
  const { FirebaseAuthentication } = await import(
    "@capacitor-firebase/authentication"
  );

  let result;
  try {
    console.info(
      "[GoogleSignIn] native start: Credential Manager disabled for Android release compatibility",
    );
    result = await runNativeGoogleSignIn(FirebaseAuthentication);
  } catch (nativeError) {
    const mapped = mapAuthError(nativeError);
    console.error(
      "[GoogleSignIn] native chooser failed",
      mapped?.nativeCode || mapped?.code || "",
      mapped?.nativeMessage || mapped?.message || "",
    );
    throw mapped;
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

  const credential = GoogleAuthProvider.credential(
    idToken,
    accessToken || undefined,
  );

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
  } catch (error) {
    console.warn("[GoogleSignIn] ensureUserDoc after native sign-in", error);
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
      userCred.user?.uid?.length || 0,
    );
    emitAuthSettled({ ok: true, reason: "popup_success" });
    return userCred;
  } catch (error) {
    const mapped = mapAuthError(error);
    emitAuthSettled({
      ok: false,
      reason: mapped?.code || error?.code || "error",
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
      const result = await runNativeGoogleSignIn(FirebaseAuthentication);
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
      const credential = GoogleAuthProvider.credential(
        idToken,
        accessToken || undefined,
      );
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
  } catch (error) {
    throw mapAuthError(error);
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
