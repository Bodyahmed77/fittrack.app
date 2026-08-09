// Shared Google Sign-In user-facing error messages (AR / EN).
// Used by LoginScreen and SignUpScreen so both stay consistent.

export function googleSignInErrorMessage(err, ar) {
  const code = err?.code || "";
  if (code === "timeout") {
    return ar
      ? "انتهت مهلة تسجيل Google. تأكد أن شاشة اختيار الحساب ظهرت، أو راجع إعدادات SHA-1 في Firebase."
      : "Google Sign-In timed out. Confirm the account picker appeared, or check Firebase SHA-1 setup.";
  }
  if (code === "plugin_unavailable") {
    return ar
      ? "إضافة Google Sign-In غير متاحة على هذا الجهاز."
      : "Google Sign-In plugin is not available on this device.";
  }
  if (code === "no_id_token") {
    return ar
      ? "تعذر الحصول على توكن Google. راجع SHA-1 وملف google-services.json."
      : "Could not get a Google ID token. Check SHA-1 and google-services.json.";
  }
  if (code === "developer_error") {
    return ar
      ? "خطأ إعداد Google Sign-In (كود 10). راجع SHA-1 للإصدار الحالي وملف google-services.json (Android + Web)."
      : "Google Sign-In configuration error (code 10). Check this APK's SHA-1 and google-services.json (Android + Web clients).";
  }
  if (code === "network") {
    return ar
      ? "مفيش اتصال أثناء تسجيل Google — راجع الشبكة وحاول تاني."
      : "Network error during Google Sign-In — check your connection and try again.";
  }
  if (code === "sign_in_failed" || code === "native_error") {
    return ar
      ? "فشل تسجيل الدخول بجوجل على الجهاز. حاول تاني."
      : "Google Sign-In failed on this device. Please try again.";
  }
  if (
    code === "cancelled" ||
    code === "auth/popup-closed-by-user" ||
    code === "auth/cancelled-popup-request"
  ) {
    return ar ? "تم إلغاء تسجيل الدخول بجوجل." : "Google Sign-In was cancelled.";
  }
  return ar
    ? "فشل تسجيل الدخول بجوجل — حاول تاني"
    : "Google Sign-In failed — please try again";
}
