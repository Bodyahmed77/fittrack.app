import { GoogleAuthProvider, signInWithCredential } from "firebase/auth";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { auth, db } from "./firebase";

// Native-only Capacitor plugin: resolve it lazily so the web/initial bundle
// never has to parse the native implementation.
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

function normalizeNativeGoogleError(error) {
  const code = error?.code || error?.errorCode || "";
  const message = error?.message || String(error || "Unknown Google Sign-In error");
  const out = new Error(message);
  out.code = code;
  out.cause = error;
  return out;
}

export async function signInWithGoogleFlow(localLang = "en", createInitialState) {
  const FirebaseAuthentication = await getNativePlugin();
  if (!FirebaseAuthentication) {
    const error = new Error(
      "Google Sign-In native plugin is unavailable. This must be tested in the Android build."
    );
    error.code = "google/native-plugin-unavailable";
    throw error;
  }

  let result;
  try {
    result = await FirebaseAuthentication.signInWithGoogle();
  } catch (error) {
    throw normalizeNativeGoogleError(error);
  }

  const idToken = result?.credential?.idToken;
  if (!idToken) {
    const error = new Error("Google Sign-In returned no ID token");
    error.code = "google/missing-id-token";
    throw error;
  }

  const credential = GoogleAuthProvider.credential(idToken);
  const userCred = await signInWithCredential(auth, credential);

  const ref = doc(db, "users", userCred.user.uid);
  const snap = await getDoc(ref);

  // Only create the initial document when the user does not already exist.
  // Existing Firestore data must never be overwritten by Google login.
  if (!snap.exists() && typeof createInitialState === "function") {
    const initial = createInitialState();
    initial.account.name = userCred.user.displayName || "";
    initial.account.email = userCred.user.email || "";
    initial.account.phone = "";
    initial.settings.language = localLang || "en";
    await setDoc(ref, initial);
  }

  return userCred;
}

// Re-authenticate a Google-authenticated Android user before sensitive
// Firebase operations such as account deletion. Google account selection is
// intentionally opened again by the native Capacitor plugin so Firebase gets
// a fresh OAuth credential rather than relying on an old session.
export async function reauthenticateWithGoogle() {
  const FirebaseAuthentication = await getNativePlugin();
  if (!FirebaseAuthentication) {
    const error = new Error("Google Sign-In native plugin is unavailable");
    error.code = "google/native-plugin-unavailable";
    throw error;
  }

  let result;
  try {
    result = await FirebaseAuthentication.signInWithGoogle();
  } catch (error) {
    throw normalizeNativeGoogleError(error);
  }

  const idToken = result?.credential?.idToken;
  if (!idToken) {
    const error = new Error("Google re-authentication returned no ID token");
    error.code = "google/missing-id-token";
    throw error;
  }

  const credential = GoogleAuthProvider.credential(idToken);
  const currentUser = auth.currentUser;
  if (!currentUser) {
    const error = new Error("No authenticated Firebase user");
    error.code = "auth/no-current-user";
    throw error;
  }

  const { reauthenticateWithCredential } = await import("firebase/auth");
  return reauthenticateWithCredential(currentUser, credential);
}
