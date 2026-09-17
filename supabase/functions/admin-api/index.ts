import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import * as jose from "https://deno.land/x/jose@v4.15.5/index.ts";

const PROJECT_ID = Deno.env.get("FIREBASE_PROJECT_ID") || "fittrack-698fa";
const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
const FIRESTORE_BASE = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents`;
const ALLOWED_ORIGINS = new Set([
  "https://bodyahmed77.github.io",
  "http://localhost",
  "https://localhost",
]);

function headersFor(req: Request): Record<string, string> {
  const origin = req.headers.get("Origin") || "";
  return {
    ...(ALLOWED_ORIGINS.has(origin)
      ? {
          "Access-Control-Allow-Origin": origin,
          Vary: "Origin",
        }
      : {}),
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Cache-Control": "no-store",
  };
}

function json(req: Request, status: number, body: Record<string, unknown>) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...headersFor(req),
      "Content-Type": "application/json",
    },
  });
}

async function verifyFirebaseIdToken(idToken: string) {
  const jwks = jose.createRemoteJWKSet(
    new URL("https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com"),
  );
  const { payload } = await jose.jwtVerify(idToken, jwks, {
    issuer: `https://securetoken.google.com/${PROJECT_ID}`,
    audience: PROJECT_ID,
  });
  const uid = payload.sub || payload.user_id;
  if (!uid) throw new Error("No uid in token");
  return String(uid);
}

async function assertAdmin(idToken: string, uid: string) {
  const response = await fetch(`${FIRESTORE_BASE}/admins/${encodeURIComponent(uid)}`, {
    headers: { Authorization: `Bearer ${idToken}` },
  });
  if (response.status === 404) return false;
  if (!response.ok) throw new Error(`admin_check_failed:${response.status}`);
  const body = await response.json();
  const role = body?.fields?.role?.stringValue;
  return role === "owner" || role === "staff" || role === "" || role == null;
}

function scalarFirestoreValue(value: unknown): Record<string, unknown> {
  if (typeof value === "boolean") return { booleanValue: value };
  if (typeof value === "number" && Number.isFinite(value)) return { doubleValue: value };
  if (typeof value === "string") return { stringValue: value };
  return { nullValue: null };
}

function buildFirestoreFields(values: Record<string, unknown>) {
  const root: Record<string, any> = {};
  for (const [path, value] of Object.entries(values)) {
    const parts = path.split(".");
    let node = root;
    for (let index = 0; index < parts.length - 1; index += 1) {
      const part = parts[index];
      if (!node[part]) node[part] = { mapValue: { fields: {} } };
      node = node[part].mapValue.fields;
    }
    node[parts[parts.length - 1]] = scalarFirestoreValue(value);
  }
  return root;
}

function decodeFirestoreValue(value: any): any {
  if (!value || typeof value !== "object") return null;
  if (Object.prototype.hasOwnProperty.call(value, "nullValue")) return null;
  if (Object.prototype.hasOwnProperty.call(value, "stringValue")) return value.stringValue;
  if (Object.prototype.hasOwnProperty.call(value, "booleanValue")) return value.booleanValue;
  if (Object.prototype.hasOwnProperty.call(value, "integerValue")) return Number(value.integerValue);
  if (Object.prototype.hasOwnProperty.call(value, "doubleValue")) return Number(value.doubleValue);
  if (Object.prototype.hasOwnProperty.call(value, "timestampValue")) return value.timestampValue;
  if (Object.prototype.hasOwnProperty.call(value, "referenceValue")) return value.referenceValue;
  if (Object.prototype.hasOwnProperty.call(value, "bytesValue")) return value.bytesValue;
  if (value.arrayValue) return (value.arrayValue.values || []).map(decodeFirestoreValue);
  if (value.mapValue) return decodeFirestoreFields(value.mapValue.fields || {});
  return null;
}

function decodeFirestoreFields(fields: Record<string, any>) {
  const result: Record<string, any> = {};
  for (const [key, value] of Object.entries(fields || {})) result[key] = decodeFirestoreValue(value);
  return result;
}

async function firestoreGetUser(idToken: string, targetUid: string) {
  const response = await fetch(`${FIRESTORE_BASE}/users/${encodeURIComponent(targetUid)}`, {
    headers: { Authorization: `Bearer ${idToken}` },
  });
  if (response.status === 404) return null;
  if (!response.ok) throw new Error(`firestore_read_failed:${response.status}`);
  return await response.json();
}

