// Firebase project: fittrack-698fa
// Public Firebase client configuration. Security is enforced by Auth + Firestore
// Rules and server-side verification; no service-account credentials belong here.
import { initializeApp } from "firebase/app";
import { getAuth, setPersistence, indexedDBLocalPersistence } from "firebase/auth";
import {
  getFirestore,
  initializeFirestore,
  persistentLocalCache,
} from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyANEXYUVqaGss1i9WS5gH7Ic3UrBgKG_qc",
  authDomain: "fittrack-698fa.firebaseapp.com",
  projectId: "fittrack-698fa",
  storageBucket: "fittrack-698fa.firebasestorage.app",
  messagingSenderId: "632925500741",
  appId: "1:632925500741:web:1d42d331f0bd09f4c67a2c",
  measurementId: "G-7S75NTCV5B",
};

export const firebaseApp = initializeApp(firebaseConfig);
export const auth = getAuth(firebaseApp);

// Make the signed-in session survive app restarts and upgrades whenever the
// WebView provides IndexedDB. Failure is non-fatal because Firebase Auth can
// fall back to its normal persistence strategy.
void setPersistence(auth, indexedDBLocalPersistence).catch(() => {});

// Firestore keeps a local cache so a returning user can render their last known
// account/workout state immediately while the live listener reconnects.
// The fallback keeps older/unsupported WebViews functional instead of crashing.
export const db = (() => {
  try {
    return initializeFirestore(firebaseApp, {
      localCache: persistentLocalCache(),
    });
  } catch (_) {
    return getFirestore(firebaseApp);
  }
})();
