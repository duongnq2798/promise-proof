# Research synthesis — first-run diagnostics

Date: 2026-10-13, Asia/Bangkok. Scope: help a developer or coding agent diagnose setup before running an outcome specification. Method: primary documentation, current source, existing examples and GitHub CI evidence. No customer interviews or usage metrics are claimed.

## Key findings

- [FACT] Playwright browser binaries are version-specific; browser installation and Linux system dependencies are separate setup concerns. Source: [Playwright browser documentation](https://playwright.dev/docs/browsers), reviewed 2026-10-13.
- [FACT] npm's diagnostic command checks environment components separately, including filesystem permissions. Source: [npm doctor documentation](https://docs.npmjs.com/cli/v11/commands/npm-doctor/), reviewed 2026-10-13.
- [FACT] GitHub CLI exposes structured authentication diagnostics, but its documented JSON mode has a different exit-code behavior. A machine consumer must understand the command's contract. Source: [gh auth status](https://cli.github.com/manual/gh_auth_status), reviewed 2026-10-13.
- [FACT] PromiseProof's existing doctor launches Chromium, parses policy, probes evidence-directory writes and optionally checks environment-variable presence. It does not authorize the spec's target against the policy and does not emit JSON. Source: `src/cli.ts` at commit `da2b815`.
- [FACT] The initial commit's CI completed successfully for Windows, Linux and macOS on Node 22 and 24, including example generation and packaged-consumer checks. Source: [run 38428830158](https://github.com/duongnq2798/promise-proof/actions/runs/38428830158).

## Insights

- [ASSUMPTION] Checking setup and explaining repair steps before verification will reduce first-use friction. Validate through reproducible missing-input/browser/policy cases now, then real user feedback when available. Owner: implementation agent for controlled cases; product owner for user feedback.
- [RECOMMENDATION] Present checks individually and return stable codes, repair hints and consistent nonzero exits for failed setup. A readable terminal view and JSON should describe the same checks.
- [RECOMMENDATION] Never confuse setup readiness with a verified application outcome. Doctor should make no app requests, execute no workflow actions and explicitly state that outcomes have not been verified.

## Recommendations

1. **Actionable doctor** → engineering. Check policy/spec compatibility, credential/evidence constraints, environment and filesystem; add structured output. Impact estimate: addresses reproducible setup gaps; user-scale impact is unmeasured.
2. **Task-based quickstart** → developer experience. Separate fixture walkthrough from using PromiseProof on a user's own app and document every supported diagnostic exit. Impact estimate: fewer ambiguous next steps; unmeasured.
3. **Keep coverage claims current** → QA. Record the successful six-job CI run and distinguish it from external user testing. Impact estimate: clearer platform support boundaries; no new platform promise without evidence.

## Selected bounded design

Extend the existing doctor flow through `src/doctor.ts`; keep the runner's verdict and action behavior intact. The CLI accepts `--json`. Its result has schemaVersion `1`, status `READY` or `BLOCKED`, outcomesVerified `false`, exitCode `0`, `2` or `3`, and checks with stable codes, names, `PASS`/`FAIL`/`NOT_CHECKED`, detail and optional remediation.

Exit `2` means an invalid/missing input or an incompatible policy/spec; exit `3` means an environmental prerequisite failed. Input errors take precedence. No spec means workflow-specific checks are `NOT_CHECKED`. Captured URLs cannot be checked before execution and are explicitly deferred. READY concerns available setup checks only, never app reachability or correctness.

Use existing validators and authorization helpers. Do not echo input JSON, URL values or environment values in diagnostics. Do not automatically install dependencies, change policy, retry actions or contact the application. A uniquely named temporary file probes evidence writes and is removed afterward.

Acceptance: real CLI tests cover JSON readiness, disallowed targets without app requests, invalid/missing files, missing Chromium, unwritable evidence, withheld secrets, credential/evidence conflicts and runtime-only URL caveats. Run RED before implementation, then GREEN and the complete suite. Update guides, architecture and the daily record after verification.

## Independent review follow-up

[FACT] The reviewer identified a serialization mismatch in secret-literal checks and an empty-file probe that did not test actual data writes. Both were reproduced with failing regressions before repair. Doctor now matches the runner's normalized pretty JSON and writes a sentinel before closing/removing its uniquely owned probe. The quota-error regression simulates the failing data-write boundary; file creation and cleanup are real. No actual full-disk/OS quota test is claimed.

[RECOMMENDATION] Keep app reachability and workflow outcomes in verify. Runtime captured URLs remain deferred, protocol statuses stay stable during redaction, and external-user feedback remains a separate validation step.
