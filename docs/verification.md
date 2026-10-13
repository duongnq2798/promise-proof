# Verification record

Date: 2026-10-13, Asia/Bangkok. Host: Windows, Node.js 24.12.0. Runner uses Playwright 1.64.0 / Chromium revision 1248. Commands below were executed locally; no remote CI result, npm publication or deployment is claimed.

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
| Saved contact | saved-contact-2026-10-13T12-09-56-126Z-5cf6740d   | PASS / exit 0 | 4 PASS                         |
| Lying form    | lying-form-2026-10-13T12-10-00-514Z-91268f6b      | FAIL / exit 1 | 1 PASS, 1 FAIL, 1 NOT_VERIFIED |
| Invitation    | teammate-invite-2026-10-13T12-10-04-850Z-3c61d0b2 | PASS / exit 0 | 6 PASS                         |

The original bundles remain under .promiseproof/runs. Portable copies are in docs/sample-report/passing, failing and invitation. The passing/failing bundles include context traces; invitation tracing is disabled because its API captures a link. All three include genuine screenshots.

## Remaining unverified boundaries

Fresh agent-client auto-discovery, Claude Code/Cursor invocation, Linux/macOS execution, remote GitHub Actions uploads, real email delivery and public registry installation have not been exercised. Public branding/owner/contact decisions remain pending. No output is described as cryptographic proof or production certification.
