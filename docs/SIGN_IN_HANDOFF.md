# Sign-in handoff

An active Clerk session now replaces the sign-in/sign-up form with an explicit workspace handoff. The requested `/app/...` or `/connect` destination is retained through sign-in and sign-up; external, API and recursive auth destinations fall back to `/app`. Pending session tasks remain inside Clerk's form. A slow SDK load or redirect displays a retry action rather than an empty form area.

The workspace token bridge delegates token expiry to Clerk, sharing only in-flight lookups. A confirmed pre-handler authentication rejection gets one fresh-token retry; arbitrary provider 401s and 403 eligibility responses are not replayed. Only a confirmed deleted/stale Clerk session is automatically signed out. Normal failures remain recoverable in the workspace. Token lookups and initial workspace checks are bounded, with a retry action on failure. Unmounting restores the original fetch function; pending requests are fenced against account changes.

The entry gate reads `/api/onboarding/status`, which returns only `finished`. Explicitly completed/skipped setup reads the stored completion marker without reading academic sources. Legacy established accounts use an account-scoped programme/course-existence query. Document reconciliation, transcript versions, Canvas connections and course-rule scans remain on the full setup page, where they are useful. The verdict retains the same semantics as `/api/onboarding`.

Clerk contracts checked against the installed SDK and official documentation:
- [Session token cache and `skipCache`](https://clerk.com/docs/js-frontend/reference/objects/session)
- [Pending session tasks](https://clerk.com/docs/guides/configure/session-tasks)
- [`useAuth`](https://clerk.com/docs/nextjs/reference/hooks/use-auth)

Validation covers return destinations, concurrent token lookup, expired-token recovery, preservation of retried request bodies, no replay for provider/eligibility errors, timeout recovery, aborts/account switching, and setup-verdict parity for new, established, skipped and explicitly completed records. Full `npm run verify`: 600 tests, no failures/skips, typecheck and production build pass. Real password/MFA sign-in needs the account holder; no production session or credentials are fabricated for browser validation.
