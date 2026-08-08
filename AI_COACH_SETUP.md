# Fifty Fit AI Coach — Gemini Free Tier setup

## Architecture

```
Fifty Fit app  →  Cloud Function `aiCoach`  →  Gemini API
                      ↑
              Firebase Auth ID token
              Server-side daily limits
              GEMINI_API_KEY (secret)
```

The mobile/web app **never** contains the Gemini API key.

## Limits

| Tier | Messages / local calendar day |
|------|-------------------------------|
| Free | **3** |
| AI Coach Pro (`entitlements.aiCoachPro`) | **50** |

Enforced in the Cloud Function (not only on the client).

## Environment / secrets

| Name | Where | Value |
|------|--------|--------|
| `GEMINI_API_KEY` | Firebase / Google Cloud **Secret** | Key from [Google AI Studio](https://aistudio.google.com/apikey) |
| `GEMINI_MODEL` | Functions param (optional) | Default: `gemini-2.5-flash-lite` |
| `VITE_AI_ENDPOINT` | App **build-time** env (public URL only) | `https://us-central1-fittrack-698fa.cloudfunctions.net/aiCoach` |

`VITE_AI_ENDPOINT` is **not** a secret — it is only the URL of *your* backend.

## Deploy steps

1. Create a free API key in Google AI Studio (Gemini API). **Do not enable billing** unless you later choose to.
2. Install Firebase CLI and log in:
   ```bash
   npm i -g firebase-tools
   firebase login
   firebase use fittrack-698fa
   ```
3. From repo root:
   ```bash
   cd functions && npm install && cd ..
   firebase functions:secrets:set GEMINI_API_KEY
   # paste the key when prompted
   firebase deploy --only functions:aiCoach
   ```
4. Copy the function URL from the deploy output, e.g.  
   `https://us-central1-fittrack-698fa.cloudfunctions.net/aiCoach`
5. Build the app with that URL:
   ```bash
   VITE_AI_ENDPOINT="https://us-central1-fittrack-698fa.cloudfunctions.net/aiCoach" npm run build
   npx cap sync android
   ```
6. For local web testing you can also set in the browser console:
   ```js
   window.__FIFTYFIT_AI_ENDPOINT__ = "https://…/aiCoach"
   ```

## Google Free Tier notes

- Quotas (RPM / RPD / TPM) change over time — check AI Studio → **Rate limits**.
- When Free Tier is exhausted, the backend returns a friendly “busy / try later” message; the app does not crash.
- When you have paying users, raise quotas or switch the server-side provider without changing the app UI (same `/aiCoach` contract).

## Privacy

- Chat messages are **not** stored in Firestore.
- Only `{ date, count }` usage is written by the **Admin SDK** on the user document.
- Session chat lives in React state and is cleared when leaving AI Coach.
