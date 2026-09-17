import React, { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  Bell,
  CheckCircle2,
  ChevronRight,
  Clock3,
  Crown,
  Database,
  FileText,
  RefreshCcw,
  Search,
  ShieldCheck,
  UserCheck,
  Users,
  XCircle,
} from "lucide-react";
import adminApi from "./adminApi";

const Card = ({ children, style }) => (
  <div
    style={{
      border: "1px solid rgba(128,128,128,.22)",
      borderRadius: 18,
      background: "rgba(255,255,255,.035)",
      padding: 16,
      ...style,
    }}
  >
    {children}
  </div>
);

const Btn = ({ children, onClick, disabled, tone = "normal", style }) => (
  <button
    type="button"
    onClick={onClick}
    disabled={disabled}
    style={{
      minHeight: 40,
      borderRadius: 12,
      border: `1px solid ${tone === "danger" ? "rgba(239,68,68,.45)" : tone === "success" ? "rgba(34,197,94,.38)" : "rgba(128,128,128,.25)"}`,
      background: "transparent",
      color: tone === "danger" ? "#ef4444" : tone === "success" ? "#22c55e" : "inherit",
      padding: "9px 13px",
      fontWeight: 800,
      cursor: disabled ? "not-allowed" : "pointer",
      opacity: disabled ? 0.55 : 1,
      display: "inline-flex",
      alignItems: "center",
      justifyContent: "center",
      gap: 7,
      ...style,
    }}
  >
    {children}
  </button>
);

const Input = ({ style, ...props }) => (
  <input
    {...props}
    style={{
      boxSizing: "border-box",
      width: "100%",
      minHeight: 42,
      padding: "9px 12px",
      borderRadius: 12,
      border: "1px solid rgba(128,128,128,.22)",
      background: "transparent",
      color: "inherit",
      outline: "none",
      ...style,
    }}
  />
);

const Stat = ({ icon: Icon, label, value, hint }) => (
  <Card>
    <div style={{ display: "flex", justifyContent: "space-between", gap: 10 }}>
      <div>
        <div style={{ fontSize: 12, opacity: 0.6 }}>{label}</div>
        <div style={{ fontSize: 30, fontWeight: 900, marginTop: 7 }}>{value}</div>
        {hint ? <div style={{ fontSize: 10.5, opacity: 0.45, marginTop: 4 }}>{hint}</div> : null}
      </div>
      <Icon size={19} />
    </div>
  </Card>
);

const dateText = (value) => {
  const date = new Date(value);
  return Number.isFinite(date.getTime()) ? date.toLocaleString() : "—";
};

const dateOnlyText = (value) => {
  const date = new Date(value);
  return Number.isFinite(date.getTime()) ? date.toISOString().slice(0, 10) : "—";
};

const uidText = (value) => {
  const text = String(value || "");
  return text.length < 18 ? text : `${text.slice(0, 8)}…${text.slice(-7)}`;
};

const PRODUCT_KEYS = ["trainingPro", "nutritionPro", "aiCoachPro"];

const PRODUCT_LABELS = {
  trainingPro: { ar: "Training Pro", en: "Training Pro" },
  nutritionPro: { ar: "Nutrition Pro", en: "Nutrition Pro" },
  aiCoachPro: { ar: "AI Coach Pro", en: "AI Coach Pro" },
};

function normalizeSupportEntitlements(raw) {
  const value = raw && typeof raw === "object" ? raw : {};
  const expiry = value.proExpiresAt ? String(value.proExpiresAt).trim() : "";
  const expiryMs = expiry ? Date.parse(`${expiry}T23:59:59.999Z`) : NaN;
  const active = !expiry || !Number.isFinite(expiryMs) || expiryMs > Date.now();
  return {
    trainingPro: active && value.trainingPro === true,
    nutritionPro: active && value.nutritionPro === true,
    aiCoachPro: active && value.aiCoachPro === true,
    proExpiresAt: active && expiry ? expiry : null,
  };
}

