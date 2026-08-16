from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
APP = ROOT / "src" / "App.jsx"
BILLING = ROOT / "src" / "billing.js"
WORKFLOW = ROOT / ".github" / "workflows" / "one-time-runtime-repair.yml"

app = APP.read_text(encoding="utf-8")
billing = BILLING.read_text(encoding="utf-8")

# 1) Language: a language explicitly selected on this device must win for the
# current session. Firestore remains the persistence source when local storage
# is empty (new device/reinstall).
old = '''  const savedLanguage = loaded ? data.settings.language : null;\n  useEffect(() => {\n    if (!savedLanguage || savedLanguage === localLang) return;\n    persistLanguage(savedLanguage);\n    setLocalLang(savedLanguage);\n  }, [savedLanguage]); // eslint-disable-line\n'''
new = '''  const savedLanguage = loaded ? data.settings.language : null;\n  useEffect(() => {\n    // Never overwrite a language the user explicitly selected on this device.\n    // Firestore only seeds local language when there is no local selection yet.\n    if (!savedLanguage || localLang) return;\n    persistLanguage(savedLanguage);\n    setLocalLang(savedLanguage);\n  }, [savedLanguage, localLang]); // eslint-disable-line\n'''
if old not in app:
    raise SystemExit("Language persistence block not found")
app = app.replace(old, new, 1)

old = '  const lang = data.settings.language || localLang || "en";\n'
new = '  const lang = localLang || data.settings.language || "en";\n'
if old not in app:
    raise SystemExit("Canonical language expression not found")
app = app.replace(old, new, 1)

# 2) Firestore: the rules already make entitlements server-authoritative. Keep
# the full field in setData so a missing legacy profile can still be CREATED
# with the required free entitlement shape; updates remain protected by rules.
old = '''      const persisted = Object.fromEntries(\n        Object.entries(next).filter(\n          ([key]) =>\n            key !== "entitlements" &&\n            key !== "customTrainingPlan" &&\n            key !== "customNutritionPlan",\n        ),\n      );\n'''
new = '''      const persisted = Object.fromEntries(\n        Object.entries(next).filter(\n          ([key]) =>\n            key !== "customTrainingPlan" &&\n            key !== "customNutritionPlan",\n        ),\n      );\n'''
if old not in app:
    raise SystemExit("setData persistence filter not found")
app = app.replace(old, new, 1)

old = '''      } catch (e) {\n        console.error("save failed", e);\n        setDataRaw(previous);\n        setSaveError(e);\n        return false;\n      } finally {\n'''
new = '''      } catch (e) {\n        console.error("save failed", e);\n        try {\n          window.__fiftyFitFirestoreDiagnostics = {\n            stage: "users_profile_write",\n            uid,\n            code: String(e?.code || "unknown"),\n            message: String(e?.message || e || ""),\n            updatedAt: new Date().toISOString(),\n          };\n        } catch (_) {}\n        setDataRaw(previous);\n        setSaveError(e);\n        return false;\n      } finally {\n'''
if old not in app:
    raise SystemExit("Firestore save catch block not found")
app = app.replace(old, new, 1)

# 3) Billing: retain the exact fresh ProductDetails result and expose the
# selected subscription offer token through JS diagnostics. The native plugin
# remains responsible for its actual BillingFlowParams construction.
old = '''    let result;\n    try {\n      result = await billing.launchBillingFlow({\n        product: productId,\n        type: "SUBS",\n      });\n'''
new = '''    let selectedOfferToken = null;\n    try {\n      const details = await queryAnyProductDetails(billing, productId);\n      selectedOfferToken =\n        details?.offerToken ||\n        details?.offer_token ||\n        details?.subscriptionOfferDetails?.[0]?.offerToken ||\n        details?.subscriptionOfferDetails?.[0]?.offer_token ||\n        details?.subscriptionOfferDetailsList?.[0]?.offerToken ||\n        details?.subscriptionOfferDetailsList?.[0]?.offer_token ||\n        details?.offers?.[0]?.offerToken ||\n        details?.offers?.[0]?.offer_token ||\n        null;\n    } catch (_) {}\n\n    try {\n      window.__fiftyFitBillingDiagnostics = {\n        ...(window.__fiftyFitBillingDiagnostics || {}),\n        stage: "before_launchBillingFlow",\n        productId,\n        offerTokenPresent: !!selectedOfferToken,\n        updatedAt: new Date().toISOString(),\n      };\n    } catch (_) {}\n\n    let result;\n    try {\n      result = await billing.launchBillingFlow({\n        product: productId,\n        type: "SUBS",\n        ...(selectedOfferToken ? { offerToken: selectedOfferToken } : {}),\n      });\n'''
if old not in billing:
    raise SystemExit("billing launch block not found")
billing = billing.replace(old, new, 1)

# Keep the script one-shot. The workflow deletes itself after committing the
# resulting source changes.
APP.write_text(app, encoding="utf-8")
BILLING.write_text(billing, encoding="utf-8")
WORKFLOW.unlink(missing_ok=True)
