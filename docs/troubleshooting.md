# Troubleshooting

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
