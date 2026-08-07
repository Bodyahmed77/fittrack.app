import React, { useCallback, useEffect, useMemo, useState } from "react";
import { createRoot } from "react-dom/client";
import {
  collection,
  doc,
  getDoc,
  getDocs,
  limit,
  query,
} from "firebase/firestore";
import { onAuthStateChanged, signOut } from "firebase/auth";
import { auth, db } from "../firebase";
import "./styles.css";

const copy = {
  en: {
    brand: "Fifty Fit Admin",
    subtitle: "Private management dashboard",
    loginTitle: "Admin sign in",
    loginBody: "Sign in with the Google/Firebase account that was granted admin access.",
    signIn: "Sign in",
    signingIn: "Use the normal Fifty Fit sign-in flow, then open this page again.",
    denied: "This account is not an administrator.",
    loading: "Loading…",
    refresh: "Refresh",
    logout: "Sign out",
    overview: "Overview",
    users: "Users",
    subscriptions: "Subscriptions",
    search: "Search by name or email",
    totalUsers: "Total users",
    training: "Training Pro",
    nutrition: "Nutrition Pro",
    both: "Both",
    active: "Active",
    expired: "Expired",
    noSubscription: "No subscription",
    details: "User details",
    name: "Name",
    email: "Email",
    uid: "UID",
    age: "Age",
    height: "Height",
    weight: "Weight",
    goal: "Goal",
    language: "Language",
    created: "Created",
    updated: "Updated",
    status: "Status",
    close: "Close",
    empty: "No users found.",
    security: "Security",
    securityBody: "Admin access is enforced by Firestore rules. This page never grants admin access by itself.",
    limitNote: "Showing up to 200 users in this MVP dashboard.",
    toggle: "العربية",
    unknown: "Unknown",
    unavailable: "Unavailable",
  },
  ar: {
    brand: "لوحة إدارة Fifty Fit",
    subtitle: "لوحة إدارة خاصة",
    loginTitle: "تسجيل دخول الأدمن",
    loginBody: "سجّل الدخول بالحساب الذي تم منحه صلاحية الأدمن في Firebase.",
    signIn: "تسجيل الدخول",
    signingIn: "استخدم تسجيل الدخول المعتاد في Fifty Fit ثم افتح هذه الصفحة مرة أخرى.",
    denied: "هذا الحساب ليس لديه صلاحية أدمن.",
    loading: "جارٍ التحميل…",
    refresh: "تحديث",
    logout: "تسجيل الخروج",
    overview: "نظرة عامة",
    users: "المستخدمون",
    subscriptions: "الاشتراكات",
    search: "ابحث بالاسم أو البريد الإلكتروني",
    totalUsers: "إجمالي المستخدمين",
    training: "Training Pro",
    nutrition: "Nutrition Pro",
    both: "Both",
    active: "نشط",
    expired: "منتهي",
    noSubscription: "بدون اشتراك",
    details: "بيانات المستخدم",
    name: "الاسم",
    email: "البريد الإلكتروني",
    uid: "UID",
    age: "العمر",
    height: "الطول",
    weight: "الوزن",
    goal: "الهدف",
    language: "اللغة",
    created: "تاريخ الإنشاء",
    updated: "آخر تحديث",
    status: "الحالة",
    close: "إغلاق",
    empty: "لا يوجد مستخدمون.",
    security: "الأمان",
    securityBody: "صلاحية الأدمن يتم فرضها من Firestore Rules. هذه الصفحة وحدها لا تمنح أي شخص صلاحية أدمن.",
    limitNote: "يتم عرض أول 200 مستخدم كحد أقصى في نسخة لوحة الإدارة الحالية.",
    toggle: "English",
    unknown: "غير معروف",
    unavailable: "غير متاح",
  },
};

function valueOf(data, keys) {
  for (const key of keys) {
    const value = data?.[key];
    if (value !== undefined && value !== null && value !== "") return value;
  }
  return null;
}

