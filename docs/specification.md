# Specification v1

JSON only. Add $schema pointing to schema/spec.schema.json for editor completion. Unknown fields/actions, malformed locators, duplicate ids, cyclic/forward dependencies, invalid timeouts and action-only workflows are rejected. File cap 1 MiB; maximum 200 workflow and 30 cleanup steps. Identifiers start with ASCII letters, followed by letters/digits/underscore/hyphen.

Required fields: schemaVersion "1", id, positive revision, goal, baseUrl and nonempty steps. Optional: environment, declared preconditions, requiredEnv, tags, non-secret metadata, timeoutMs (100–60000; default 5000), evidence, cleanup.

Each step has id, type, description and optional context (default "default"), timeout/dependencies. Actions state the expected operation; assertions state expected outcomes. Predecessor is the default dependency. Explicit dependsOn must reference earlier ids; [] permits independent checks after a failure. Never use independence to hide a required dependency. Every assertion appears in the result even when blocked.

| Type       | Fields/semantics                                                                     |
| ---------- | ------------------------------------------------------------------------------------ |
| navigate   | url; authorized URL, wait for DOM content loaded                                     |
| click      | locator; Playwright actionability                                                    |
| fill       | locator, value                                                                       |
| select     | locator, value (option value)                                                        |
| check      | locator, checked boolean                                                             |
| wait       | locator, state visible/hidden/attached/detached                                      |
| visible    | locator, expected boolean; hidden includes absent                                    |
| text       | locator, equals; Playwright normalized exact text                                    |
| url        | equals; exact resolved URL                                                           |
| property   | locator, property: value/string, checked/boolean, disabled/boolean, required/boolean |
| validation | locator, valid boolean; native form/control validity                                 |
| noErrors   | no console/page errors observed up to this step in this context                      |
| api        | url, status, optional headers, json {path, equals}, capture {variable, path}         |
| response   | url, status, after earlier action in the same context                                |
| unverified | reason; always NOT_VERIFIED                                                          |

Locators choose exactly one of {role, name?, exact?}, {label, exact?}, {testId} or {css}. Supported roles are enumerated in the schema. CSS is not code execution.

String inputs accept literals, {env: "NAME"} or {variable: "capturedName"}. No interpolation or shell expressions. Missing environment variables reject execution. Captured strings exist only after the source API assertion passes. Sensitive headers/inputs and credential-bearing URL literals require references.

API json.path supports own-property dot paths and numeric array indices; empty selects the whole body. Exact deep equality checks the selected value. GET-only APIs share context cookies, never follow redirects and require <=1 MiB JSON bodies. Only selected fields/statuses are stored, not full headers/bodies.

Response checks bind to requests initiated during their after action; old responses cannot satisfy later actions. Browser response-body capture is deferred; use a controlled API check. State transitions are explicit initial-state assertion → action → final-state assertion.

Evidence defaults to screenshots false, trace false, mask []. Screenshots capture navigation and assertions, including failures; clicks/fills avoid racing asynchronous navigation for immediate images. Password/custom masks apply. Environment references disable binary artifacts; captures disable traces. Collection failures are errors.

Cleanup is an explicit final sequence run after workflow failure too. It cannot convert failure into PASS. It starts independently by default and may declare dependencies. No arbitrary deletion/SQL/shell cleanup exists.

PASS means expected state matched; FAIL is mismatch or action/assertion timeout; NOT_VERIFIED is blocked dependency/explicit missing evidence/captured string; ERROR is runtime/source/browser/policy/collection/shutdown failure. Overall precedence: ERROR > FAIL > NOT_VERIFIED > PASS. Summary counts cover workflow assertions; actions/cleanup remain visible and affect overall status.

Bundles store spec.json, versioned result.json, report.html and configured images/context traces. Results include digest/revision, timestamps/durations, expected/observed records, zero/one attempts, contexts/phases, browser errors and selected network observations. No automatic workflow retries; bounded assertion polling is not a retry.
