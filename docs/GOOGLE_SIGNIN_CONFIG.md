# Google Sign-In configuration

Fifty Fit uses the Android Play App Signing certificate and the upload certificate as separate OAuth Android clients, plus one Web OAuth client used as the Credential Manager server client ID.

The canonical package is `com.bodyahmed77.fiftyfit`.

The Web client ID is configured in `capacitor.config.json` under `plugins.FirebaseAuthentication.googleWebClientId` and is validated against the Web OAuth client extracted from `google-services.json` during the Android release workflow.

Do not replace the Play App Signing SHA-1 with the upload SHA-1 or vice versa. Play-distributed builds use the Play App Signing certificate; direct/sideloaded artifacts use the upload certificate.
