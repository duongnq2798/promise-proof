# One command to your first evidence report

Requires Node.js 22.12 or newer and npm. This is the scoped distribution candidate; registry publication is verified separately. The existing GitHub preview.2 tarball has neither quickstart nor schema export.

The final candidate passed local and six-platform-job checks; its npm publish attempt requires owner authentication. See the [maintainer release handoff](releases/npm-0.1.0.md). Until registry verification succeeds, use the confirmed candidate tarball route below.

After the scoped package is published and registry availability is confirmed, its entry command is:

```sh
npx @duongnq2798/promiseproof quickstart
```

The first invocation may download the npm runtime and matching Chromium. The CLI prints installation progress without forwarding raw downloader URLs or errors, which could contain credentials. Cached invocations reuse a browser that passes an actual headless launch/close probe. Setup checks do not prove application outcomes; the later verify stage runs the sample's actual assertions.

Quickstart starts a synthetic in-memory fixture on a free 127.0.0.1 port, creates an isolated workspace under `.promiseproof/quickstarts`, writes its spec/exact-origin policy and executes the saved-contact workflow. It prints JSON-quoted Workspace/Report paths and launches the local offline report viewer by default. The owned demo stops before the command exits. Existing project config/spec files remain untouched; each invocation has a new workspace.

The report's PASS covers the bundled example for this execution. It does not verify your own app or establish broad correctness. Keep the generated workspace when inspecting or sharing its evidence; report.html alone cannot carry its screenshots/traces. The demo data disappears with its server, so replay requires starting a fixture again and deliberately matching the new spec/policy origin.

## Options and the deliberate defect

```sh
npx @duongnq2798/promiseproof quickstart --no-open
npx @duongnq2798/promiseproof quickstart --example failing-workflow --no-open
npx @duongnq2798/promiseproof quickstart --example invitation-flow --no-open
```

These registry commands require the published package. The default/simple-form exits 0 for PASS. The deliberate defect exits 1: UI PASS, persistence FAIL, downstream NOT_VERIFIED with zero attempts. Invitation also exits 0 for its controlled local workflow, not real email delivery. Never change the failed persistence expectation to match the defect.

`--no-install` prevents downloading a missing browser. Missing/unlaunchable Chromium exits 3 with repair guidance before an app workflow. Invalid example names exit 2 before writing. Interrupting setup/opener/cleanup cannot return successful quickstart completion; any created files are retained. An unavailable viewer does not change the recorded verdict: use the printed Report path.

On Linux, missing system libraries may require the one-time privileged `npm exec playwright install --with-deps chromium` setup. Network/browser-cache problems get a rerun hint. Cold and cached performance depend on the machine, network and cache; no universal timing is promised.

## Try a candidate without registry publication

Use the actual provided scoped tarball path, in a new test directory:

```sh
npx --yes --package /absolute/path/to/duongnq2798-promiseproof-0.1.0.tgz promiseproof quickstart --no-open
```

Or build this checkout and run `node dist/cli.js quickstart --no-open`. Candidate testing is separate from registry availability. Old preview.2 uses its own [release instructions](releases/v0.1.0-preview.2.md).

## Use the skill with your own app

```sh
npx skills add duongnq2798/promise-proof --skill promiseproof
```

This installs agent instructions, not a completed verification. The skill uses the installed/scoped runner and requests the bundled schema through `promiseproof schema` or `promiseproof schema --policy`. Scope/registry readiness and actual agent invocation must be checked independently of discovering the skill. Public main must contain the updated skill before it can install that version.

Start your authorized disposable test app, use init with its exact origin, and replace the starter criteria with the outcomes you actually need. The coding agent can inspect source and write a contract; the deterministic runner makes the verdict. Doctor is setup-only. Existing security, credential-reference, origin and binary-evidence restrictions still apply. See [specification](specification.md), [security](security.md) and [troubleshooting](troubleshooting.md).
