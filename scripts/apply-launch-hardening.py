from pathlib import Path
import re

ROOT = Path(__file__).resolve().parents[1]

# App.jsx: age gate, remove mandatory phone collection, and add AI reporting.
p = ROOT / 'src/App.jsx'
s = p.read_text(encoding='utf-8')

if '  Flag,\n} from "lucide-react";' not in s:
    s = s.replace('  CheckCircle,\n} from "lucide-react";', '  CheckCircle,\n  Flag,\n} from "lucide-react";', 1)

old_age = '''if (step === 1 && (!age || age < 10 || age > 100)) {\n      setErr(ar ? "اكتب سن صحيح (10-100)" : "Enter a valid age (10-100)");'''
new_age = '''if (step === 1 && (!age || age < 13 || age > 100)) {\n      setErr(ar ? "اكتب سن صحيح (13-100)" : "Enter a valid age (13-100)");'''
if old_age in s:
    s = s.replace(old_age, new_age, 1)

phone_gate = '''    const isGoogle = (firebaseUser?.providerData || []).some(\n      (p) => p?.providerId === "google.com",\n    );\n    const hasPhone = !!(data?.account?.phone || "").trim();\n    if (isGoogle && !hasPhone) {\n      setPhase("googlePhone");\n      return;\n    }\n    setPhase("onboarding");'''
if phone_gate in s:
    s = s.replace(phone_gate, '    setPhase("onboarding");', 1)
s = s.replace(
    '}, [firebaseUser, loaded, localLang, savedLanguage, data.onboarded, data?.account?.phone]); // eslint-disable-line',
    '}, [firebaseUser, loaded, localLang, savedLanguage, data.onboarded]); // eslint-disable-line',
    1,
)

# Remove the mandatory phone screen and unreachable route.
s, _ = re.subn(
    r'\nfunction GooglePhoneScreen\([\s\S]*?\n\}\n\nfunction OnboardingScreen\(',
    '\nfunction OnboardingScreen(',
    s,
    count=1,
)
s, _ = re.subn(
    r'\n  else if \(phase === "googlePhone"\)\n    authScreen = \([\s\S]*?\n    \);\n',
    '\n',
    s,
    count=1,
)
s = s.replace(
    'return; // onboarding/googlePhone/language: no natural "back" target, ignore',
    'return; // onboarding/language: no natural "back" target, ignore',
    1,
)

# AI report state and handler.
marker = '  const [input, setInput] = useState("");\n  const [busy, setBusy] = useState(false);'
if marker in s and 'reportTarget' not in s:
    s = s.replace(marker, '''  const [input, setInput] = useState("");\n  const [busy, setBusy] = useState(false);\n  const [reportTarget, setReportTarget] = useState(null);\n  const [reportReason, setReportReason] = useState("");\n  const [reportBusy, setReportBusy] = useState(false);''', 1)

reset_marker = '''      setMessages([]);\n      setInput("");\n      setBusy(false);\n      setKeyboardInset(0);'''
if reset_marker in s and 'setReportTarget(null);' not in s:
    s = s.replace(reset_marker, '''      setMessages([]);\n      setInput("");\n      setBusy(false);\n      setReportTarget(null);\n      setReportReason("");\n      setReportBusy(false);\n      setKeyboardInset(0);''', 1)

if 'const submitAiReport = async () =>' not in s:
    handler = '''  const submitAiReport = async () => {\n    if (!reportTarget || reportBusy) return;\n    const reason = reportReason.trim();\n    if (!reason) {\n      showToast(ar ? "اكتب سبب البلاغ" : "Please describe the issue");\n      return;\n    }\n    setReportBusy(true);\n    try {\n      const { reportAiContent } = await import("./aiReport");\n      await reportAiContent({\n        response: String(reportTarget.content || "").slice(0, 2000),\n        reason: reason.slice(0, 500),\n        lang: ar ? "ar" : "en",\n      });\n      setReportTarget(null);\n      setReportReason("");\n      showToast(ar ? "تم إرسال البلاغ، شكرًا لمساعدتنا." : "Report sent. Thanks for helping us improve.");\n    } catch {\n      showToast(ar ? "تعذر إرسال البلاغ. حاول مرة أخرى." : "Could not send the report. Please try again.");\n    } finally {\n      setReportBusy(false);\n    }\n  };\n\n'''
    s = s.replace('  const send = async () => {', handler + '  const send = async () => {', 1)

