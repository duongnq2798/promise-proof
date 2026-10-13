# Contributing

Install Node.js >=22.12, run npm ci, npm exec playwright install chromium, npm run build, then npm run check. Use disposable local fixtures. Unit tests cover contracts, status precedence, redaction and report escaping. Integration tests exercise built CLI subprocesses and real Chromium. No credentials or external APIs are needed.

Keep changes narrow and update ARCHITECTURE.md and relevant guides. Do not weaken failing acceptance criteria or relabel missing evidence as success. Include regression tests for false PASS, leaks or policy bypasses.

To add an action: extend the strict step schema in src/spec.ts, implement a fixed adapter in src/browser.ts, authorize all I/O, document fields and add real-browser coverage. No arbitrary eval/shell actions. Regenerate schemas with npm run build.

To add an assertion: add its schema and assertionTypes entry, define exact observations/comparisons/missing-source semantics, then test passing, failing, blocked and source-error paths. Backend effects need an independent source or an explicit UI-only boundary. Verify aggregation and exit codes.

To add a reporter: consume RunResult without mutating verdicts, escape untrusted content, keep assets offline and link artifacts relatively. Test result/report parity. Public exports include verify(), schemas, result types and renderReport(); no unsafe runtime plugin loader is needed.

To test agent integrations: exercise agent --output, validate frontmatter and safety instructions, then run generation → runner → result-reading against synthetic fixtures. Keep client discovery testing separate. Record the actual client/version before claiming automatic integration.

For package smoke testing run npm pack and node scripts/package-smoke.mjs <tarball>. It installs into a disposable directory beneath .smoke, starts the synthetic server and invokes the packaged CLI on passing/failing specs. Nothing is published.

Follow CODE_OF_CONDUCT.md. Report sensitive issues through SECURITY.md. Traffic guards, cleanup and credential handling require careful review.
