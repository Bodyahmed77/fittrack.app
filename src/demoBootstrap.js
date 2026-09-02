import { createUserWithEmailAndPassword, signInWithEmailAndPassword } from "firebase/auth";
import { auth } from "./firebase";

// Public, non-production demo identity used only by the ad-preview web build.
// This account is intentionally not an owner/staff/admin account.
const DEMO_EMAIL = "fiftyfit.ad.demo@bodyahmed77.com";
const DEMO_PASSWORD = "FiftyFitDemo#2026!";

export const WEB_DEMO_EMAIL = DEMO_EMAIL;

export async function bootstrapDemoSession() {
  if (typeof window === "undefined") return null;
  try {
    localStorage.setItem("50fit-lang", "en");
  } catch (_) {}

  try {
    if (auth.currentUser) return auth.currentUser;
    const signedIn = await signInWithEmailAndPassword(auth, DEMO_EMAIL, DEMO_PASSWORD);
    return signedIn.user;
  } catch (firstError) {
    if (firstError?.code !== "auth/user-not-found") {
      throw firstError;
    }
    const created = await createUserWithEmailAndPassword(auth, DEMO_EMAIL, DEMO_PASSWORD);
    return created.user;
  }
}