old_messages = '''          {messages.map((m, i) => (\n            <div\n              key={i}\n              style={{\n                alignSelf: m.role === "user" ? "flex-end" : "flex-start",\n                maxWidth: "92%",\n                background: m.role === "user" ? C.green : C.card2,\n                color: m.role === "user" ? "#04140a" : C.text,\n                padding: "10px 12px",\n                borderRadius: 14,\n                fontSize: 13.5,\n                lineHeight: 1.45,\n                whiteSpace: "pre-wrap",\n              }}\n            >\n              {m.content}\n            </div>\n          ))}'''
new_messages = '''          {messages.map((m, i) =>\n            m.role === "assistant" ? (\n              <div key={i} style={{ alignSelf: "flex-start", maxWidth: "92%" }}>\n                <div\n                  style={{\n                    background: C.card2,\n                    color: C.text,\n                    padding: "10px 12px",\n                    borderRadius: 14,\n                    fontSize: 13.5,\n                    lineHeight: 1.45,\n                    whiteSpace: "pre-wrap",\n                  }}\n                >\n                  {m.content}\n                </div>\n                <button\n                  type="button"\n                  onClick={() => {\n                    setReportTarget({ index: i, content: m.content });\n                    setReportReason("");\n                  }}\n                  style={{\n                    marginTop: 4,\n                    padding: "3px 6px",\n                    border: "none",\n                    background: "transparent",\n                    color: C.sub2,\n                    fontSize: 10.5,\n                    cursor: "pointer",\n                    display: "inline-flex",\n                    alignItems: "center",\n                    gap: 4,\n                  }}\n                >\n                  <Flag size={11} />\n                  {ar ? "الإبلاغ عن إجابة" : "Report answer"}\n                </button>\n              </div>\n            ) : (\n              <div\n                key={i}\n                style={{\n                  alignSelf: "flex-end",\n                  maxWidth: "92%",\n                  background: C.green,\n                  color: "#04140a",\n                  padding: "10px 12px",\n                  borderRadius: 14,\n                  fontSize: 13.5,\n                  lineHeight: 1.45,\n                  whiteSpace: "pre-wrap",\n                }}\n              >\n                {m.content}\n              </div>\n            ),\n          )}'''
if old_messages in s:
    s = s.replace(old_messages, new_messages, 1)

