# PromiseProof architecture

One Node.js ESM package, strict TypeScript, Chromium via Playwright, Zod validation, Commander CLI and Vitest tests. No server or model is part of the runner. The optional demo server is a loopback-only fixture.

Contact demo records are scoped to a synthetic fixture cookie. Each new context begins empty; an explicit absence assertion precedes submission. Reload preserves that context's record. This prevents older runs from satisfying a new creation check. Storage is in-memory, not durable across fixture-server restarts.

```text
src/spec.ts      strict contracts, semantic validation and editor schema
src/security.ts  origins, remote opt-in, references and redaction
src/browser.ts   fixed action/assertion adapters and read-only test API
src/runner.ts    contexts, dependency execution and evidence persistence
src/result.ts    status precedence and stable machine-readable types
src/reporter.ts  escaped offline HTML from recorded results
src/report-guidance.ts  pure next-check suggestions from recorded status/type/dependencies
src/report-icons.ts  fixed inline SVG icon set
src/report-styles.ts  loads the local report stylesheet for inline embedding
assets/         report CSS, embedded Geist font and SIL font license
src/cli.ts       initialization, verification, diagnostics and agent export
src/doctor.ts    structured setup diagnostics and actionable repair guidance
src/index.ts     public library exports
examples/       form, broken persistence and invitation fixtures
tests/          unit, real Chromium and built CLI tests
schema/         generated spec and policy JSON Schemas
skills/         reusable agent planning/reproduction instructions
scripts/        schema, sample and package smoke utilities
docs/           guides, real sample evidence and release records
.github/        CI and contributor templates
```

Execution: validate → authorize → check credentials → unique run directory → browser launch → ordered steps → explicit cleanup → traces → close contexts/browser → aggregate → redact human/data fields → spec/result/report.

Steps depend on their predecessor by default. Explicit dependsOn: [] is independent and must be justified by the author. Blocked dependencies record NOT_VERIFIED with zero attempts. Runtime, artifact, shutdown and policy errors prevent success. No workflow retries. Bounded Playwright assertion polling waits for state without rerunning actions.

Named contexts isolate cookies/storage. API GET assertions share the selected context's cookie jar; redirects are not followed. Body equality uses own-property dot paths and exact deep equality. Selected browser response statuses are tagged with the initiating action at request time; a response assertion names an earlier after action in the same context.

Browser HTTP(S) requests pass through an authorized single-hop fetch/fulfill guard. Browser HTTP redirects are blocked because Playwright routing can skip redirect hops. This changes some network behavior and is not a transparent browser proxy. WebSockets/service workers are unsupported. Broader authentication/CDN workflows need a tested policy adapter, not relaxed enforcement.

Each bundle has a unique run id and relative artifact paths. spec.json stores the normalized validated contract, references, revision and defaults; its exact bytes have a SHA-256 digest in result.json. This is version identification, not tamper resistance. Expected-outcome changes require a new source revision and explanation. No registry enforces monotonically increasing revisions across source files.

HTML and JSON share the same result. Website text is escaped; the report runs no scripts, loads no external assets and has a restrictive CSP. Images/traces sit alongside HTML. Licensed Geist fonts are embedded as data URLs; font-src permits only data. Native radio controls and CSS support System/Light/Dark themes, and native disclosures provide keyboard-accessible workflow details. Failed steps open by default. A two-column review layout pairs the workflow with a genuine screenshot and recorded observation; mobile stacks those sections. Full raw observations remain inspectable. Artifact links accept only generated PNG/ZIP basenames. Protocol fields survive redaction when a secret equals a status word.

Extension seams are source adapters, public verify()/renderReport() and schema-versioned JSON. No arbitrary runtime plugin execution or commercial-service dependency. See CONTRIBUTING.md.

The CLI JSON-file boundary separates file access, size limits and JSON parsing. Missing/unreadable files and malformed/oversized JSON return configuration exit 2 with a file-path repair hint. Parser and filesystem exception messages are not forwarded, so malformed file contents cannot be echoed by JSON.parse diagnostics. File paths remain visible for troubleshooting. The shared reader is used by verify, list and report; doctor retains its separate structured setup checks. Rejected inputs do not create an outcome verdict or start a workflow.

Doctor is separate from outcome verification. It validates supplied files, authorizes available spec URL references, checks credential/evidence constraints and environment-variable presence, probes uniquely named evidence-directory files, and launches/closes Chromium without app requests. It produces the same check records for terminal and JSON output. Missing/invalid inputs and policy incompatibility exit 2; environmental failures exit 3; input errors take precedence. READY applies only to the checks performed, and outcomesVerified is always false. Omitted specs and captured URLs are explicitly NOT_CHECKED. Diagnostic messages do not echo raw JSON, URL values or credential values; human fields receive redaction without altering protocol codes/statuses. Runtime policy enforcement and deterministic verdicts remain in the existing runner.

Report guidance consumes only the recorded result and does not mutate it or infer an application root cause. Nonpassing steps get a next-check suggestion; unsuccessful runs get a linked Next steps section. Primary focus prioritizes recorded runtime observations, then ERROR/FAIL/NOT_VERIFIED steps. Zero-attempt blocked steps link only their nonpassing declared/default prerequisites; explicit independent steps remain independent and cleanup defaults reset at the phase boundary. Native disclosures expose setup/replay text and a local trace command only for a safe ZIP basename. Guidance never executes commands, contacts services, changes expectations or replaces verdict evidence. PASS reports omit failure prompts.
