# Review a saved outcome in CI

Current source builds support `promiseproof summary RUN_ID [--config POLICY] [--artifact-url HTTPS_URL]`. It prints Markdown for one saved run and returns its recorded verdict's exit code: **0 PASS**, **1 FAIL/NOT_VERIFIED**, **3 ERROR**. Invalid input exits **2** with no summary.

This feature is development after preview.2. Build and install a current local tarball for a consuming project; the existing preview.2 download lacks the command.

## Inspect one saved run

From the project where verification ran:

```sh
npm exec --offline -- promiseproof list
npm exec --offline -- promiseproof summary RUN_ID
```

Replace `RUN_ID` with an ID printed by list. The default policy is `.promiseproof/config.json`. Use `--config` for another policy.

The output shows the recorded verdict, run/contract identity, revision and digest, workflow assertion counts, unsuccessful actions/cleanup and blocked prerequisites. Counts cover workflow assertions; failed actions, cleanup or runtime errors can prevent overall PASS even when those counts look successful.

See [a summary of the genuine broken-form run](summary-example.md). Raw observations and request data remain in the offline report/result bundle. Summary generation reads that bundle, preserves its contents and does not contact the app.

`--artifact-url` accepts a caller-supplied HTTPS download link without embedded credentials or newlines. It rejects recognized sensitive query keys, including tokens, API keys and common signed-link credentials, rather than exposing them or silently breaking a redacted link. Use an authenticated artifact-download page instead. Accepted links are encoded and never fetched. Without a link, the output names the files to open in the downloaded run folder; it does not invent a hosted report URL.

## Use the copyable recipe

Install a current local package in your consuming project, then copy [ci-run.mjs](ci-run.mjs) to `scripts/promiseproof-ci.mjs`. Start and wait for your authorized test app using your project's existing startup routine. Run:

```sh
node scripts/promiseproof-ci.mjs path/to/spec.json path/to/policy.json
```

Arguments default to `.promiseproof/example.json` and `.promiseproof/config.json`. The helper resolves the installed ESM package, runs the real CLI, saves `summary.md` beside its result/report and retains verification's exit code. It uses no shell to launch the CLI.

When `GITHUB_STEP_SUMMARY` is set by GitHub Actions, the same Markdown is appended there. For a local rehearsal, set it to a new writable file in your test workspace. PASS returns 0; intentional FAIL returns 1 with its evidence and summary retained; infrastructure ERROR returns 3. Invalid input returns 2 with an unavailable-result note instead of a fabricated verdict. Failed summary generation or destination writes return 3.

Configure your project's `verify:outcome` script to start/wait for the test app and invoke this helper with your actual contract/policy. The [consumer workflow](ci-example.yml) then:

1. Installs the locked package and Chromium.
2. Runs your verification script.
3. Uploads the whole evidence directory with `always()`, including failed runs.
4. Adds the uploader's generated artifact-download URL to the job summary.

Do not suppress verification failures with `|| true` or make its step permanently successful. The helper already handles expected nonzero verdicts while retaining their evidence.

## GitHub behavior and boundaries

GitHub supports Markdown job summaries through its per-step `GITHUB_STEP_SUMMARY` file, with a 1 MiB limit. The renderer rejects oversized output before printing any partial summary. Existing JSON-file reads also have a 1 MiB limit. [Official job-summary reference](https://docs.github.com/en/actions/reference/workflows-and-actions/workflow-commands#adding-a-job-summary).

The upload action exposes `artifact-url`; readers must be signed in, and the link lasts only while the artifact/run/repository exists. It downloads evidence rather than hosting our HTML report. [Uploader outputs](https://github.com/actions/upload-artifact#outputs).

The command validates supported saved-result shape, counts, status precedence and identity. That is consistency checking, not proof that an editable bundle is authentic. Untrusted text is escaped; screenshots/traces may still contain private page data. Review artifacts and retention/access settings before sharing.

The helper emits only the recorded status and evidence location in its terminal success message, encoding the path as a JSON string so control characters cannot become workflow commands. It writes a new summary for its newly created run; it does not rewrite result.json, spec.json or report.html. It makes no PR comments or publication calls. Local tests exercise the recipe; hosted GitHub behavior requires its own actual workflow execution.

See [security](security.md), [troubleshooting](troubleshooting.md) and [the first-run guide](getting-started.md).