if 'Report an AI answer' not in s:
    modal = '''        {reportTarget && (\n          <div\n            style={{\n              position: "absolute",\n              inset: 0,\n              zIndex: 20,\n              background: "rgba(0,0,0,0.55)",\n              display: "flex",\n              alignItems: "center",\n              justifyContent: "center",\n              padding: 18,\n            }}\n            onClick={() => !reportBusy && setReportTarget(null)}\n          >\n            <div\n              dir={ar ? "rtl" : "ltr"}\n              onClick={(e) => e.stopPropagation()}\n              style={{\n                width: "100%",\n                maxWidth: 330,\n                background: C.card,\n                border: `1px solid ${C.border}`,\n                borderRadius: 16,\n                padding: 16,\n              }}\n            >\n              <div style={{ color: C.text, fontWeight: 800, fontSize: 15, marginBottom: 6 }}>\n                {ar ? "الإبلاغ عن إجابة AI" : "Report an AI answer"}\n              </div>\n              <div style={{ color: C.sub, fontSize: 11.5, lineHeight: 1.5, marginBottom: 10 }}>\n                {ar ? "ساعدنا نراجع الإجابة ونحسن الأمان والجودة." : "Tell us what was wrong so we can review and improve safety and quality."}\n              </div>\n              <textarea\n                value={reportReason}\n                onChange={(e) => setReportReason(e.target.value)}\n                maxLength={500}\n                rows={4}\n                placeholder={ar ? "إيه المشكلة في الإجابة؟" : "What was wrong with this answer?"}\n                style={{\n                  width: "100%",\n                  boxSizing: "border-box",\n                  resize: "none",\n                  background: C.card2,\n                  color: C.text,\n                  border: `1px solid ${C.border}`,\n                  borderRadius: 12,\n                  padding: "10px 12px",\n                  outline: "none",\n                  fontSize: 12.5,\n                  lineHeight: 1.45,\n                }}\n              />\n              <div style={{ display: "flex", gap: 8, marginTop: 10 }}>\n                <button type="button" disabled={reportBusy} onClick={() => setReportTarget(null)} style={{ flex: 1, padding: "10px 12px", borderRadius: 11, border: `1px solid ${C.border}`, background: "transparent", color: C.text, fontWeight: 700, cursor: "pointer" }}>\n                  {ar ? "إلغاء" : "Cancel"}\n                </button>\n                <button type="button" disabled={reportBusy || !reportReason.trim()} onClick={submitAiReport} style={{ flex: 1, padding: "10px 12px", borderRadius: 11, border: "none", background: C.green, color: C.onAccent, fontWeight: 800, cursor: reportBusy ? "wait" : "pointer", opacity: reportBusy || !reportReason.trim() ? 0.5 : 1 }}>\n                  {reportBusy ? (ar ? "جاري الإرسال…" : "Sending…") : (ar ? "إرسال البلاغ" : "Send report")}\n                </button>\n              </div>\n            </div>\n          </div>\n        )}\n\n'''
    s = s.replace('        <div\n          ref={inputBarRef}', modal + '        <div\n          ref={inputBarRef}', 1)

# Only one occurrence is the drawer panel; make it positioned for the report overlay.
panel_marker = '''          display: "flex",\n          flexDirection: "column",\n          boxShadow: "0 0 40px rgba(0,0,0,0.35)",'''
if panel_marker in s and '          position: "absolute",\n          boxShadow: "0 0 40px rgba(0,0,0,0.35)",' not in s:
    s = s.replace(panel_marker, '''          display: "flex",\n          flexDirection: "column",\n          position: "absolute",\n          boxShadow: "0 0 40px rgba(0,0,0,0.35)",''', 1)

# AI safety error shown to user.
safety_toast = '''    if (code === "gemini_safety_blocked") {\n      return ar\n        ? "الإجابة دي اتمنعت بسبب فلتر الأمان. جرّب سؤال مختلف."\n        : "That answer was blocked by the safety filter. Try a different question.";\n    }\n'''
if 'code === "gemini_safety_blocked"' not in s:
    s = s.replace('    if (code === "network") {', safety_toast + '    if (code === "network") {', 1)

p.write_text(s, encoding='utf-8')

# config.js
p = ROOT / 'src/config.js'
s = p.read_text(encoding='utf-8')
marker = '''export const AI_COACH_ENDPOINT =\n  "https://zemqiedqcujevyewfpld.supabase.co/functions/v1/ai-coach";'''
if marker in s and 'AI_REPORT_ENDPOINT' not in s:
    s = s.replace(marker, marker + '''\n\nexport const AI_REPORT_ENDPOINT =\n  (typeof import.meta !== "undefined" &&\n    import.meta.env &&\n    import.meta.env.VITE_AI_REPORT_ENDPOINT) ||\n  (AI_COACH_ENDPOINT || "").replace(\n    "/functions/v1/ai-coach",\n    "/functions/v1/ai-report",\n  );''', 1)
s = s.replace('// Fifty Fit App — External Configuration', '// FitTrack App — External Configuration', 1)
p.write_text(s, encoding='utf-8')

# capacitor app label
p = ROOT / 'capacitor.config.json'
s = p.read_text(encoding='utf-8').replace('"appName": "Fifty Fit"', '"appName": "FitTrack"', 1)
p.write_text(s, encoding='utf-8')

