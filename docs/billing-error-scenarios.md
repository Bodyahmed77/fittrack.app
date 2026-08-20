# Google Play Billing — Error Scenarios & Expected Toasts

This document lists every billing failure path the Paywall surfaces after the
`friendlyBillingErrorMessage` / `formatBillingFailureToast` change.

**Toast format (Arabic):**
`فشل الدفع — كود Google Play: {code} ({NAME}) — {friendly explanation} — stage: {stage}`

**Toast format (English):**
`Purchase failed — Google Play code: {code} ({NAME}) — {friendly explanation} — stage: {stage}`

Duration: **12 seconds**. Diagnostics are also written to:
- `window.__fiftyFitBillingDiagnostics`
- `window.__fiftyFitLastBillingError`

---

## A) Google Play BillingResponseCode (native)

| Code | Name | How to reproduce | Expected Arabic explanation | Expected English explanation |
|------|------|------------------|-----------------------------|------------------------------|
| 0 | OK | Successful purchase | تمت العملية بنجاح | OK |
| 1 | USER_CANCELED | Open paywall → Buy → press Back / Cancel in Play sheet | تم إلغاء الشراء من جهازك (USER_CANCELED) | Purchase cancelled by user (USER_CANCELED) |
| 2 | SERVICE_UNAVAILABLE | Airplane mode / no network while launching billing | خدمة Google Play غير متاحة مؤقتًا — تحقق من الإنترنت (SERVICE_UNAVAILABLE) | Google Play service temporarily unavailable — check network (SERVICE_UNAVAILABLE) |
| 3 | BILLING_UNAVAILABLE | Device without Play Store / restricted account / missing Billing Library | الفوترة غير متاحة على هذا الجهاز أو الحساب (BILLING_UNAVAILABLE) | Billing unavailable on this device/account (BILLING_UNAVAILABLE) |
| 4 | ITEM_UNAVAILABLE | Product ID not published / not available in country | المنتج غير متاح في متجر Google Play (ITEM_UNAVAILABLE) | Product not available in Google Play (ITEM_UNAVAILABLE) |
| 5 | DEVELOPER_ERROR | Wrong package name, bad offerToken, SKU misconfigured in Play Console | خطأ في إعداد المنتج أو الـ offer token (DEVELOPER_ERROR) | Invalid product setup or offer token (DEVELOPER_ERROR) |
| 6 | ERROR | Fatal internal Play Billing error | خطأ عام من Google Play أثناء الدفع (ERROR) | Fatal error during Google Play billing (ERROR) |
| 7 | ITEM_ALREADY_OWNED | Buy an active subscription again without restore | الاشتراك مملوك بالفعل — استخدم استعادة المشتريات (ITEM_ALREADY_OWNED) | Item already owned — use Restore Purchases (ITEM_ALREADY_OWNED) |
| 8 | ITEM_NOT_OWNED | Consume/acknowledge path on non-owned item (rare for SUBS) | المنتج غير مملوك حاليًا (ITEM_NOT_OWNED) | Item not owned (ITEM_NOT_OWNED) |
| -1 | SERVICE_DISCONNECTED | Kill Play Store process mid-flow / BillingClient disconnected | انقطع الاتصال بخدمة الفوترة (SERVICE_DISCONNECTED) | Billing service disconnected (SERVICE_DISCONNECTED) |
| -2 | FEATURE_NOT_SUPPORTED | Old Play Store / device missing required feature | الميزة غير مدعومة على هذا الجهاز (FEATURE_NOT_SUPPORTED) | Feature not supported on this device (FEATURE_NOT_SUPPORTED) |

---

## B) App-level / bridge codes

| Code | Stage (typical) | How to reproduce | Expected Arabic | Expected English |
|------|-----------------|------------------|-----------------|------------------|
| `billing_connection_failed` | `billing_connection_failed` | Plugin `startConnection` fails | تعذر الاتصال بخدمة Google Play Billing | Could not connect to Google Play Billing |
| `billing_flow_failed` | `launchBillingFlow_exception` / `purchase_exception` | `launchBillingFlow` throws or non-OK response without mapped code | فشل تدفق الدفع من Google Play | Google Play billing flow failed |
| `offer_token_missing` | before launch | Product has no matching base-plan offer for selected duration | لا يوجد عرض اشتراك صالح لهذا المنتج في Google Play | No eligible subscription offer for this product |
| `purchase_pending` | `purchase_pending` | Cash / pending payment methods; Play returns pending | عملية الشراء معلّقة — انتظر التأكيد من Google Play | Purchase is pending — waiting for Google Play confirmation |
| `purchase_not_completed` | `purchase_token_missing` | Flow closed without token and not marked pending | لم تكتمل عملية الشراء — لم يُرجع Google Play رمز شراء | Purchase did not complete — no purchase token from Google Play |
| `billing_query_failed` | product query | `queryProductDetails` fails | (falls through to generic + debug if any) | (falls through to generic + debug if any) |
| `billing_restore_failed` | restore | Restore path exception | (restore uses separate toast) | (restore uses separate toast) |

---

## C) Server verification (after native success)

These appear **after** a successful native purchase when `registerServerEntitlement` fails.
They use a dedicated long toast (not the Google Play code toast):

| Server code | Meaning | User-facing message (AR / EN) |
|-------------|---------|--------------------------------|
| `purchase_not_found` | Google API cannot find token | تم استلام عملية الشراء ولكن لم يتم تفعيل الاشتراك بعد… / Purchase received but the subscription was not activated… |
| `product_mismatch` | Token product ≠ expected SKU | same support message |
| `purchase_not_active` | Subscription expired / cancelled at Google | same support message |
| `purchase_already_claimed` | Token already bound to another account | same support message |

---

## D) Manual QA checklist (device)

1. **USER_CANCELED (1)** — Cancel the Play sheet → toast shows code `1 (USER_CANCELED)`.
2. **ITEM_ALREADY_OWNED (7)** — Purchase while already subscribed → code `7` + restore hint.
3. **Network (2)** — Airplane mode → Buy → `SERVICE_UNAVAILABLE` or connection failed.
4. **Bad offer (5)** — Temporarily force wrong `offerToken` in debug build → `DEVELOPER_ERROR`.
5. **Pending** — Use a test account with pending payment method if available → `purchase_pending`.
6. **Diagnostics** — After any failure, in Chrome remote debug:
   ```js
   window.__fiftyFitLastBillingError
   window.__fiftyFitBillingDiagnostics
   ```
   Confirm `responseCode`, `responseName`, `stage`, `debugMessage` match the toast.

---

## E) Files changed in this fix

- `src/App.jsx` — `friendlyBillingErrorMessage`, `formatBillingFailureToast`, Paywall `purchase` success:false + catch paths.
- `src/billing.js` — stop using generic string when `responseCode` exists; attach `debugMessage` on flow errors.
- `docs/billing-error-scenarios.md` — this file.
