# Release repair status

## Confirmed

- Play App Signing SHA-1: `55:38:4C:F2:06:85:49:73:C6:8D:FB:A5:BE:2A:1B:BA:8E:04:8B:EE`
- Upload SHA-1: `C6:2C:4D:0C:0A:E9:64:62:08:87:E4:64:83:5D:E5:19:68:42:13:1B`
- Package: `com.bodyahmed77.fiftyfit`
- Android OAuth clients exist for both certificates.
- A Web OAuth client exists.

## Current repair phases

1. Make the Web OAuth client ID explicit in Capacitor FirebaseAuthentication configuration.
2. Validate google-services.json Web client and Capacitor configuration agree before Android build.
3. Audit and repair the Firestore onboarding state machine without introducing a persistent watermark regression.
4. Keep Billing diagnosis separate from Google Sign-In and preserve the real native BillingResult.
5. Runtime-test the Play-installed artifact before declaring Google Sign-In or Billing fixed.
