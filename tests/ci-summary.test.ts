import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  mkdir,
  mkdtemp,
  readFile,
  readdir,
  rm,
  writeFile,
} from 'node:fs/promises';
import { execFile } from 'node:child_process';
import { once } from 'node:events';
import { promisify } from 'node:util';
import path from 'node:path';
import { createDemoServer } from '../examples/server.mjs';
const execute = promisify(execFile);
const server = createDemoServer();
let root: string;
let baseUrl: string;
beforeAll(async () => {
  await mkdir('.smoke', { recursive: true });
  root = await mkdtemp(path.resolve('.smoke/ci-recipe-'));
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  baseUrl = 'http://127.0.0.1:' + (server.address() as { port: number }).port;
});
afterAll(async () => {
  await new Promise<void>((resolve) => server.close(() => resolve()));
  await rm(root, { recursive: true, force: true });
});
async function scenario(name: string, missingBrowser = false) {
  const directory = await mkdtemp(path.join(root, 'case-'));
  const spec = JSON.parse(
    await readFile('examples/' + name + '/spec.json', 'utf8'),
  );
  spec.baseUrl = baseUrl;
  spec.evidence = { screenshots: false, trace: false };
  const specFile = path.join(directory, 'spec.json');
  const policyFile = path.join(directory, 'policy.json');
  const stepSummary = path.join(directory, 'job-summary.md');
  await writeFile(specFile, JSON.stringify(spec));
  await writeFile(
    policyFile,
    JSON.stringify({
      schemaVersion: '1',
      environment: 'test',
      allowedOrigins: [baseUrl],
      outputDir: path.join(directory, 'runs'),
    }),
  );
  const env = { ...process.env, GITHUB_STEP_SUMMARY: stepSummary };
  if (missingBrowser)
    env.PLAYWRIGHT_BROWSERS_PATH = path.join(directory, 'no-browser');
  async function run() {
    try {
      return {
        ...(await execute(
          process.execPath,
          ['docs/ci-run.mjs', specFile, policyFile],
          { env },
        )),
        code: 0,
      };
    } catch (error) {
      return error as { stdout: string; stderr: string; code: number };
    }
  }
  return { directory, specFile, stepSummary, run };
}
describe('executed consumer CI recipe', () => {
  it('encodes a recorded directory before printing it to the CI terminal', async () => {
    const directory = await mkdtemp(path.join(root, 'logging-'));
    const preload = path.join(directory, 'preload.cjs');
    const record = {
      runId: 'saved-run',
      status: 'FAIL',
      directory: '/tmp/runs\n::warning::private-log-canary',
    };
    // Stub only subprocess/filesystem boundaries so a Linux-valid newline path
    // can exercise the real helper's terminal output on Windows as well.
    await writeFile(
      preload,
      `const cp = require('node:child_process');
const fs = require('node:fs');
cp.spawnSync = (_command, args) => ({
  status: 1, stderr: '', stdout: args.includes('verify')
    ? ${JSON.stringify(JSON.stringify(record))}
    : 'Recorded outcome: **FAIL**\\n'
});
fs.promises.writeFile = async () => {};
fs.promises.appendFile = async () => {};
require('node:module').syncBuiltinESMExports();
`,
    );
    let output;
    try {
      await execute(process.execPath, [
        '--require',
        preload,
        'docs/ci-run.mjs',
      ]);
      throw new Error('The fixture verdict must remain FAIL');
    } catch (error) {
      output = error as { stdout: string; stderr: string; code: number };
    }
    expect(output.code, output.stderr).toBe(1);
    expect(output.stdout).toContain('Recorded outcome: FAIL');
    expect(output.stdout).not.toContain('\n::warning::');
    expect(output.stdout).toContain('\\n::warning::');
  });

  it.each([
    ['simple-form', false, 'PASS', 0],
    ['failing-workflow', false, 'FAIL', 1],
    ['simple-form', true, 'ERROR', 3],
  ] as const)(
    'preserves %s infrastructure=%s verdict %s and exit %s',
    async (name, missingBrowser, status, code) => {
      const test = await scenario(name, missingBrowser);
      const output = await test.run();
      expect(output.code, output.stderr).toBe(code);
      expect(output.stdout).toContain('Recorded outcome: ' + status);
      const summary = await readFile(test.stepSummary, 'utf8');
      expect(summary).toContain('Recorded outcome: **' + status + '**');
      const runs = await readdir(path.join(test.directory, 'runs'));
      expect(runs).toHaveLength(1);
      const run = path.join(test.directory, 'runs', runs[0]!);
      expect(await readFile(path.join(run, 'summary.md'), 'utf8')).toBe(
        summary,
      );
      const result = JSON.parse(
        await readFile(path.join(run, 'result.json'), 'utf8'),
      );
      expect(result.status).toBe(status);
      expect(await readFile(path.join(run, 'report.html'), 'utf8')).toContain(
        '<title>' + status,
      );
      if (status === 'FAIL') {
        expect(summary).toContain('Blocked by: persisted');
        expect(
          result.steps.find((s: { id: string }) => s.id === 'downstream')
            .attempts,
        ).toBe(0);
      }
    },
  );
  it('keeps invalid input red and withholds its contents without inventing a result', async () => {
    const test = await scenario('simple-form');
    await writeFile(test.specFile, 'private-ci-canary');
    const output = await test.run();
    expect(output.code).toBe(2);
    expect(output.stdout).toBe('');
    expect(output.stderr).not.toContain('private-ci-canary');
    const summary = await readFile(test.stepSummary, 'utf8');
    expect(summary).toContain('No usable completed result');
    expect(summary).not.toContain('Recorded outcome: **PASS**');
    expect(await readdir(test.directory)).not.toContain('runs');
  });
});
