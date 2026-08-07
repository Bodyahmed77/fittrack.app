// Firebase project: fittrack-698fa
// Note: this "apiKey" is not a secret — it's the standard public client
// config every Firebase web/mobile app ships with. Real protection comes
// from Firestore Security Rules (see firestore.rules in this project) and,
// later, App Check. Never put your Firebase *service account* key (a
// different, genuinely secret file) into client code like this.
import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

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
export const db = getFirestore(firebaseApp);