function dateValue(value) {
  if (!value) return null;
  if (typeof value?.toDate === "function") return value.toDate();
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function formatDate(value, locale) {
  const date = dateValue(value);
  return date ? new Intl.DateTimeFormat(locale, { dateStyle: "medium" }).format(date) : "—";
}

function entitlement(data) {
  const training = Boolean(
    valueOf(data, ["trainingPro", "trainingProActive", "trainingPremium"]) ||
      data?.entitlements?.trainingPro === true,
  );
  const nutrition = Boolean(
    valueOf(data, ["nutritionPro", "nutritionProActive", "nutritionPremium"]) ||
      data?.entitlements?.nutritionPro === true,
  );
  if (training && nutrition) return "both";
  if (training) return "training";
  if (nutrition) return "nutrition";
  return "none";
}

function statusFromData(data) {
  const raw = valueOf(data, ["subscriptionStatus", "billingStatus", "status"]);
  if (typeof raw === "string") return raw.toLowerCase();
  return "unknown";
}

function App() {
  const [lang, setLang] = useState("en");
  const [authUser, setAuthUser] = useState(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [checkingAdmin, setCheckingAdmin] = useState(true);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState(null);
  const t = copy[lang];
  const locale = lang === "ar" ? "ar-EG" : "en-US";

  useEffect(() => {
    const saved = localStorage.getItem("fifty-fit-admin-lang");
    if (saved === "ar" || saved === "en") setLang(saved);
    return onAuthStateChanged(auth, async (user) => {
      setAuthUser(user);
      setCheckingAdmin(true);
      setError("");
      if (!user) {
        setIsAdmin(false);
        setCheckingAdmin(false);
        return;
      }
      try {
        const adminSnap = await getDoc(doc(db, "admins", user.uid));
        setIsAdmin(adminSnap.exists());
        if (!adminSnap.exists()) setError(t.denied);
      } catch (err) {
        console.error(err);
        setIsAdmin(false);
        setError("Admin access could not be verified.");
      } finally {
        setCheckingAdmin(false);
      }
    });
  }, []);

  const loadUsers = useCallback(async () => {
    if (!isAdmin) return;
    setLoading(true);
    setError("");
    try {
      const snap = await getDocs(query(collection(db, "users"), limit(200)));
      const rows = snap.docs.map((item) => ({ id: item.id, ...item.data() }));
      rows.sort((a, b) => {
        const da = dateValue(valueOf(a, ["updatedAt", "createdAt", "created"]));
        const db = dateValue(valueOf(b, ["updatedAt", "createdAt", "created"]));
        return (db?.getTime() || 0) - (da?.getTime() || 0);
      });
      setUsers(rows);
    } catch (err) {
      console.error(err);
      setError(err?.message || "Could not load users.");
    } finally {
      setLoading(false);
    }
  }, [isAdmin]);

  useEffect(() => {
    if (isAdmin) loadUsers();
  }, [isAdmin, loadUsers]);

  const stats = useMemo(() => {
    const counts = users.reduce(
      (acc, user) => {
        const plan = entitlement(user);
        acc.total += 1;
        acc[plan] += 1;
        return acc;
      },
      { total: 0, training: 0, nutrition: 0, both: 0, none: 0 },
    );
    return counts;
  }, [users]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return users;
    return users.filter((user) => {
      const name = String(valueOf(user, ["name", "displayName", "fullName"]) || "").toLowerCase();
      const email = String(valueOf(user, ["email"]) || "").toLowerCase();
      return name.includes(q) || email.includes(q) || user.id.toLowerCase().includes(q);
    });
  }, [users, search]);

  const setLanguage = (next) => {
    setLang(next);
    localStorage.setItem("fifty-fit-admin-lang", next);
  };

  if (checkingAdmin) return <Shell><Loading text={t.loading} /></Shell>;

  if (!authUser) {
    return (
      <Shell lang={lang} setLanguage={setLanguage} t={t}>
        <section className="auth-card">
          <div className="brand-mark">50</div>
          <h1>{t.loginTitle}</h1>
          <p>{t.loginBody}</p>
          <a className="primary-button" href="/">
            {t.signIn}
          </a>
          <p className="muted">{t.signingIn}</p>
        </section>
      </Shell>
    );
  }

  if (!isAdmin) {
    return (
      <Shell lang={lang} setLanguage={setLanguage} t={t}>
        <section className="auth-card">
          <div className="status-icon">!</div>
          <h1>{t.denied}</h1>
          <p>{error || t.denied}</p>
          <button className="secondary-button" onClick={() => signOut(auth)}>{t.logout}</button>
        </section>
      </Shell>
    );
  }

  return (
    <Shell lang={lang} setLanguage={setLanguage} t={t}>
      <header className="topbar">
        <div>
          <div className="eyebrow">{t.overview}</div>
          <h1>{t.brand}</h1>
          <p>{t.subtitle}</p>
        </div>
        <div className="top-actions">
          <button className="secondary-button" onClick={() => loadUsers()} disabled={loading}>{loading ? t.loading : t.refresh}</button>
          <button className="secondary-button" onClick={() => signOut(auth)}>{t.logout}</button>
        </div>
      </header>

      {error && <div className="error-banner">{error}</div>}

      <section className="stat-grid">
        <Stat title={t.totalUsers} value={stats.total} />
        <Stat title={t.training} value={stats.training} />
        <Stat title={t.nutrition} value={stats.nutrition} />
        <Stat title={t.both} value={stats.both} />
      </section>

      <section className="panel">
        <div className="panel-heading">
          <div>
            <h2>{t.users}</h2>
            <p>{t.limitNote}</p>
          </div>
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder={t.search} />
        </div>

        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>{t.name}</th>
                <th>{t.email}</th>
                <th>{t.status}</th>
                <th>{t.updated}</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((user) => {
                const plan = entitlement(user);
                return (
                  <tr key={user.id}>
                    <td className="strong">{valueOf(user, ["name", "displayName", "fullName"]) || t.unknown}</td>
                    <td>{valueOf(user, ["email"]) || "—"}</td>
                    <td><PlanBadge plan={plan} t={t} /></td>
                    <td>{formatDate(valueOf(user, ["updatedAt", "createdAt", "created"]), locale)}</td>
                    <td><button className="text-button" onClick={() => setSelected(user)}>{t.details}</button></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {!loading && filtered.length === 0 && <div className="empty">{t.empty}</div>}
        </div>
      </section>

      <section className="security-note">
        <strong>{t.security}</strong>
        <span>{t.securityBody}</span>
      </section>

      {selected && <UserModal user={selected} t={t} locale={locale} onClose={() => setSelected(null)} />}
    </Shell>
  );
}

function Shell({ children, lang = "en", setLanguage, t }) {
  return (
    <div className="app-shell" dir={lang === "ar" ? "rtl" : "ltr"}>
      {setLanguage && (
        <div className="language-switch">
          <button onClick={() => setLanguage(lang === "ar" ? "en" : "ar")}>{t.toggle}</button>
        </div>
      )}
      <main>{children}</main>
    </div>
  );
}

function Loading({ text }) {
  return <div className="loading"><div className="spinner" />{text}</div>;
}

function Stat({ title, value }) {
  return <article className="stat-card"><span>{title}</span><strong>{value}</strong></article>;
}

function PlanBadge({ plan, t }) {
  const label = plan === "training" ? t.training : plan === "nutrition" ? t.nutrition : plan === "both" ? t.both : t.noSubscription;
  return <span className={`badge ${plan}`}>{label}</span>;
}

function UserModal({ user, t, locale, onClose }) {
  const plan = entitlement(user);
  const status = statusFromData(user);
  return (
    <div className="modal-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <section className="modal-card" role="dialog" aria-modal="true">
        <div className="modal-head"><div><div className="eyebrow">{t.details}</div><h2>{valueOf(user, ["name", "displayName", "fullName"]) || t.unknown}</h2></div><button className="icon-button" onClick={onClose}>×</button></div>
        <div className="detail-grid">
          <Detail label={t.email} value={valueOf(user, ["email"]) || "—"} />
          <Detail label={t.uid} value={user.id} mono />
          <Detail label={t.age} value={valueOf(user, ["age"]) ?? "—"} />
          <Detail label={t.height} value={valueOf(user, ["height", "heightCm"]) ?? "—"} />
          <Detail label={t.weight} value={valueOf(user, ["weight", "weightKg"]) ?? "—"} />
          <Detail label={t.goal} value={valueOf(user, ["goal", "fitnessGoal"]) || "—"} />
          <Detail label={t.language} value={valueOf(user, ["language", "lang"]) || "—"} />
          <Detail label={t.status} value={status || t.unknown} />
          <Detail label={t.subscriptions} value={plan === "training" ? t.training : plan === "nutrition" ? t.nutrition : plan === "both" ? t.both : t.noSubscription} />
          <Detail label={t.created} value={formatDate(valueOf(user, ["createdAt", "created"]), locale)} />
          <Detail label={t.updated} value={formatDate(valueOf(user, ["updatedAt", "updated"]), locale)} />
        </div>
        <button className="secondary-button full" onClick={onClose}>{t.close}</button>
      </section>
    </div>
  );
}

function Detail({ label, value, mono }) {
  return <div className="detail"><span>{label}</span><strong className={mono ? "mono" : ""}>{String(value)}</strong></div>;
}

createRoot(document.getElementById("admin-root")).render(<App />);
