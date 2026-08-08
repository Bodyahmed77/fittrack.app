/**
 * Fifty Fit — AI Coach HTTPS endpoint
 *
 * Architecture:
 *   App → this function (Firebase Auth verified) → Gemini API → App
 *
 * Secrets / env (set in Google Cloud / Firebase, NEVER in the app):
 *   GEMINI_API_KEY   – Google AI Studio key (Free Tier)
 *   GEMINI_MODEL     – default: gemini-2.5-flash-lite
 *   FREE_AI_LIMIT    – default: 3
 *   PRO_AI_LIMIT     – default: 50
 *
 * Deploy:
 *   cd functions && npm install
 *   firebase functions:config:set gemini.key="YOUR_KEY" gemini.model="gemini-2.5-flash-lite"
 *   # or use Secret Manager / .env for functions v2
 *   firebase deploy --only functions:aiCoach
 */

const { onRequest } = require("firebase-functions/v2/https");
const { defineSecret, defineString } = require("firebase-functions/params");
const admin = require("firebase-admin");

if (!admin.apps.length) {
  admin.initializeApp();
}

const geminiApiKey = defineSecret("GEMINI_API_KEY");
const geminiModel = defineString("GEMINI_MODEL", {
  default: "gemini-2.5-flash-lite",
});

const FREE_LIMIT = Number(process.env.FREE_AI_LIMIT || 3);
const PRO_LIMIT = Number(process.env.PRO_AI_LIMIT || 50);

const SYSTEM_PROMPT = `You are "Fifty Fit AI Coach" — a practical gym, strength, and nutrition coach inside the Fifty Fit fitness app.

Personality:
- Supportive, direct, concise, and realistic.
- Speak like a smart gym coach, not a generic chatbot and not a doctor.
- Prefer actionable advice (sets, reps, protein targets, meal ideas, recovery).

Language:
- If the user writes primarily in Arabic, reply in Arabic (Egyptian-friendly is fine).
- If the user writes primarily in English, reply in English.
- Match the user's language automatically. Do not ask them to pick a language.

Safety:
- You are NOT a doctor. Never diagnose, prescribe medication, or treat medical conditions.
- For chest pain, severe injury, eating disorders, fainting, or medication questions: briefly refuse medical advice and recommend a qualified professional.
- Avoid extreme crash diets or unsafe supplement stacks.

Style:
- Keep answers focused and useful (usually short to medium length).
- Use the provided user context when relevant; do not invent personal facts not present in context.
- Do not mention that you are Gemini or Google unless asked about the product.`;

function isIsoDate(s) {
  return typeof s === "string" && /^\d{4}-\d{2}-\d{2}$/.test(s);
}

function serverUtcDate() {
  return new Date().toISOString().slice(0, 10);
}

/** Accept client local date only if within ±1 day of server UTC (anti-spoof). */
function resolveUsageDate(clientLocalDate) {
  if (!isIsoDate(clientLocalDate)) return serverUtcDate();
  const server = serverUtcDate();
  const c = new Date(clientLocalDate + "T12:00:00Z").getTime();
  const s = new Date(server + "T12:00:00Z").getTime();
  const dayMs = 86400000;
  if (Math.abs(c - s) <= dayMs) return clientLocalDate;
  return server;
}

function detectArabic(text) {
  return /[\u0600-\u06FF]/.test(String(text || ""));
}

function compactContext(ctx) {
  if (!ctx || typeof ctx !== "object") return {};
  const out = {};
  const allow = [
    "age",
    "gender",
    "height",
    "weight",
    "goal",
    "plan",
    "todayWorkout",
    "completedToday",
    "proteinTarget",
    "calorieTarget",
  ];
  for (const k of allow) {
    if (ctx[k] !== undefined && ctx[k] !== null && ctx[k] !== "") {
      out[k] = ctx[k];
    }
  }
  return out;
}

function buildGeminiContents(messages, context) {
  const recent = (Array.isArray(messages) ? messages : [])
    .filter((m) => m && (m.role === "user" || m.role === "assistant") && m.content)
    .slice(-6);

  const lines = [];
  const ctx = compactContext(context);
  if (Object.keys(ctx).length) {
    lines.push({
      role: "user",
      parts: [
        {
          text:
            "User fitness context (JSON, for personalization only):\n" +
            JSON.stringify(ctx),
        },
      ],
    });
    lines.push({
      role: "model",
      parts: [
        {
          text: "Understood. I will use this context only when relevant.",
        },
      ],
    });
  }

  for (const m of recent) {
    lines.push({
      role: m.role === "assistant" ? "model" : "user",
      parts: [{ text: String(m.content).slice(0, 2000) }],
    });
  }
  return lines;
}

