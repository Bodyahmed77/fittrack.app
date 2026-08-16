# Onboarding repair plan

The onboarding loop is treated as a Firestore state-machine problem, not a UI navigation problem.

Required invariants:

1. A successful completion writes `onboarded: true` and a fresh `updatedAt` to `users/{uid}`.
2. All writes to the current user's profile document use the same freshness contract.
3. A stale or undated snapshot must never regress newer local/profile state.
4. Completion must not navigate to the app until persistence has succeeded.
5. Email/password signup with an existing phone skips the duplicate phone step.
6. The selected language is written explicitly as `settings.language` during onboarding completion.
7. Firestore read/write failures are surfaced instead of being mistaken for a fresh user profile.

The implementation will be changed in `src/App.jsx` after a complete review of every `users/{uid}` write path. The earlier localStorage watermark patch from the external audit is not applied verbatim because its persistent watermark semantics require tighter handling of multi-device writes.