function effectiveEntitlements(data) {
  const paid = data?.entitlements || {};
  const support = normalizeSupportEntitlements(data?.adminEntitlements);
  return {
    trainingPro: !!paid.trainingPro || support.trainingPro,
    nutritionPro: !!paid.nutritionPro || support.nutritionPro,
    aiCoachPro: !!paid.aiCoachPro || support.aiCoachPro,
  };
}

export default function AdminDashboard({ C, lang, back, showToast }) {
  const ar = lang === "ar";
  const [tab, setTab] = useState("overview");
  const [filter, setFilter] = useState("open");
  const [overview, setOverview] = useState(null);
  const [reports, setReports] = useState([]);
  const [billing, setBilling] = useState([]);
  const [audit, setAudit] = useState([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [lastUpdated, setLastUpdated] = useState(null);

  const [email, setEmail] = useState("");
  const [user, setUser] = useState(null);
  const [notFound, setNotFound] = useState(false);
  const [searching, setSearching] = useState(false);
  const [saving, setSaving] = useState(false);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [support, setSupport] = useState(normalizeSupportEntitlements(null));
  const [noteTitle, setNoteTitle] = useState("");
  const [noteBody, setNoteBody] = useState("");

  const load = async () => {
    setBusy(true);
    setError("");
    try {
      const [nextOverview, nextReports, nextBilling, nextAudit] = await Promise.all([
        adminApi.overview(),
        adminApi.reports(filter, 50),
        adminApi.billing(50),
        adminApi.audit(50),
      ]);
      setOverview(nextOverview || null);
      setReports(nextReports || []);
      setBilling(nextBilling || []);
      setAudit(nextAudit || []);
      setLastUpdated(new Date());
    } catch (err) {
      console.error(err);
      setError(String(err?.message || "Admin data could not be loaded"));
    } finally {
      setBusy(false);
    }
  };

  useEffect(() => {
    load();
  }, [filter]);

  const searchUser = async () => {
    const query = email.trim().toLowerCase();
    if (!query.includes("@")) {
      showToast(ar ? "اكتب بريدًا إلكترونيًا صحيحًا" : "Enter a valid email");
      return;
    }
    setSearching(true);
    setNotFound(false);
    try {
      const rows = await adminApi.searchUsers(query);
      const result = Array.isArray(rows) ? rows[0] : null;
      if (!result) {
        setUser(null);
        setNotFound(true);
        return;
      }
      setUser(result);
      setName(result.data?.account?.name || "");
      setPhone(result.data?.account?.phone || "");
      setSupport(normalizeSupportEntitlements(result.data?.adminEntitlements));
    } catch (err) {
      console.error(err);
      showToast(ar ? "فشل البحث عن المستخدم" : "User search failed");
    } finally {
      setSearching(false);
    }
  };

  const saveUser = async () => {
    if (!user) return;
    setSaving(true);
    try {
      await adminApi.updateUserAccount(user.uid, name, phone);
      setUser((current) => ({
        ...current,
        data: {
          ...current.data,
          account: {
            ...(current.data?.account || {}),
            name: name.trim(),
            phone: phone.trim(),
          },
        },
      }));
      showToast(ar ? "تم حفظ بيانات الحساب" : "User details saved");
      await load();
    } catch (err) {
      console.error(err);
      showToast(ar ? "فشل حفظ بيانات الحساب" : "Account save failed");
    } finally {
      setSaving(false);
    }
  };

  const saveSupportEntitlements = async () => {
    if (!user) return;
    setSaving(true);
    try {
      const next = await adminApi.updateUserEntitlements(user.uid, {
        trainingPro: !!support.trainingPro,
        nutritionPro: !!support.nutritionPro,
        aiCoachPro: !!support.aiCoachPro,
        proExpiresAt: support.proExpiresAt || null,
      });
      const normalized = normalizeSupportEntitlements(next);
      setSupport(normalized);
      setUser((current) => ({
        ...current,
        data: { ...current.data, adminEntitlements: normalized },
      }));
      showToast(ar ? "تم تحديث دعم Pro" : "Support entitlements updated");
      await load();
    } catch (err) {
      console.error(err);
      showToast(ar ? "فشل تحديث صلاحيات الدعم" : "Support entitlement update failed");
    } finally {
      setSaving(false);
    }
  };

  const notify = async () => {
    if (!user) return;
    const title = noteTitle.trim();
    const message = noteBody.trim();
    if (!title || !message) return;
    setSaving(true);
    try {
      await adminApi.sendNotification(user.uid, title, message);
      setNoteTitle("");
      setNoteBody("");
      showToast(ar ? "تم إرسال الإشعار" : "Notification sent");
      await load();
    } catch (err) {
      console.error(err);
      showToast(ar ? "فشل إرسال الإشعار" : "Notification failed");
    } finally {
      setSaving(false);
    }
  };

  const updateReport = async (id, status) => {
    try {
      await adminApi.updateReport(id, status);
      setReports(await adminApi.reports(filter, 50));
      setOverview(await adminApi.overview());
      showToast(ar ? "تم تحديث البلاغ" : "Report updated");
    } catch (err) {
      console.error(err);
      showToast(ar ? "فشل تحديث البلاغ" : "Report update failed");
    }
  };

  const supportExpiry = support.proExpiresAt || "";
  const purchased = user?.data?.entitlements || {};
  const effective = useMemo(() => effectiveEntitlements(user?.data), [user]);
  const stats = overview?.stats || {};
  const tabs = [
    ["overview", ar ? "نظرة عامة" : "Overview"],
    ["users", ar ? "المستخدمون" : "Users"],
    ["reports", ar ? "بلاغات AI" : "AI Reports"],
    ["billing", ar ? "المدفوعات" : "Billing"],
    ["audit", ar ? "سجل الإدارة" : "Audit"],
  ];

  return (
    <div dir={ar ? "rtl" : "ltr"} style={{ paddingBottom: 34 }}>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          gap: 12,
          padding: "18px 18px 12px",
          position: "sticky",
          top: 0,
          zIndex: 5,
          background: C.bg,
          borderBottom: "1px solid rgba(128,128,128,.12)",
        }}
      >
        <div>
          <div style={{ fontSize: 11, opacity: 0.5, fontWeight: 800, letterSpacing: 0.7 }}>
            FIFTY FIT CONTROL CENTER
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 24, fontWeight: 900, marginTop: 4 }}>
            <ShieldCheck size={21} />
            {ar ? "لوحة الإدارة" : "Admin Console"}
          </div>
          <div style={{ fontSize: 10.5, opacity: 0.45, marginTop: 4 }}>
            {ar ? "عمليات مؤمنة + سجل تدقيق" : "Authorized operations + audit trail"}
          </div>
        </div>
        <div style={{ display: "flex", gap: 7 }}>
          <Btn onClick={load} disabled={busy} aria-label={ar ? "تحديث" : "Refresh"}>
            <RefreshCcw size={17} />
          </Btn>
          <Btn onClick={back}>{ar ? "رجوع" : "Back"}</Btn>
        </div>
      </div>

      <div style={{ padding: "14px 18px 0" }}>
        {error ? (
          <Card style={{ marginBottom: 12, borderColor: "rgba(239,68,68,.35)" }}>
            <div style={{ display: "flex", gap: 9, alignItems: "flex-start" }}>
              <AlertTriangle size={18} color="#ef4444" />
              <div>
                <b>{ar ? "تعذر تحميل بيانات الإدارة" : "Admin data unavailable"}</b>
                <div style={{ fontSize: 12, opacity: 0.6, marginTop: 4 }}>{error}</div>
              </div>
            </div>
          </Card>
        ) : null}

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(160px,1fr))", gap: 9, marginBottom: 12 }}>
          <Stat icon={AlertTriangle} label={ar ? "بلاغات مفتوحة" : "Open reports"} value={stats.openReports ?? "—"} hint={`${stats.reports7d ?? 0} / 7d`} />
          <Stat icon={Crown} label={ar ? "صلاحيات نشطة" : "Active entitlements"} value={stats.activeEntitlements ?? "—"} />
          <Stat icon={Users} label={ar ? "رسائل AI اليوم" : "AI messages today"} value={stats.aiMessagesToday ?? "—"} />
          <Stat icon={Database} label={ar ? "أحداث الدفع 24س" : "Billing events 24h"} value={stats.billing24h ?? "—"} hint={`${stats.audit7d ?? 0} audit / 7d`} />
        </div>

        <div style={{ display: "flex", gap: 7, overflowX: "auto", marginBottom: 12 }}>
          {tabs.map(([id, label]) => (
            <button
              key={id}
              type="button"
              onClick={() => setTab(id)}
              style={{
                flex: "0 0 auto",
                border: `1px solid ${tab === id ? "rgba(255,255,255,.6)" : "rgba(128,128,128,.22)"}`,
                background: tab === id ? "rgba(255,255,255,.08)" : "transparent",
                color: "inherit",
                borderRadius: 999,
                padding: "9px 13px",
                fontSize: 12,
                fontWeight: 850,
              }}
            >
              {label}
            </button>
          ))}
        </div>

        {tab === "overview" ? (
          <div style={{ display: "grid", gap: 11 }}>
            <Card>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "center" }}>
                <div>
                  <div style={{ fontWeight: 900 }}>{ar ? "حالة العمليات" : "Operations status"}</div>
                  <div style={{ fontSize: 11, opacity: 0.5, marginTop: 4 }}>
                    {lastUpdated ? `${ar ? "آخر تحديث" : "Updated"}: ${lastUpdated.toLocaleTimeString()}` : ar ? "لم يتم التحديث بعد" : "Waiting for first refresh"}
                  </div>
                </div>
                <ShieldCheck size={19} />
              </div>
              <div style={{ display: "grid", gap: 8, marginTop: 14 }}>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12.5 }}>
                  <span>{ar ? "حالة API الإدارة" : "Admin API"}</span>
                  <b>{error ? "DEGRADED" : "READY"}</b>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12.5 }}>
                  <span>{ar ? "بلاغات آخر 7 أيام" : "AI reports / 7d"}</span>
                  <b>{stats.reports7d ?? "—"}</b>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12.5 }}>
                  <span>{ar ? "إجراءات الإدارة / 7 أيام" : "Admin actions / 7d"}</span>
                  <b>{stats.audit7d ?? "—"}</b>
                </div>
              </div>
            </Card>

            <Card>
              <div style={{ fontWeight: 900 }}>{ar ? "الصلاحيات حسب المنتج" : "Active entitlements by product"}</div>
              <div style={{ display: "grid", gap: 8, marginTop: 12 }}>
                {Object.entries(overview?.activeEntitlementsByProduct || {}).length ? (
                  Object.entries(overview?.activeEntitlementsByProduct || {}).map(([key, value]) => (
                    <div key={key} style={{ display: "flex", justifyContent: "space-between", fontSize: 12.5 }}>
                      <span>{key}</span>
                      <b>{value}</b>
                    </div>
                  ))
                ) : (
                  <div style={{ fontSize: 12, opacity: 0.5 }}>{ar ? "لا توجد بيانات مدفوعة نشطة" : "No active paid entitlements"}</div>
                )}
              </div>
            </Card>

            <Card>
              <div style={{ display: "flex", gap: 8, alignItems: "center", fontWeight: 900 }}>
                <FileText size={17} />
                {ar ? "آخر بلاغات AI" : "Latest AI reports"}
              </div>
              {reports.slice(0, 5).map((report) => (
                <div key={report.id} style={{ borderTop: "1px solid rgba(128,128,128,.14)", paddingTop: 10, marginTop: 10 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
                    <b style={{ fontSize: 12 }}>{report.reason}</b>
                    <span style={{ fontSize: 10, opacity: 0.5 }}>{dateText(report.created_at)}</span>
                  </div>
                  <div style={{ fontSize: 11.5, opacity: 0.65, marginTop: 4, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                    {report.response_text}
                  </div>
                </div>
              ))}
              {!reports.length ? <div style={{ fontSize: 12, opacity: 0.5, marginTop: 10 }}>{ar ? "لا توجد بلاغات" : "No reports"}</div> : null}
            </Card>
          </div>
        ) : null}

        {tab === "users" ? (
          <div style={{ display: "grid", gap: 11 }}>
            <Card>
              <div style={{ fontWeight: 900 }}>{ar ? "بحث ودعم المستخدم" : "User support workspace"}</div>
              <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
                <div style={{ position: "relative", flex: 1 }}>
                  <Search size={16} style={{ position: "absolute", left: 12, top: 13, opacity: 0.5 }} />
                  <Input
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    onKeyDown={(event) => event.key === "Enter" && searchUser()}
                    placeholder={ar ? "البحث بالبريد الإلكتروني" : "Search by email"}
                    style={{ paddingLeft: 36 }}
                  />
                </div>
                <Btn onClick={searchUser} disabled={searching}>
                  {searching ? "…" : ar ? "بحث" : "Search"}
                </Btn>
              </div>
              {notFound ? <div style={{ fontSize: 12, opacity: 0.55, marginTop: 8 }}>{ar ? "لا يوجد مستخدم بهذا البريد." : "No user found for this email."}</div> : null}
            </Card>

            {user ? (
              <>
                <Card>
                  <div style={{ display: "flex", justifyContent: "space-between", gap: 10 }}>
                    <div>
                      <div style={{ fontSize: 19, fontWeight: 900 }}>{user.data?.account?.name || "—"}</div>
                      <div style={{ fontSize: 12, opacity: 0.58 }}>{user.data?.account?.email || email}</div>
                      <div style={{ fontSize: 10, opacity: 0.4, marginTop: 3 }}>UID: {uidText(user.uid)}</div>
                    </div>
                    <UserCheck size={20} />
                  </div>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 7, marginTop: 12 }}>
                    {PRODUCT_KEYS.map((key) => (
                      <span key={key} style={{ border: "1px solid rgba(128,128,128,.2)", borderRadius: 999, padding: "6px 9px", fontSize: 10.5 }}>
                        {PRODUCT_LABELS[key][ar ? "ar" : "en"]}: {effective[key] ? "ACTIVE" : "OFF"}
                      </span>
                    ))}
                  </div>
                </Card>

                <Card>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
                    <div>
                      <b>{ar ? "مشتريات Google Play" : "Google Play entitlements"}</b>
                      <div style={{ fontSize: 11, opacity: 0.48, marginTop: 4 }}>{ar ? "مصدر الدفع الفعلي — للعرض فقط" : "Purchase-backed state — read only"}</div>
                    </div>
                    <Crown size={18} />
                  </div>
                  <div style={{ display: "grid", gap: 8, marginTop: 12 }}>
                    {PRODUCT_KEYS.map((key) => (
                      <div key={key} style={{ display: "flex", justifyContent: "space-between", fontSize: 12.5 }}>
                        <span>{PRODUCT_LABELS[key][ar ? "ar" : "en"]}</span>
                        <b>{purchased[key] ? "ACTIVE" : "OFF"}</b>
                      </div>
                    ))}
                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11.5, opacity: 0.58 }}>
                      <span>{ar ? "انتهاء الاشتراك" : "Subscription expiry"}</span>
                      <span>{purchased.proExpiresAt ? dateOnlyText(purchased.proExpiresAt) : "—"}</span>
                    </div>
                  </div>
                </Card>

                <Card>
                  <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "center" }}>
                    <div>
                      <b>{ar ? "دعم Pro من الإدارة" : "Admin support entitlements"}</b>
                      <div style={{ fontSize: 11, opacity: 0.48, marginTop: 4 }}>{ar ? "منفصل عن مشتريات Google Play ولا يكتب فوقها" : "Separate from Google Play purchases and does not overwrite them"}</div>
                    </div>
                    <ShieldCheck size={18} />
                  </div>

                  <div style={{ display: "grid", gap: 8, marginTop: 12 }}>
                    {PRODUCT_KEYS.map((key) => (
                      <label key={key} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, border: "1px solid rgba(128,128,128,.18)", borderRadius: 12, padding: "9px 11px", fontSize: 12 }}>
                        <span>{PRODUCT_LABELS[key][ar ? "ar" : "en"]}</span>
                        <input
                          type="checkbox"
                          checked={!!support[key]}
                          onChange={(event) => setSupport((current) => ({ ...current, [key]: event.target.checked }))}
                        />
                      </label>
                    ))}
                    <Input
                      type="date"
                      value={supportExpiry}
                      onChange={(event) => setSupport((current) => ({ ...current, proExpiresAt: event.target.value || null }))}
                    />
                    <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                      <Btn tone="success" disabled={saving} onClick={saveSupportEntitlements}>
                        <CheckCircle2 size={15} />
                        {ar ? "حفظ دعم Pro" : "Save support"}
                      </Btn>
                      <Btn
                        tone="danger"
                        disabled={saving}
                        onClick={() => setSupport({ trainingPro: false, nutritionPro: false, aiCoachPro: false, proExpiresAt: null })}
                      >
                        <XCircle size={15} />
                        {ar ? "تجهيز للإلغاء" : "Clear support"}
                      </Btn>
                    </div>
                  </div>
                </Card>

                <Card>
                  <b>{ar ? "بيانات الحساب" : "Account details"}</b>
                  <div style={{ display: "grid", gap: 8, marginTop: 10 }}>
                    <Input value={name} onChange={(event) => setName(event.target.value)} placeholder={ar ? "الاسم" : "Name"} maxLength={120} />
                    <Input value={phone} onChange={(event) => setPhone(event.target.value)} placeholder={ar ? "الهاتف" : "Phone"} maxLength={40} />
                    <Btn onClick={saveUser} disabled={saving}>
                      {ar ? "حفظ" : "Save"}
                    </Btn>
                  </div>
                </Card>

                <Card>
                  <div style={{ display: "flex", gap: 8, alignItems: "center", fontWeight: 900 }}>
                    <Bell size={17} />
                    {ar ? "إشعار مباشر" : "Direct notification"}
                  </div>
                  <div style={{ display: "grid", gap: 8, marginTop: 10 }}>
                    <Input value={noteTitle} onChange={(event) => setNoteTitle(event.target.value)} placeholder={ar ? "عنوان الإشعار" : "Notification title"} maxLength={100} />
                    <textarea
                      value={noteBody}
                      onChange={(event) => setNoteBody(event.target.value)}
                      placeholder={ar ? "نص الإشعار" : "Notification message"}
                      maxLength={1000}
                      rows={4}
                      style={{ padding: 10, borderRadius: 12, border: "1px solid rgba(128,128,128,.22)", background: "transparent", color: "inherit", resize: "vertical" }}
                    />
                    <Btn onClick={notify} disabled={saving || !noteTitle.trim() || !noteBody.trim()}>
                      {ar ? "إرسال" : "Send"}
                    </Btn>
                  </div>
                </Card>
              </>
            ) : (
              <Card>
                <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                  <Users size={18} />
                  <div style={{ fontSize: 12, opacity: 0.58 }}>{ar ? "ابحث عن مستخدم للبدء." : "Search a user to open the support workspace."}</div>
                </div>
              </Card>
            )}
          </div>
        ) : null}

        {tab === "reports" ? (
          <div style={{ display: "grid", gap: 9 }}>
            <div style={{ display: "flex", gap: 7, flexWrap: "wrap" }}>
              {["open", "reviewed", "dismissed"].map((status) => (
                <Btn key={status} onClick={() => setFilter(status)} style={{ opacity: filter === status ? 1 : 0.65 }}>
                  {status === "open" ? (ar ? "مفتوح" : "Open") : status === "reviewed" ? (ar ? "تمت المراجعة" : "Reviewed") : ar ? "متجاهل" : "Dismissed"}
                </Btn>
              ))}
            </div>
            {reports.map((report) => (
              <Card key={report.id}>
                <div style={{ display: "flex", justifyContent: "space-between", gap: 8, alignItems: "flex-start" }}>
                  <div>
                    <b>{report.reason}</b>
                    <div style={{ fontSize: 10.5, opacity: 0.45, marginTop: 4 }}>
                      {uidText(report.uid)} · {report.lang?.toUpperCase() || "EN"} · {report.model || "unknown"}
                    </div>
                  </div>
                  <span style={{ fontSize: 10, opacity: 0.5 }}>{dateText(report.created_at)}</span>
                </div>
                <div style={{ fontSize: 12.5, lineHeight: 1.55, marginTop: 9, whiteSpace: "pre-wrap" }}>{report.response_text}</div>
                <div style={{ display: "flex", gap: 7, flexWrap: "wrap", marginTop: 10 }}>
                  {report.status !== "reviewed" ? (
                    <Btn tone="success" onClick={() => updateReport(report.id, "reviewed")}>
                      <CheckCircle2 size={15} />
                      {ar ? "مراجعة" : "Mark reviewed"}
                    </Btn>
                  ) : null}
                  {report.status !== "dismissed" ? (
                    <Btn tone="danger" onClick={() => updateReport(report.id, "dismissed")}>
                      <XCircle size={15} />
                      {ar ? "تجاهل" : "Dismiss"}
                    </Btn>
                  ) : null}
                  {report.status !== "open" ? (
                    <Btn onClick={() => updateReport(report.id, "open")}>
                      <Clock3 size={15} />
                      {ar ? "إعادة فتح" : "Re-open"}
                    </Btn>
                  ) : null}
                </div>
              </Card>
            ))}
            {!reports.length ? <Card><div style={{ fontSize: 12, opacity: 0.5 }}>{ar ? "لا توجد بلاغات في هذه الحالة." : "No reports in this state."}</div></Card> : null}
          </div>
        ) : null}

        {tab === "billing" ? (
          <div style={{ display: "grid", gap: 8 }}>
            {billing.map((event) => (
              <Card key={event.id} style={{ padding: 13 }}>
                <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
                  <b style={{ fontSize: 12 }}>{event.event_type}</b>
                  <span style={{ fontSize: 10, opacity: 0.5 }}>{dateText(event.created_at)}</span>
                </div>
                <div style={{ fontSize: 11, opacity: 0.6, marginTop: 5 }}>{event.product_key} · {event.purchase_state || "—"}</div>
                <div style={{ fontSize: 10.5, opacity: 0.45, marginTop: 3 }}>
                  {uidText(event.uid)} · {event.expires_at ? dateText(event.expires_at) : ar ? "بدون انتهاء" : "no expiry"}
                </div>
              </Card>
            ))}
            {!billing.length ? <Card><div style={{ fontSize: 12, opacity: 0.5 }}>{ar ? "لا توجد أحداث دفع حديثة." : "No recent billing events."}</div></Card> : null}
          </div>
        ) : null}

        {tab === "audit" ? (
          <div style={{ display: "grid", gap: 8 }}>
            {audit.map((event) => (
              <Card key={event.id} style={{ padding: 13 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <ShieldCheck size={16} />
                  <b style={{ fontSize: 12 }}>{event.action}</b>
                  <span style={{ marginInlineStart: "auto", fontSize: 10, opacity: 0.45 }}>{dateText(event.created_at)}</span>
                </div>
                <div style={{ fontSize: 10.5, opacity: 0.5, marginTop: 4 }}>{event.target_type} · {uidText(event.target_id)}</div>
                {event.metadata ? <div style={{ fontSize: 10, opacity: 0.38, marginTop: 4, whiteSpace: "pre-wrap" }}>{JSON.stringify(event.metadata)}</div> : null}
              </Card>
            ))}
            {!audit.length ? <Card><div style={{ fontSize: 12, opacity: 0.5 }}>{ar ? "لا توجد سجلات تدقيق حديثة." : "No recent audit events."}</div></Card> : null}
          </div>
        ) : null}

        {tab !== "users" && user ? (
          <button
            type="button"
            onClick={() => setTab("users")}
            style={{ marginTop: 14, width: "100%", border: "1px solid rgba(128,128,128,.16)", background: "transparent", color: "inherit", borderRadius: 12, padding: "10px 12px", fontSize: 11, display: "flex", alignItems: "center", justifyContent: "space-between" }}
          >
            <span>{ar ? `المستخدم الحالي: ${user.data?.account?.email || user.uid}` : `Current user: ${user.data?.account?.email || user.uid}`}</span>
            <ChevronRight size={15} />
          </button>
        ) : null}
      </div>
    </div>
  );
}
