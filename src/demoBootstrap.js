import { createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut } from "firebase/auth";
import { auth, db, authPersistenceReady } from "./firebase";

const DEMO_EMAIL = "fiftyfit.ad.demo@bodyahmed77.com";
const DEMO_PASSWORD = "FiftyFitDemo#2026!";

// Web-demo bootstrap code is injected into main.jsx by the Pages build patch.
// Expose the same Firestore instance to that injected module-level code without
// changing the production/native entrypoint.
if (typeof globalThis !== "undefined") globalThis.db = db;

export const WEB_DEMO_EMAIL = DEMO_EMAIL;

export async function bootstrapDemoSession() {
  if (typeof window === "undefined") return null;
  await authPersistenceReady.catch(() => null);
  try { localStorage.setItem("50fit-lang", "en"); } catch (_) {}
  if (auth.currentUser && auth.currentUser.email !== DEMO_EMAIL) {
    await signOut(auth);
  }
  if (auth.currentUser?.email === DEMO_EMAIL) return auth.currentUser;
  try {
    const signedIn = await signInWithEmailAndPassword(auth, DEMO_EMAIL, DEMO_PASSWORD);
    return signedIn.user;
  } catch (firstError) {
    if (firstError?.code !== "auth/user-not-found") throw firstError;
    const created = await createUserWithEmailAndPassword(auth, DEMO_EMAIL, DEMO_PASSWORD);
    return created.user;
  }
}
