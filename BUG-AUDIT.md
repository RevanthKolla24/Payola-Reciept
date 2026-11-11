# Code and UI audit — November 10, 2026

This is a local audit of candidate `9a97ed7` plus the working-tree fixes below.
It is not a guarantee that every defect has been found or a production release approval.

## Fixed in this working tree

- Preserve canonical UTC Last.fm timestamps through normalization, client loading,
  local backup and restoration, enabling timestamp-based listening patterns.
- Retain per-input provenance warnings and YouTube music-marked activity limitations
  and audit counts in both rendered and downloaded session comparisons. Older
  activity backups explicitly identify missing exclusion counts.
- Preserve CSV self-reported/unverified-source warnings on PNG exports and keep the
  unknown-duration/eligibility warning on hypothetical Last.fm benchmark images.
- Remove leftover dollar-calculation/table wording from the no-route empty state.
- Disable record diagnostics for manual counts instead of exporting misleading
  zero-record diagnostics; manual session backups remain available.
- Replace disallowed display controls in captured receipt highlights only. Original
  session metadata is preserved; receipt validation and cloud rules are unchanged.
- Establish the receipt-preview opener's focus explicitly for native modal dismissal.
- Wrap saved receipt SVGs by Unicode code point, include separator widths in wrapping,
  and constrain non-ASCII text advance to the image's available width.

## Corrections to the initial source review

- The checked-in CSV guide already renders invalid preview rows explicitly. No
  production change was necessary; browser assertions now protect this behavior.
- Unknown-duration CSV hours already receive a source-specific override. The earlier
  concern about manual-count wording was not established as a visible defect.

## Validation evidence

The two added timestamp/provenance unit tests failed before their fixes and passed
afterward. The full unit/server suite now contains 131 passing tests. Syntax and
whitespace checks pass.

Completed browser matrix: all 15 suite/engine combinations passed (five suites
each in Chromium, Firefox and WebKit). These include mocked-adapter account tests;
they are not equivalent to the separate real-SDK emulator suite.

Firestore rules tests passed against the demo emulators. Real-SDK account browser
tests passed in Chromium and Firefox. The additional WebKit real-SDK run reached
its final browser-error assertion but failed because loopback Firestore streaming
requests produced access-control browser errors. This is an unresolved validation
failure, not a certified WebKit account pass. Production security settings were
not changed and the error assertion was not weakened to hide it.

Local-only evidence files (temporary, not durable release artifacts):

- `/tmp/payola-audit-unit.log`
- `/tmp/payola-audit-check.log`
- `/tmp/payola-audit-matrix.log`
- `/tmp/payola-audit-emulators.log`
- `/tmp/payola-audit-accounts-other-engines.log`
- `/tmp/payola-audit-ui-result.json`
- `/tmp/payola-audit-screenshots/`

The responsive audit captured all seven routes at 320, 390 and 1440 pixels, with
no page-level horizontal overflow. Representative mobile and desktop screenshots
were visually inspected. A synthetic 200,000-record restore took approximately
2.4 seconds on this desktop, retained correct counts/pagination and raised no
browser errors. This is not a physical-mobile performance certification.

Browser-matrix and emulator conclusions must be taken from their completed logs,
not inferred from a process starting. Emulator logs contain synthetic action links
and should remain private. Test dependencies live outside the repository in
`/tmp/payola-audit-tools`; matching Playwright browser binaries are cached locally.

## Remaining limits and release blockers

- Physical iOS/Android testing, real-inbox verification/reset delivery, real native
  export schema review, Job Tracker coordination and production interoperability
  remain outside this local audit.
- WebKit real-SDK emulator access-control errors need investigation before claiming
  real-client account certification across all three engines.
- Main-thread work on large histories remains a performance risk on slower devices.
  The desktop stress result does not justify claiming it is solved.
- Account writes intentionally remain locked until settlement, with a delayed
  warning. Indefinitely hanging SDK operations need further recovery design; simply
  unlocking retries could permit conflicting pending writes.
- Proxy-address-based Last.fm rate limiting requires deployment-network validation
  before making per-user fairness claims.
- Unicode wrapping preserves code points, not complete grapheme clusters. Complex
  combining/ZWJ sequences may still be broken across lines.
- The earlier saved production evidence indicates app/rules drift and missing
  receipt-collection rules. No production state was revalidated or changed here.
  Rules, index changes, deployments and production account writes each retain their
  separate approval boundaries.

No commit, push, deployment, rule publication or production account mutation is
part of this audit.