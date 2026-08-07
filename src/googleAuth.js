import {
  GoogleAuthProvider,
  reauthenticateWithCredential,
  signInWithCredential,
} from "firebase/auth";
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

export async function signInWithGoogleFlow(localLang = "en", createInitialState) {
  const FirebaseAuthentication = await getNativePlugin();
  if (!FirebaseAuthentication) {
    throw new Error("Google Sign-In native plugin is unavailable");
  }

  const result = await FirebaseAuthentication.signInWithGoogle();
  const idToken = result?.credential?.idToken;
  if (!idToken) throw new Error("No ID token from Google");

  const credential = GoogleAuthProvider.credential(idToken);
  const userCred = await signInWithCredential(auth, credential);

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

  return userCred;
}

export async function reauthenticateWithGoogleFlow(user) {
  const FirebaseAuthentication = await getNativePlugin();
  if (!FirebaseAuthentication) {
    throw new Error("Google Sign-In native plugin is unavailable");
  }
  const result = await FirebaseAuthentication.signInWithGoogle();
  const idToken = result?.credential?.idToken;
  if (!idToken) throw new Error("No ID token from Google");
  return reauthenticateWithCredential(
    user,
    GoogleAuthProvider.credential(idToken),
  );
}
