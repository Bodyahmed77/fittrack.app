# Google Play Billing — Error Scenarios & Expected Toasts

The Android release uses the first-party `FiftyFitBilling` Capacitor bridge and Google Play Billing 9.1.0. Google Play is the source of purchase state; server verification happens before entitlement acknowledgement.

**Arabic toast:**
`فشل الدفع — كود Google Play: {code} ({NAME}) — {friendly explanation} — stage: {stage}`

**English toast:**
`Purchase failed — Google Play code: {code} ({NAME}) — {friendly explanation} — stage: {stage}`

Diagnostics are also written to:
- `window.__fiftyFitBillingDiagnostics`
- `window.__fiftyFitLastBillingError`

## Native BillingResponseCode

| Code | Name | Meaning |
|---|---|---|
| 0 | `OK` | Successful BillingResult |
| 1 | `USER_CANCELED` | User cancelled the Google Play sheet |
| 2 | `SERVICE_UNAVAILABLE` | Google Play service temporarily unavailable |
| 3 | `BILLING_UNAVAILABLE` | Billing unavailable for this device/account |
| 4 | `ITEM_UNAVAILABLE` | Product not available for this account/country |
| 5 | `DEVELOPER_ERROR` | Product/package/offer configuration problem |
| 6 | `ERROR` | General Google Play Billing error |
| 7 | `ITEM_ALREADY_OWNED` | Active subscription already belongs to the tester |
| 8 | `ITEM_NOT_OWNED` | Item is not owned |
| -1 | `SERVICE_DISCONNECTED` | Billing service disconnected |
| -2 | `FEATURE_NOT_SUPPORTED` | Requested feature is not supported |

## App/bridge failures

These are internal operation labels, not Google response codes:

- `billing_connection_failed`
- `billing_flow_failed`
- `offer_token_missing`
- `purchase_pending`
- `purchase_not_completed`
- `billing_query_failed`

The app must never display one of these strings as the Google Play numeric code when Google returned a real `BillingResponseCode`.

## Purchase flow

1. Fetch the Google Play subscription by product ID.
2. Export all subscription offers with `basePlanId`, `offerId`, and `offerToken`.
3. Select the requested offer in JavaScript.
4. Pass that exact `offerToken` into the first-party Android `FiftyFitBilling` bridge.
5. Call `launchBillingFlow()` directly against Google Play Billing 9.1.0.
6. Return the native `responseCode`, `debugMessage`, and sub-response code to JavaScript as structured data.
7. On a successful purchase, return the purchase token to `registerPurchase.js` for server-side Google verification.

## Manual QA

- Cancel the Play sheet: expect `1 (USER_CANCELED)`.
- Test an already-owned subscription: expect `7 (ITEM_ALREADY_OWNED)`.
- Disable network: expect `2 (SERVICE_UNAVAILABLE)` or a connection-stage diagnostic.
- Test a deliberately invalid offer in a non-release build: expect `5 (DEVELOPER_ERROR)`.
- For any failure, inspect:

```js
window.__fiftyFitLastBillingError
window.__fiftyFitBillingDiagnostics
```

The diagnostic object must contain the native response code when Google returned one.

## Release files

- `src/billing.js` — product/offer selection and server purchase handoff.
- `src/fiftyFitBilling.js` — JavaScript registration for the first-party native bridge.
- `scripts/inject-fiftyfit-billing-v2.py` — generates the Android Billing 9.1.0 bridge and registers it in `MainActivity`.
- `scripts/verify-first-party-billing-release.py` — validates the final AAB/APK.
