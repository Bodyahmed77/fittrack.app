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

// IMPORTANT: imported modules execute before main.jsx can set a runtime
// window flag. Therefore demo detection must be available at module-evaluation
// time via Vite's build constant and the URL query itself.
const webDemoMode =
  import.meta.env?.VITE_WEB_DEMO === "1" ||
  (typeof window !== "undefined" &&
    new URLSearchParams(window.location.search).get("demo") === "1");

export const firebaseApp = initializeApp(firebaseConfig);
export const auth = getAuth(firebaseApp);

// The public web demo never needs auth persistence. Skipping IndexedDB here
// avoids browser/private-mode storage failures while preserving normal native
// persistence for the actual application.
export const authPersistenceReady = webDemoMode
  ? Promise.resolve()
  : setPersistence(auth, indexedDBLocalPersistence).catch((error) => {
      console.warn("[Firebase Auth] IndexedDB persistence unavailable", error);
      return null;
    });

// The public demo never reads/writes Firestore. Avoid constructing the
// persistent cache in that mode; browser storage policies must not be able to
// break the otherwise local demo shell.
export const db = (() => {
  if (webDemoMode) return getFirestore(firebaseApp);
  try {
    return initializeFirestore(firebaseApp, {
      localCache: persistentLocalCache(),
    });
  } catch (_) {
    return getFirestore(firebaseApp);
  }
})();
