/**
 * Google OAuth **Web** client ID (type 3 in google-services.json).
 * Used only for the Android external-browser id_token flow.
 *
 * CI (extract-google-web-client-id.py) overwrites the placeholder before
 * `npm run build` when GOOGLE_SERVICES_JSON_BASE64 is present.
 * Safe to commit: Web client IDs are public by design.
 */
export const GOOGLE_WEB_CLIENT_ID =
  "REPLACE_WITH_GOOGLE_WEB_CLIENT_ID.apps.googleusercontent.com";
