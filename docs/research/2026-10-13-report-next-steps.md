# Research synthesis — actionable evidence reports

Date: 2026-10-13, Asia/Bangkok. Scope: help a person investigate an unsuccessful recorded run without guessing a root cause or changing its acceptance criterion.

## Key findings

- [FACT] Playwright's trace viewer can inspect recorded actions, before/after state, errors, console messages and network observations. It supports local saved traces through `playwright show-trace`. Source: [official trace viewer documentation](https://playwright.dev/docs/trace-viewer), reviewed 2026-10-13.
- [FACT] Playwright recommends tests based on user-visible behavior and isolated state. Source: [official best practices](https://playwright.dev/docs/best-practices), reviewed 2026-10-13.
- [FACT] PromiseProof already preserves expected/observed data, screenshots, traces and replay instructions. Its failing fixture records UI PASS, API FAIL and a dependent NOT_VERIFIED assertion. Source: `src/reporter.ts` and `docs/sample-report/failing/result.json` at commit `126f4d5`.
- [FACT] Setup-only diagnostic guidance exists in doctor; report guidance is the next priority in the daily record. Source: `src/doctor.ts` and `docs/superpowers/daily/2026-10-13.md`.

## Insights

- [ASSUMPTION] People benefit from a visible bridge between a failed observation and the next investigation action. This has not been confirmed by an external user study. Verify controlled behavior, navigation, keyboard use and mobile layout now; collect user feedback when available.
- [RECOMMENDATION] Add concise suggestions from the recorded status, phase and step type. A suggestion never changes the result or asserts an inferred cause.
- [RECOMMENDATION] Link blocked steps to failed prerequisites only when a zero-attempt NOT_VERIFIED step and its declared/default dependencies support that relationship. Independent steps must not inherit preceding failures in guidance.

## Recommendations

1. **Contextual next checks** → product engineering. Add a small guidance block to nonpassing steps and a run-level Next steps destination. Reach and time saved remain unmeasured.
2. **Safe replay tools** → developer experience. Offer doctor/verify commands using the recorded spec and a policy placeholder; offer a local trace command only for a safe ZIP basename. Commands remain text and never execute in the report.
3. **Preserve report clarity** → product design/QA. Keep successful reports uncluttered; reuse theme tokens and native disclosures; verify keyboard, mobile and offline behavior with real reports.

## Selected bounded design and acceptance

Extend the reporter with `src/report-guidance.ts`, a pure helper over recorded results. Select a recorded runtime error, ERROR, FAIL or NOT_VERIFIED item; return recommended checks for its actual type/phase and supported dependency links. Do not contact a service or mutate result data.

Unsuccessful reports receive a verdict link to `#next-steps`, a compact Next check in nonpassing step details, and a Next steps section after workflow/evidence. Native details expose doctor/replay commands and safe local trace instructions. PASS reports receive no failure prompts. Runtime observations and cleanup failures receive their own guidance; original expectations remain authoritative.

Acceptance: tests run RED before code. Cover failure/dependency links, independent steps, cleanup/runtime focus, missing evidence, safe trace commands, preserved result data/statuses, keyboard and 320/390-pixel layouts. Inspect fresh CLI sample bundles, then run full checks, independent review, package smoke and platform CI.
