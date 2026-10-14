# PromiseProof saved-run summary

Recorded outcome: **FAIL**

A successful form submission actually saves the contact

Run: lying-form-2026-10-13T16-59-59-593Z-e4df82cf
Contract: lying-form · revision 1
Spec SHA-256: 14cd81ae422bd545e7132d65a5191a738319f38eba030d258f093fe9546e6066

## Workflow assertions

| Status       | Count |
| ------------ | ----- |
| PASS         | 1     |
| FAIL         | 1     |
| NOT_VERIFIED | 1     |
| ERROR        | 0     |

Counts cover workflow assertions. Failed actions and cleanup also affect the recorded outcome.
Runtime errors: 0 (details in the evidence bundle).

## Checks to review

| Step       | Kind               | Status       | Check                                            | Next                                |
| ---------- | ------------------ | ------------ | ------------------------------------------------ | ----------------------------------- |
| ui         | workflow assertion | PASS         | The UI claims success                            |                                     |
| persisted  | workflow assertion | FAIL         | The API must contain the saved contact           | Inspect result.json and report.html |
| downstream | workflow assertion | NOT_VERIFIED | A downstream record check depends on persistence | Blocked by: persisted               |

## Evidence

Open lying-form-2026-10-13T16-59-59-593Z-e4df82cf/report.html in the downloaded run folder.
Recorded data: lying-form-2026-10-13T16-59-59-593Z-e4df82cf/result.json
Executed contract: lying-form-2026-10-13T16-59-59-593Z-e4df82cf/spec.json

This summarizes recorded evidence; it does not rerun verification or authenticate editable bundles.
Raw observations, request data and binary artifacts remain in the bundle. Review it before sharing.
