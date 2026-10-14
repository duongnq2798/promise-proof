# Release readiness

The scoped local MVP is implemented and exercised on Windows with real Chromium. It is usable from the checkout and a local tarball. The source repository is [duongnq2798/promise-proof](https://github.com/duongnq2798/promise-proof). A GitHub development preview is being prepared with an installable tarball and checksum under the user's release authorization. It has not been published to npm or deployed as a hosted service. Stable registry release remains blocked by naming/ownership decisions and dedicated conduct/contact setup. Private vulnerability reporting is enabled on GitHub. The private-input repair `5f653c0` passed all six Windows/Linux/macOS and Node 22/24 CI jobs; exact local and CI evidence is recorded in verification.md. Subsequent changes need their own verification.

## Acceptance evidence

| Criterion                                      | Evidence                                                                                                               |
| ---------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| Local install/run without account or model key | Clean dependency install, packed consumer smoke, no external services in the fixture runner                            |
| init preserves existing files                  | Built CLI integration tests                                                                                            |
| Valid/invalid specs                            | Strict Zod and semantic validation tests; invalid CLI exit 2                                                           |
| Real browser workflows                         | Passing form, lying form and isolated invitation examples                                                              |
| Deterministic assertions                       | Fixed browser/API adapters, exact observations/equality, no model in verdict                                           |
| Deliberate defect detected                     | UI PASS, persistence FAIL, downstream NOT_VERIFIED                                                                     |
| Missing evidence cannot pass                   | Dependency, unverified source and unavailable API regressions                                                          |
| Genuine screenshots/traces                     | PNG signatures, nonempty trace ZIPs, unique bundles and sample reports                                                 |
| Offline report/JSON parity                     | Browser-opened file report, image loading, zero external requests, persisted JSON equality                             |
| Actionable setup/report guidance               | Installed doctor readiness, recorded dependency/runtime links, preserved verdicts, keyboard/mobile report tests        |
| Security constraints                           | Origin/redirect regressions, stale response checks, credential and redaction tests; documented sandbox limits          |
| Exit codes                                     | Built CLI verifies 0/1/2/3                                                                                             |
| Tests/build/lint/format                        | Executed quality gates recorded in verification.md                                                                     |
| CI                                             | Private-input repair's six OS/Node jobs passed, including evidence uploads, real examples and packaged consumer checks |
| Agent workflow                                 | Export/non-overwrite tests; explicit file plus CLI workflow exercised in this Codex session                            |
| Contributor foundations                        | MIT, conduct/security/contribution guides, issue/PR templates, architecture/schema guides                              |

## Boundaries

Chromium only; JSON only. Browser HTTP redirects, WebSockets and service workers are blocked. Response assertions capture status, not browser bodies; API assertions check body fields. No arbitrary DB/shell/eval, hosted dashboard, real email delivery, storage-state import, full-workflow retry or automatic agent repair loop. Binary artifacts cannot be universally redacted; credential-referenced runs disable them. Generic click consequences cannot be inferred, so only disposable test environments are appropriate.

Specs have revision/digest snapshots, but no cross-file monotonic revision registry or signatures. Preconditions are declarations unless encoded as assertions. Evidence proves the specified observations for one run; it is not exhaustive correctness or third-party attestation.

## Before a stable registry release

1. Resolve the PromiseProof name conflict, public package owner and package namespace. The source repository is established above. Keep private true until the package decisions are settled. The preview uses the provisional promiseproof-local package name and GitHub distribution; it is not advertised as an npm registry package.
2. Keep GitHub private vulnerability reporting enabled; establish dedicated conduct/reporting contacts before a stable public launch. No email address or response SLA is invented for the preview.
3. Keep the Windows/Linux/macOS and Node 22/24 CI, evidence uploads and packed CLI smoke green for the candidate release. The private-input repair's [run 38493375599](https://github.com/duongnq2798/promise-proof/actions/runs/38493375599) passed these jobs. Then add verified package repository metadata and create a release tag with user authorization.

Runtime dependencies retain their own licenses: Playwright packages Apache-2.0; Zod/Commander MIT. The project is MIT. Local dependency audit reported zero vulnerabilities; this is not a guarantee against undisclosed defects or a legal trademark clearance.

The bundled Geist font retains its SIL Open Font License in assets/geist-LICENSE.txt. Font/style assets are included in the local package and embedded in generated reports so they do not depend on an external CDN.

## Next three engineering priorities

1. Validate first-run usability with external developers; maintain the now-executed OS matrix for subsequent changes.
2. Add a controlled test email-receiver adapter with explicit delivery/acceptance boundaries.
3. Implement tested redirect/authentication support under a stronger network isolation policy, preserving per-hop authorization and sensitive-evidence controls.
