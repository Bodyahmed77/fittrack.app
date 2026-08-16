# Release repair status

Confirmed package: `com.bodyahmed77.fiftyfit`

Confirmed Play App Signing SHA-1: `55:38:4C:F2:06:85:49:73:C6:8D:FB:A5:BE:2A:1B:BA:8E:04:8B:EE`

Confirmed Upload SHA-1: `C6:2C:4D:0C:0A:E9:64:62:08:87:E4:64:83:5D:E5:19:68:42:13:1B`

Confirmed Android OAuth clients exist for both certificates, plus a Web OAuth client.

Current repair phases:
1. Explicit Web OAuth client ID in Capacitor FirebaseAuthentication configuration.
2. Build-time validation that google-services.json and Capacitor config use the same Web client ID.
3. Firestore onboarding state-machine repair without the unsafe persistent-watermark patch.
4. Separate Billing diagnosis while preserving native BillingResult.
5. Runtime verification on the Play-installed artifact before declaring Google Sign-In or Billing fixed.
