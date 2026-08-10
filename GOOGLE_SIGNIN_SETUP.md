# Google Sign-In setup

Package: `com.fittrack.app`  
Firebase project: `fittrack-698fa`

## Why Google Sign-In breaks after switching to release builds

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

- `capacitor.config.json` → `FirebaseAuthentication.providers: ["google.com"]`
- `src/googleAuth.js` → native `@capacitor-firebase/authentication` → Firebase `signInWithCredential`
- `src/firebase.js` → project `fittrack-698fa`
- Android package / `appId` → `com.fittrack.app`

Do not commit `google-services.json` or any `.keystore` file (see `.gitignore`).

## 5. Test on a real device

1. Install the **release APK** artifact from Actions (signed with the release keystore).
2. Tap Google Sign-In.
3. Separately test the **Play Store** build after publishing (Play signing cert must also be in Firebase).

Email/password login is independent and should keep working either way.


## 6. Web OAuth client (required for ID tokens)

Google Sign-In on Android requests an **ID token** using the **Web** OAuth client (`client_type: 3` in `google-services.json`).

1. Firebase Console → Project settings → Your apps → Android app
2. After SHA-1 is registered, **Download google-services.json** again
3. Confirm the JSON has at least one `oauth_client` with `"client_type": 3` (Web)
4. Re-encode and update GitHub secret `GOOGLE_SERVICES_JSON_BASE64`
5. Rebuild the release APK

Without a Web client, native Google Sign-In often returns **ApiException: 10 (DEVELOPER_ERROR)** and the account picker may never appear.

## 7. Native plugin flag (`rgcfaIncludeGoogle`)

The Android build workflow sets `rgcfaIncludeGoogle = true` in `android/variables.gradle` so `@capacitor-firebase/authentication` includes the Google provider dependency. This is applied automatically on every GitHub Actions build.


---

## Android: external Chrome OAuth (current flow)

Android Google Sign-In opens **Chrome / Custom Tabs** (not the Capacitor WebView) so the user can pick a Google account already saved on the device.

1. App builds an OAuth URL with the **Web client ID** (type 3 from `google-services.json`) and `redirect_uri=com.fittrack.app://google-auth`.
2. `@capacitor/browser` opens that URL in the system browser.
3. After the user selects an account, Google redirects to `com.fittrack.app://google-auth#id_token=...`.
4. The app receives the deep link via `App.addListener('appUrlOpen')`, builds a Firebase credential from the `id_token`, and signs in.
5. The user is **not** left on `https://localhost`.

### Google Cloud Console — authorized redirect URI

In [Google Cloud Console](https://console.cloud.google.com/) → APIs & Services → Credentials → your **Web client** (OAuth 2.0 Client ID):

- Add authorized redirect URI: `com.fittrack.app://google-auth`

Without this, Google may reject the redirect after account selection.

### CI helpers

- `scripts/extract-google-web-client-id.py` — writes `src/googleWebClientId.js` before `npm run build` (uses `GOOGLE_SERVICES_JSON_BASE64`).
- `scripts/inject-google-auth-deeplink.py` — adds the `com.fittrack.app` / `google-auth` intent-filter to `AndroidManifest.xml` after `cap sync`.

Web / desktop continues to use Firebase `signInWithPopup`.

### New Google users — phone required

If the signed-in Google user has no `account.phone` in Firestore, the app shows a **Complete your profile** step (phone only) before the normal onboarding questionnaire. Existing Google users who already have a phone skip this step.
