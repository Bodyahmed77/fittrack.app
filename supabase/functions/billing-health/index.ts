import * as jose from "https://deno.land/x/jose@v4.15.5/index.ts";

const PACKAGE_NAME = Deno.env.get("ANDROID_PACKAGE_NAME") || "com.bodyahmed77.fiftyfit";
const PROJECT_ID = Deno.env.get("FIREBASE_PROJECT_ID") || "fittrack-698fa";

type ServiceAccountKey = { client_email: string; private_key: string; token_uri?: string };

function json(status: number, body: Record<string, unknown>) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
  });
}

function parseServiceAccount() {
  const raw = Deno.env.get("GOOGLE_PLAY_SERVICE_ACCOUNT_JSON") || "";
  const rawLength = raw.length;
  if (!raw.trim()) return { ok: false as const, rawLength, reason: "secret_empty" };

  const candidates = [
    raw.trim(),
    raw.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "").trim(),
  ];
  for (const candidate of candidates) {
    try {
      let value: unknown = JSON.parse(candidate);
      if (typeof value === "string") value = JSON.parse(value);
      const key = value as ServiceAccountKey;
      if (key && typeof key.client_email === "string" && typeof key.private_key === "string") {
        return { ok: true as const, key, rawLength };
      }
    } catch (_) {}
  }
  return { ok: false as const, rawLength, reason: "json_parse_failed" };
}

async function getAccessToken(key: ServiceAccountKey) {
  const pemBody = key.private_key
    .replace(/-----BEGIN PRIVATE KEY-----/g, "")
    .replace(/-----END PRIVATE KEY-----/g, "")
    .replace(/\\n/g, "\n")
    .replace(/\s+/g, "");
  let der: Uint8Array;
  try {
    der = Uint8Array.from(atob(pemBody), (c) => c.charCodeAt(0));
  } catch (_) {
    throw new Error("private_key_base64_invalid");
  }
  const cryptoKey = await crypto.subtle.importKey(
    "pkcs8",
    der,
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const now = Math.floor(Date.now() / 1000);
  const assertion = await new jose.SignJWT({ scope: "https://www.googleapis.com/auth/androidpublisher" })
    .setProtectedHeader({ alg: "RS256", typ: "JWT" })
    .setIssuer(key.client_email)
    .setAudience(key.token_uri || "https://oauth2.googleapis.com/token")
    .setIssuedAt(now)
    .setExpirationTime(now + 3600)
    .sign(cryptoKey);
  const tokenRes = await fetch(key.token_uri || "https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion,
    }),
  });
  if (!tokenRes.ok) throw new Error(`oauth_token_exchange_failed_${tokenRes.status}`);
  const token = await tokenRes.json();
  if (!token?.access_token) throw new Error("oauth_access_token_missing");
  return String(token.access_token);
}

Deno.serve(async (req) => {
  if (req.method !== "GET") return json(405, { ok: false, error: "method_not_allowed" });

  const parsed = parseServiceAccount();
  if (!parsed.ok) {
    return json(200, {
      ok: false,
      packageName: PACKAGE_NAME,
      projectId: PROJECT_ID,
      secretPresent: parsed.rawLength > 0,
      rawLength: parsed.rawLength,
      credentialParseable: false,
      credentialReason: parsed.reason,
      oauthExchange: false,
      playApiReachable: false,
    });
  }

  let accessToken: string;
  try {
    accessToken = await getAccessToken(parsed.key);
  } catch (error) {
    return json(200, {
      ok: false,
      packageName: PACKAGE_NAME,
      projectId: PROJECT_ID,
      secretPresent: true,
      rawLength: parsed.rawLength,
      credentialParseable: true,
      oauthExchange: false,
      oauthReason: String((error as Error)?.message || error).slice(0, 120),
      playApiReachable: false,
    });
  }

  const playUrl = `https://androidpublisher.googleapis.com/androidpublisher/v3/applications/${encodeURIComponent(PACKAGE_NAME)}/subscriptions?pageSize=1`;
  try {
    const play = await fetch(playUrl, { headers: { Authorization: `Bearer ${accessToken}` } });
    if (!play.ok) {
      const detail = await play.text().catch(() => "");
      return json(200, {
        ok: false,
        packageName: PACKAGE_NAME,
        projectId: PROJECT_ID,
        secretPresent: true,
        rawLength: parsed.rawLength,
        credentialParseable: true,
        oauthExchange: true,
        playApiReachable: false,
        playApiStatus: play.status,
        playApiDetail: detail.slice(0, 180),
      });
    }
    return json(200, {
      ok: true,
      packageName: PACKAGE_NAME,
      projectId: PROJECT_ID,
      secretPresent: true,
      rawLength: parsed.rawLength,
      credentialParseable: true,
      oauthExchange: true,
      playApiReachable: true,
      playApiStatus: play.status,
    });
  } catch (error) {
    return json(200, {
      ok: false,
      packageName: PACKAGE_NAME,
      projectId: PROJECT_ID,
      secretPresent: true,
      rawLength: parsed.rawLength,
      credentialParseable: true,
      oauthExchange: true,
      playApiReachable: false,
      playApiReason: String((error as Error)?.message || error).slice(0, 120),
    });
  }
});