# privacy/legal text and public docs branding
p = ROOT / 'src/privacy.js'
s = p.read_text(encoding='utf-8').replace('Fifty Fit', 'FitTrack')
s = s.replace(
    'AI Coach Requests: information from your current FitTrack context and your message that is sent to Google\'s Gemini API to generate an answer. FitTrack does not store a chat-history database.',
    'AI Coach Requests: information from your current FitTrack context and your message that is sent to Google\'s Gemini API to generate an answer. FitTrack does not store a chat-history database. If you report an AI answer, the reported answer snippet and your report reason are stored in Supabase so we can review safety and quality issues.',
)
s = s.replace(
    'The App is not medical advice, diagnosis, or treatment.',
    'The App is not medical advice, diagnosis, or treatment. AI Coach is for general fitness and nutrition guidance only and should not be used for diagnosis, treatment, or emergency decisions.',
)
p.write_text(s, encoding='utf-8')

for path in [ROOT / 'docs/account-deletion.html', ROOT / 'docs/privacy-policy.html', ROOT / 'docs/index.html']:
    if path.exists():
        text = path.read_text(encoding='utf-8').replace('Fifty Fit', 'FitTrack')
        path.write_text(text, encoding='utf-8')

# AI client: remove production diagnostics without changing behavior.
p = ROOT / 'src/aiCoach.js'
s = p.read_text(encoding='utf-8')
s = re.sub(
    r'function diag\(\.\.\.args\) \{[\s\S]*?\n\}\n\nfunction normalizeUsage',
    'function diag() {}\n\nfunction normalizeUsage',
    s,
    count=1,
)
if '"gemini_safety_blocked"' not in s:
    s = s.replace('    "gemini_not_configured",\n', '    "gemini_not_configured",\n    "gemini_safety_blocked",\n', 1)
p.write_text(s, encoding='utf-8')

# AI report client helper.
(ROOT / 'src/aiReport.js').write_text('''import { AI_REPORT_ENDPOINT, SUPABASE_ANON_KEY } from "./config";\nimport { auth } from "./firebase";\n\nexport async function reportAiContent({ response, reason, lang }) {\n  const user = auth.currentUser;\n  if (!user) throw new Error("Sign in required");\n  const token = await user.getIdToken(true);\n  if (!AI_REPORT_ENDPOINT) throw new Error("AI report endpoint is not configured");\n  const headers = { "Content-Type": "application/json", Authorization: `Bearer ${token}` };\n  if (SUPABASE_ANON_KEY) headers.apikey = SUPABASE_ANON_KEY;\n  const res = await fetch(AI_REPORT_ENDPOINT, {\n    method: "POST",\n    headers,\n    body: JSON.stringify({\n      response: String(response || "").slice(0, 2000),\n      reason: String(reason || "").slice(0, 500),\n      lang: lang === "ar" ? "ar" : "en",\n    }),\n  });\n  if (!res.ok) throw new Error(`AI report failed: ${res.status}`);\n  return res.json();\n}\n''', encoding='utf-8')

