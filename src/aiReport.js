import { AI_REPORT_ENDPOINT, SUPABASE_ANON_KEY } from "./config";
import { auth } from "./firebase";

export async function reportAiContent({ response, reason, lang }) {
  const user = auth.currentUser;
  if (!user) throw new Error("Sign in required");
  const token = await user.getIdToken(true);
  if (!AI_REPORT_ENDPOINT) throw new Error("AI report endpoint is not configured");
  const headers = { "Content-Type": "application/json", Authorization: `Bearer ${token}` };
  if (SUPABASE_ANON_KEY) headers.apikey = SUPABASE_ANON_KEY;
  const res = await fetch(AI_REPORT_ENDPOINT, {
    method: "POST",
    headers,
    body: JSON.stringify({
      response: String(response || "").slice(0, 2000),
      reason: String(reason || "").slice(0, 500),
      lang: lang === "ar" ? "ar" : "en",
    }),
  });
  if (!res.ok) throw new Error(`AI report failed: ${res.status}`);
  return res.json();
}
