# Troubleshooting

In a generated report, use **View next steps** to start with the relevant recorded observation. **Next check** separates API/UI checks, unmet prerequisites, cleanup and runtime failures. Prerequisite links reflect the executed contract; independent steps do not inherit a preceding failure. Expand **Commands and trace tools** for local doctor, replay and safe ZIP trace instructions. Keep the bundle's screenshots/traces and original acceptance criterion intact.

Start with `promiseproof doctor --spec <spec.json> --config <policy.json>`. From the checkout, use `node dist/cli.js` in place of `promiseproof`. Each failed diagnostic has a stable code and a next action; add `--json` for an agent or script. Doctor checks setup without contacting the application or proving its outcomes.

| Doctor code                 | Next action                                                                                             |
| --------------------------- | ------------------------------------------------------------------------------------------------------- |
| CONFIG_MISSING              | Run init or supply the policy with --config                                                             |
| CONFIG_INVALID              | Check JSON and exact origins; do not put paths or trailing slashes in allowedOrigins                    |
| SPEC_MISSING / SPEC_INVALID | Check the --spec path, JSON, supported step types and dependency order                                  |
| TARGET_POLICY               | Check URLs against allowedOrigins; remote opt-in applies only to an authorized test deployment          |
| ENVIRONMENT_VARIABLE        | Set the named variable in the process running PromiseProof; values are withheld                         |
| EVIDENCE_POLICY             | Disable binary artifacts for credential references and traces for API captures; replace secret literals |
| EVIDENCE_DIRECTORY          | Use a writable directory and check permissions/free space                                               |
| CHROMIUM                    | Install matching binaries if missing; otherwise check OS dependencies, permissions and browser policies |

Doctor exits **2** for invalid/missing inputs or incompatible policy/spec, **3** for environment failures, and **0** for ready setup. Input failures take precedence. Captured URLs remain NOT_CHECKED until the runner can resolve and authorize them. Supplying no spec omits workflow-specific checks. A READY result never substitutes for `verify`.

| Observation                    | Action                                                                                |
| ------------------------------ | ------------------------------------------------------------------------------------- |
| Missing Chromium               | npm exec playwright install chromium; Linux may need --with-deps                      |
| Origin not allowed             | Add only exact authorized test origins to the separate policy                         |
| Remote target rejected         | Confirm test deployment and explicitly set allowRemote true                           |
| Browser HTTP redirect rejected | Navigate directly to final URLs; redirect authentication is deferred                  |
| Credential missing             | Set the named variable; doctor checks presence without printing it                    |
| Evidence disabled              | Turn off screenshots/traces for credential runs; captures disable traces too          |
| NOT_VERIFIED                   | Inspect the failed dependency or missing-evidence reason                              |
| API mismatch after UI success  | Backend effect is unverified; do not replace expected with broken observations        |
| API unavailable                | Start the test source; ERROR is not PASS                                              |
| Response timeout               | after must identify the initiating action for that exact request URL                  |
| Locator/text mismatch          | Inspect accessible names; exact text uses Playwright normalization                    |
| Images absent after copying    | Copy the entire bundle                                                                |
| Console errors                 | Put noErrors after the relevant milestone; it covers errors observed so far           |
| Cannot save evidence           | Use writable outputDir; doctor probes writes                                          |
| Missing email receiver         | Configure a test source or explicit unverified assertion; link access is not delivery |

Only JSON specs are supported. YAML, regex expectations and custom code are deferred. No sleeps, hidden retries, hosted dashboard or model key are needed. Open traces with local Playwright show-trace; verdicts live in result.json/report.html.

Credential literals are checked conservatively against the serialized spec. Very short/common environment values may collide with ordinary spec text and be rejected; use dedicated high-entropy test secrets.

## Invalid input before a run

`verify`, `list` and `report` return exit **2** for an unreadable file, malformed JSON or an input larger than 1 MiB. The message names the file and gives a next action. A missing path is resolved relative to your terminal's current directory. Use a readable file; for invalid JSON, check quotes, commas and matching brackets in your editor. Parser details and malformed file contents are withheld from terminal output. File paths remain visible, so avoid placing sensitive values in filenames.

No application outcome has been tested at this stage. Fix the input, run doctor with the relevant spec/policy, then rerun verify. Share the safe error message and a minimal sanitized reproduction when requesting help; keep credentials in environment references.
