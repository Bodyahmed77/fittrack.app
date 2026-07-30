# Android signing setup

Your real signing key has already been generated for you (see the chat message
with your credentials). This file explains what to do with it — do this once.

## Why this matters
Every Android app is signed with a private key. Google Play uses it to verify
that updates really come from you. **If you lose this key, you can never
update this app again under the same listing — you'd have to publish it as a
brand new app.** Save the keystore file and the passwords somewhere durable
(a password manager, encrypted cloud folder) that isn't just this chat.

## One-time setup (in your GitHub repo)

1. Push this project to a new GitHub repository (see README.md).
2. In the repo, go to **Settings → Secrets and variables → Actions → New repository secret**.
3. Add these four secrets exactly as named:

| Secret name | Value |
|---|---|
| `ANDROID_KEYSTORE_BASE64` | the long text from `keystore_base64.txt` (given to you separately — do not commit this file) |
| `ANDROID_KEYSTORE_PASSWORD` | your keystore password (given in chat) |
| `ANDROID_KEY_ALIAS` | `fittrack` |
| `ANDROID_KEY_PASSWORD` | same as the keystore password (PKCS12 keystores use one password for both) |

4. Go to the **Actions** tab → **Build Android App Bundle** → **Run workflow**.
5. When it finishes, open the run and download the `fittrack-release-aab`
   artifact — that `.aab` file is what you upload to Google Play Console.

Never paste these values directly into code or commit the `.keystore` file —
GitHub Secrets keep them encrypted and out of your repo history.
