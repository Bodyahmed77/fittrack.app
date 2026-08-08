import {
  GoogleAuthProvider,
  reauthenticateWithCredential,
  signInWithCredential,
  signInWithPopup,
} from "firebase/auth";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { auth, db } from "./firebase";

// Must stay under 90s so the UI never sticks on "loading" forever.
const GOOGLE_SIGNIN_TIMEOUT_MS = 90000;

let nativePluginPromise;
async function getNativePlugin() {
  if (!nativePluginPromise) {
    nativePluginPromise = import(
      /* @vite-ignore */ "@capacitor-firebase/authentication"
    )
      .then((mod) => mod.FirebaseAuthentication)
      .catch((e) => {
        console.warn("[GoogleSignIn] plugin import failed", e?.message || e);
        return null;
      });
  }
  return nativePluginPromise;
}

async function isNativePlatform() {
  try {
    const { Capacitor } = await import(/* @vite-ignore */ "@capacitor/core");
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

function mapNativeError(e) {
  const raw = String(e?.message || e || "");
  const code = String(e?.code || "");
  // Google Sign-In CommonStatusCodes.DEVELOPER_ERROR = 10
  if (
    /\b10\b/.test(raw) ||
    /DEVELOPER_ERROR/i.test(raw) ||
    /ApiException:\s*10/i.test(raw)
  ) {
    const err = new Error(
      "Google Sign-In configuration error (code 10). Verify package com.fittrack.app, SHA-1 of THIS APK, and that google-services.json contains Android + Web OAuth clients.",
    );
    err.code = "developer_error";
    err.cause = e;
    return err;
  }
  if (/12501|SIGN_IN_CANCELLED|canceled|cancelled/i.test(raw + code)) {
    const err = new Error("Google Sign-In was cancelled");
    err.code = "cancelled";
    return err;
  }
  if (/12500|SIGN_IN_FAILED/i.test(raw + code)) {
    const err = new Error("Google Sign-In failed on device");
    err.code = "sign_in_failed";
    return err;
  }
  // Error 2 often accompanies DEVELOPER_ERROR when OAuth clients are wrong.
  if (/\b2\b/.test(raw) && /ApiException|GoogleSignIn|rtvip/i.test(raw)) {
    const err = new Error(
      "Google Sign-In configuration error (code 2/10). Verify package com.fittrack.app, release SHA-1, Play App Signing SHA-1, and that google-services.json includes Android + Web (client_type 3) OAuth clients.",
    );
    err.code = "developer_error";
    err.cause = e;
    return err;
  }
  if (e && typeof e === "object") {
    e.code = e.code || code || "native_error";
  }
  return e instanceof Error ? e : new Error(raw || "Google Sign-In failed");
}

/**
 * Native Android Google Sign-In.
 * IMPORTANT: skipNativeAuth must be true when using the Firebase JS SDK
 * (signInWithCredential). Otherwise native Firebase Auth and the JS SDK fight
 * each other and the account picker can fail with DEVELOPER_ERROR / hang.
 */
async function nativeGoogleIdToken() {
  console.info("[GoogleSignIn] start native");
  const FirebaseAuthentication = await getNativePlugin();
  if (!FirebaseAuthentication) {
    const err = new Error("Google Sign-In native plugin is unavailable");
    err.code = "plugin_unavailable";
    throw err;
  }
  console.info("[GoogleSignIn] plugin loaded, calling signInWithGoogle");

  let result;
  try {
    // useCredentialManager:false forces the classic account chooser UI.
    result = await withTimeout(
      FirebaseAuthentication.signInWithGoogle({
        useCredentialManager: false,
        skipNativeAuth: true,
      }),
      GOOGLE_SIGNIN_TIMEOUT_MS,
      "Google Sign-In",
    );
  } catch (e) {
    console.warn(
      "[GoogleSignIn] native error",
      e?.code || "",
      String(e?.message || e).slice(0, 180),
    );
    throw mapNativeError(e);
  }

  console.info(
    "[GoogleSignIn] native result keys",
    result ? Object.keys(result) : null,
    "credential?",
    !!(result && result.credential),
  );

  const idToken =
    result?.credential?.idToken ||
    result?.credential?.id_token ||
    result?.idToken ||
    null;

  if (!idToken) {
    console.warn("[GoogleSignIn] no idToken in result");
    const err = new Error(
      "No ID token from Google — check SHA-1, package com.fittrack.app, and google-services.json OAuth clients (Android + Web)",
    );
    err.code = "no_id_token";
    throw err;
  }
  console.info("[GoogleSignIn] idToken received (length only)", idToken.length);
  return idToken;
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

async function ensureUserDoc(userCred, localLang, createInitialState) {
  const ref = doc(db, "users", userCred.user.uid);
  const snap = await getDoc(ref);
  if (!snap.exists() && typeof createInitialState === "function") {
    const initial = createInitialState();
    initial.account.name = userCred.user.displayName || "";
    initial.account.email = userCred.user.email || "";
    initial.settings.language = localLang || "en";
    initial.createdAt = new Date().toISOString();
    await setDoc(ref, initial);
  }
}

export async function signInWithGoogleFlow(localLang = "en", createInitialState) {
  const native = await isNativePlatform();
  console.info("[GoogleSignIn] platform native?", native);

  if (native) {
    const idToken = await nativeGoogleIdToken();
    const credential = GoogleAuthProvider.credential(idToken);
    const userCred = await signInWithCredential(auth, credential);
    await ensureUserDoc(userCred, localLang, createInitialState);
    console.info("[GoogleSignIn] success uid length", userCred.user.uid.length);
    return userCred;
  }

  const userCred = await webGoogleSignIn();
  await ensureUserDoc(userCred, localLang, createInitialState);
  return userCred;
}

export async function reauthenticateWithGoogleFlow(user) {
  const native = await isNativePlatform();
  if (native) {
    const idToken = await nativeGoogleIdToken();
    return reauthenticateWithCredential(
      user,
      GoogleAuthProvider.credential(idToken),
    );
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
}
