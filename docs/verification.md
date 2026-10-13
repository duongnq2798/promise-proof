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
- Platform CI for this increment will be recorded after its implementation commit is pushed and the run completes.