async function callGemini({ apiKey, model, messages, context }) {
  const url =
    `https://generativelanguage.googleapis.com/v1beta/models/` +
    `${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(apiKey)}`;

  const body = {
    systemInstruction: { parts: [{ text: SYSTEM_PROMPT }] },
    contents: buildGeminiContents(messages, context),
    generationConfig: {
      temperature: 0.7,
      maxOutputTokens: 512,
    },
  };

  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  const raw = await res.text();
  let data;
  try {
    data = JSON.parse(raw);
  } catch {
    data = null;
  }

  if (!res.ok) {
    const status = res.status;
    const msg =
      data?.error?.message ||
      (status === 429
        ? "rate_limit"
        : status === 403
          ? "forbidden"
          : "upstream_error");
    const err = new Error(msg);
    err.status = status;
    err.code =
      status === 429
        ? "rate_limit"
        : status === 403
          ? "forbidden"
          : "upstream_error";
    throw err;
  }

  const text =
    data?.candidates?.[0]?.content?.parts?.map((p) => p.text).join("") ||
    "";
  if (!text.trim()) {
    const err = new Error("empty_response");
    err.code = "empty_response";
    throw err;
  }
  return text.trim();
}

exports.aiCoach = onRequest(
  {
    region: "us-central1",
    secrets: [geminiApiKey],
    cors: true,
    timeoutSeconds: 60,
    memory: "256MiB",
  },
  async (req, res) => {
    // CORS preflight
    if (req.method === "OPTIONS") {
      res.set("Access-Control-Allow-Origin", "*");
      res.set("Access-Control-Allow-Methods", "POST, OPTIONS");
      res.set("Access-Control-Allow-Headers", "Content-Type, Authorization");
      res.status(204).send("");
      return;
    }

    res.set("Access-Control-Allow-Origin", "*");

    if (req.method !== "POST") {
      res.status(405).json({ error: "method_not_allowed" });
      return;
    }

    try {
      const authHeader = req.get("Authorization") || "";
      const match = authHeader.match(/^Bearer\s+(.+)$/i);
      if (!match) {
        res.status(401).json({
          error: "unauthenticated",
          message: "Sign in required to use AI Coach.",
        });
        return;
      }

      let decoded;
      try {
        decoded = await admin.auth().verifyIdToken(match[1]);
      } catch {
        res.status(401).json({
          error: "unauthenticated",
          message: "Invalid or expired session. Please sign in again.",
        });
        return;
      }

      const uid = decoded.uid;
      const payload = req.body || {};
      const messages = Array.isArray(payload.messages) ? payload.messages : [];
      const localDate = resolveUsageDate(payload.localDate);
      const context = compactContext(payload.context || {});

      if (!messages.length || !messages[messages.length - 1]?.content) {
        res.status(400).json({ error: "empty_message" });
        return;
      }

      const userRef = admin.firestore().doc(`users/${uid}`);
      const snap = await userRef.get();
      const userData = snap.exists ? snap.data() : {};
      const hasPro = !!(userData.entitlements && userData.entitlements.aiCoachPro);
      const limit = hasPro ? PRO_LIMIT : FREE_LIMIT;

      const prevUsage = userData.aiUsage || {};
      const used =
        prevUsage.date === localDate && Number.isFinite(Number(prevUsage.count))
          ? Number(prevUsage.count)
          : 0;

      if (used >= limit) {
        res.status(429).json({
          error: "daily_limit",
          limit,
          used,
          remaining: 0,
          date: localDate,
          hasPro,
          message: hasPro
            ? "Daily AI Coach Pro limit reached. Try again tomorrow."
            : "You've used your free AI messages for today. Come back tomorrow or upgrade to AI Coach Pro.",
        });
        return;
      }

      const apiKey = geminiApiKey.value();
      if (!apiKey) {
        res.status(503).json({
          error: "backend_unavailable",
          message: "AI service is not configured yet.",
        });
        return;
      }

      const model = geminiModel.value() || "gemini-2.5-flash-lite";
      let reply;
      try {
        reply = await callGemini({
          apiKey,
          model,
          messages,
          context,
        });
      } catch (e) {
        const code = e.code || "upstream_error";
        const status = e.status === 429 ? 429 : 502;
        res.status(status).json({
          error: code,
          message:
            code === "rate_limit"
              ? "The AI service is busy right now. Please try again in a minute."
              : "AI service temporarily unavailable. Please try again.",
        });
        return;
      }

      // Server-side increment (Admin SDK — not trustable client write)
      const nextCount = used + 1;
      await userRef.set(
        { aiUsage: { date: localDate, count: nextCount } },
        { merge: true },
      );

      res.status(200).json({
        reply,
        usage: {
          date: localDate,
          count: nextCount,
          used: nextCount,
          limit,
          remaining: Math.max(0, limit - nextCount),
          hasPro,
        },
      });
    } catch (e) {
      console.error("aiCoach error", e);
      res.status(500).json({
        error: "internal",
        message: "Something went wrong. Please try again.",
      });
    }
  },
);