# ai-report Edge Function.
fn = ROOT / 'supabase/functions/ai-report'
fn.mkdir(parents=True, exist_ok=True)
(fn / 'index.ts').write_text('''import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";\nimport * as jose from "https://deno.land/x/jose@v4.15.5/index.ts";\n\nconst PROJECT_ID = Deno.env.get("FIREBASE_PROJECT_ID") || "fittrack-698fa";\nconst corsHeaders: Record<string, string> = {\n  "Access-Control-Allow-Origin": "*",\n  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",\n  "Access-Control-Allow-Methods": "POST, OPTIONS",\n};\nfunction json(status: number, body: Record<string, unknown>) {\n  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });\n}\nasync function verifyFirebaseIdToken(idToken: string) {\n  const JWKS = jose.createRemoteJWKSet(new URL("https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com"));\n  const { payload } = await jose.jwtVerify(idToken, JWKS, { issuer: `https://securetoken.google.com/${PROJECT_ID}`, audience: PROJECT_ID });\n  const uid = payload.sub || payload.user_id;\n  if (!uid) throw new Error("No uid in token");\n  return String(uid);\n}\nDeno.serve(async (req) => {\n  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });\n  if (req.method !== "POST") return json(405, { error: "method_not_allowed" });\n  const match = (req.headers.get("Authorization") || "").match(/^Bearer\\s+(.+)$/i);\n  if (!match) return json(401, { error: "unauthenticated" });\n  let uid: string;\n  try { uid = await verifyFirebaseIdToken(match[1].trim()); } catch { return json(401, { error: "unauthenticated" }); }\n  let body: Record<string, unknown>;\n  try { body = await req.json(); } catch { return json(400, { error: "bad_request" }); }\n  const response = typeof body.response === "string" ? body.response.trim().slice(0, 2000) : "";\n  const reason = typeof body.reason === "string" ? body.reason.trim().slice(0, 500) : "";\n  const lang = body.lang === "ar" ? "ar" : "en";\n  if (!response || !reason) return json(400, { error: "bad_request" });\n  const url = Deno.env.get("SUPABASE_URL");\n  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");\n  if (!url || !serviceKey) return json(500, { error: "backend_error" });\n  const sb = createClient(url, serviceKey);\n  const { error } = await sb.from("ai_reports").insert({ uid, response_text: response, reason, lang });\n  if (error) return json(500, { error: "backend_error" });\n  return json(200, { ok: true });\n});\n''', encoding='utf-8')

# AI global concurrency slots + report storage.
(ROOT / 'supabase/migrations/20260811210000_ai_runtime_guard_and_reports.sql').write_text('''create table if not exists public.ai_runtime_slots (\n  slot_id smallint primary key,\n  lease_until timestamptz not null default to_timestamp(0)\n);\n\ninsert into public.ai_runtime_slots (slot_id)\nselect gs from generate_series(1, 4) as gs\non conflict (slot_id) do nothing;\n\nalter table public.ai_runtime_slots enable row level security;\nrevoke all on public.ai_runtime_slots from public, anon, authenticated;\n\ncreate or replace function public.try_acquire_ai_slot(p_lease_seconds integer default 45)\nreturns smallint language plpgsql security definer set search_path = public\nas $$\ndeclare\n  v_slot smallint;\n  v_lease integer := greatest(15, least(coalesce(p_lease_seconds, 45), 90));\nbegin\n  select slot_id into v_slot from public.ai_runtime_slots\n  where lease_until <= now() order by slot_id for update skip locked limit 1;\n  if v_slot is null then return 0; end if;\n  update public.ai_runtime_slots set lease_until = now() + make_interval(secs => v_lease) where slot_id = v_slot;\n  return v_slot;\nend;\n$$;\n\ncreate or replace function public.release_ai_slot(p_slot_id smallint)\nreturns boolean language plpgsql security definer set search_path = public\nas $$\nbegin\n  update public.ai_runtime_slots set lease_until = to_timestamp(0) where slot_id = p_slot_id;\n  return found;\nend;\n$$;\n\nrevoke all on function public.try_acquire_ai_slot(integer) from public, anon, authenticated;\nrevoke all on function public.release_ai_slot(smallint) from public, anon, authenticated;\ngrant execute on function public.try_acquire_ai_slot(integer) to service_role;\ngrant execute on function public.release_ai_slot(smallint) to service_role;\n\ncreate table if not exists public.ai_reports (\n  id uuid primary key default gen_random_uuid(),\n  uid text not null,\n  response_text text not null check (char_length(response_text) between 1 and 2000),\n  reason text not null check (char_length(reason) between 1 and 500),\n  lang text not null default 'en' check (lang in ('ar', 'en')),\n  created_at timestamptz not null default now()\n);\ncreate index if not exists ai_reports_created_at_idx on public.ai_reports (created_at desc);\ncreate index if not exists ai_reports_uid_idx on public.ai_reports (uid);\nalter table public.ai_reports enable row level security;\nrevoke all on public.ai_reports from public, anon, authenticated;\n''', encoding='utf-8')

