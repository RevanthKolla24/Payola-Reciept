# Release-readiness checks and remaining gates

These checks authorize no commit, push, deployment, production write or account deletion.

## Local evidence — November 7, 2026

Validated on macOS with Node 24.21.0, Playwright-managed Chromium 156, Firefox
and WebKit 27.2, and Firebase browser SDK 13.2.0:

- 128 unit/server tests passed, including the private diagnostic privacy test.
- All 15 browser engine/suite combinations passed. Each engine includes the
  seven-service responsive checks and 35 route checks, plus Help at six widths.
- Real-client account suite passed in Chromium: registration/profile creation,
  verification, no implicit saves, snapshot save/changed-view restore/delete,
  receipt save/delete, temporary/remembered reload behavior, password reset and
  new-password login, offline sign-in failure/retry. No production requests.
- Demo rules suite passed, including owner-only snapshots/receipts, job/profile
  boundaries and cross-device versions/conflicts. Expected denial logs are part
  of the negative assertions, not failed checks.
- Syntax checks and `git diff --check` passed.

Evidence logs (local and temporary): `/tmp/payola-release-unit.log`,
`/tmp/payola-release-check.log`, `/tmp/payola-release-matrix-verified.log`,
`/tmp/payola-release-accounts-final4.log`, `/tmp/payola-release-rules.log`.
The account log includes synthetic emulator action links; do not publish it as a
real-account troubleshooting template. No real exports, physical devices,
production email delivery, Job Tracker runtime or deployed rules were certified.

## Reproduce local checks

Start the app separately with `PORT=3099 npm start`. Set
`TEST_URL=http://127.0.0.1:3099` and, if needed, `PLAYWRIGHT_MODULE` to an absolute
path to an existing Playwright `index.mjs`.

- `npm test`, `npm run check`, `git diff --check`.
- `npm run test:browser:matrix`: five suites in Chromium, Firefox and WebKit,
  including their responsive checks. Install all engines with the Playwright CLI
  first. Missing engines fail rather than silently skip. Single suites accept
  `TEST_BROWSER=chromium`, `firefox` or `webkit`.
- `npm run test:accounts:emulator`: real Firebase adapter and matching installed
  browser SDK with demo Auth/Firestore emulators. Set `FIREBASE_TEST_MODULES` to
  an absolute node_modules directory containing the same Firebase version as the
  adapter. Requires Java and Firebase CLI. Only loopback endpoints and the demo
  project are allowed. Test-only intercepted responses supply local SDK files,
  emulator connections and CSP allowances; shipped code stays unchanged.
  Production/unrelated requests are blocked and fail the suite.
- `FIREBASE_TEST_MODULES=/absolute/node_modules npm run test:rules`: owner-only
  rules, profile/role boundaries, receipt bounds and cross-device versions.

Run emulator commands sequentially (shared ports 9099/8080). Persistence checks
cover reload in one fresh browser context, not OS/browser restart. Email action
codes come from the demo emulator and are completed through the real SDK: this
does not certify inbox delivery or the production hosted email-action handler.
Offline real-client coverage is sign-in failure/retry; mocked tests cover further
cloud failures and account transitions. Synthetic demo accounts are ephemeral.
WebKit and narrow viewports are **not physical Safari/iPhone certification**.
Record exact engine/OS/device and pass/failure for each release; old logs are not
evidence for newly edited tests.

## Private native-export fixture workflow

Keep originals and redacted copies outside the repository. Never upload entire
archives to third-party tools. Do not supply credentials, cookies or tokens.

1. Record service, export date, chosen category/product, language, timezone,
   archive member structure and whether the sample is real-derived or synthetic.
2. Remove email/IDs, device/IP/location and unrelated activity. Replace artists
   and titles with fictional values while retaining keys, types, nesting and
   missing fields. Shift dates consistently, retaining format/timezone/order.
   Retain URL host/path/query shape with fictional valid-length IDs.
3. Include music-marked activity, ordinary video history, searches/ads, missing
   channel metadata, bad dates and localized labels where present. Independently
   document expected accepted/excluded counts by human review.
4. Run `npm run validate:activity -- /absolute/path/redacted-activity.json`.
   Output is category counts only. This validates the JSON normalizer, not ZIP,
   worker or UI behavior; zero accepted records is not proof of compatibility.
5. Exercise JSON and ZIP through the local browser importer. Compare reviewed
   counts and disclosures across receipt, PNG, CSV, backups and explicit cloud
   saves. Duration stays unknown; channels are not verified recording artists.
6. With consent, derive minimal synthetic regression fixtures. A passing sample
   establishes only that schema, not every export or language.

YouTube remains experimental until real-account schema review. Apple native
archive detection remains deferred until event fields and their meaning are
verified. Playlists, libraries, purchases, catalog duration and aggregate totals
must not be inferred as listening events.

## Production gate — separate authorization required

- Confirm app URL/revision and inspect health, integration availability, guest
  routes, headers and account configuration. Configured is not live-verified.
- Compare rules/indexes with a private deployed backup. Local emulator success
  does not verify deployed state. Publish correct owner-only receipt rules before
  enabling production collection writes; preserve jobs/admin restrictions and
  existing indexes. Preserve `/tmp/payola-firebase-production-backup` privately.
- Obtain a dedicated test inbox and consent for real account creation/writes.
  Check delivered verification/reset links, authorized return domain, changed
  password login, account separation and explicit-only saves. No personal
  credentials, session-cookie collection or unapproved account deletion.
- Coordinate Job Tracker verification with its maintainer: profiles/roles,
  shared password changes and separate app sessions. Cross-app deletion requires
  coordinated data cleanup and cannot be certified in this repository alone.
- Test physical iOS Safari and Android Chrome: file/ZIP picker, worker import,
  cancellation, receipt download/share, backup restore, accounts and large-history
  memory/performance. Record OS/browser versions and observed limits.
- Follow the existing deployment/rollback procedure only after explicit release
  approval. Retain prior revision and private rules/index backups. Avoid
  destructive migrations; record rollback checks and test-data cleanup separately.