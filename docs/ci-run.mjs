// Copy into a consumer project with the current PromiseProof package installed.
// Run after the authorized test app is ready. No shell commands or external posts.
import { spawnSync } from 'node:child_process';
import { appendFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const maxBuffer = 8 * 1024 * 1024;
async function jobSummary(markdown) {
  if (process.env.GITHUB_STEP_SUMMARY)
    await appendFile(process.env.GITHUB_STEP_SUMMARY, markdown, 'utf8');
}
function run(cli, args) {
  return spawnSync(process.execPath, [cli, ...args], {
    encoding: 'utf8',
    maxBuffer,
  });
}
async function main() {
  const [
    spec = '.promiseproof/example.json',
    policy = '.promiseproof/config.json',
  ] = process.argv.slice(2);
  const cli = path.join(
    path.dirname(fileURLToPath(import.meta.resolve('promiseproof-local'))),
    'cli.js',
  );
  const verification = run(cli, ['verify', spec, '--config', policy, '--json']);
  if (verification.stderr) process.stderr.write(verification.stderr);
  let record;
  try {
    record = JSON.parse(verification.stdout);
  } catch {
    /* No fabricated verdict. */
  }
  if (
    ![0, 1, 3].includes(verification.status) ||
    typeof record?.runId !== 'string' ||
    typeof record?.directory !== 'string'
  ) {
    const code = [1, 2, 3].includes(verification.status)
      ? verification.status
      : 3;
    await jobSummary(
      '## PromiseProof — run unavailable\n\nNo usable completed result was returned. Verification exit: ' +
        code +
        '. Inspect the verification diagnostics.\n',
    );
    process.exitCode = code;
    return;
  }
  const summary = run(cli, ['summary', record.runId, '--config', policy]);
  if (!summary.stdout || summary.status !== verification.status) {
    await jobSummary(
      '## PromiseProof — summary unavailable\n\nEvidence could not be summarized consistently. Inspect the retained run folder.\n',
    );
    process.stderr.write(
      'CI summary failed; verification evidence remains in its run folder.\n',
    );
    process.exitCode = 3;
    return;
  }
  await writeFile(path.join(record.directory, 'summary.md'), summary.stdout, {
    flag: 'wx',
    mode: 0o600,
  });
  await jobSummary(summary.stdout);
  console.log(
    'Recorded outcome: ' +
      record.status +
      '; evidence retained in ' +
      JSON.stringify(record.directory),
  );
  process.exitCode = verification.status;
}
try {
  await main();
} catch {
  process.stderr.write(
    'Cannot complete the CI recipe. Check package installation, file permissions and the summary destination.\n',
  );
  process.exitCode = 3;
}
