# Verification record

Date: 2026-10-13, Asia/Bangkok. Local host: Windows, Node.js 24.12.0. Runner uses Playwright 1.64.0 / Chromium revision 1248. Local commands and the separately observed initial-commit CI run are distinguished below. No npm publication or deployment is claimed.

## Quality checks

- Clean npm ci completed; dependency audit reported zero vulnerabilities. The workspace-local npm cache was selected through npm_config_cache to comply with filesystem permissions.
- npm exec playwright install chromium completed. Initial missing-browser installation used the equivalent direct Playwright installer with authorized cache access.
- The redesigned report passed npm run check: type checking, ESLint, Prettier verification, 72 tests across 4 files and production build. Test execution took 48.44 seconds. The suite uses real Chromium for browser/CLI acceptance tests.
- Editor JSON Schemas were generated from the same Zod contracts. CI YAML was parsed and its upload-on-failure/hidden-evidence policy checked.
- The independent reviewer separately ran 57 tests and real redirect/stale-response/credential probes during development. See adversarial-review.md for the findings, repairs and exact scope.

## Genuine examples

The sample generator invokes the actual built CLI against the running loopback fixture; no verdicts are hardcoded into reports. Passing form expects exit 0, lying form expects exit 1, invitation expects exit 0. Each generated report links its spec/result, fresh screenshots and configured traces.

The passing contract revision 2 asserts the record is initially absent, submits, checks UI success, reloads, confirms the exact saved record through the test API and checks browser errors. Fresh fixture sessions prevent reuse of older records. The failing contract preserves its original expected persistence value; UI confirmation passes, missing persistence fails and downstream evidence remains NOT_VERIFIED.

Invitation uses synthetic sender login, a fresh recipient context, an explicitly controlled link API and independent membership confirmation. No real mailbox or email delivery is tested.

Desktop and 390-pixel mobile screenshots of the actual offline failing report were visually inspected. README's image is browser-rendered output, not a generated mockup.

The redesigned report was informed by visually inspected Linear and Vercel Geist references. Its six additional Chromium tests cover preserved verdicts, expanded failures, mouse/keyboard theme controls, offline embedded-font/image loading, capture disclosures, mobile/tablet overflow and long untrusted observations. Report links reject active/external artifact URLs. Dark and light previews are generated from the same real failing run; captures disable transient CSS animations for stable screenshots.

## Packaging

npm pack creates a local tarball containing compiled CLI/ESM exports/declarations, local report stylesheet, licensed embedded font, schemas, examples, skill, source architecture and contributor materials. No node_modules, private run directory, .env, reviewer fixture or test workspace is included.

The final clean consumer smoke passed in a fresh isolated .smoke/package-* consumer directory. It installed only runtime dependencies, resolved the installed executable through npm exec --offline, ran init, imported the package's documented ESM exports, exported agent instructions without changing settings, read the packaged architecture file, and ran all three installed examples with exits 0/1/0. Each generated HTML title agreed with its JSON verdict. The smoke harness was corrected to use ESM imports rather than CommonJS resolution; the package is intentionally ESM.

Final genuine sample runs:

| Example       | Run id                                            | Result        | Assertions                     |
| ------------- | ------------------------------------------------- | ------------- | ------------------------------ |
| Saved contact | saved-contact-2026-10-13T16-59-58-285Z-17a7d85f   | PASS / exit 0 | 4 PASS                         |
| Lying form    | lying-form-2026-10-13T16-59-59-593Z-e4df82cf      | FAIL / exit 1 | 1 PASS, 1 FAIL, 1 NOT_VERIFIED |
| Invitation    | teammate-invite-2026-10-13T17-00-02-345Z-165c95fe | PASS / exit 0 | 6 PASS                         |

The original bundles remain under .promiseproof/runs. Portable copies are in docs/sample-report/passing, failing and invitation. The passing/failing bundles include context traces; invitation tracing is disabled because its API captures a link. All three include genuine screenshots.

## Remaining unverified boundaries

Fresh agent-client auto-discovery, Claude Code/Cursor invocation, external-user first-run testing, real email delivery and public registry installation have not been exercised. Public branding/owner/contact decisions remain pending. No output is described as cryptographic proof or production certification.

## Observed initial-commit CI

