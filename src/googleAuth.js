import {
  GoogleAuthProvider,
  reauthenticateWithCredential,
  signInWithCredential,
  signInWithPopup,
} from "firebase/auth";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { auth, db } from "./firebase";

const GOOGLE_SIGNIN_TIMEOUT_MS = 90000;

let nativePluginPromise;
async function getNativePlugin() {
  if (!nativePluginPromise) {
    nativePluginPromise = import(
      /* @vite-ignore */ "@capacitor-firebase/authentication"
    )
      .then((mod) => mod.FirebaseAuthentication)
      .catch(() => null);
  }
  return nativePluginPromise;
}

async function isNativePlatform() {
  try {
    const { Capacitor } = await import(
      /* @vite-ignore */ "@capacitor/core"
    );
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

/**
 * Native Android Google Sign-In via @capacitor-firebase/authentication.
 * Must open the system Google account chooser — never silently hang.
 */
async function nativeGoogleIdToken() {
  const FirebaseAuthentication = await getNativePlugin();
  if (!FirebaseAuthentication) {
    const err = new Error("Google Sign-In native plugin is unavailable");
    err.code = "plugin_unavailable";
    throw err;
  }

  // Prefer the interactive account picker. Options vary by plugin version;
  // unknown keys are ignored by Capacitor bridges.
  const options = {
    useCredentialManager: false,
    skipNativeAuth: false,
  };

  const result = await withTimeout(
    FirebaseAuthentication.signInWithGoogle(options),
    GOOGLE_SIGNIN_TIMEOUT_MS,
    "Google Sign-In",
  );

  const idToken =
    result?.credential?.idToken ||
    result?.credential?.id_token ||
    result?.idToken ||
    null;

  if (!idToken) {
    const err = new Error(
      "No ID token from Google — register the APK SHA-1 in Firebase and ensure google-services.json matches com.fittrack.app",
    );
    err.code = "no_id_token";
    throw err;
  }
  return idToken;
}

/** Browser / preview fallback using Firebase JS popup. */
async function webGoogleSignIn() {
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

  if (native) {
    const idToken = await nativeGoogleIdToken();
    const credential = GoogleAuthProvider.credential(idToken);
    const userCred = await signInWithCredential(auth, credential);
    await ensureUserDoc(userCred, localLang, createInitialState);
    return userCred;
  }

  // Web / Vite preview — open Google account chooser via popup
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
