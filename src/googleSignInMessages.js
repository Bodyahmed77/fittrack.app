// Shared Google Sign-In user-facing error messages (AR / EN).
// Used by LoginScreen and SignUpScreen so both stay consistent.

export function googleSignInErrorMessage(err, ar) {
  const code = err?.code || "";
  if (code === "timeout") {
    return ar
      ? "انتهت مهلة تسجيل Google. تأكد أن شاشة اختيار الحساب ظهرت، أو حاول تاني."
      : "Google Sign-In timed out. Confirm the account chooser appeared, or try again.";
  }
  if (code === "redirect_failed") {
    return ar
      ? "تعذر فتح تسجيل Google. تأكد من الاتصال بالإنترنت وحاول تاني."
      : "Could not start Google Sign-In. Check your connection and try again.";
  }
  if (code === "popup_blocked") {
    return ar
      ? "المتصفح منع نافذة Google. اسمح بالنوافذ المنبثقة وحاول تاني."
      : "The browser blocked the Google popup. Allow popups and try again.";
  }
  if (code === "plugin_unavailable") {
    return ar
      ? "إضافة Google Sign-In غير متاحة على هذا الجهاز."
      : "Google Sign-In plugin is not available on this device.";
  }
  if (code === "no_id_token") {
    return ar
      ? "تعذر الحصول على توكن Google. حاول تاني."
      : "Could not get a Google ID token. Please try again.";
  }
  if (code === "developer_error") {
    return ar
      ? "خطأ إعداد Google Sign-In (كود 10). راجع SHA-1 للإصدار الحالي وملف google-services.json (Android + Web)."
      : "Google Sign-In configuration error (code 10). Check this APK's SHA-1 and google-services.json (Android + Web clients).";
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
