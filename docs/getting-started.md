# Getting started

Node.js >=22.12, npm, Chromium disk space and an authorized test app are required. Installation downloads packages/browser; subsequent local runs need no external service.

From the checkout run npm ci, npm run build, npm exec playwright install chromium, then npm run demo. Leave it running on 127.0.0.1:4173. Linux may need --with-deps during installation.

In another terminal run node dist/cli.js init and node dist/cli.js doctor. Verify examples/simple-form/spec.json with --config examples/config.json. Then verify examples/failing-workflow/spec.json. The first exits 0; the second exits 1 because persistence fails despite UI success.

Open the printed report.html path. Copy the whole bundle to retain screenshots/traces. The list command shows run ids; report RUN_ID prints its report path.

For your app, edit .promiseproof/config.json with exact test origins without trailing slashes/paths. Replace the starter spec's criterion with your real outcome. Use an independent test API for backend effects. Preconditions are author declarations; encode testable ones as early assertions.

To use an executable in another project without a registry release, run npm pack here and install its tarball there with npm install /absolute/path/to/promiseproof-local-0.1.0.tgz. Browser installation is separate. A local dependency exposes the CLI through package scripts; global npm link is unnecessary.
