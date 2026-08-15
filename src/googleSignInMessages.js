// Shared Google Sign-In user-facing error messages (AR / EN).
// Used by LoginScreen and SignUpScreen so both stay consistent.

function diagnosticSuffix(err) {
  const parts = [];
  if (err?.firebaseAuthCode) parts.push(`Firebase: ${err.firebaseAuthCode}`);
  if (err?.nativeCode) parts.push(`Native: ${err.nativeCode}`);
  if (err?.nativeErrorCode) parts.push(`NativeError: ${err.nativeErrorCode}`);
  if (err?.firstNativeCode) parts.push(`FirstNative: ${err.firstNativeCode}`);
  if (err?.fallbackAttempted) parts.push("fallback attempted");
  if (!parts.length) return "";
  return ` [${parts.join(" | ")}]`;
}

export function googleSignInErrorMessage(err, ar) {
  const code = err?.code || "";
  const suffix = diagnosticSuffix(err);
  if (code === "timeout") {
    return ar
      ? `انتهت مهلة تسجيل Google. لو شاشة الحساب ظهرت، ارجع للتطبيق بعد الاختيار أو حاول تاني.${suffix}`
      : `Google Sign-In timed out. If the account chooser appeared, return to the app after choosing, or try again.${suffix}`;
  }
  if (code === "redirect_failed") {
    return ar
      ? `تعذر إكمال تسجيل Google داخل التطبيق. حاول تاني.${suffix}`
      : `Could not complete Google Sign-In inside the app. Please try again.${suffix}`;
  }
  if (code === "popup_blocked") {
    return ar
      ? `المتصفح منع نافذة Google. اسمح بالنوافذ المنبثقة وحاول تاني.${suffix}`
      : `The browser blocked the Google popup. Allow popups and try again.${suffix}`;
  }
  if (code === "plugin_unavailable") {
    return ar
      ? `إضافة Google Sign-In غير متاحة على هذا الجهاز.${suffix}`
      : `Google Sign-In plugin is not available on this device.${suffix}`;
  }
  if (code === "no_id_token") {
    return ar
      ? `تعذر الحصول على توكن Google. حاول تاني.${suffix}`
      : `Could not get a Google ID token. Please try again.${suffix}`;
  }
  if (code === "developer_error") {
    return ar
      ? `خطأ إعداد Google Sign-In (كود 10). راجع SHA-1 للإصدار الحالي وملف google-services.json (Android + Web).${suffix}`
      : `Google Sign-In configuration error (code 10). Check this APK's SHA-1 and google-services.json (Android + Web clients).${suffix}`;
  }
  if (code === "credential_manager_unsupported") {
    return ar
      ? `هذا الجهاز لا يدعم Credential Manager لتسجيل Google. حدّث خدمات Google Play وحاول تاني.${suffix}`
      : `This device does not support Google Credential Manager. Update Google Play services and try again.${suffix}`;
  }
  if (
    code === "cancelled" ||
    code === "auth/popup-closed-by-user" ||
    code === "auth/cancelled-popup-request"
  ) {
    return ar ? `تم إلغاء تسجيل الدخول بجوجل.${suffix}` : `Google Sign-In was cancelled.${suffix}`;
  }

  const raw = err?.firebaseAuthMessage || err?.nativeMessage || err?.message || "";
  const safeRaw = String(raw).replace(/\s+/g, " ").trim().slice(0, 180);
  const rawSuffix = safeRaw && !suffix ? ` (${safeRaw})` : "";
  return ar
    ? `فشل تسجيل الدخول بجوجل — حاول تاني${suffix}${rawSuffix}`
    : `Google Sign-In failed — please try again${suffix}${rawSuffix}`;
}