# AI Coach server: global slot, explicit safety filters, safety-block handling.
p = ROOT / 'supabase/functions/ai-coach/index.ts'
s = p.read_text(encoding='utf-8')
slot_marker = '''    const sb = createClient(supabaseUrl, serviceKey);\n\n    // ---- SERVER-SIDE entitlement (not client-provided).'''
slot_replacement = '''    const sb = createClient(supabaseUrl, serviceKey);\n\n    // Global DB-backed concurrency gate: four provider calls maximum across all Edge isolates.\n    const { data: aiSlot, error: aiSlotErr } = await asRpc(sb).rpc("try_acquire_ai_slot", { p_lease_seconds: 45 });\n    const slotId = Number(aiSlot || 0);\n    if (aiSlotErr || !slotId) {\n      log("request_complete", { status: 503, error: "provider_overloaded", durationMs: Date.now() - t0 });\n      return json(503, { error: "provider_overloaded", message: "AI service is busy right now — please try again shortly" });\n    }\n\n    try {\n      // ---- SERVER-SIDE entitlement (not client-provided).'''
if slot_marker in s and 'try_acquire_ai_slot' not in s:
    s = s.replace(slot_marker, slot_replacement, 1)

tail_old = '''  } catch (e) {\n    log("request_complete", {\n      status: 500,\n      error: "backend_error",\n      durationMs: Date.now() - t0,\n      detail: String((e as Error)?.message || e).slice(0, 120),\n    });\n    return json(500, { error: "backend_error", message: "Internal error" });\n  } finally {\n    releaseConcurrencySlot();\n  }\n});'''
tail_new = '''      } catch (e) {\n        log("request_complete", {\n          status: 500,\n          error: "backend_error",\n          durationMs: Date.now() - t0,\n          detail: String((e as Error)?.message || e).slice(0, 120),\n        });\n        return json(500, { error: "backend_error", message: "Internal error" });\n      } finally {\n        await asRpc(sb).rpc("release_ai_slot", { p_slot_id: slotId }).catch(() => {});\n      }\n    } finally {\n      releaseConcurrencySlot();\n    }\n});'''
if 'release_ai_slot' not in s and tail_old in s:
    s = s.replace(tail_old, tail_new, 1)

safety_marker = '            generationConfig: { maxOutputTokens: 1024 },'
safety_replacement = '''            generationConfig: { maxOutputTokens: 1024 },\n            safetySettings: [\n              { category: "HARM_CATEGORY_HATE_SPEECH", threshold: "BLOCK_MEDIUM_AND_ABOVE" },\n              { category: "HARM_CATEGORY_HARASSMENT", threshold: "BLOCK_MEDIUM_AND_ABOVE" },\n              { category: "HARM_CATEGORY_SEXUALLY_EXPLICIT", threshold: "BLOCK_MEDIUM_AND_ABOVE" },\n              { category: "HARM_CATEGORY_DANGEROUS_CONTENT", threshold: "BLOCK_MEDIUM_AND_ABOVE" },\n            ],'''
if safety_marker in s and 'HARM_CATEGORY_DANGEROUS_CONTENT' not in s:
    s = s.replace(safety_marker, safety_replacement, 1)

reply_marker = '''      const geminiData = await geminiRes.json();\n      const reply =\n        geminiData?.candidates?.[0]?.content?.parts'''
reply_replacement = '''      const geminiData = await geminiRes.json();\n      if (geminiData?.promptFeedback?.blockReason || geminiData?.candidates?.[0]?.finishReason === "SAFETY") {\n        return { ok: false, code: "gemini_safety_blocked", status: 400, model } as const;\n      }\n      const reply =\n        geminiData?.candidates?.[0]?.content?.parts'''
if reply_marker in s and 'gemini_safety_blocked' not in s:
    s = s.replace(reply_marker, reply_replacement, 1)
p.write_text(s, encoding='utf-8')

print('launch hardening patch prepared')