async function firestoreSearchUserByEmail(idToken: string, email: string) {
  const response = await fetch(`${FIRESTORE_BASE}:runQuery`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${idToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      structuredQuery: {
        from: [{ collectionId: "users" }],
        where: {
          fieldFilter: {
            field: { fieldPath: "account.email" },
            op: "EQUAL",
            value: { stringValue: email },
          },
        },
        limit: 10,
      },
    }),
  });
  if (!response.ok) throw new Error(`firestore_search_failed:${response.status}`);
  const rows = await response.json();
  return (Array.isArray(rows) ? rows : [])
    .filter((row) => row?.document?.name)
    .map((row) => {
      const name = String(row.document.name);
      const uid = name.split("/users/")[1] || "";
      const data = decodeFirestoreFields(row.document.fields || {});
      return { uid, data };
    })
    .filter((row) => row.uid);
}

async function firestorePatchUser(idToken: string, targetUid: string, values: Record<string, unknown>) {
  const fieldPaths = Object.keys(values)
    .map((key) => `updateMask.fieldPaths=${encodeURIComponent(key)}`)
    .join("&");
  const response = await fetch(
    `${FIRESTORE_BASE}/users/${encodeURIComponent(targetUid)}?${fieldPaths}`,
    {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${idToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ fields: buildFirestoreFields(values) }),
    },
  );
  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    throw new Error(`firestore_write_failed:${response.status}:${detail.slice(0, 300)}`);
  }
}

async function firestoreCreateNotification(idToken: string, targetUid: string, title: string, body: string) {
  const documentId = crypto.randomUUID().replaceAll("-", "");
  const response = await fetch(
    `${FIRESTORE_BASE}/users/${encodeURIComponent(targetUid)}/notifications?documentId=${documentId}`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${idToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        fields: {
          title: { stringValue: title },
          body: { stringValue: body },
          createdAt: { timestampValue: new Date().toISOString() },
          read: { booleanValue: false },
        },
      }),
    },
  );
  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    throw new Error(`firestore_notification_failed:${response.status}:${detail.slice(0, 300)}`);
  }
}

function firestoreAdminEntitlements(doc: any) {
  const fields = doc?.fields?.adminEntitlements?.mapValue?.fields || {};
  const enabled = (key: string) => fields?.[key]?.booleanValue === true;
  const expiry = fields?.proExpiresAt?.stringValue ? String(fields.proExpiresAt.stringValue).trim() : null;
  if (!expiry) {
    return enabled("trainingPro") || enabled("nutritionPro") || enabled("aiCoachPro")
      ? {
          trainingPro: enabled("trainingPro"),
          nutritionPro: enabled("nutritionPro"),
          aiCoachPro: enabled("aiCoachPro"),
          proExpiresAt: null,
        }
      : {
          trainingPro: false,
          nutritionPro: false,
          aiCoachPro: false,
          proExpiresAt: null,
        };
  }
  const expiryMs = Date.parse(`${expiry}T23:59:59.999Z`);
  if (!Number.isFinite(expiryMs) || expiryMs <= Date.now()) {
    return {
      trainingPro: false,
      nutritionPro: false,
      aiCoachPro: false,
      proExpiresAt: null,
    };
  }
  return {
    trainingPro: enabled("trainingPro"),
    nutritionPro: enabled("nutritionPro"),
    aiCoachPro: enabled("aiCoachPro"),
    proExpiresAt: expiry,
  };
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
  const since24h = new Date(Date.now() - 86400000).toISOString();
  const since7d = new Date(Date.now() - 7 * 86400000).toISOString();

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
    .select("product_key")
    .eq("purchase_state", "active");
  if (productError) throw productError;

  const activeEntitlementsByProduct: Record<string, number> = {};
  for (const row of productRows || []) {
    activeEntitlementsByProduct[row.product_key] = (activeEntitlementsByProduct[row.product_key] || 0) + 1;
  }

  return {
    stats: {
      openReports,
      activeEntitlements,
      billing24h,
      aiMessagesToday,
      reports7d,
      audit7d,
    },
    activeEntitlementsByProduct,
    generatedAt: new Date().toISOString(),
  };
}

