// Shared Google Sign-In user-facing error messages (AR / EN).
// Used by LoginScreen and SignUpScreen so both stay consistent.

export function googleSignInErrorMessage(err, ar) {
  const code = err?.code || "";
  if (code === "timeout") {
    return ar
      ? "انتهت مهلة تسجيل Google. لو شاشة الحساب ظهرت في Chrome، ارجع للتطبيق بعد الاختيار أو حاول تاني."
      : "Google Sign-In timed out. If the account chooser appeared in Chrome, return to the app after choosing, or try again.";
  }
  if (code === "redirect_failed" || code === "oauth_error") {
    return ar
      ? "تعذر إكمال تسجيل Google. حاول تاني."
      : "Could not complete Google Sign-In. Please try again.";
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
      ? "خطأ إعداد Google Sign-In. تأكد من Web Client ID ورابط العودة com.fittrack.app://google-auth في Google Cloud Console."
      : "Google Sign-In configuration error. Check the Web Client ID and authorized redirect URI com.fittrack.app://google-auth in Google Cloud Console.";
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
