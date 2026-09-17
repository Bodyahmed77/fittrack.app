import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import * as jose from "https://deno.land/x/jose@v4.15.5/index.ts";

const PROJECT_ID = Deno.env.get("FIREBASE_PROJECT_ID") || "fittrack-698fa";
const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";

const corsHeaders: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Cache-Control": "no-store",
};

function json(status: number, body: Record<string, unknown>) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

async function verifyFirebaseIdToken(idToken: string) {
  const JWKS = jose.createRemoteJWKSet(
    new URL("https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com"),
  );
  const { payload } = await jose.jwtVerify(idToken, JWKS, {
    issuer: `https://securetoken.google.com/${PROJECT_ID}`,
    audience: PROJECT_ID,
  });
  const uid = payload.sub || payload.user_id;
  if (!uid) throw new Error("No uid in token");
  return String(uid);
}

async function assertAdmin(idToken: string, uid: string) {
  const url = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents/admins/${encodeURIComponent(uid)}`;
  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${idToken}` },
  });
  if (response.status === 200) return true;
  if (response.status === 404) return false;
  throw new Error(`admin_check_failed:${response.status}`);
}

function toFirestoreValue(value: unknown): Record<string, unknown> {
  if (typeof value === "boolean") return { booleanValue: value };
  if (typeof value === "number" && Number.isFinite(value)) return { doubleValue: value };
  if (typeof value === "string") return { stringValue: value };
  if (value instanceof Date) return { timestampValue: value.toISOString() };
  return { nullValue: null };
}

async function firestorePatchUser(idToken: string, targetUid: string, values: Record<string, unknown>) {
  const fieldPaths = Object.keys(values).map((key) => `updateMask.fieldPaths=${encodeURIComponent(key)}`).join("&");
  const url = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents/users/${encodeURIComponent(targetUid)}${fieldPaths ? `?${fieldPaths}` : ""}`;
  const fields: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(values)) fields[key] = toFirestoreValue(value);
  const response = await fetch(url, {
    method: "PATCH",
    headers: {
      Authorization: `Bearer ${idToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ fields }),
  });
  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    throw new Error(`firestore_write_failed:${response.status}:${detail.slice(0, 300)}`);
  }
}

