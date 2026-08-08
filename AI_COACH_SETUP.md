# Fifty Fit AI Coach (Supabase + Gemini)

## Architecture

```
Fifty Fit app (Firebase Auth)
  → Authorization: Bearer <Firebase ID token>
  → Supabase Edge Function: ai-coach
  → Gemini API (server-side key)
```

Endpoint (public URL, not a secret):

`https://zemqiedqcujevyewfpld.supabase.co/functions/v1/ai-coach`

## Limits

| Tier | Messages / local calendar day |
|------|-------------------------------|
| Free | **3** |
| AI Coach Pro (`entitlements.aiCoachPro`) | **50** |

Enforced on the **server** (`ai_usage` table). Chat transcripts are **session-only** in the app.

## Secrets (server only)

| Name | Where |
|------|--------|
| `GEMINI_API_KEY` | Supabase Edge Function secrets |

Never put the Gemini key in the app, APK, or GitHub source.

## Client config

`src/config.js`:

- `AI_COACH_ENDPOINT` — Supabase function URL
- Optional `VITE_SUPABASE_ANON_KEY` — public anon key if the gateway requires `apikey`

## Auth note

Firebase Authentication remains the app auth system. The Edge Function should run with **`verify_jwt = false`** so Firebase ID tokens are accepted and validated inside the function (not as Supabase Auth JWTs).

## CORS

Allowed request headers from the browser must include at least:

`authorization, content-type, apikey`

Do **not** send custom headers such as `X-Firebase-Token` (browsers will block the request and the app may show a false “no internet” error).