[GitHub run 38428830158](https://github.com/duongnq2798/promise-proof/actions/runs/38428830158), head `da2b8150fcf9dbdf49d7e7894b9af8b0f310215c`, completed successfully. All six jobs passed: Windows/Linux/macOS with Node 22 and 24. The workflow executes npm ci, Chromium installation, build/check, real samples, evidence upload, pack and isolated consumer smoke. Follow-up diagnostics changes below are not part of that commit's results.

## Actionable diagnostics follow-up

- Fresh npm run check passed type checking, ESLint, formatting, **83 tests across 5 files** and production build. The final suite took 28.50 seconds on this Windows host.
- Eight new CLI acceptance cases first failed against the original CLI, including a reproducible false-ready target-policy mismatch. They passed after implementation. An additional case covers captured URLs and unsafe API-capture tracing.
- A separate read-only reviewer inspected the new diagnostic module and CLI boundary. Its two findings were reproduced RED then fixed GREEN: secret-literal serialization parity and real evidence data writes with cleanup after failure. The quota failure is simulated at the FileHandle write boundary while creation and removal remain real; actual OS quota/ACL exhaustion is unverified.
- Real CLI coverage includes readable/JSON readiness, no app requests, missing/malformed files, missing browser, unwritable output, credential withholding, evidence constraints and unchecked boundaries. The JSON reports outcomesVerified false and setup-only readiness.
- `doctor-example.json` is output from the actual built doctor with the simple-form spec and example policy, formatted for readability; no verdict or check was fabricated.
- A fresh packaged consumer at `.smoke/package-njcLPg` passed installed init, doctor JSON readiness with outcomesVerified false, documented ESM exports, agent export and all three real workflows with exits 0/1/0. The enhanced consumer check is included in the existing CI workflow through `scripts/package-smoke.mjs`.
- The diagnostics implementation commit `3a4af81016443a33346ad43bb80d697efcaad88c` also passed all six Windows/Linux/macOS and Node 22/24 jobs in [run 38431931787](https://github.com/duongnq2798/promise-proof/actions/runs/38431931787), including the full suite and enhanced installed-doctor consumer check. No hosted user study is implied by this platform coverage.

## Contextual report guidance follow-up — 2026-10-14

- Fresh npm run check passed type checking, ESLint, formatting, **90 tests across 5 files** and production build on Windows. The final suite took 34.06 seconds. These results supersede the earlier local counts for this increment; prior CI runs above do not cover it.
- Seven new Chromium report tests failed before implementation and passed afterward; the report suite now has 13 tests. They cover actual failure/dependency navigation, explicit independent steps, runtime and cleanup focus, missing-evidence suggestions, safe ZIP trace commands, unchanged result data, PASS omission, native keyboard disclosures and 320/390-pixel layouts.
- A separate read-only reviewer found no Critical or Important issues. Its documentation finding was addressed in ARCHITECTURE.md. Additional probes inspected multiple dependencies, cleanup phase boundaries, explicit cross-phase dependencies, already-attempted NOT_VERIFIED steps, escaped labels and preserved input results.
- The sample generator rebuilt the three genuine CLI bundles shown above, with exits 0/1/0. Desktop dark/light previews and the new desktop/mobile Next steps captures were visually inspected. `report-next-steps.png` is browser-rendered output from the failing bundle, not a mockup.
- A fresh packed consumer at `.smoke/package-HsGCzu` passed installed init, doctor JSON readiness with outcomesVerified false, ESM exports, agent export and all three real browser workflows with exits 0/1/0. The consumer additionally checked that generated Next steps presence matches unsuccessful verdicts and is absent for PASS.
- Guidance consists of recommended investigation steps derived from recorded observations. Neither tests nor review establish user time saved, an application root cause or external-user usability. Direct screen-reader testing and suggested trace-command execution in a user's environment remain unverified.
- Implementation commit `50e9955e5da13f938b7b1d8ea8032293a2f76435` passed all six Windows/Linux/macOS and Node 22/24 jobs in [run 38436232239](https://github.com/duongnq2798/promise-proof/actions/runs/38436232239), including full checks, actual sample generation and installed-package guidance checks.
- The earlier documentation commit `126f4d5` had five successful jobs and a cancelled macOS/Node 22 job in [run 38432464125](https://github.com/duongnq2798/promise-proof/actions/runs/38432464125). Its GitHub annotation reports unavailable hosted-runner capacity; that job had no executed steps. This is recorded as an incomplete run, not a product-test failure or a six-job success.

## Private input errors follow-up — 2026-10-14

- Fresh npm run check passed type checking, ESLint, formatting, **95 tests across 5 files** and production build on Windows. The suite took 54.21 seconds. The five additional real built-CLI cases were first observed RED and then GREEN.
- Four RED cases reproduced malformed JSON content in stderr using synthetic canaries across verify/list/report; no real credentials were used. After repair, all four withheld contents and provided a JSON repair hint with exit 2. The verify-spec case also observed zero fixture app requests. The fifth case checks a missing-file path hint and empty stdout instead of a verdict.
- A fresh packed consumer at `.smoke/package-xqB8B4` passed an installed malformed-input privacy check with exit 2, then doctor readiness, init, ESM exports, agent export and all three genuine browser workflows with exits 0/1/0. Report guidance and JSON verdict parity checks remain active.
- The CLI intentionally still displays the input file path. This increment covers the shared JSON-file reader, not every validation/runtime message or binary-artifact privacy. OS permission exhaustion and external-user usability are not established by these tests.
- A separate read-only reviewer found no Critical, Important or Minor issues requiring repair. Its built-CLI probes confirmed malformed input with --json, missing paths, directory inputs, oversized input and a valid policy padded to exactly 1 MiB. The exact-limit input was accepted; rejected inputs exited 2 and created no evidence directory. These probes are distinct from the five automated regression cases. Exhaustive ACL testing remains unverified.
- Implementation commit `5f653c0043ef0319e903d69ac81275ba97624b7d` passed all six Windows/Linux/macOS and Node 22/24 jobs in [run 38493375599](https://github.com/duongnq2798/promise-proof/actions/runs/38493375599), including the full suite, genuine examples and the installed malformed-input privacy check. Earlier platform runs are separate historical evidence.

## GitHub preview preparation — 2026-10-14

- The user authorized distribution first and further development afterward. The candidate is a GitHub prerelease with a local-install tarball; npm publication, stable branding and hosted deployment are separate.
- Fresh npm run check passed typecheck, lint, formatting, 95 tests / 5 files and build; tests took 70.59 seconds. A fresh candidate consumer at `.smoke/package-UMlRB1` passed all installed checks and three real workflows with exits 0/1/0.
- Read-only independent review found no Critical/Important/Minor issues. Its package dry-run confirmed the necessary runtime/example/docs assets and excluded private runs, .env, caches, node_modules and probe files. Release notes distinguish source test evidence from external-user usability.
- GitHub private vulnerability reporting was enabled and read back as true. No vulnerability message was sent. Final asset checksum and actual release publication are recorded when performed.

## Published preview.1

- [GitHub v0.1.0-preview.1](https://github.com/duongnq2798/promise-proof/releases/tag/v0.1.0-preview.1) was published as a prerelease at exact commit `4329a4fa22355f3ade974669c28f8e3a924ee541`. All six candidate OS/Node jobs passed in [run 38500300474](https://github.com/duongnq2798/promise-proof/actions/runs/38500300474).
- The final asset consumer at `.smoke/package-csoHSW` passed the full installed smoke with exits 0/1/0. A separate direct-entrypoint probe started the packaged examples/server.mjs, served the real form over loopback and terminated it afterward.
- Published assets are `promiseproof-local-0.1.0.tgz` (995060 bytes) and `SHA256SUMS.txt`. SHA-256: `e6f518fe102d28adc37df983052d23f07db62adff42297065d54d29bf8943c17`. Both assets were downloaded again from GitHub and the computed tarball checksum matched the published file. The checksum is transfer/version evidence, not a digital signature.
- Main-branch work after this tag is separate. Preview.1 retains the direct fixture-start command; its tarball does not contain the new demo CLI.

## Installed demo CLI follow-up

- Six new built-process tests ran assertion RED before implementation and GREEN after it. They cover four invalid ports, an occupied listener that remains intact, real fixture serving on port 0 and port release after termination; startup creates no local policy/evidence files.
- Fresh npm run check passed typecheck, lint, formatting, **101 tests / 6 files** and build. Tests took 57.58 seconds on Windows. The final source package consumer at `.smoke/package-GrJ8Fb` used the installed demo process for all three real browser workflows and passed with exits 0/1/0.
- Read-only independent review found no Critical/Important issues. Its Minor about fragmented stdout in the smoke harness was addressed using a complete-line reader, bounded startup and early-close diagnostics. The harness then passed again at `.smoke/package-GCyaXn`, including installed demo, init, doctor, privacy checks, exports, agent export and all three workflows.
- Independent Windows probes emitted SIGINT/SIGTERM events with a real idle TCP connection and observed socket closure/exit 0. Built-process tests terminate the process and check port release; Unix jobs also assert exit 0. A real Windows keyboard Ctrl+C interaction remains unverified. No external-user feedback or internet-facing bind probe is claimed.
- The new CLI is main-branch development after preview.1. Implementation commit `159eb500da3918e1556619e27dcde854db8be4a3` passed all six Windows/Linux/macOS and Node 22/24 jobs in [run 38501613887](https://github.com/duongnq2798/promise-proof/actions/runs/38501613887), including the 101-test suite and installed-demo consumer workflows.

## Runnable init / preview.2 candidate

- Seven new built-CLI cases cover real generated simple-form/failing-workflow/invitation-flow specs, default-starter compatibility, unsupported names and existing-file preservation. Six cases were observed assertion RED before implementation; the existing default behavior already passed. All seven then passed, including three real browser results 0/1/0.
- Initial full check had 107 PASS and 1 FAIL (108 tests / 7 files, 220.61 seconds): `a second response assertion cannot reuse the first action response`. Focused reproduction showed submit click timing out on element stability under the test's global 500 ms deadline, so the desired assertion was blocked as NOT_VERIFIED.
- The test was repaired by keeping 500 ms only on its missing-response assertion and requiring submit/network/edit to PASS. URL, status, after-action identity and expected FAIL are unchanged; no runner/browser deadline or retry changed. The parent's focused rerun passed in 3.13 seconds. Final full checks and installed smoke remain required before publication.
- Independent review found no Critical/Important/Minor issues in init or the repaired test. Probes confirmed normalized contract parity (apart from baseUrl, omitted relative schema link and equivalent demo-start wording), partial-file preservation, invalid/encoded traversal choices and credential/malformed URL rejection before writes. Its additional focused test attempt hit the overall 30-second test timeout without a returned result; concurrent processes were observed, but a cause for that separate timeout was not established. The reviewer stopped further browser probes while the parent's full check runs.
- The next local full suite passed 105/108 but hit the 30-second test-level deadline in `blocks browser redirect destinations outside policy`, `fresh runs cannot reuse screenshot paths`, and `returns 3 for unavailable infrastructure` (482.25 seconds total). All three subsequently passed together in a focused run in 13.90 seconds, without code/deadline changes. A host CPU sample read 100%; this is an observation, not a confirmed cause for every timeout. Local full-suite success is not claimed. The candidate remains isolated until full CI and final installed-consumer evidence are available.

## Published preview.2

- Implementation commit `0c6d48de6b72f9a952a0949cf47a3a88a48dcbe0` passed all six Windows/Linux/macOS and Node 22/24 jobs in [run 38505353242](https://github.com/duongnq2798/promise-proof/actions/runs/38505353242), including the full 108-test / 7-file suite, quality checks, build, real sample generation and installed demo/generated-init consumer smoke. The same commit was fast-forwarded into main; no additional product changes were introduced during integration. The local timeout observations above remain recorded.
- Main's independent post-integration [run 38506072772](https://github.com/duongnq2798/promise-proof/actions/runs/38506072772) also completed with all six jobs successful at the same exact commit. This confirms the integrated source rather than relying on a historical version's CI.
- A fresh final-asset consumer at `.smoke/package-RrasJ0` passed installed demo, generated examples, malformed-input privacy, setup-only doctor, ESM exports, agent export and all three real workflows with exits 0/1/0. The asset was built from the clean committed release target, then preserved separately from subsequent packages.
- [GitHub v0.1.0-preview.2](https://github.com/duongnq2798/promise-proof/releases/tag/v0.1.0-preview.2) was published as a prerelease, not a draft, at exact commit `0c6d48de6b72f9a952a0949cf47a3a88a48dcbe0`. Published assets are `promiseproof-local-0.1.0.tgz` (1001541 bytes) and `SHA256SUMS.txt` (96 bytes). SHA-256: `ce68565f6be7df7fe80f6504a194c0111515f61f6ac573b981d6b0e04202fe26`. Both assets were downloaded again into `.smoke/release-download-preview.2`; the computed tarball hash matched both the downloaded checksum file and the preserved final asset. This is transfer/version evidence, not a digital signature.
- Preview.2 includes demo and runnable init templates; preview.1's tag and assets were not replaced. The package name/version remain provisional promiseproof-local 0.1.0 and private; no npm publication, hosted deployment or external-user study is implied.
- A second fresh consumer at `.smoke/package-uPdpJK` installed the actual GitHub-downloaded tarball and passed the complete smoke: installed demo, generated init templates, privacy checks, setup-only doctor, exports, agent instructions and three real Chromium workflows PASS / FAIL / PASS with exits 0/1/0. This validates the downloaded bytes, not only the source checkout or pre-upload package.
