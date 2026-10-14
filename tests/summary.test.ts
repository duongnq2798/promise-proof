import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  cp,
  mkdir,
  mkdtemp,
  readFile,
  readdir,
  rm,
  writeFile,
} from 'node:fs/promises';
import path from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import type { RunResult } from '../src/result.js';
import { redact } from '../src/security.js';

const command = promisify(execFile);
const cli = path.resolve('dist/cli.js');
let root: string;
const failing: RunResult = JSON.parse(
  await readFile('docs/sample-report/failing/result.json', 'utf8'),
);

beforeAll(async () => {
  await mkdir('.smoke', { recursive: true });
  root = await mkdtemp(path.resolve('.smoke/summary-'));
});
afterAll(async () => {
  await rm(root, { recursive: true, force: true });
});

async function saved(result: RunResult = structuredClone(failing)) {
  const directory = await mkdtemp(path.join(root, 'case-'));
  const run = path.join(directory, 'runs', result.runId);
  await cp('docs/sample-report/failing', run, { recursive: true });
  await writeFile(path.join(run, 'result.json'), JSON.stringify(result));
  await writeFile(
    path.join(directory, 'config.json'),
    JSON.stringify({
      schemaVersion: '1',
      environment: 'test',
      allowedOrigins: ['http://127.0.0.1:4173'],
      outputDir: path.join(directory, 'runs'),
    }),
  );
  return { directory, run, result };
}
async function call(directory: string, id: string, ...extra: string[]) {
  try {
    return {
      ...(await command(
        process.execPath,
        [cli, 'summary', id, '--config', 'config.json', ...extra],
        {
          cwd: directory,
          env: {
            ...process.env,
            PLAYWRIGHT_BROWSERS_PATH: path.join(directory, 'no-browser'),
          },
        },
      )),
      code: 0,
    };
  } catch (error) {
    return error as { stdout: string; stderr: string; code: number };
  }
}

