from pathlib import Path

# Diagnostic-only patch for @capacitor-firebase/authentication's Android
# Google Credential Manager path. It does not alter authentication behavior.
# It logs the exact runtime package, signing SHA-1, Web client ID resource,
# and Credential Manager exception so a status-10 / 28444 failure can be
# diagnosed from the installed artifact instead of guessing at console config.

PLUGIN = Path("node_modules/@capacitor-firebase/authentication/android/src/main/java/io/capawesome/capacitorjs/plugins/firebase/authentication/handlers/GoogleAuthProviderHandler.java")
if not PLUGIN.exists():
    raise SystemExit("GoogleAuthProviderHandler.java not found")

text = PLUGIN.read_text(encoding="utf-8")
original = text

imports_old = '''import android.app.PendingIntent;\nimport android.content.Intent;\nimport android.content.IntentSender;\nimport android.os.Bundle;\nimport android.util.Log;'''
imports_new = '''import android.app.PendingIntent;\nimport android.content.Intent;\nimport android.content.IntentSender;\nimport android.content.pm.PackageInfo;\nimport android.content.pm.PackageManager;\nimport android.content.pm.Signature;\nimport android.os.Bundle;\nimport android.util.Log;'''
if imports_old in text and 'import android.content.pm.PackageInfo;' not in text:
    text = text.replace(imports_old, imports_new, 1)

needle_import = 'import java.io.IOException;\n'
if 'import java.security.MessageDigest;' not in text:
    text = text.replace(needle_import, needle_import + 'import java.security.MessageDigest;\n', 1)

marker = '''public class GoogleAuthProviderHandler {\n'''
helper = '''public class GoogleAuthProviderHandler {\n\n    private void logCredentialManagerDiagnostics(@NonNull String stage, @Nullable Exception exception) {\n        try {\n            Activity activity = pluginImplementation.getPlugin().getActivity();\n            String packageName = activity.getPackageName();\n            String webClientId = activity.getString(R.string.default_web_client_id);\n            String sha1 = "unknown";\n            try {\n                PackageManager pm = activity.getPackageManager();\n                PackageInfo info = pm.getPackageInfo(packageName, PackageManager.GET_SIGNING_CERTIFICATES);\n                Signature[] signatures = info.signingInfo.getApkContentsSigners();\n                if (signatures != null && signatures.length > 0) {\n                    byte[] digest = MessageDigest.getInstance("SHA-1").digest(signatures[0].toByteArray());\n                    StringBuilder out = new StringBuilder();\n                    for (int i = 0; i < digest.length; i++) {\n                        if (i > 0) out.append(":");\n                        out.append(String.format("%02X", digest[i]));\n                    }\n                    sha1 = out.toString();\n                }\n            } catch (Exception ignored) {\n                // Keep auth behavior unchanged even if diagnostics cannot read signing info.\n            }\n            String exceptionType = exception == null ? "none" : exception.getClass().getName();\n            String exceptionMessage = exception == null ? "" : String.valueOf(exception.getMessage());\n            Log.e("FiftyFitGoogleAuth", "stage=" + stage + " package=" + packageName + " signingSha1=" + sha1 + " webClientId=" + webClientId + " exceptionType=" + exceptionType + " exceptionMessage=" + exceptionMessage);\n        } catch (Exception ignored) {\n            // Diagnostic only; never break authentication because logging failed.\n        }\n    }\n'''
if 'logCredentialManagerDiagnostics' not in text:
    if marker not in text:
        raise SystemExit("Google handler class marker not found")
    text = text.replace(marker, helper, 1)

start_marker = '''        if (useCredentialManager) {\n            Executor executor = Executors.newSingleThreadExecutor();'''
start_replacement = '''        if (useCredentialManager) {\n            logCredentialManagerDiagnostics("credential_manager_start", null);\n            Executor executor = Executors.newSingleThreadExecutor();'''
if start_marker in text and 'credential_manager_start' not in text:
    text = text.replace(start_marker, start_replacement, 1)

error_marker = '''                    public void onError(@NonNull GetCredentialException exception) {\n                        handleGetCredentialError(call, isLink, exception);\n                    }'''
error_replacement = '''                    public void onError(@NonNull GetCredentialException exception) {\n                        logCredentialManagerDiagnostics("credential_manager_error", exception);\n                        handleGetCredentialError(call, isLink, exception);\n                    }'''
if error_marker in text and 'credential_manager_error' not in text:
    text = text.replace(error_marker, error_replacement, 1)

required = [
    'import android.content.pm.PackageInfo;',
    'import java.security.MessageDigest;',
    'FiftyFitGoogleAuth',
    'credential_manager_start',
    'credential_manager_error',
    'signingSha1=',
    'webClientId=',
]
missing = [x for x in required if x not in text]
if missing:
    raise SystemExit("Google native diagnostics incomplete: " + ", ".join(missing))

if text == original:
    print("Google native diagnostics already applied")
else:
    PLUGIN.write_text(text, encoding="utf-8")
    print("Applied Google Credential Manager runtime diagnostics")
