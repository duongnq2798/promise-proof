# Scoped npm 0.1.0 candidate: maintainer handoff

**Status: publication blocked by npm's one-time authentication requirement.** The owner approved public npm distribution. The actual attempt returned EOTP; the package is not claimed as published.

Candidate source: `8eadd7bcad6e47a06e60a83060bba43874cfc98a`. All six OS/Node jobs passed in [candidate CI](https://github.com/duongnq2798/promise-proof/actions/runs/38546015833). Main contains the same implementation. A final installed consumer passed genuine examples, CI-summary failure propagation, Quickstart PASS/FAIL and schema exports.

Preserved file on the maintainer's machine:

```text
E:\APP2028\promise-proof\.smoke\release-scoped-0.1.0\duongnq2798-promiseproof-0.1.0.tgz
```

Size: 126971 bytes. SHA-256:

```text
74cba9c6741e6eb01515fa990ae3f274bb1b67cf74cb492296275f591849b00a
```

Run this in your own terminal, then enter authentication directly when npm asks:

```powershell
npm publish "E:\APP2028\promise-proof\.smoke\release-scoped-0.1.0\duongnq2798-promiseproof-0.1.0.tgz" --access public --cache "E:\APP2028\promise-proof\.npm-cache"
```

Do not paste OTPs, passwords or tokens into chat, repository files or recording output. If npm's noninteractive mode reports EOTP without prompting, rerun with its `--otp` option locally. Publication needs the account's authentication, not another feature approval.

After publication, verify registry metadata for `@duongnq2798/promiseproof@0.1.0`, compare its integrity with the preserved candidate, and execute the actual registry command from a fresh test project:

```sh
npx @duongnq2798/promiseproof@0.1.0 quickstart --no-open
npx @duongnq2798/promiseproof@0.1.0 quickstart --example failing-workflow --no-open
```

Expected exits are 0 and 1. Inspect the saved results/reports, retained persistence expectation and stopped demo. Only then update candidate wording and announce the public runtime command. Skill installation from GitHub and runtime publication are separate steps.

Old GitHub preview.1/preview.2 tags and `promiseproof-local` assets are immutable historical distributions; neither contains this Quickstart. No existing release asset was replaced.
