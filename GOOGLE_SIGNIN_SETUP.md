# Google Sign-In setup

Package: `com.fittrack.app`  
Firebase project: `fittrack-698fa`

## Current approach (Capacitor 7 + Credential Manager)

Android Google Sign-In uses **@capacitor-firebase/authentication 7.x** with
**Android Credential Manager** (Google's recommended API, not the deprecated
Google Sign-In for Android SDK and not an external-browser OAuth flow).

Flow:

1. User taps Continue with Google
2. `FirebaseAuthentication.signInWithGoogle({ useCredentialManager: true, skipNativeAuth: true })`
3. System Credential Manager account picker (saved Google accounts on device)
4. Plugin returns an ID token
5. App calls Firebase JS `signInWithCredential(GoogleAuthProvider.credential(idToken))`
6. Existing Fifty Fit onboarding runs; new Google users without a phone see **Complete your profile**

Web / desktop continues to use Firebase `signInWithPopup`.

There is **no** custom URI scheme (`com.fittrack.app://google-auth`), **no**
`Browser.open()`, **no** `signInWithRedirect`, and **no** `https://localhost` OAuth callback.

---

## Why Google Sign-In can break after switching to release builds

Debug builds use the **debug keystore** SHA-1.  
Release APKs/AABs from GitHub Actions use the **release keystore** SHA-1.  
Google Play installs may use a **third** certificate: **Play App Signing**.

Firebase Android OAuth only accepts Google Sign-In if the **SHA-1** (and ideally SHA-256) of the certificate that signed the installed APK is registered on the Android app in Firebase.

If you only registered the debug SHA-1, release/Play builds will fail Google Sign-In even though email/password still works.

---

## 1. Enable Google provider in Firebase

1. [Firebase Console](https://console.firebase.google.com/) → project **fittrack-698fa**
2. **Authentication** → **Sign-in method** → enable **Google** → support email → Save

## 2. Register certificate fingerprints on the Android app

1. Project **Settings** (gear) → **General** → **Your apps** → Android app **`com.fittrack.app`**
2. **Add fingerprint** for **each** certificate that can sign the app:

### A) Release keystore (GitHub Actions / direct APK install)

After every Actions run of **Build Android App Bundle**, open the job log and find:

```text
RELEASE KEYSTORE FINGERPRINTS (add to Firebase)
SHA-1:   ...
SHA-256: ...
```

Paste both into Firebase.

### B) Google Play App Signing certificate (Play Store installs)

If Play App Signing is enabled (default for new apps):

1. [Google Play Console](https://play.google.com/console/) → your app
2. **Setup** → **App signing** (or **Release** → **Setup** → **App signing**)
3. Copy **App signing key certificate** SHA-1 and SHA-256
4. Add them in Firebase as additional fingerprints

Do **not** assume the upload key (your release.keystore) matches the Play signing key.

## 3. Refresh `google-services.json` after adding fingerprints

1. Firebase → Project settings → Android app → **Download google-services.json**
2. Encode (do not commit the file):

```bash
base64 -i google-services.json | tr -d '\n'
```

3. GitHub → **Settings** → **Secrets and variables** → **Actions** → secret **`GOOGLE_SERVICES_JSON_BASE64`** → paste the base64 string
4. Re-run **Build Android App Bundle**

The workflow validates that the secret decodes to:

- `project_id` = `fittrack-698fa`
- Android package = `com.fittrack.app`

It does **not** print the full JSON.

## 4. Code / Capacitor (already in the repo)

- `capacitor.config.json` → `FirebaseAuthentication.providers: ["google.com"]`, `skipNativeAuth: true`
- `src/googleAuth.js` → native Credential Manager via plugin → Firebase `signInWithCredential`
- `src/firebase.js` → project `fittrack-698fa`
- Android package / `appId` → `com.fittrack.app`
- `android/variables.gradle` (injected by CI):
  - `rgcfaIncludeGoogle = true`
  - `androidxCredentialsVersion = '1.3.0'`

Do not commit `google-services.json` or any `.keystore` file (see `.gitignore`).

## 5. Web OAuth client (required for ID tokens)

Google Credential Manager / native Google Sign-In requests an **ID token** using the **Web** OAuth client (`client_type: 3` in `google-services.json`).

1. Firebase Console → Project settings → Your apps → Android app
2. After SHA-1 is registered, **Download google-services.json** again
3. Confirm the JSON has at least one `oauth_client` with `"client_type": 3` (Web)
4. Re-encode and update GitHub secret `GOOGLE_SERVICES_JSON_BASE64`
5. Rebuild the release APK

Without a Web client, native Google Sign-In often returns a developer / configuration error.

## 6. New Google users — phone required

If the signed-in Google user has no `account.phone` in Firestore, the app shows a **Complete your profile** step (phone only) before the normal onboarding questionnaire. Existing Google users who already have a phone skip this step.

## 7. Test on a real device

1. Install the **release APK** artifact from Actions (signed with the release keystore).
2. Tap Google Sign-In → Credential Manager account picker should appear.
3. Separately test the **Play Store** build after publishing (Play signing cert must also be in Firebase).

Email/password login is independent and should keep working either way.