async function firestoreCreateNotification(idToken: string, targetUid: string, payload: { title: string; body: string }) {
  const documentId = crypto.randomUUID().replaceAll("-", "");
  const url = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents/users/${encodeURIComponent(targetUid)}/notifications?documentId=${documentId}`;
  const response = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${idToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      fields: {
        title: { stringValue: payload.title },
        body: { stringValue: payload.body },
        createdAt: { timestampValue: new Date().toISOString() },
        read: { booleanValue: false },
      },
    }),
  });
  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    throw new Error(`firestore_notification_failed:${response.status}:${detail.slice(0, 300)}`);
  }
}

const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

async function countRows(table: string, filter?: (query: any) => any) {
  let query = sb.from(table).select("id", { count: "exact", head: true });
  if (filter) query = filter(query);
  const { count, error } = await query;
  if (error) throw error;
  return Number(count || 0);
}

async function overview() {
  const since24h = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const since7d = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
  const [openReports, activeEntitlements, billing24h, reports7d, audit7d] = await Promise.all([
    countRows("ai_reports", (q) => q.eq("status", "open")),
    countRows("entitlements", (q) => q.eq("purchase_state", "active")),
    countRows("billing_event_log", (q) => q.gte("created_at", since24h)),
    countRows("ai_reports", (q) => q.gte("created_at", since7d)),
    countRows("admin_audit_log", (q) => q.gte("created_at", since7d)),
  ]);

  const { data: usageRows, error: usageError } = await sb
    .from("ai_usage")
    .select("count")
    .eq("usage_date", new Date().toISOString().slice(0, 10));
  if (usageError) throw usageError;
  const aiMessagesToday = (usageRows || []).reduce((sum, row) => sum + Number(row.count || 0), 0);

  const { data: productRows, error: productError } = await sb
    .from("entitlements")
    .select("product_key,purchase_state,expires_at,updated_at")
    .eq("purchase_state", "active");
  if (productError) throw productError;
  const byProduct: Record<string, number> = {};
  for (const row of productRows || []) byProduct[row.product_key] = (byProduct[row.product_key] || 0) + 1;

  return {
    stats: { openReports, activeEntitlements, billing24h, aiMessagesToday, reports7d, audit7d },
    activeEntitlementsByProduct: byProduct,
    generatedAt: new Date().toISOString(),
  };
}

async function recentReports(status: string | null, limit: number) {
  let q = sb
    .from("ai_reports")
    .select("id,uid,response_text,reason,lang,created_at,status,model,reviewed_at,reviewed_by")
    .order("created_at", { ascending: false })
    .limit(Math.min(Math.max(limit, 1), 100));
  if (status && ["open", "reviewed", "dismissed"].includes(status)) q = q.eq("status", status);
  const { data, error } = await q;
  if (error) throw error;
  return data || [];
}

async function recentBilling(limit: number) {
  const { data, error } = await sb
    .from("billing_event_log")
    .select("id,uid,product_key,event_type,purchase_state,expires_at,purchase_token_present,created_at")
    .order("created_at", { ascending: false })
    .limit(Math.min(Math.max(limit, 1), 100));
  if (error) throw error;
  return data || [];
}

async function recentAudit(limit: number) {
  const { data, error } = await sb
    .from("admin_audit_log")
    .select("id,admin_uid,action,target_type,target_id,metadata,created_at")
    .order("created_at", { ascending: false })
    .limit(Math.min(Math.max(limit, 1), 100));
  if (error) throw error;
  return data || [];
}

async function updateReport(adminUid: string, reportId: string, status: string) {
  if (!reportId || !["open", "reviewed", "dismissed"].includes(status)) {
    throw new Error("invalid_report_update");
  }
  const reviewed = status === "open" ? null : new Date().toISOString();
  const reviewedBy = status === "open" ? null : adminUid;
  const { data, error } = await sb
    .from("ai_reports")
    .update({ status, reviewed_at: reviewed, reviewed_by: reviewedBy })
    .eq("id", reportId)
    .select("id,uid,status,reviewed_at,reviewed_by")
    .single();
  if (error) throw error;
  await sb.from("admin_audit_log").insert({
    admin_uid: adminUid,
    action: "report_status_update",
    target_type: "ai_report",
    target_id: reportId,
    metadata: { status },
  });
  return data;
}

async function upsertUserAccount(idToken: string, adminUid: string, targetUid: string, name?: string, phone?: string) {
  if (!targetUid) throw new Error("target_uid_required");
  const values: Record<string, unknown> = {};
  if (typeof name === "string") values["account.name"] = name.trim().slice(0, 120);
  if (typeof phone === "string") values["account.phone"] = phone.trim().slice(0, 40);
  if (!Object.keys(values).length) throw new Error("no_account_changes");
  values.updatedAt = new Date().toISOString();
  await firestorePatchUser(idToken, targetUid, values);
  await sb.from("admin_audit_log").insert({
    admin_uid: adminUid,
    action: "user_account_update",
    target_type: "firebase_user",
    target_id: targetUid,
    metadata: { fields: Object.keys(values).filter((x) => x !== "updatedAt") },
  });
  return { ok: true };
}

async function updateUserPro(idToken: string, adminUid: string, targetUid: string, enabled: boolean) {
  if (!targetUid) throw new Error("target_uid_required");
  const expires = enabled ? new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10) : null;
  await firestorePatchUser(idToken, targetUid, {
    "entitlements.trainingPro": enabled,
    "entitlements.nutritionPro": enabled,
    "entitlements.aiCoachPro": enabled,
    "entitlements.proExpiresAt": expires,
    updatedAt: new Date().toISOString(),
  });
  await sb.from("admin_audit_log").insert({
    admin_uid: adminUid,
    action: enabled ? "grant_pro" : "revoke_pro",
    target_type: "firebase_user",
    target_id: targetUid,
    metadata: { durationDays: enabled ? 30 : 0 },
  });
  return { ok: true, enabled, expiresAt: expires };
}

async function sendNotification(idToken: string, adminUid: string, targetUid: string, title: string, body: string) {
  title = String(title || "Fifty Fit").trim().slice(0, 100);
  body = String(body || "").trim().slice(0, 1000);
  if (!targetUid || !title || !body) throw new Error("notification_fields_required");
  await firestoreCreateNotification(idToken, targetUid, { title, body });
  await sb.from("admin_audit_log").insert({
    admin_uid: adminUid,
    action: "send_notification",
    target_type: "firebase_user",
    target_id: targetUid,
    metadata: { titleLength: title.length, bodyLength: body.length },
  });
  return { ok: true };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json(405, { error: "method_not_allowed" });
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) return json(500, { error: "backend_error" });

  const match = (req.headers.get("Authorization") || "").match(/^Bearer\s+(.+)$/i);
  if (!match) return json(401, { error: "unauthenticated" });
  const idToken = match[1].trim();

  let adminUid: string;
  try {
    adminUid = await verifyFirebaseIdToken(idToken);
    if (!(await assertAdmin(idToken, adminUid))) return json(403, { error: "forbidden" });
  } catch (error) {
    console.error("admin authentication failed", error);
    return json(401, { error: "unauthenticated" });
  }

  let body: Record<string, unknown> = {};
  try { body = await req.json(); } catch {}
  const action = String(body.action || "");

  try {
    switch (action) {
      case "overview":
        return json(200, { ok: true, data: await overview() });
      case "reports_list":
        return json(200, { ok: true, data: await recentReports(body.status ? String(body.status) : null, Number(body.limit || 50)) });
      case "billing_recent":
        return json(200, { ok: true, data: await recentBilling(Number(body.limit || 50)) });
      case "audit_recent":
        return json(200, { ok: true, data: await recentAudit(Number(body.limit || 50)) });
      case "report_update":
        return json(200, { ok: true, data: await updateReport(adminUid, String(body.reportId || ""), String(body.status || "")) });
      case "user_account_update":
        return json(200, { ok: true, data: await upsertUserAccount(idToken, adminUid, String(body.targetUid || ""), typeof body.name === "string" ? body.name : undefined, typeof body.phone === "string" ? body.phone : undefined) });
      case "user_pro_update":
        return json(200, { ok: true, data: await updateUserPro(idToken, adminUid, String(body.targetUid || ""), body.enabled === true) });
      case "send_notification":
        return json(200, { ok: true, data: await sendNotification(idToken, adminUid, String(body.targetUid || ""), String(body.title || ""), String(body.message || "")) });
      default:
        return json(400, { error: "unknown_action" });
    }
  } catch (error) {
    console.error("admin-api action failed", { action, adminUid, error: String(error) });
    return json(500, { error: "backend_error" });
  }
});
