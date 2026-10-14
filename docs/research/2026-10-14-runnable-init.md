# Research synthesis — runnable first-use templates

Date: 2026-10-14, Asia/Bangkok. Bounded scope: existing init, bundled examples and installable preview distribution.

- [FACT] At source commit `1ade692`, init creates a starter heading assertion; running the meaningful form/invitation examples requires a node_modules or checkout spec path. Preview.1 does not include the newer demo command. Source: src/cli.ts and docs/releases/v0.1.0-preview.1.md.
- [FACT] Commander supports allowlisted option choices and a default value. Confirmed against the installed v15 source and [the project's official README](https://github.com/tj/commander.js/blob/master/Readme.md), reviewed 2026-10-14.
- [FACT] Six new built-CLI cases failed because --example was missing; one default-starter compatibility case already passed. After implementation all seven passed, including generated spec/policy → real verify → reports with exits 0/1/0. Source: tests/init.test.ts, local RED/GREEN runs.
- [ASSUMPTION] Removing internal package paths from first use may reduce friction. No external-user usability or time-saving measurements exist. Validate the complete installed journey now; collect actual feedback only when available or authorized.
- [RECOMMENDATION] Add --example as an allowlisted option: starter(default), simple-form, failing-workflow, invitation-flow. Reuse/validate bundled specs, replace baseUrl and demo-start precondition wording, remove the old relative $schema link, preserve assertions and expected values. Preserve existing spec and policy bytes; fail unsupported choices before writes.
- [RECOMMENDATION] Package smoke should generate each example in a fresh consumer directory and use its default policy while the installed demo runs. Publish preview.2 with final asset smoke, checksum, real download verification and its own CI/review evidence. Preview.1 stays immutable.

Success: no internal package path is needed for the simple-form first outcome; failure remains failure; default init and user files remain intact; rejected names cannot select arbitrary files. Public npm branding, hosted service and external-user validation remain separate.
