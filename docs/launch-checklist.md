# Launch after registry verification

**Current gate:** the candidate passed source/platform/installed-consumer checks, but npm publication requires the owner's authentication. Do not post these drafts until the pinned public package is fetched and exercised successfully. Posting or contacting people remains a separate owner decision.

## Launch sequence

1. Complete [npm publication and registry verification](releases/npm-0.1.0.md). Then change candidate wording in README/Quickstart to the verified public version.
2. Keep the runtime command prominent. Explain that `npx skills add duongnq2798/promise-proof --skill promiseproof` installs agent instructions separately.
3. Show the deliberately broken form and its actual report: UI success, failed persistence, blocked downstream check.
4. Use one relevant channel at a time: a repository update, a developer community or an owner-controlled social account. Follow posting rules; do not mass-message people.
5. With owner-authorized outreach, invite consenting developers to try a first report and an own-app contract. A suggested five participants is a planning target. Record actual platform/cache state, first report, verdict understanding, blocker and repeated run.
6. Add funding navigation only after [the real Ko-fi page](sponsorship.md) is confirmed. Explain what voluntary maintenance support funds.

No hidden telemetry is proposed. Downloads, skill installs and stars describe discovery; they do not establish successful verification, repeat use or sponsorship.

## Draft: short launch post

AI built your form. The UI says “Success.” Did it save anything?

PromiseProof runs an explicit outcome contract in a real browser and checks independent test API evidence. Its offline report keeps PASS, FAIL and NOT_VERIFIED visible.

Try `npx @duongnq2798/promiseproof@0.1.0 quickstart`, then use `--example failing-workflow` to catch the deliberate persistence defect. The first run may download Chromium. The example checks a synthetic fixture; your own app needs its own acceptance contract.

[Code, examples and usage](https://github.com/duongnq2798/promise-proof). MIT licensed, with no model API required by the runner.

## Draft: developer-community introduction

I built PromiseProof to make a software-outcome claim reviewable. You write a versioned JSON contract; a deterministic runner combines real browser observations with independent test API checks and saves an offline evidence bundle.

The clearest example is a form that announces success while dropping the record. The UI assertion passes, persistence fails, and the dependent check remains NOT_VERIFIED. Screenshots do not overrule the failed assertion.

Start with `npx @duongnq2798/promiseproof@0.1.0 quickstart`; try `--example failing-workflow` for the defect. Chromium may need a first download and Linux system-library setup. Coding agents can install the repository's skill to help draft the contract and interpret evidence. Installing instructions is separate from verifying an app.

A PASS covers explicit assertions in an authorized test run; it is not a broad correctness certificate. Saved evidence is not cryptographically authenticated.

Useful feedback is the workflow you wanted to check, where first use blocked you, and which expected evidence was missing. Remove private data before sharing reports. [Repository and issues](https://github.com/duongnq2798/promise-proof).

## Learn from actual trials

Prioritize blocked first use, misleading verdicts, lost evidence and security defects. Keep observed sessions separate from adoption assumptions. Choose the next feature from a reproducible blocker; authenticated test-app access and read-only run comparison remain candidates awaiting specific workflow evidence.
