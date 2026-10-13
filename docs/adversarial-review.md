# Independent adversarial review

Review date: 2026-10-13. This review was performed by a separate reviewer agent, which did not edit the implementation. The implementation agent received the findings and owns the fixes and regression tests.

The review focuses on false passing results, assertion dependencies, origin restrictions, credentials, output consistency, CLI behavior, and package contents. It is a targeted review, not a penetration test or a claim of exhaustive correctness.

## Confirmed defects found during development

| Finding                                                     | Reproduction before remediation                                                                                                                                                                                        | Required correction                                                                                  |
| ----------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| HTTP redirects bypassed origin policy                       | An approved local server returned a 302 to a second local origin absent from `allowedOrigins`. The second server received one request and the run returned `PASS`.                                                     | Prevent unauthorized redirect requests before they reach the destination, including redirect chains. |
| Response evidence could be reused                           | A working button made one successful `/signal` request. A second button did nothing. Both response assertions passed against that single response, and the run returned `PASS`.                                        | Bind response evidence to the request's initiating action and reject stale observations.             |
| Literal credentials leaked into the saved specification     | An API step used a synthetic literal `authorization` header. `result.json` redacted it, but `spec.json` retained the literal on both successful and unavailable-browser runs.                                          | Reject credential literals before writing any evidence; require environment references.              |
| URL credential literals leaked into the saved specification | An API URL containing a synthetic `?token=` value returned `PASS` and retained that value in `spec.json`.                                                                                                              | Reject recognizable sensitive query literals and require environment references.                     |
| Generic redaction could corrupt protocol fields             | Source review showed that replacement applied to all result strings, including status values. An environment value equal to a verdict string could change the serialized verdict while leaving summary keys unchanged. | Preserve validated protocol fields and redact data-bearing fields.                                   |

The first three defects were reproduced with real headless Chromium and temporary localhost servers. The initial reproduction used an already installed Chromium revision 1243 with a reviewer-only executable override because the project's required revision 1248 had not yet finished downloading. This limitation applies to the initial probes; final verification is recorded below.

The redirect defect was also confirmed directly in the installed Playwright source: redirected requests are continued without calling the user route handler. The official [Playwright route documentation](https://playwright.dev/docs/api/class-route) describes redirect behavior and disabling automatic redirects for `route.fetch`.

## Remediation verification

The first remediation rerun used real Chromium revision 1243 and the rebuilt implementation. Outcomes:

- Unauthorized redirect: `ERROR`; the denied server received zero requests.
- Same-origin redirect leading to an unauthorized redirect: `ERROR`; the denied server received zero requests. The guarded MVP blocks browser HTTP redirects altogether.
- Broken second submission after an earlier successful response: `FAIL`; only the first request existed.
- Delayed response from an earlier action arriving during a later action: `FAIL`; evidence retained the original initiating action identifier.
- Literal authorization header: rejected with `ConfigurationError` before execution.
- Environment credential whose value was `PASS`: verdicts remained `PASS` and assertion counts remained consistent.

The URL credential case required a follow-up fix. A final independent probe run against Chromium revision 1248, without any executable override, reproduced all remediation outcomes above and confirmed that the literal `?token=` URL was rejected before execution. A source-review follow-up identified camel-case `apiKey` query names as an additional recognizable credential spelling to reject.

An independent `npm test` run using the project's installed Chromium revision 1248 completed successfully: 2 test files, 57 tests passed, 32.00 seconds. This included real browser examples, local offline report loading, artifact persistence, missing sources, dependency failure, CLI exit codes, and the initial remediation regressions. Later code changes must be checked separately.

## Security and evidence limits examined

- Verdict aggregation includes action failures, assertion failures, missing evidence, cleanup results, and infrastructure errors. A downstream step whose dependency failed is represented as `NOT_VERIFIED`.
- The report renders runner results and escapes observed text; it does not ask an LLM to rejudge assertions.
- API verification uses explicitly authorized GET endpoints and does not follow redirects automatically.
- Browser contexts are isolated and closed; screenshots have unique run directories and filenames.
- Environment-backed credentials cannot be combined with screenshot or trace collection because binary artifacts are not reliably redactable.
- Browser content remains untrusted data. The runner has no page-to-shell or page-to-agent instruction path.
- Literal credentials hidden in arbitrary text or secrets that an application renders cannot be universally recognized. Evidence settings and synthetic fixtures remain essential.

## Release checks

- A repository-local-cache `npm pack --dry-run --ignore-scripts --json` succeeded. The package included the compiled CLI, JavaScript exports, declarations, schemas, examples, agent skill, README, and documentation. It excluded source tests, reviewer fixtures, reviewer evidence, credentials, and `node_modules`.
- A tarball installed into a fresh local consumer directory with only its runtime dependencies. Installed `init` worked, ESM exports resolved, the installed passing form workflow returned exit `0` / `PASS`, and the installed broken workflow returned exit `1` / `FAIL`. Both generated HTML reports agreed with the JSON verdict.
- The package smoke artifact preceded final documentation updates. Final release preparation must repack after those updates. The review identified that the architecture document linked to a root `ARCHITECTURE.md` that also needs to be included in the package.
- The independent suite completed on Windows using Chromium revision 1248. Other operating systems require their own CI executions; the reviewer does not claim they were executed locally.

No package publication, remote push, deployment, or external account creation was performed by this reviewer.
