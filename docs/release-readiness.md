# Release readiness

## Current public npm release — 2026-10-14

`@duongnq2798/promiseproof@0.1.0` is public. The downloaded registry tarball matches the tested release bytes; genuine public npx checks returned PASS/0 and intentional FAIL/1, with stopped owned fixtures. Source checks passed 159 tests / 11 files and six OS/Node jobs. See the [release verification](releases/npm-0.1.0.md) for checksums, commands and exact boundaries. No hosted service, automatic client activation or external-user usability is claimed.

## Historical GitHub preview.2 readiness

The following preview evidence and its publication boundaries describe preview.2 at the time of that release; the npm follow-up is recorded above.

The scoped local MVP is implemented and exercised with real Chromium. It is usable from the checkout and the [GitHub preview.2 release](https://github.com/duongnq2798/promise-proof/releases/tag/v0.1.0-preview.2), published with an installable tarball and checksum under the user's release authorization. Preview.2 adds installed demo and runnable init templates and targets `0c6d48d`, which passed all six Windows/Linux/macOS and Node 22/24 CI jobs with 108 tests / 7 files. The final asset passed isolated consumer smoke, and its downloaded checksum matched. Exact local timeouts, focused reruns and CI evidence are recorded in verification.md; local full-suite success is not claimed for this increment. Preview.1 remains a separate earlier release. The package has not been published to npm or deployed as a hosted service. Stable registry release remains blocked by naming/ownership decisions and dedicated conduct/contact setup. Private vulnerability reporting is enabled on GitHub.

## Acceptance evidence

| Criterion                                      | Evidence                                                                                                                |
| ---------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| Local install/run without account or model key | Actual GitHub-downloaded preview.2 consumer passed demo/init/doctor/verify with exits 0/1/0; no fixture-service account |
| init preserves existing files                  | Built CLI integration tests                                                                                             |
| Valid/invalid specs                            | Strict Zod and semantic validation tests; invalid CLI exit 2                                                            |
| Real browser workflows                         | Passing form, lying form and isolated invitation examples                                                               |
| Deterministic assertions                       | Fixed browser/API adapters, exact observations/equality, no model in verdict                                            |
| Deliberate defect detected                     | UI PASS, persistence FAIL, downstream NOT_VERIFIED                                                                      |
| Missing evidence cannot pass                   | Dependency, unverified source and unavailable API regressions                                                           |
| Genuine screenshots/traces                     | PNG signatures, nonempty trace ZIPs, unique bundles and sample reports                                                  |
| Offline report/JSON parity                     | Browser-opened file report, image loading, zero external requests, persisted JSON equality                              |
| Actionable setup/report guidance               | Installed doctor readiness, recorded dependency/runtime links, preserved verdicts, keyboard/mobile report tests         |
| Security constraints                           | Origin/redirect regressions, stale response checks, credential and redaction tests; documented sandbox limits           |
| Exit codes                                     | Built CLI verifies 0/1/2/3                                                                                              |
| Tests/build/lint/format                        | Executed quality gates recorded in verification.md                                                                      |
| CI                                             | Preview.2's six OS/Node jobs passed, including evidence uploads, real examples and installed demo/init consumer checks  |
| Agent workflow                                 | Export/non-overwrite tests; explicit file plus CLI workflow exercised in this Codex session                             |
| Contributor foundations                        | MIT, conduct/security/contribution guides, issue/PR templates, architecture/schema guides                               |

## Boundaries

Chromium only; JSON only. Browser HTTP redirects, WebSockets and service workers are blocked. Response assertions capture status, not browser bodies; API assertions check body fields. No arbitrary DB/shell/eval, hosted dashboard, real email delivery, storage-state import, full-workflow retry or automatic agent repair loop. Binary artifacts cannot be universally redacted; credential-referenced runs disable them. Generic click consequences cannot be inferred, so only disposable test environments are appropriate.

Specs have revision/digest snapshots, but no cross-file monotonic revision registry or signatures. Preconditions are declarations unless encoded as assertions. Evidence proves the specified observations for one run; it is not exhaustive correctness or third-party attestation.

## Ongoing release checks

1. Maintain the confirmed npm scope `@duongnq2798/promiseproof` and source/version/checksum records. The older preview uses the separate promiseproof-local package and GitHub distribution; its immutable assets are not the npm runtime. Namespace ownership does not establish trademark clearance.
2. Keep GitHub private vulnerability reporting enabled; establish dedicated conduct/reporting contacts before a stable public launch. No email address or response SLA is invented for the preview.
3. Keep the Windows/Linux/macOS and Node 22/24 CI, evidence uploads and packed CLI smoke green for each subsequent candidate. Preview.2's [run 38505353242](https://github.com/duongnq2798/promise-proof/actions/runs/38505353242) passed these jobs; repository metadata and the authorized preview tag are established. Future product changes need evidence from their own source commit.

Runtime dependencies retain their own licenses: Playwright packages Apache-2.0; Zod/Commander MIT. The project is MIT. Local dependency audit reported zero vulnerabilities; this is not a guarantee against undisclosed defects or a legal trademark clearance.

The bundled Geist font retains its SIL Open Font License in assets/geist-LICENSE.txt. Font/style assets are included in the local package and embedded in generated reports so they do not depend on an external CDN.

## Current prioritization

Follow the [latest daily plan](superpowers/daily/2026-10-14.md) for active priorities and authorization. Public npm distribution is now verified. Actual first-use feedback, client activation and sponsorship retain their documented dependencies; earlier email/auth ideas do not automatically authorize new implementation. Security, false-verdict and lost-evidence defects retain precedence.