async function recentReports(status: string | null, limit: number) {
  let query = sb
    .from("ai_reports")
    .select("id,uid,response_text,reason,lang,created_at,status,model,reviewed_at,reviewed_by")
    .order("created_at", { ascending: false })
    .limit(Math.min(Math.max(limit, 1), 100));
  if (status && ["open", "reviewed", "dismissed"].includes(status)) query = query.eq("status", status);
  const { data, error } = await query;
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

async function searchUsers(idToken: string, email: string) {
  const normalized = String(email || "").trim().toLowerCase().slice(0, 200);
  if (!normalized.includes("@")) throw new Error("invalid_email");
  return await firestoreSearchUserByEmail(idToken, normalized);
}

async function updateReport(adminUid: string, reportId: string, status: string) {
  if (!reportId || !["open", "reviewed", "dismissed"].includes(status)) throw new Error("invalid_report_update");
  const reviewed = status === "open" ? null : new Date().toISOString();
  const reviewedBy = status === "open" ? null : adminUid;
  const { data, error } = await sb
    .from("ai_reports")
    .update({ status, reviewed_at: reviewed, reviewed_by: reviewedBy })
    .eq("id", reportId)
    .select("id,uid,status,reviewed_at,reviewed_by")
    .single();
  if (error) throw error;
  const { error: auditError } = await sb.from("admin_audit_log").insert({
    admin_uid: adminUid,
    action: "report_status_update",
    target_type: "ai_report",
    target_id: reportId,
    metadata: { status },
  });
  if (auditError) throw auditError;
  return data;
}

async function updateUserAccount(
  idToken: string,
  adminUid: string,
  targetUid: string,
  name?: string,
  phone?: string,
) {
  if (!targetUid) throw new Error("target_uid_required");
  const values: Record<string, unknown> = {};
  if (typeof name === "string") values["account.name"] = name.trim().slice(0, 120);
  if (typeof phone === "string") values["account.phone"] = phone.trim().slice(0, 40);
  if (!Object.keys(values).length) throw new Error("no_account_changes");
  values.updatedAt = new Date().toISOString();
  await firestorePatchUser(idToken, targetUid, values);
  const { error } = await sb.from("admin_audit_log").insert({
    admin_uid: adminUid,
    action: "user_account_update",
    target_type: "firebase_user",
    target_id: targetUid,
    metadata: { fields: Object.keys(values).filter((key) => key !== "updatedAt") },
  });
  if (error) throw error;
  return { ok: true };
}

async function updateUserAdminEntitlements(
  idToken: string,
  adminUid: string,
  targetUid: string,
  changes: any,
) {
  if (!targetUid || !changes || typeof changes !== "object") throw new Error("invalid_entitlement_change");
  const allowed = ["trainingPro", "nutritionPro", "aiCoachPro"];
  if (!allowed.some((key) => Object.prototype.hasOwnProperty.call(changes, key))) {
    throw new Error("no_entitlement_change");
  }

  const doc = await firestoreGetUser(idToken, targetUid);
  const current = firestoreAdminEntitlements(doc || {});
  const next = {
    trainingPro: current.trainingPro,
    nutritionPro: current.nutritionPro,
    aiCoachPro: current.aiCoachPro,
    proExpiresAt: current.proExpiresAt,
  };
  for (const key of allowed) {
    if (changes[key] !== undefined) next[key] = changes[key] === true;
  }

  const anyEnabled = next.trainingPro || next.nutritionPro || next.aiCoachPro;
  if (anyEnabled) {
    const requested = typeof changes.proExpiresAt === "string" ? changes.proExpiresAt.trim() : "";
    const requestedMs = requested ? Date.parse(`${requested}T23:59:59.999Z`) : NaN;
    if (requested && Number.isFinite(requestedMs) && requestedMs > Date.now()) {
      next.proExpiresAt = requested;
    } else if (changes.proExpiresAt === null) {
      throw new Error("admin_expiry_required");
    } else {
      const currentMs = next.proExpiresAt ? Date.parse(`${next.proExpiresAt}T23:59:59.999Z`) : NaN;
      if (!Number.isFinite(currentMs) || currentMs <= Date.now()) throw new Error("admin_expiry_required");
      next.proExpiresAt = next.proExpiresAt;
    }
  } else {
    next.proExpiresAt = null;
  }

  await firestorePatchUser(idToken, targetUid, {
    "adminEntitlements.trainingPro": next.trainingPro,
    "adminEntitlements.nutritionPro": next.nutritionPro,
    "adminEntitlements.aiCoachPro": next.aiCoachPro,
    "adminEntitlements.proExpiresAt": next.proExpiresAt,
    updatedAt: new Date().toISOString(),
  });

  const { error } = await sb.from("admin_audit_log").insert({
    admin_uid: adminUid,
    action: "admin_entitlement_update",
    target_type: "firebase_user",
    target_id: targetUid,
    metadata: { changes, next },
  });
  if (error) throw error;
  return next;
}

async function sendNotification(
  idToken: string,
  adminUid: string,
  targetUid: string,
  title: string,
  body: string,
) {
  title = title.trim().slice(0, 100);
  body = body.trim().slice(0, 1000);
  if (!targetUid || !title || !body) throw new Error("notification_fields_required");
  await firestoreCreateNotification(idToken, targetUid, title, body);
  const { error } = await sb.from("admin_audit_log").insert({
    admin_uid: adminUid,
    action: "send_notification",
    target_type: "firebase_user",
    target_id: targetUid,
    metadata: { titleLength: title.length, bodyLength: body.length },
  });
  if (error) throw error;
  return { ok: true };
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: headersFor(req) });
  if (req.method !== "POST") return json(req, 405, { error: "method_not_allowed" });
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) return json(req, 500, { error: "backend_error" });

  const match = (req.headers.get("Authorization") || "").match(/^Bearer\s+(.+)$/i);
  if (!match) return json(req, 401, { error: "unauthenticated" });
  const idToken = match[1].trim();

  let adminUid = "";
  try {
    adminUid = await verifyFirebaseIdToken(idToken);
    if (!(await assertAdmin(idToken, adminUid))) return json(req, 403, { error: "forbidden" });
  } catch (error) {
    console.error("admin authentication failed", error);
    return json(req, 401, { error: "unauthenticated" });
  }

  let body: Record<string, unknown> = {};
  try {
    body = await req.json();
  } catch {
    return json(req, 400, { error: "bad_request" });
  }

  const action = String(body.action || "");
  try {
    switch (action) {
      case "overview":
        return json(req, 200, { ok: true, data: await overview() });
      case "users_search":
        return json(req, 200, {
          ok: true,
          data: await searchUsers(idToken, String(body.email || "")),
        });
      case "reports_list":
        return json(req, 200, {
          ok: true,
          data: await recentReports(body.status ? String(body.status) : null, Number(body.limit || 50)),
        });
      case "billing_recent":
        return json(req, 200, { ok: true, data: await recentBilling(Number(body.limit || 50)) });
      case "audit_recent":
        return json(req, 200, { ok: true, data: await recentAudit(Number(body.limit || 50)) });
      case "report_update":
        return json(req, 200, {
          ok: true,
          data: await updateReport(adminUid, String(body.reportId || ""), String(body.status || "")),
        });
      case "user_account_update":
        return json(req, 200, {
          ok: true,
          data: await updateUserAccount(
            idToken,
            adminUid,
            String(body.targetUid || ""),
            typeof body.name === "string" ? body.name : undefined,
            typeof body.phone === "string" ? body.phone : undefined,
          ),
        });
      case "user_pro_update":
        return json(req, 200, {
          ok: true,
          data: await updateUserAdminEntitlements(idToken, adminUid, String(body.targetUid || ""), {
            trainingPro: body.trainingPro,
            nutritionPro: body.nutritionPro,
            aiCoachPro: body.aiCoachPro,
            proExpiresAt: body.proExpiresAt,
          }),
        });
      case "send_notification":
        return json(req, 200, {
          ok: true,
          data: await sendNotification(
            idToken,
            adminUid,
            String(body.targetUid || ""),
            String(body.title || ""),
            String(body.message || ""),
          ),
        });
      default:
        return json(req, 400, { error: "unknown_action" });
    }
  } catch (error) {
    console.error("admin-api action failed", {
      action,
      adminUid,
      error: String(error),
    });
    return json(req, 500, { error: "backend_error" });
  }
});
