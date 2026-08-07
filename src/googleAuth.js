// ============================================================
// Google Sign-In Wrapper (@capacitor-firebase/authentication)
// ============================================================
// Modular, production-shaped abstraction around native Google
// Sign-In via the `@capacitor-firebase/authentication` plugin.
//
// On Android (device) it uses the native plugin's
// `signInWithGoogle()` — the system Google account picker (no
// WebView), then bridges the returned ID token into the Firebase
// JS SDK session via `GoogleAuthProvider.credential`.
//
// On web / preview / CI the native plugin isn't available (its
// macOS/Linux web build can't resolve the native module), so we
// gracefully fall back to the Firebase Web SDK's
// `signInWithPopup(GoogleAuthProvider)` — development and preview
// keep working without any native plugin.
//
// This mirrors the identical dynamic-import pattern used in
// src/billing.js and src/review.js so the app can build in CI
// (GitHub Actions) without the native modules installed.
// ============================================================

import {
  GoogleAuthProvider,
  signInWithCredential,
  signInWithPopup,
} from "firebase/auth";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { auth, db } from "./firebase";

// Lazily resolve the native Capacitor Firebase Authentication plugin
// so a plain browser/CI build (without the native plugin resolvable)
// still works without failing to import at module load time.
let googleAuthPluginPromise = null;
function getGoogleAuthPlugin() {
  if (!googleAuthPluginPromise) {
    googleAuthPluginPromise = (async () => {
      try {
        const mod = await import(
          /* @vite-ignore */ "@capacitor-firebase/authentication"
        );
        const plugin = mod.FirebaseAuthentication;
        // Guard: make sure the plugin actually exposes signInWithGoogle.
        return plugin && typeof plugin.signInWithGoogle === "function"
          ? plugin
          : null;
      } catch (e) {
        console.warn(
          "Capacitor Firebase Authentication plugin not available — using web fallback",
          e,
        );
        return null;
      }
    })();
  }
  return googleAuthPluginPromise;
}

// Matches the default-state shape used by App.jsx for a brand-new
// Google sign-in user (exactly the same fields written today).
function freshUserState() {
  return {
    onboarded: false,
    account: {
      name: "",
      email: "",
      phone: "",
      gender: "",
      age: "",
      height: "",
      goal: "",
      daysPerWeek: 4,
      activityLevel: "moderate",
      photo: "",
    },
    settings: {
      theme: "dark",
      notifications: true,
      reminderTime: "18:00",
      language: null,
    },
    profile: { level: 1, xp: 0, xpMax: 500 },
    entitlements: {
      nutritionPro: false,
      trainingPro: false,
      proExpiresAt: null,
    },
    nutritionPlan: null,
    proPlan: null,
    dailyTargets: null,
    activePlanId: "beginner",
    customPlan: {},
    bodyWeight: [],
    logs: {},
    meals: {},
  };
}

// Create a Firestore doc for a brand-new Google sign-in user.
async function ensureUserDoc(userCred, localLang) {
  const ref = doc(db, "users", userCred.user.uid);
  const snap = await getDoc(ref);
  if (!snap.exists()) {
    const initial = freshUserState();
    initial.account.name = userCred.user.displayName || "";
    initial.account.email = userCred.user.email || "";
    initial.settings.language = localLang || "en";
    await setDoc(ref, initial);
  }
}

/**
 * Sign in with Google, preserving the existing behavior:
 *  - Native picker on Android via @capacitor-firebase/authentication
 *  - Web popup fallback in browsers / preview / CI
 *  - Always bridges into the Firebase JS SDK session and creates the
 *    user's Firestore doc on first sign-in.
 * @param {string} [localLang] - preferred language ("ar" | "en").
 * @returns {Promise<import("firebase/auth").UserCredential>}
 */
export async function signInWithGoogleFlow(localLang) {
  const plugin = await getGoogleAuthPlugin();

  if (plugin) {
    // Step 1: Show native Google account picker (no WebView, uses the
    // system account).
    const result = await plugin.signInWithGoogle();
    const idToken = result.credential?.idToken;
    if (!idToken) throw new Error("No ID token from Google");
    // Step 2: Bridge the credential into the JS Firebase SDK session.
    const credential = GoogleAuthProvider.credential(idToken);
    const userCred = await signInWithCredential(auth, credential);
    // Step 3: Create a Firestore doc for brand-new Google users.
    await ensureUserDoc(userCred, localLang);
    return userCred;
  }

  // Web / preview / CI fallback: use the Firebase Web SDK directly.
  const provider = new GoogleAuthProvider();
  const userCred = await signInWithPopup(auth, provider);
  await ensureUserDoc(userCred, localLang);
  return userCred;
}
