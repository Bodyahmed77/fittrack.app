# Fifty Fit — Android app project

Real project: React + Vite + Capacitor (Android) + Firebase (Auth + Firestore).

## What's already done
- Full app UI and logic (workouts, nutrition, plans, Pro paywall, settings)
- Real accounts and login via Firebase Authentication
- Real per-user data storage via Firestore, locked down by `firestore.rules`
- Android signing key generated (see `SIGNING_SETUP.md`)
- A GitHub Actions pipeline that builds a signed `.aab` in the cloud — no
  Android Studio needed on your computer

## What's next (in order)
1. **Publish Firestore rules**: Firebase Console → Firestore Database → Rules
   → paste the contents of `firestore.rules` → Publish.
2. **Push this project to GitHub** (a new empty repository), then follow
   `SIGNING_SETUP.md` to add your 4 signing secrets.
3. **Run the build** from the Actions tab and download the `.aab`.
4. Create your Google Play Console account and upload that `.aab` to an
   **Internal testing** release first — install it on your own phone via the
   testing link Play Console gives you, and confirm everything really works
   on real Android.
5. Once happy, move to a production release.

## Local development (optional)
You don't need this to ship, but if you ever get a working computer to test
on: `npm install` then `npm run dev` opens it in a browser.

## Project layout
- `src/App.jsx` — the entire app (screens, logic, styling)
- `src/firebase.js` — your Firebase project connection
- `capacitor.config.json` — Android app ID (`com.fittrack.app`) and native settings
- `firestore.rules` — database security rules (deploy these in Firebase Console)
- `.github/workflows/build-android.yml` — the cloud build pipeline
