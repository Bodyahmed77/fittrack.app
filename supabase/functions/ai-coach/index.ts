// Supabase Edge Function: ai-coach
// Architecture: Firebase Auth ID token → verify inside function → Gemini
//
// Deploy:
//   supabase functions deploy ai-coach --no-verify-jwt
//
// Secrets:
//   GEMINI_API_KEY (required)
// Optional:
//   FIREBASE_PROJECT_ID (default: fittrack-698fa)
//   GEMINI_MODEL (default: gemini-2.5-flash)
//
// Schema: public.ai_usage (uid text, usage_date date, count int) PK (uid, usage_date)
// Atomic limit: public.reserve_ai_usage(uid, usage_date, limit) → jsonb

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import * as jose from "https://deno.land/x/jose@v4.15.5/index.ts";

const PROJECT_ID = Deno.env.get("FIREBASE_PROJECT_ID") || "fittrack-698fa";
const FREE_LIMIT = 3;
const PRO_LIMIT = 50;
// gemini-2.0-flash was shut down by Google (2026).
const GEMINI_MODEL = Deno.env.get("GEMINI_MODEL") || "gemini-2.5-flash";

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

/** Verify Firebase Auth ID token via Google securetoken JWKS (not tokeninfo). */
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

    // Atomic reserve: increments count only if under limit (avoids race).
    const { data: reserved, error: reserveErr } = await sb.rpc(
      "reserve_ai_usage",
      {
        p_uid: uid,
        p_usage_date: localDate,
        p_limit: limit,
      },
    );

    if (reserveErr) {
      console.error("ai_usage reserve", {
        code: reserveErr.code,
        message: String(reserveErr.message || "").slice(0, 160),
      });
      // Fallback if RPC not applied yet
      const { data: existing, error: readErr } = await sb
        .from("ai_usage")
        .select("count")
        .eq("uid", uid)
        .eq("usage_date", localDate)
        .maybeSingle();

      if (readErr) {
        console.error("ai_usage read", {
          code: readErr.code,
          message: String(readErr.message || "").slice(0, 160),
        });
        return json(500, {
          error: "usage_read_failed",
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

      (body as Record<string, unknown>).__legacyUsage = used;
    } else {
      const r = (reserved || {}) as {
        allowed?: boolean;
        count?: number;
        limit?: number;
        remaining?: number;
      };
      if (!r.allowed) {
        return json(429, {
          error: "daily_limit",
          code: "daily_limit",
          message: "Daily AI message limit reached",
          date: localDate,
          used: r.count ?? limit,
          count: r.count ?? limit,
          limit,
          remaining: 0,
          hasPro: hasAiPro,
        });
      }
      (body as Record<string, unknown>).__reservedCount = r.count ?? 1;
      (body as Record<string, unknown>).__reservedRemaining =
        r.remaining ?? Math.max(0, limit - (r.count ?? 1));
    }

    const geminiKey = Deno.env.get("GEMINI_API_KEY");
    if (!geminiKey) {
      return json(500, {
        error: "gemini_not_configured",
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

    const userCtx =
      body.context && typeof body.context === "object"
        ? JSON.stringify(body.context).slice(0, 1200)
        : "";

    const prompt = `${systemPrompt}\n\nUser context: ${userCtx}\n\nConversation:\n${historyText}\n\nUser: ${String(userMessage).slice(0, 1500)}\nCoach:`;

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
        error: "gemini_failed",
        message: "AI generation failed",
        geminiStatus: geminiRes.status,
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

    let newCount =
      typeof (body as Record<string, unknown>).__reservedCount === "number"
        ? ((body as Record<string, unknown>).__reservedCount as number)
        : null;
    let remaining =
      typeof (body as Record<string, unknown>).__reservedRemaining === "number"
        ? ((body as Record<string, unknown>).__reservedRemaining as number)
        : null;

    if (newCount == null) {
      const used =
        typeof (body as Record<string, unknown>).__legacyUsage === "number"
          ? ((body as Record<string, unknown>).__legacyUsage as number)
          : 0;
      newCount = used + 1;
      remaining = Math.max(0, limit - newCount);
      const { error: writeErr } = await sb.from("ai_usage").upsert(
        { uid, usage_date: localDate, count: newCount },
        { onConflict: "uid,usage_date" },
      );
      if (writeErr) {
        console.error("ai_usage write", {
          code: writeErr.code,
          message: String(writeErr.message || "").slice(0, 160),
        });
      }
    }

    return json(200, {
      reply,
      usage: {
        date: localDate,
        count: newCount,
        used: newCount,
        limit,
        remaining: remaining ?? Math.max(0, limit - (newCount || 0)),
        hasPro: hasAiPro,
      },
    });
  } catch (e) {
    console.error(
      "ai-coach unhandled",
      String((e as Error)?.message || e).slice(0, 200),
    );
    return json(500, { error: "backend_error", message: "Internal error" });
  }
});
