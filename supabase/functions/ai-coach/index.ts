// Supabase Edge Function: ai-coach
// Architecture: Firebase Auth ID token → verify inside function → Gemini
//
// Deploy with:
//   supabase functions deploy ai-coach --no-verify-jwt
// (or set verify_jwt = false in config) so the gateway does not reject
// Firebase JWTs. Validation happens inside this function.
//
// Secrets (Supabase → Edge Functions → Secrets):
//   GEMINI_API_KEY
// Optional:
//   FIREBASE_PROJECT_ID (default: fittrack-698fa)
//
// IMPORTANT: Do NOT use oauth2.googleapis.com/tokeninfo for Firebase ID
// tokens — that endpoint is for Google OAuth ID tokens and rejects
// securetoken.google.com Firebase JWTs (→ 401 unauthenticated).

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import * as jose from "https://deno.land/x/jose@v4.15.5/index.ts";

const PROJECT_ID = Deno.env.get("FIREBASE_PROJECT_ID") || "fittrack-698fa";
const FREE_LIMIT = 3;
const PRO_LIMIT = 50;
const GEMINI_MODEL = "gemini-2.0-flash";

const corsHeaders: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(status: number, body: Record<string, unknown>) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

/** Verify Firebase Auth ID token using Google securetoken JWKS. */
async function verifyFirebaseIdToken(idToken: string) {
  const JWKS = jose.createRemoteJWKSet(
    new URL(
      "https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com",
    ),
  );
  const { payload } = await jose.jwtVerify(idToken, JWKS, {
    issuer: `https://securetoken.google.com/${PROJECT_ID}`,
    audience: PROJECT_ID,
  });
  const uid = payload.sub || payload.user_id;
  if (!uid) throw new Error("No uid in token");
  return {
    uid: String(uid),
    email: typeof payload.email === "string" ? payload.email : null,
  };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }
  if (req.method !== "POST") {
    return json(405, { error: "method_not_allowed" });
  }

  try {
    const authHeader = req.headers.get("Authorization") || "";
    const m = authHeader.match(/^Bearer\s+(.+)$/i);
    if (!m) {
      return json(401, {
        error: "unauthenticated",
        message: "Missing Bearer token",
      });
    }
    const idToken = m[1].trim();

    let uid: string;
    try {
      const verified = await verifyFirebaseIdToken(idToken);
      uid = verified.uid;
    } catch (e) {
      console.error(
        "Firebase token verify failed",
        String((e as Error)?.message || e).slice(0, 200),
      );
      return json(401, {
        error: "unauthenticated",
        message: "Invalid or expired Firebase ID token",
      });
    }

    let body: Record<string, unknown> = {};
    try {
      body = await req.json();
    } catch {
      body = {};
    }

    const lang = body.lang === "ar" ? "ar" : "en";
    const localDate =
      typeof body.localDate === "string" &&
      /^\d{4}-\d{2}-\d{2}$/.test(body.localDate as string)
        ? (body.localDate as string)
        : new Date().toISOString().slice(0, 10);
    const hasAiPro = !!body.hasAiPro;
    const limit = hasAiPro ? PRO_LIMIT : FREE_LIMIT;
    const messages = Array.isArray(body.messages)
      ? (body.messages as Array<{ role?: string; content?: string }>).slice(-6)
      : [];
    const userMessage =
      typeof body.message === "string"
        ? body.message
        : messages.filter((x) => x?.role === "user").pop()?.content || "";

    if (!userMessage || !String(userMessage).trim()) {
      return json(400, { error: "bad_request", message: "Empty message" });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!supabaseUrl || !serviceKey) {
      return json(500, {
        error: "backend_error",
        message: "Supabase service credentials missing",
      });
    }
    const sb = createClient(supabaseUrl, serviceKey);

    const { data: existing, error: readErr } = await sb
      .from("ai_usage")
      .select("count")
      .eq("uid", uid)
      .eq("usage_date", localDate)
      .maybeSingle();

    if (readErr) {
      console.error("ai_usage read", readErr);
      return json(500, {
        error: "backend_error",
        message: "Usage read failed",
      });
    }

    const used = (existing as { count?: number } | null)?.count ?? 0;
    if (used >= limit) {
      return json(429, {
        error: "daily_limit",
        code: "daily_limit",
        message: "Daily AI message limit reached",
        date: localDate,
        used,
        count: used,
        limit,
        remaining: 0,
        hasPro: hasAiPro,
      });
    }

    const geminiKey = Deno.env.get("GEMINI_API_KEY");
    if (!geminiKey) {
      return json(500, {
        error: "backend_error",
        message: "GEMINI_API_KEY not configured",
      });
    }

    const systemPrompt =
      lang === "ar"
        ? "أنت مدرب لياقة وتغذية محترف لتطبيق Fifty Fit. أجب باختصار ووضوح بالعربية. لا تقدم نصائح طبية. ركز على التمرين والتغذية العملية."
        : "You are a professional fitness and nutrition coach for the Fifty Fit app. Answer briefly and clearly in English. No medical advice. Focus on practical training and nutrition.";

    const historyText = messages
      .map(
        (m) =>
          `${m.role === "assistant" ? "Coach" : "User"}: ${String(m.content || "").slice(0, 800)}`,
      )
      .join("\n");

    const prompt = `${systemPrompt}\n\nConversation:\n${historyText}\n\nUser: ${String(userMessage).slice(0, 2000)}\nCoach:`;

    const geminiRes = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${encodeURIComponent(geminiKey)}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ role: "user", parts: [{ text: prompt }] }],
          generationConfig: {
            temperature: 0.7,
            maxOutputTokens: 1024,
          },
        }),
      },
    );

    if (!geminiRes.ok) {
      const errText = await geminiRes.text();
      console.error("Gemini error", geminiRes.status, errText.slice(0, 300));
      if (geminiRes.status === 429) {
        return json(429, {
          error: "quota",
          message: "Gemini quota exceeded",
        });
      }
      return json(500, {
        error: "backend_error",
        message: "AI generation failed",
      });
    }

    const geminiData = await geminiRes.json();
    const reply =
      geminiData?.candidates?.[0]?.content?.parts
        ?.map((p: { text?: string }) => p?.text || "")
        .join("")
        .trim() || "";

    if (!reply) {
      return json(500, {
        error: "empty_response",
        message: "Empty AI response",
      });
    }

    const newCount = used + 1;
    const { error: writeErr } = await sb.from("ai_usage").upsert(
      { uid, usage_date: localDate, count: newCount },
      { onConflict: "uid,usage_date" },
    );
    if (writeErr) {
      console.error("ai_usage write", writeErr);
    }

    return json(200, {
      reply,
      usage: {
        date: localDate,
        count: newCount,
        used: newCount,
        limit,
        remaining: Math.max(0, limit - newCount),
        hasPro: hasAiPro,
      },
    });
  } catch (e) {
    console.error("ai-coach unhandled", e);
    return json(500, { error: "backend_error", message: "Internal error" });
  }
});
