# Research and reproduction — private CLI input errors

Date: 2026-10-14, Asia/Bangkok. Scope: the existing CLI JSON-file boundary; no new commands or changes to workflow assertions.

## Evidence

- [FACT] At source commit `f871ec0`, `src/cli.ts` wrapped file reads and JSON.parse in one catch, then forwarded the original exception message to stderr. Doctor already withheld its corresponding raw input errors. Source: `src/cli.ts:12` and `src/doctor.ts`.
- [FACT] Five real built-CLI regression cases failed before the repair. Four showed synthetic canaries from malformed spec/policy files in stderr across verify/list/report. The fifth found a missing-file message without a plain path-repair hint. Source: tests/e2e.test.ts, local RED run on 2026-10-14. No real secrets were used or observed.
- [FACT] Node documents SyntaxError as a JavaScript parsing error. Its exact text is not a safe input-output contract for this CLI. Source: [official Node errors documentation](https://nodejs.org/api/errors.html), reviewed 2026-10-14; canary inclusion is established by local reproduction, not inferred from that documentation.
- [FACT] OWASP recommends excluding credentials, access tokens and other sensitive data from application logs. Source: [official Logging Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Logging_Cheat_Sheet.html), reviewed 2026-10-14.
- [ASSUMPTION] A user may accidentally paste private content into malformed input or share an error with support. There is no evidence that a real user's secret leaked. Verify the privacy boundary with synthetic canaries now; collect actual support feedback only when provided or authorized.

## Selected bounded repair

- [RECOMMENDATION] Separate file access, byte-size validation and JSON parsing in the existing reader. Keep the file path and an actionable static hint; withhold raw parser/filesystem exception text. This addresses the cause instead of guessing credential patterns inside arbitrary parser messages.
- [RECOMMENDATION] Keep configuration exit 2, valid-input behavior, deterministic verdicts and security policy intact. Doctor remains setup-only. No dependencies, report redesign or new subsystem are needed.
- [RECOMMENDATION] Verify RED → GREEN through the built CLI, then full checks, read-only review, a packed consumer privacy probe and all six platform CI jobs. Test invalid input before app requests; retain genuine PASS / FAIL / PASS examples.

## Boundaries

[FACT] The repair withholds malformed file contents at this reader; it does not promise that every possible error or user-supplied path is secret-free. File paths remain visible. Binary artifact privacy and other validation/runtime error paths retain their existing documented constraints. External-user usability remains unverified.
