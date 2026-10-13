# Implementation plan

1. A single strict TypeScript package: validated JSON specifications, security policy, browser runner, reporters, CLI. Reuse Playwright rather than implement automation primitives.
2. Browser and controlled test API assertions; dependency-aware statuses; isolated named contexts; immutable per-run specification snapshots and content digests.
3. A loopback demo with a persisted form, a lying form, and a sender/recipient invitation flow. No email delivery claims.
4. Genuine unit, CLI, and Chromium tests. Independent adversarial review, package smoke test, offline report inspection.
5. Documentation, agent skill, CI, contribution materials. No publication or deployment. Working name conflicts with an existing project; resolve before a public release.
