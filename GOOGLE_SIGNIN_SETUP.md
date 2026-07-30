# Google Sign-In setup

## What you need to do in Firebase Console (one time)
1. Authentication → Sign-in method → enable **Google** → set a support email → Save.
2. Project Settings (gear icon) → General → scroll to "Your apps" → your
   Android app (`com.fittrack.app`) → **Add fingerprint** → paste the SHA-1
   given to you in chat. Add the SHA-256 too if there's a field for it.
3. Download `google-services.json` again from that same screen — it changes
   once a fingerprint is added, so the old copy won't work for sign-in.

## What to do with that file
Do **not** commit `google-services.json` to the repo — like the signing key,
it should only live in an encrypted GitHub Secret so the CI pipeline can
write it in fresh on every build.

1. Convert it to base64 (any of these work):
   - Mac/Linux terminal: `base64 -i google-services.json | tr -d '\n'`
   - Or ask Claude to do it for you if you paste the file's contents in chat.
2. GitHub repo → Settings → Secrets and variables → Actions → New repository secret:
   - Name: `GOOGLE_SERVICES_JSON_BASE64`
   - Value: the base64 text from step 1
3. Re-run the "Build Android App Bundle" workflow from the Actions tab.

Once that secret exists, every build automatically includes real Google
Sign-In — nothing else to configure.
