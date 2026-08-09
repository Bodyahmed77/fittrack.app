# Fifty Fit AI Coach (Supabase + Gemini)

## Architecture

```
Fifty Fit app (Firebase Auth)
  → Authorization: Bearer <Firebase ID token>
  → Supabase Edge Function: ai-coach  (verify_jwt = false)
  → Firebase ID token verified inside the function
  → ai_usage table (daily limits)
  → Gemini API (server-side key)
```

Endpoint (public URL, not a secret):

`https://zemqiedqcujevyewfpld.supabase.co/functions/v1/ai-coach`

Source in this repo: `supabase/functions/ai-coach/index.ts`

## Limits

| Tier | Messages / local calendar day |
|------|-------------------------------|
| Free | **3** |
| AI Coach Pro (`entitlements.aiCoachPro`) | **50** |

Enforced on the **server** (`ai_usage` table). Chat transcripts are **session-only** in the app (cleared when the AI drawer closes).

## Deploy / fix 401 unauthenticated

The Supabase **gateway** must not require a Supabase JWT (Firebase tokens are not Supabase JWTs).

```bash
# From a machine with Supabase CLI linked to project zemqiedqcujevyewfpld:
supabase functions deploy ai-coach --no-verify-jwt
```

Or in `supabase/config.toml`:

```toml
[functions.ai-coach]
verify_jwt = false
```

Then set secrets:

```bash
supabase secrets set GEMINI_API_KEY=your_gemini_key
# optional override:
# supabase secrets set FIREBASE_PROJECT_ID=fittrack-698fa
```

Create the usage table once (SQL editor):

```sql
create table if not exists public.ai_usage (
  uid text not null,
  usage_date date not null,
  count int not null default 0,
  primary key (uid, usage_date)
);
alter table public.ai_usage enable row level security;
-- Edge Function uses service role (bypasses RLS).
```

## Secrets (server only)

| Name | Where |
|------|--------|
| `GEMINI_API_KEY` | Supabase Edge Function secrets |
| `SUPABASE_SERVICE_ROLE_KEY` | Injected automatically by Supabase runtime |
| `SUPABASE_URL` | Injected automatically by Supabase runtime |

Never put the Gemini key in the app, APK, or GitHub source.

## Client config

`src/config.js`:

- `AI_COACH_ENDPOINT` — Supabase function URL
- Optional `VITE_SUPABASE_ANON_KEY` — public anon key if the gateway requires `apikey`

## CORS

Allowed request headers from the browser must include at least:

`authorization, content-type, apikey`

Do **not** send custom headers such as `X-Firebase-Token` (browsers will block the request).

## Auth note

Firebase Authentication remains the app auth system. The Edge Function runs with **`verify_jwt = false`** and validates the Firebase ID token with Google's `tokeninfo` endpoint (issuer + audience + exp + uid).
