# Fifty Fit — Studio Hardening Release Gates

This branch carries PR #79 on top of the latest `main` plus CI and admin entitlement safety fixes.

Release gates:
- update safety must inspect the actual production patch chain
- returning users must keep cached profile state during transient Firestore failure
- missing remote profiles must use explicit account recovery, not silently start onboarding
- admin support entitlements are separate from Google Play entitlements
- invalid admin support expiry values fail closed
- Google Play status in Admin Console must respect purchase expiry
- public Pages must include demo, admin, privacy policy, and account deletion routes
- Android release remains gated on Gradle, AAB/APK, signing, and Billing compatibility validation
- real device / Google Play internal testing is still required for runtime purchase and auth certification
