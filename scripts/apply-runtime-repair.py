#!/usr/bin/env python3
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
APP = ROOT / "src" / "App.jsx"
AUTH = ROOT / "src" / "googleAuth.js"
BILL = ROOT / "src" / "billing.js"


def replace_once(text, old, new, label):
    count = text.count(old)
    if count != 1:
        raise SystemExit(f"{label}: expected 1 match, found {count}")
    return text.replace(old, new, 1)


def repair_app():
    text = APP.read_text(encoding="utf-8")
    old = '''    let base;\n    try {\n      const snap = await getDoc(doc(db, "users", uid));\n      if (!snap.exists()) throw new Error("User profile document does not exist");\n      base = { ...freshState(), ...snap.data() };\n    } catch (e) {\n      console.error("[onboarding] authoritative Firestore read failed", e);\n      setErr(ar ? "تعذر قراءة بياناتك المحفوظة — حاول تاني" : "Couldn’t read your saved profile — please try again");\n      return;\n    }\n\n    const next = clone(base);'''
    new = '''    let base;\n    try {\n      const snap = await getDoc(doc(db, "users", uid));\n      base = snap.exists() ? { ...freshState(), ...snap.data() } : clone(data);\n    } catch (e) {\n      // The live useAppData listener is already our canonical Firestore-backed\n      // state. A transient direct getDoc failure must not lock a brand-new user\n      // out of onboarding. Use the latest trusted React state as a write base;\n      // setData() below performs the authoritative merged persistence and rolls\n      // back on a real write failure.\n      console.warn("[onboarding] direct profile read failed; using trusted app state", e);\n      base = clone(data);\n    }\n\n    if (!base || typeof base !== "object") {\n      setErr(ar ? "تعذر تجهيز بياناتك — حاول تاني" : "Couldn’t prepare your profile — please try again");\n      return;\n    }\n\n    const next = clone(base);'''
    text = replace_once(text, old, new, "Onboarding direct Firestore read")
    APP.write_text(text, encoding="utf-8")


def repair_google_auth():
    text = AUTH.read_text(encoding="utf-8")
    old = '''async function nativeGoogleSignIn(localLang, createInitialState) {\n  let result;\n  let usedCredentialManager = true;\n  try {\n    console.info("[GoogleSignIn] native start: Credential Manager enabled");\n    result = await runNativeGoogleSignIn(true);\n  } catch (nativeError) {\n    const mapped = mapAuthError(nativeError);\n\n    if (isNoCredentialError(mapped) || mapped?.googleStatusCode === "10" || mapped?.code === "developer_error") {'''
    new = '''async function nativeGoogleSignIn(localLang, createInitialState) {\n  let result;\n  const usedCredentialManager = false;\n  try {\n    // The current Android build is hitting Credential Manager / One Tap\n    // error 10 ([28444] Developer console is not set up correctly).\n    // The plugin explicitly supports opting out of Credential Manager. Use\n    // the legacy Google Sign-In chooser directly so we do not enter the\n    // failing One Tap path in the first place.\n    console.info("[GoogleSignIn] native start: legacy chooser (Credential Manager disabled)");\n    result = await runNativeGoogleSignIn(false);\n  } catch (nativeError) {\n    const mapped = mapAuthError(nativeError);\n    try {\n      window.__fiftyFitGoogleAuthDiagnostics = {\n        stage: "native_sign_in_legacy",\n        code: mapped?.code || "unknown",\n        googleStatusCode: mapped?.googleStatusCode || mapped?.nativeCode || mapped?.nativeErrorCode || null,\n        nativeCode: mapped?.nativeCode || null,\n        nativeErrorCode: mapped?.nativeErrorCode || null,\n        nativeMessage: mapped?.nativeMessage || null,\n        message: mapped?.message || String(mapped || ""),\n        updatedAt: new Date().toISOString(),\n      };\n    } catch (_) {}\n    console.error(\n      "[GoogleSignIn] legacy native chooser failed",\n      mapped?.nativeCode || mapped?.nativeErrorCode || mapped?.code || "",\n      mapped?.nativeMessage || mapped?.message || "",\n    );\n    throw mapped;\n  }\n\n  const idToken = result?.credential?.idToken || result?.credential?.id_token || result?.idToken;'''
    text = replace_once(text, old, new, "Google native flow")
    # The replacement above also leaves the old body after the inserted block.
    # Remove the now-unreachable old fallback branch through the first idToken declaration.
    marker = '''\n  const idToken = result?.credential?.idToken || result?.credential?.id_token || result?.idToken;'''
    first = text.find(marker)
    second = text.find(marker, first + 1)
    if second != -1:
        # Keep the first declaration and remove the duplicated old block up to it.
        text = text[:first] + text[second:]
    AUTH.write_text(text, encoding="utf-8")


def repair_billing():
    text = BILL.read_text(encoding="utf-8")
    old = '''    const result = await billing.launchBillingFlow({\n      product: productId,\n      type: "SUBS",\n    });\n\n    const responseCode =\n      result?.responseCode ??\n      result?.billingResponseCode ??\n      result?.response?.responseCode;\n    if (responseCode != null && String(responseCode) !== "0") {\n      return {\n        success: false,\n        preview: false,\n        error: billingError(\n          {\n            responseCode,\n            message: result?.debugMessage || result?.response?.message,\n            subResponseCode: result?.subResponseCode,\n          },\n          "billing_flow_failed",\n        ),\n      };\n    }'''
    new = '''    let result;\n    try {\n      result = await billing.launchBillingFlow({\n        product: productId,\n        type: "SUBS",\n      });\n    } catch (launchError) {\n      const launchMapped = billingError(launchError, "billing_flow_failed");\n      try {\n        window.__fiftyFitBillingDiagnostics = {\n          stage: "launchBillingFlow_exception",\n          productId,\n          code: launchMapped.code,\n          message: launchMapped.message,\n          nativeCode: launchMapped.nativeCode || null,\n          nativeMessage: launchMapped.nativeMessage || null,\n          raw: String(launchError?.message || launchError || ""),\n          updatedAt: new Date().toISOString(),\n        };\n      } catch (_) {}\n      throw launchMapped;\n    }\n\n    const responseCode =\n      result?.responseCode ??\n      result?.billingResponseCode ??\n      result?.response?.responseCode;\n    const debugMessage =\n      result?.debugMessage ||\n      result?.response?.message ||\n      result?.message ||\n      "Google Play did not complete the purchase";\n\n    try {\n      window.__fiftyFitBillingDiagnostics = {\n        stage: "launchBillingFlow_result",\n        productId,\n        responseCode: responseCode ?? null,\n        debugMessage,\n        subResponseCode: result?.subResponseCode ?? null,\n        rawResult: result,\n        updatedAt: new Date().toISOString(),\n      };\n    } catch (_) {}\n\n    if (responseCode != null && String(responseCode) !== "0") {\n      const flowError = billingError(\n        {\n          responseCode,\n          message: debugMessage,\n          subResponseCode: result?.subResponseCode,\n        },\n        "billing_flow_failed",\n      );\n      flowError.message = `Google Play Billing code ${responseCode}: ${debugMessage}`;\n      return {\n        success: false,\n        preview: false,\n        error: flowError,\n      };\n    }'''
    text = replace_once(text, old, new, "Billing launch diagnostics")
    BILL.write_text(text, encoding="utf-8")


if __name__ == "__main__":
    repair_app()
    repair_google_auth()
    repair_billing()
    print("Runtime repair applied: onboarding read fallback, legacy Google auth, billing diagnostics")
