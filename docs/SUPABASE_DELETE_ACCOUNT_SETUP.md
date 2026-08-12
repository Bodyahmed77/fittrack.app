# Fifty Fit — Supabase Account Deletion Setup

The repository already contains the server-side deletion function:

`supabase/functions/delete-account/index.ts`

and the SQL cleanup function:

`supabase/migrations/20260811190000_delete_user_data.sql`

## What the function does

1. Accepts a Firebase ID token in `Authorization: Bearer <token>`.
2. Verifies the Firebase token and extracts the authenticated UID.
3. Uses the Supabase service-role key **only on the Edge Function server**.
4. Calls `public.delete_user_data(p_uid)` to remove the user's Supabase-side records.
5. Returns success only after the server-side cleanup succeeds.

Firebase Auth and Firestore deletion are intentionally completed by the authenticated app flow after this function succeeds.

## Supabase deployment

In Supabase Dashboard:

1. Open the Fifty Fit project.
2. Go to **Edge Functions**.
3. Open/create the function named **delete-account**.
4. Copy the exact code from `supabase/functions/delete-account/index.ts` in the GitHub `main` branch.
5. Deploy the function.
6. Go to **SQL Editor** and make sure the migration `20260811190000_delete_user_data.sql` has been applied. If migrations are managed manually in this project, run that SQL once.
7. Confirm the function has access to these server-side secrets/environment variables:
   - `SUPABASE_URL`
   - `SUPABASE_SERVICE_ROLE_KEY`
   - `FIREBASE_PROJECT_ID` (optional because the function defaults to `fittrack-698fa`)

**Never put `SUPABASE_SERVICE_ROLE_KEY` in the React app, Admin Dashboard, GitHub Pages, or public HTML.**

## Testing

Do not test deletion with a real production account first. Create a disposable Firebase test account and confirm:

- the Supabase cleanup succeeds;
- the Firebase user is deleted by the app flow;
- the user's Firestore document/data is deleted by the app flow;
- the user cannot sign in again with the deleted account;
- no entitlement, AI usage, or purchase-token record remains in Supabase.

## External Google Play deletion page

The public page is:

`docs/account-deletion.html`

It provides an external deletion request path for users who no longer have the app. The page does not contain privileged credentials. The current flow sends a verified deletion request to support; the server-side Edge Function remains the secure deletion primitive used by the authenticated app flow.

Before Google Play submission, verify that the public deletion URL is the exact URL entered in Play Console and that the deletion process actually removes the applicable user data.