describe('saved-run Markdown summary CLI', () => {
  it('renders the real failure, its blocked prerequisite and artifact link without changing evidence', async () => {
    const { directory, run, result } = await saved();
    const files = await readdir(run);
    const before = await Promise.all(
      files.map((file) => readFile(path.join(run, file))),
    );
    const output = await call(
      directory,
      result.runId,
      '--artifact-url',
      'https://github.com/example/repo/actions/runs/1/artifacts/2',
    );
    expect(output.code, output.stderr).toBe(1);
    expect(output.stdout).toContain('Recorded outcome: **FAIL**');
    expect(output.stdout).toContain('| PASS | 1 |');
    expect(output.stdout).toContain('| FAIL | 1 |');
    expect(output.stdout).toContain('| NOT_VERIFIED | 1 |');
    expect(output.stdout).toContain('persisted');
    expect(output.stdout).toContain('downstream');
    expect(output.stdout).toContain('Blocked by: persisted');
    expect(output.stdout).toContain(
      'https://github.com/example/repo/actions/runs/1/artifacts/2',
    );
    expect(output.stdout).toContain(result.specDigest);
    expect(output.stdout).toContain(result.runId + '/report.html');
    expect(await readdir(run)).toEqual(files);
    expect(
      await Promise.all(files.map((file) => readFile(path.join(run, file)))),
    ).toEqual(before);
  });

  it.each([
    ['PASS', 0],
    ['NOT_VERIFIED', 1],
    ['ERROR', 3],
  ] as const)('retains saved %s and its exit code', async (status, code) => {
    const result = structuredClone(failing);
    result.status = status;
    result.steps.forEach((step) => {
      step.status = status;
      step.attempts = status === 'NOT_VERIFIED' ? 0 : 1;
    });
    result.summary = { PASS: 0, FAIL: 0, NOT_VERIFIED: 0, ERROR: 0 };
    result.summary[status] = 3;
    const { directory } = await saved(result);
    const output = await call(directory, result.runId);
    expect(output.code, output.stderr).toBe(code);
    expect(output.stdout).toContain('Recorded outcome: **' + status + '**');
    expect(output.stdout).toContain('| ' + status + ' | 3 |');
  });

  it('shows failed actions even when all outcome assertions passed', async () => {
    const result = structuredClone(failing);
    result.steps.forEach((step) => {
      step.status = 'PASS';
      step.attempts = 1;
    });
    result.steps[0]!.status = 'FAIL';
    result.summary = { PASS: 3, FAIL: 0, NOT_VERIFIED: 0, ERROR: 0 };
    const { directory } = await saved(result);
    const output = await call(directory, result.runId);
    expect(output.code).toBe(1);
    expect(output.stdout).toContain('open');
    expect(output.stdout).toContain('workflow action');
    expect(output.stdout).toContain('| PASS | 3 |');
    expect(output.stdout).toContain('Recorded outcome: **FAIL**');
  });

  it('separates cleanup and runtime errors from workflow assertion counts', async () => {
    const result = structuredClone(failing);
    result.status = 'ERROR';
    result.errors = ['Private runtime details belong in the evidence bundle'];
    result.steps.push({
      ...result.steps[0]!,
      id: 'cleanup-probe',
      phase: 'cleanup',
      status: 'ERROR',
      assertion: false,
    });
    const { directory } = await saved(result);
    const output = await call(directory, result.runId);
    expect(output.code).toBe(3);
    expect(output.stdout).toContain('cleanup-probe');
    expect(output.stdout).toContain('cleanup action');
    expect(output.stdout).toContain('Runtime errors: 1');
    expect(output.stdout).not.toContain(result.errors[0]);
    expect(output.stdout).toContain('| ERROR | 0 |');
  });

  it('escapes injected Markdown/HTML/workflow commands and omits raw observation data', async () => {
    const result = structuredClone(failing);
    result.goal =
      'Danger\n::error::injected [click](javascript:alert(1)) <img src=x> | *bold*';
    result.steps[5]!.description = 'Broken\n## heading | `code` <script>';
    result.steps[5]!.observed = 'private-observation-canary';
    const { directory } = await saved(result);
    const output = await call(directory, result.runId);
    expect(output.code).toBe(1);
    expect(output.stdout).not.toContain('\n::error::');
    expect(output.stdout).not.toContain('[click](javascript:');
    expect(output.stdout).not.toContain('<img');
    expect(output.stdout).not.toContain('<script>');
    expect(output.stdout).not.toContain('private-observation-canary');
    expect(output.stdout).not.toContain('\n## heading');
    expect(output.stdout).toContain('&lt;img');
  });

  it.each([
    ['unknown schema', (r: RunResult) => ({ ...r, schemaVersion: '99' })],
    ['wrong run identity', (r: RunResult) => ({ ...r, runId: 'other-run' })],
    ['false PASS', (r: RunResult) => ({ ...r, status: 'PASS' })],
    [
      'wrong assertion counts',
      (r: RunResult) => ({ ...r, summary: { ...r.summary, PASS: 900 } }),
    ],
    [
      'invalid step status',
      (r: RunResult) => ({
        ...r,
        steps: [{ ...r.steps[0], status: 'private-invalid-canary' }],
      }),
    ],
    [
      'duplicate step IDs',
      (r: RunResult) => ({ ...r, steps: [...r.steps, r.steps[0]] }),
    ],
    [
      'no outcome assertions',
      (r: RunResult) => ({
        ...r,
        status: 'PASS',
        steps: r.steps.filter((s) => !s.assertion),
        summary: { PASS: 0, FAIL: 0, NOT_VERIFIED: 0, ERROR: 0 },
      }),
    ],
    [
      'unattempted PASS',
      (r: RunResult) => ({
        ...r,
        steps: r.steps.map((s) =>
          s.status === 'PASS' ? { ...s, attempts: 0 } : s,
        ),
      }),
    ],
    [
      'invalid dependency',
      (r: RunResult) => ({
        ...r,
        steps: r.steps.map((s) => ({
          ...s,
          expected: { dependsOn: ['future-step'] },
        })),
      }),
    ],
  ])(
    'rejects %s without printing a verdict or input contents',
    async (_name, change) => {
      const { directory, run, result } = await saved();
      await writeFile(
        path.join(run, 'result.json'),
        JSON.stringify(change(result)),
      );
      const output = await call(directory, result.runId);
      expect(output.code).toBe(2);
      expect(output.stdout).toBe('');
      expect(output.stderr).not.toContain('private-invalid-canary');
      expect(output.stderr).toMatch(/saved result|run identity/i);
    },
  );

  it('withholds malformed JSON contents and identifies the file', async () => {
    const { directory, run, result } = await saved();
    await writeFile(path.join(run, 'result.json'), 'private-json-canary');
    const output = await call(directory, result.runId);
    expect(output.code).toBe(2);
    expect(output.stdout).toBe('');
    expect(output.stderr).toContain('result.json');
    expect(output.stderr).not.toContain('private-json-canary');
  });

  it('accepts the runner redacting an entire console-error context bucket', async () => {
    const { directory, run, result } = await saved();
    result.steps.forEach((step) => (step.context = 'password-reset'));
    const consoleErrors = redact({
      'password-reset': ['private-console-canary'],
    });
    await writeFile(
      path.join(run, 'result.json'),
      JSON.stringify({ ...result, consoleErrors }),
    );
    const before = await readFile(path.join(run, 'result.json'), 'utf8');
    const output = await call(directory, result.runId);
    expect(output.code, output.stderr).toBe(1);
    expect(output.stdout).toContain('Recorded outcome: **FAIL**');
    expect(output.stdout).not.toContain('private-console-canary');
    expect(await readFile(path.join(run, 'result.json'), 'utf8')).toBe(before);
  });

  it('rejects deeply nested saved JSON as invalid input without parser details', async () => {
    const { directory, run, result } = await saved();
    result.steps[5]!.observed = 'private-depth-canary';
    const nested =
      '['.repeat(3000) + '"private-depth-canary"' + ']'.repeat(3000);
    await writeFile(
      path.join(run, 'result.json'),
      JSON.stringify(result).replace('"private-depth-canary"', nested),
    );
    const output = await call(directory, result.runId);
    expect(output.code, output.stderr).toBe(2);
    expect(output.stdout).toBe('');
    expect(output.stderr).toContain('Invalid saved result');
    expect(output.stderr).not.toMatch(
      /private-depth-canary|RangeError|call stack/,
    );
  });

  it('rejects a summary exceeding the CI size limit without emitting a partial result', async () => {
    const result = structuredClone(failing);
    result.goal = '*'.repeat(220000);
    const { directory } = await saved(result);
    const output = await call(directory, result.runId);
    expect(output.code).toBe(2);
    expect(output.stdout).toBe('');
    expect(output.stderr).toMatch(/summary.*size|summary.*limit/i);
  });

  it('rejects missing runs and traversal', async () => {
    const { directory } = await saved();
    const missing = await call(directory, 'missing-run');
    expect(missing.code).toBe(2);
    expect(missing.stderr).toContain('result.json');
    expect((await call(directory, '../outside')).code).toBe(2);
  });

  it.each([
    'javascript:alert(1)',
    'http://example.test/file',
    'https://name:private-url-canary@example.test/file',
    'https://example.test/file?token=private-url-canary',
    'https://example.test/file?api_key=private-url-canary',
    'https://example.test/file?access_key=private-url-canary',
    'https://example.test/file?private-key=private-url-canary',
    'https://example.test/file?X-Amz-Credential=private-url-canary',
    'https://example.test/file?X-Amz-Signature=private-url-canary',
    'https://example.test/file?sig=private-url-canary',
  ])('rejects unsafe artifact URL %s without echoing it', async (url) => {
    const { directory, result } = await saved();
    const output = await call(directory, result.runId, '--artifact-url', url);
    expect(output.code).toBe(2);
    expect(output.stdout).toBe('');
    expect(output.stderr).not.toContain('private-url-canary');
    expect(output.stderr).toMatch(/artifact.*HTTPS/i);
  });

  it('retains an ordinary download query in the artifact link', async () => {
    const { directory, result } = await saved();
    const output = await call(
      directory,
      result.runId,
      '--artifact-url',
      'https://example.test/file?download=1',
    );
    expect(output.code, output.stderr).toBe(1);
    expect(output.stdout).toContain('https://example.test/file?download=1');
  });
});
