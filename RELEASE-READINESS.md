# Release-readiness checks and remaining gates

These checks authorize no commit, push, deployment, production write or account deletion.

## Read-only production review — November 10, 2026

**Release remains blocked by deployed app/rules drift.** The workspace was clean
at the start of this review; the candidate work is already committed as `9a97ed7`.
No commit, push, deploy, rule publication, account creation or data mutation was
performed in this review. These observations supersede older deployed-state claims.

- Live `payola-draft.onrender.com` health, home, import, receipt and Help endpoints
  returned HTTP 200. Health reported `ok`; Last.fm and Apple availability were
  both false. Accounts were enabled for `job-tracker-project-c4e87`.
- Live HTML has the expected restrictive CSP and `Referrer-Policy: strict-origin`.
  `/firestore.rules` and `/.env` returned 404. These checks are not an exhaustive
  security audit or a browser/account workflow certification.
- The live `collection-ui.js` exactly matches the candidate, but `app.js`,
  `navigation.js`, `session.js`, `reports.js` and `index.html` differ. The new
  `service-catalog.js`, `service-history.js` and `import-audit.js` return 404.
  The exact deployed Git revision is unknown; HTTP byte comparisons establish
  that this is not the current candidate, not which release is running.
- The active Firestore release was last updated November 4, 2026 at
  23:39:02 UTC. Its rules differ from the local file only by the missing bounded
  owner-only receipt rule block. Consequently production receipt access is
  denied by default, not public. Serving collection UI does not make it usable.
  No production account or receipt operation was attempted to verify behavior.
- Email/password sign-in is enabled, and the Payola hostname is authorized.
  Actual email delivery, hosted action handling and Job Tracker remain untested.
- The paginated composite-index listing returned zero indexes. The `chunks.data`
  field still inherits ascending, descending and array indexing; the local
  payload exemption is not deployed. Do not treat this as authorization to alter
  shared indexes or claim large-payload production writes have passed.
- `/tmp/payola-firebase-production-backup` exists but is **empty**. The historical
  pre-change backup is unavailable there. A new mode-0700 private directory at
  `/tmp/payola-production-readonly-2026-11-10` contains the current rules release,
  rules source, Auth config, index responses and HTTP evidence. This is a current
  configuration snapshot, not a recovery of historical settings or user data.
  Copy it to durable private storage before an approved production change.

Local `npm test` (128 tests), `npm run check` and whitespace checks passed again.
The earlier `/tmp` Playwright/Firebase test installations are no longer present;
browser/emulator suites were not rerun during this read-only review. The November
7 results below are historical evidence, not a fresh browser certification.

### Next approved-release sequence

1. Retain the current private snapshot durably; review the exact app and rule
   revisions, shared-project impact and rollback plan.
2. Obtain separate authorization to publish the reviewed receipt rules to the
   explicit shared project. Do not include index changes implicitly. Verify the
   active release source after publication.
3. Obtain separate authorization to deploy the reviewed app revision. Check the
   three new module URLs, app assets, health, guest routes and service disclosures.
4. With a dedicated inbox and consent, verify real account links, explicit-only
   snapshot/receipt operations and cross-account denials. Coordinate shared-app
   checks and non-destructive cleanup with Job Tracker's maintainer.
5. Complete physical-device and large-history checks before broad release. Keep
   YouTube experimental and Apple native parsing deferred pending real fixtures.

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
  existing indexes. The original backup directory is currently empty; preserve
  the new current-state snapshot privately and obtain a durable copy before changes.
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