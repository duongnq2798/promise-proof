# Get your first evidence report

You need Node.js 22.12 or newer, npm and an authorized test application. Installing packages and Chromium requires a network connection; local verification does not require an account or model key.

## 1. Install from the source repository

```sh
git clone https://github.com/duongnq2798/promise-proof.git
cd promise-proof
npm ci
npm run build
npm exec playwright install chromium
```

On Linux, use `npm exec playwright install --with-deps chromium` if the browser's OS dependencies are missing. Use the Playwright browser installed for this package version.

PromiseProof is not published to npm. Do not run an unqualified public `npx promiseproof` command.

## 2. Start the example application

```sh
npm run demo
```

Keep this terminal running. The fixture listens on `http://127.0.0.1:4173`. Its accounts and records are synthetic; data is held in memory.

## 3. Check setup in a second terminal

From the same checkout:

```sh
node dist/cli.js doctor --config examples/config.json --spec examples/simple-form/spec.json
```

Each failed check includes a **Next** action. Fix those checks and rerun doctor. READY describes setup checks; it does not prove the application is reachable or works. Doctor launches Chromium and probes evidence-directory writes, but does not send requests to the app or execute the spec.

For a coding agent or automation:

```sh
node dist/cli.js doctor --config examples/config.json --spec examples/simple-form/spec.json --json
```

Read both the JSON `exitCode` and check statuses. Doctor exits `0` for ready setup, `2` for invalid input or policy/spec incompatibility, and `3` for an environment failure. Input failures take precedence. `NOT_CHECKED` records omitted workflow checks or values available only at runtime. `outcomesVerified` is always `false`.

See [actual diagnostic output](doctor-example.json) from the example spec. Its readiness is setup evidence only.

## 4. See a real success and an intentional defect

```sh
node dist/cli.js verify examples/simple-form/spec.json --config examples/config.json
node dist/cli.js verify examples/failing-workflow/spec.json --config examples/config.json
```

The first command exits `0`: a new contact is absent before submission and is confirmed through the test API after reload.

The second command exits `1`: the broken form displays “Success” but its API contains no saved record. UI PASS, persistence FAIL and the dependent NOT_VERIFIED check are the expected demonstration result. Keep the original assertion; a broken observation is not a new expected outcome.

Open the printed `report.html` path in a browser. The report includes the actual workflow, expected/observed data and linked evidence. Copy the whole run folder when sharing it so screenshots and traces remain available.

For an unsuccessful run, choose **View next steps** beside the verdict. Each nonpassing step has a **Next check**; blocked steps link to the prerequisite observation. **Commands and trace tools** provides local setup, replay and trace-viewer commands. These are investigation suggestions, not a diagnosed cause or permission to weaken the expected outcome. Run them in the same authorized test environment with restored test data and required variables.

```sh
node dist/cli.js list --config examples/config.json
node dist/cli.js report RUN_ID --config examples/config.json
```

Replace `RUN_ID` with a value printed by list.

## 5. Use your own test app

```sh
node dist/cli.js init --base-url http://127.0.0.1:3000
```

Initialization preserves existing files. If you initialized another app earlier, edit `.promiseproof/config.json` deliberately rather than expecting init to replace it.

Edit `.promiseproof/example.json` to describe your application's actual outcome. The starter heading assertion is a placeholder criterion, not a universal test. Add an independent test API assertion when the desired effect is backend persistence. Exact test origins belong in the separate policy; URL paths and trailing slashes do not belong in `allowedOrigins`. Use environment references for credentials and follow the binary-evidence restrictions.

```sh
node dist/cli.js doctor --spec .promiseproof/example.json
node dist/cli.js verify .promiseproof/example.json
```

These commands use `.promiseproof/config.json` by default. Start your test app before verify. Preconditions are declarations unless encoded as assertions. See [the specification guide](specification.md) and [troubleshooting](troubleshooting.md).

## Install the CLI in another project

Run `npm pack` in this checkout. In the consuming project, install that local tarball:

```sh
npm install /absolute/path/to/promiseproof-local-0.1.0.tgz
npm exec playwright install chromium
npm exec --offline -- promiseproof init --base-url http://127.0.0.1:3000
```

Use the actual tarball path on your system. The installed package exposes the executable without a global link. Browser installation is still required. Use the same doctor/spec/policy workflow through the installed executable.
