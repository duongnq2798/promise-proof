import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createDemoServer } from '../examples/server.mjs';
import {
  mkdir,
  mkdtemp,
  readFile,
  rm,
  stat,
  writeFile,
} from 'node:fs/promises';
import { once } from 'node:events';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { chromium } from '@playwright/test';
import { verify } from '../src/runner.js';
import type { Spec, Step } from '../src/spec.js';

const server = createDemoServer();
let baseUrl: string;
let workspace: string;
const command = promisify(execFile);
const policy = () => ({
  schemaVersion: '1',
  environment: 'test',
  allowedOrigins: [baseUrl],
  outputDir: path.join(workspace, 'runs'),
});
async function example(name: string) {
  const spec = JSON.parse(await readFile(`examples/${name}/spec.json`, 'utf8'));
  return { ...spec, baseUrl };
}
function spec(steps: unknown[], evidence = {}) {
  return {
    schemaVersion: '1',
    id: 'e2e',
    revision: 1,
    goal: 'Test observable outcomes',
    baseUrl,
    timeoutMs: 700,
    evidence,
    steps,
  };
}
const open = (url: string) => ({
  id: 'open',
  type: 'navigate',
  url,
  description: 'Open fixture',
});
beforeAll(async () => {
  await mkdir('.smoke', { recursive: true });
  workspace = await mkdtemp(path.resolve('.smoke/e2e-'));
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  baseUrl = `http://127.0.0.1:${(server.address() as { port: number }).port}`;
});
afterAll(async () => {
  await new Promise<void>((resolve) => server.close(() => resolve()));
  await rm(workspace, { recursive: true, force: true });
});
describe('real Chromium verification', () => {
  it('passes the persisted form and writes fresh portable evidence', async () => {
    const { result, directory } = await verify(
      await example('simple-form'),
      policy(),
    );
    expect(result.status).toBe('PASS');
    expect(result.summary.PASS).toBe(4);
    expect(result.evidenceClasses).toContain('API-confirmed assertions');
    const stored = JSON.parse(
      await readFile(path.join(directory, 'result.json'), 'utf8'),
    );
    expect(stored).toEqual(result);
    const snapshot = await readFile(path.join(directory, 'spec.json'));
    expect(createHash('sha256').update(snapshot).digest('hex')).toBe(
      result.specDigest,
    );
    expect(
      (await stat(path.join(directory, result.traces[0]!))).size,
    ).toBeGreaterThan(1000);
    const shot = await readFile(
      path.join(directory, result.steps[0]!.screenshot!),
    );
    expect(shot.subarray(1, 4).toString()).toBe('PNG');
    const browser = await chromium.launch();
    try {
      const page = await browser.newPage();
      const remote: string[] = [];
      page.on('request', (r) => {
        if (r.url().startsWith('http')) remote.push(r.url());
      });
      await page.goto(
        new URL(
          `file:///${path.join(directory, 'report.html').replaceAll('\\', '/')}`,
        ).href,
      );
      expect(await page.locator('h1').textContent()).toBe(result.goal);
      expect(await page.locator('.badge').first().textContent()).toBe(
        result.status,
      );
      await page.locator('img').first().scrollIntoViewIfNeeded();
      await page.waitForFunction(() =>
        [...document.images].some(
          (img) => img.complete && img.naturalWidth > 0,
        ),
      );
      expect(remote).toEqual([]);
    } finally {
      await browser.close();
    }
  });
  it('catches the lying UI and leaves downstream assertions unverified', async () => {
    const { result } = await verify(
      await example('failing-workflow'),
      policy(),
    );
    expect(result.status).toBe('FAIL');
    expect(result.steps.find((s) => s.id === 'ui')?.status).toBe('PASS');
    expect(result.steps.find((s) => s.id === 'persisted')?.status).toBe('FAIL');
    expect(result.steps.find((s) => s.id === 'downstream')?.status).toBe(
      'NOT_VERIFIED',
    );
  });
  it('verifies invitations in isolated sender and recipient sessions', async () => {
    const { result } = await verify(await example('invitation-flow'), policy());
    expect(
      result.status,
      JSON.stringify({
        errors: result.errors,
        steps: result.steps.filter((s) => s.status !== 'PASS'),
      }),
    ).toBe('PASS');
    expect(result.evidenceClasses).toContain('Cross-context assertions');
    expect(result.steps.find((s) => s.id === 'isolated')?.status).toBe('PASS');
    expect(JSON.stringify(result)).not.toMatch(/token=[a-f0-9-]{36}/);
  });
  it('missing evidence cannot pass', async () => {
    const { result } = await verify(
      spec([
        {
          id: 'email',
          type: 'unverified',
          description: 'Email delivery',
          reason: 'No email receiver configured',
        },
      ]),
      policy(),
    );
    expect(result.status).toBe('NOT_VERIFIED');
    expect(result.summary.NOT_VERIFIED).toBe(1);
  });
  it('unavailable API source becomes ERROR', async () => {
    const unreachable = 'http://127.0.0.1:1';
    const { result } = await verify(
      spec([
        {
          id: 'api',
          type: 'api',
          description: 'Independent source',
          url: unreachable,
          status: 200,
        },
      ]),
      { ...policy(), allowedOrigins: [baseUrl, unreachable] },
    );
    expect(result.status).toBe('ERROR');
  });
  it('browser errors are programmatically detected', async () => {
    const { result } = await verify(
      spec([
        open('/errors'),
        { id: 'errors', type: 'noErrors', description: 'No browser errors' },
      ]),
      policy(),
    );
    expect(result.status).toBe('FAIL');
    expect(result.consoleErrors.default!.join(' ')).toContain('Synthetic');
  });
  it('selected response statuses are collected before the click', async () => {
    const input = await example('simple-form');
    input.evidence = {};
    input.steps.splice(
      input.steps.findIndex((s: { id: string }) => s.id === 'ui') + 1,
      0,
      {
        id: 'network',
        type: 'response',
        after: 'submit',
        description: 'Form POST succeeded',
        url: '/api/contacts',
        status: 201,
      },
    );
    const { result } = await verify(input, policy());
    expect(result.status).toBe('PASS');
    expect(result.network).toHaveLength(1);
  });
  it('a second response assertion cannot reuse the first action response', async () => {
    const input = await example('simple-form');
    input.evidence = {};
    input.steps.splice(
      input.steps.findIndex((s: { id: string }) => s.id === 'ui') + 1,
      0,
      {
        id: 'network',
        type: 'response',
        after: 'submit',
        description: 'First response',
        url: '/api/contacts',
        status: 201,
      },
      {
        id: 'edit',
        type: 'fill',
        description: 'Change name without submitting',
        locator: { label: 'Name' },
        value: 'Changed',
      },
      {
        id: 'missing-response',
        type: 'response',
        timeoutMs: 500,
        after: 'edit',
        description: 'No new response exists',
        url: '/api/contacts',
        status: 201,
      },
    );
    const { result } = await verify(input, policy());
    expect(result.status).toBe('FAIL');
    for (const id of ['submit', 'network', 'edit']) {
      expect(
        result.steps.find((step) => step.id === id)?.status,
        JSON.stringify(
          result.steps.map(({ id, status, observed }) => ({
            id,
            status,
            observed,
          })),
        ),
      ).toBe('PASS');
    }
    expect(
      result.steps.find((s) => s.id === 'missing-response')?.status,
      JSON.stringify(
        result.steps.map(({ id, status, observed }) => ({
          id,
          status,
          observed,
        })),
      ),
    ).toBe('FAIL');
  });
  it('a secret equal to PASS cannot corrupt protocol verdicts', async () => {
    process.env.PP_COLLISION = 'PASS';
    try {
      const { result } = await verify(
        {
          ...spec([
            open('/'),
            {
              id: 'visible',
              type: 'visible',
              description: 'Heading',
              locator: { role: 'heading' },
            },
          ]),
          requiredEnv: ['PP_COLLISION'],
        },
        policy(),
      );
      expect(result.status).toBe('PASS');
      expect(result.steps.every((s) => s.status === 'PASS')).toBe(true);
      expect(result.schemaVersion).toBe('1');
    } finally {
      delete process.env.PP_COLLISION;
    }
  });
  it('browser redirect chains send zero requests to unauthorized servers', async () => {
    const http = await import('node:http');
    let deniedRequests = 0;
    const denied = http.createServer((_req, res) => {
      deniedRequests++;
      res.end('<h1>Unauthorized</h1>');
    });
    denied.listen(0, '127.0.0.1');
    await once(denied, 'listening');
    const destination = `http://127.0.0.1:${(denied.address() as { port: number }).port}`;
    const redirect = http.createServer((_req, res) => {
      res.writeHead(302, { Location: destination });
      res.end();
    });
    redirect.listen(0, '127.0.0.1');
    await once(redirect, 'listening');
    const allowed = `http://127.0.0.1:${(redirect.address() as { port: number }).port}`;
    try {
      const { result } = await verify(
        spec([
          open(allowed),
          {
            id: 'visible',
            type: 'visible',
            description: 'Must not navigate onward',
            locator: { role: 'heading' },
          },
        ]),
        { ...policy(), allowedOrigins: [baseUrl, allowed] },
      );
      expect(result.status).toBe('ERROR');
      expect(deniedRequests).toBe(0);
    } finally {
      await Promise.all([
        new Promise<void>((resolve) => denied.close(() => resolve())),
        new Promise<void>((resolve) => redirect.close(() => resolve())),
      ]);
    }
  });
  it('executes select, check, validation, property, wait, hidden and state transition assertions', async () => {
    const steps = [
      open('/controls'),
      {
        id: 'pending',
        type: 'text',
        locator: { role: 'status' },
        equals: 'Pending',
      },
      {
        id: 'select',
        type: 'select',
        locator: { label: 'Plan' },
        value: 'pro',
      },
      {
        id: 'selected',
        type: 'property',
        locator: { label: 'Plan' },
        property: 'value',
        equals: 'pro',
      },
      {
        id: 'check',
        type: 'check',
        locator: { label: 'Accept terms' },
        checked: true,
      },
      {
        id: 'checked',
        type: 'property',
        locator: { label: 'Accept terms' },
        property: 'checked',
        equals: true,
      },
      {
        id: 'uncheck',
        type: 'check',
        locator: { label: 'Accept terms' },
        checked: false,
      },
      {
        id: 'valid',
        type: 'validation',
        locator: { label: 'Required input' },
        valid: false,
      },
      {
        id: 'required',
        type: 'property',
        locator: { label: 'Required input' },
        property: 'required',
        equals: true,
      },
      {
        id: 'enabled',
        type: 'property',
        locator: { role: 'button', name: 'Complete' },
        property: 'disabled',
        equals: false,
      },
      {
        id: 'wait',
        type: 'wait',
        locator: { role: 'button', name: 'Complete' },
        state: 'visible',
      },
      {
        id: 'complete',
        type: 'click',
        locator: { role: 'button', name: 'Complete' },
      },
      { id: 'done', type: 'text', locator: { role: 'status' }, equals: 'Done' },
      {
        id: 'hidden',
        type: 'visible',
        locator: { css: '#absent' },
        expected: false,
      },
      { id: 'url', type: 'url', equals: '/controls' },
    ].map((s) => ({ ...s, description: s.id }));
    const { result } = await verify(spec(steps), policy());
    expect(
      result.status,
      JSON.stringify({
        errors: result.errors,
        steps: result.steps.filter((s) => s.status !== 'PASS'),
      }),
    ).toBe('PASS');
  });
  it('an action timeout blocks following assertions and cannot become PASS', async () => {
    const { result } = await verify(
      spec([
        open('/form'),
        {
          id: 'bad',
          type: 'click',
          description: 'Missing button',
          locator: { role: 'button', name: 'Missing' },
        },
        {
          id: 'outcome',
          type: 'visible',
          description: 'Dependent assertion',
          locator: { role: 'heading' },
        },
      ]),
      policy(),
    );
    expect(result.status).toBe('FAIL');
    expect(result.steps[2]!.status).toBe('NOT_VERIFIED');
  });
  it('blocks browser redirect destinations outside policy', async () => {
    const { result } = await verify(
      spec([
        open('/redirect-external'),
        {
          id: 'outcome',
          type: 'visible',
          description: 'Outcome',
          locator: { role: 'heading' },
        },
      ]),
      policy(),
    );
    expect(result.status).toBe('ERROR');
    expect(result.errors.join(' ')).toContain('allowedOrigins');
  });
  it('API redirects are never followed', async () => {
    const { result } = await verify(
      spec([
        {
          id: 'api',
          type: 'api',
          description: 'Reject redirect',
          url: '/redirect-external',
          status: 200,
        },
      ]),
      policy(),
    );
    expect(result.status).toBe('FAIL');
    expect(String(result.steps[0]!.observed)).toContain('302');
  });
  it('explicit independent assertions execute after an unrelated failure; cleanup runs', async () => {
    const input = spec([
      open('/form'),
      {
        id: 'bad',
        type: 'text',
        description: 'Wrong text',
        locator: { role: 'heading' },
        equals: 'Wrong',
      },
      {
        id: 'independent',
        type: 'api',
        dependsOn: [],
        description: 'Independent source',
        url: '/api/membership',
        status: 200,
      },
    ]);
    const { result } = await verify(
      {
        ...input,
        cleanup: [
          {
            id: 'cleanup',
            type: 'navigate',
            description: 'Explicit cleanup navigation',
            url: '/',
          },
        ],
      },
      policy(),
    );
    expect(result.status).toBe('FAIL');
    expect(result.steps[2]!.status).toBe('PASS');
    expect(result.steps[3]!.phase).toBe('cleanup');
  });
  it('configured credentials are absent from metadata and disable binary artifacts', async () => {
    process.env.PP_TEST_SECRET = 'credential-unique-72839';
    try {
      const steps = [
        open('/form'),
        {
          id: 'fill',
          type: 'fill',
          locator: { label: 'Name' },
          value: { env: 'PP_TEST_SECRET' },
          description: 'Fill secret',
        },
        {
          id: 'text',
          type: 'text',
          description: 'Failure captures actual page text',
          locator: { label: 'Name' },
          equals: 'different',
        },
      ];
      const input = spec(steps);
      const { directory } = await verify(input, policy());
      for (const file of ['result.json', 'report.html', 'spec.json'])
        expect(
          await readFile(path.join(directory, file), 'utf8'),
        ).not.toContain(process.env.PP_TEST_SECRET);
      await expect(
        verify({ ...input, evidence: { trace: true } }, policy()),
      ).rejects.toThrow(/disabled/);
    } finally {
      delete process.env.PP_TEST_SECRET;
    }
  });
  it('fresh runs cannot reuse screenshot paths', async () => {
    const input = spec(
      [
        open('/'),
        {
          id: 'visible',
          type: 'visible',
          description: 'Heading',
          locator: { role: 'heading' },
        },
      ],
      { screenshots: true },
    );
    const a = await verify(input, policy());
    const b = await verify(input, policy());
    expect(a.directory).not.toBe(b.directory);
  });
});
describe('built CLI', () => {
  const cli = path.resolve('dist/cli.js');
  async function call(args: string[], env?: NodeJS.ProcessEnv) {
    try {
      const result = await command(process.execPath, [cli, ...args], {
        cwd: workspace,
        env,
      });
      return { ...result, code: 0 };
    } catch (error) {
      const e = error as Error & {
        code: number;
        stdout: string;
        stderr: string;
      };
      return { code: e.code, stdout: e.stdout, stderr: e.stderr };
    }
  }
  async function files(input: unknown) {
    await writeFile(path.join(workspace, 'spec.json'), JSON.stringify(input));
    await writeFile(
      path.join(workspace, 'config.json'),
      JSON.stringify(policy()),
    );
  }
  it('initializes safely and preserves existing configuration', async () => {
    expect((await call(['init', '--base-url', baseUrl])).code).toBe(0);
    const file = path.join(workspace, '.promiseproof/config.json');
    const before = await readFile(file, 'utf8');
    expect((await call(['init'])).stdout).toContain('Preserved');
    expect(await readFile(file, 'utf8')).toBe(before);
  });
  it('rejects invalid spec with exit 2', async () => {
    await files({ invalid: true });
    const result = await call([
      'verify',
      'spec.json',
      '--config',
      'config.json',
    ]);
    expect(result.code).toBe(2);
    expect(result.stderr).toContain('Invalid configuration');
  });
  it('verify withholds malformed spec contents and explains how to repair JSON', async () => {
    await files(await example('simple-form'));
    const marker = 'private-canary-91';
    await writeFile(path.join(workspace, 'spec.json'), marker);
    let requests = 0;
    const count = () => requests++;
    server.on('request', count);
    try {
      const result = await call([
        'verify',
        'spec.json',
        '--config',
        'config.json',
      ]);
      expect(result.code).toBe(2);
      expect(result.stdout + result.stderr).not.toContain(marker);
      expect(result.stderr).toContain('spec.json');
      expect(result.stderr).toMatch(/JSON/);
      expect(result.stderr).toMatch(/check|fix/i);
      expect(requests).toBe(0);
    } finally {
      server.off('request', count);
    }
  });
  it.each([
    ['verify', 'spec.json', '--config', 'malformed-policy.json'],
    ['list', '--config', 'malformed-policy.json'],
    ['report', 'recorded-run', '--config', 'malformed-policy.json'],
  ])('withholds malformed policy contents for %s', async (...args) => {
    await files(await example('simple-form'));
    const marker = 'private-canary-92';
    await writeFile(path.join(workspace, 'malformed-policy.json'), marker);
    const result = await call(args);
    expect(result.code).toBe(2);
    expect(result.stdout + result.stderr).not.toContain(marker);
    expect(result.stderr).toContain('malformed-policy.json');
    expect(result.stderr).toMatch(/JSON/);
    expect(result.stderr).toMatch(/check|fix/i);
  });
  it('points missing input files to a path repair without a runtime verdict', async () => {
    await files(await example('simple-form'));
    const result = await call([
      'verify',
      'missing-workflow.json',
      '--config',
      'config.json',
    ]);
    expect(result.code).toBe(2);
    expect(result.stdout).toBe('');
    expect(result.stderr).toContain('missing-workflow.json');
    expect(result.stderr).toMatch(/not found/i);
    expect(result.stderr).toMatch(/check.*path/i);
  });
  it('returns 0 for real success, emits JSON, and locates the report', async () => {
    await files(await example('simple-form'));
    const result = await call([
      'verify',
      'spec.json',
      '--config',
      'config.json',
      '--json',
    ]);
    expect(result.code).toBe(0);
    const parsed = JSON.parse(result.stdout);
    expect(parsed.status).toBe('PASS');
    expect((await call(['list', '--config', 'config.json'])).stdout).toContain(
      parsed.runId,
    );
    expect(
      (
        await call(['report', parsed.runId, '--config', 'config.json'])
      ).stdout.trim(),
    ).toBe(path.join(parsed.directory, 'report.html'));
  });
  it('returns 1 for the deliberately broken workflow', async () => {
    await files(await example('failing-workflow'));
    expect(
      (await call(['verify', 'spec.json', '--config', 'config.json'])).code,
    ).toBe(1);
  });
  it('returns 3 for unavailable infrastructure', async () => {
    const unreachable = 'http://127.0.0.1:1';
    await files({
      ...spec([
        {
          id: 'api',
          type: 'api',
          description: 'Source',
          url: '/',
          status: 200,
        },
      ]),
      baseUrl: unreachable,
    });
    await writeFile(
      path.join(workspace, 'config.json'),
      JSON.stringify({ ...policy(), allowedOrigins: [unreachable] }),
    );
    expect(
      (await call(['verify', 'spec.json', '--config', 'config.json'])).code,
    ).toBe(3);
  });
  it('doctor verifies browser, configuration and filesystem', async () => {
    await files(await example('simple-form'));
    expect(
      (await call(['doctor', '--config', 'config.json', '--spec', 'spec.json']))
        .code,
    ).toBe(0);
  });
  it('doctor emits setup readiness JSON without claiming verified outcomes', async () => {
    await files(await example('simple-form'));
    const result = await call([
      'doctor',
      '--config',
      'config.json',
      '--spec',
      'spec.json',
      '--json',
    ]);
    expect(result.code).toBe(0);
    const report = JSON.parse(result.stdout);
    expect(report).toMatchObject({
      schemaVersion: '1',
      status: 'READY',
      outcomesVerified: false,
      exitCode: 0,
    });
    expect(
      report.checks.some(
        (c: { code: string; status: string }) =>
          c.code === 'TARGET_POLICY' && c.status === 'PASS',
      ),
    ).toBe(true);
  });
  it('doctor rejects a disallowed target before making any application request', async () => {
    await files(await example('simple-form'));
    await writeFile(
      path.join(workspace, 'config.json'),
      JSON.stringify({ ...policy(), allowedOrigins: ['http://127.0.0.1:9'] }),
    );
    let requests = 0;
    const count = () => {
      requests++;
    };
    server.on('request', count);
    try {
      const result = await call([
        'doctor',
        '--config',
        'config.json',
        '--spec',
        'spec.json',
      ]);
      expect(result.code).toBe(2);
      expect(result.stdout).toContain('TARGET_POLICY');
      expect(result.stdout).toContain('allowedOrigins');
      expect(requests).toBe(0);
    } finally {
      server.off('request', count);
    }
  });
  it('doctor keeps malformed input private and returns a JSON repair hint', async () => {
    await files(await example('simple-form'));
    const marker = 'synthetic-private-value-not-for-output';
    await writeFile(
      path.join(workspace, 'spec.json'),
      '{"bad":"' + marker + '"',
    );
    const result = await call([
      'doctor',
      '--config',
      'config.json',
      '--spec',
      'spec.json',
      '--json',
    ]);
    expect(result.code).toBe(2);
    expect(result.stdout + result.stderr).not.toContain(marker);
    const report = JSON.parse(result.stdout);
    expect(report.status).toBe('BLOCKED');
    expect(report.checks).toContainEqual(
      expect.objectContaining({
        code: 'SPEC_INVALID',
        status: 'FAIL',
        remediation: expect.any(String),
      }),
    );
  });
  it('doctor reports a missing policy with an init action and exit 2', async () => {
    const result = await call([
      'doctor',
      '--config',
      'missing-policy.json',
      '--json',
    ]);
    expect(result.code).toBe(2);
    const check = JSON.parse(result.stdout).checks.find(
      (c: { code: string }) => c.code === 'CONFIG_MISSING',
    );
    expect(check.status).toBe('FAIL');
    expect(check.remediation).toContain('init');
  });
  it('doctor diagnoses an absent browser without installing it', async () => {
    await files(await example('simple-form'));
    const result = await call(['doctor', '--config', 'config.json', '--json'], {
      ...process.env,
      PLAYWRIGHT_BROWSERS_PATH: path.join(workspace, 'no-browsers'),
    });
    expect(result.code).toBe(3);
    const check = JSON.parse(result.stdout).checks.find(
      (c: { code: string }) => c.code === 'CHROMIUM',
    );
    expect(check.status).toBe('FAIL');
    expect(check.remediation).toContain('playwright install');
    await expect(stat(path.join(workspace, 'no-browsers'))).rejects.toThrow();
  });
  it('doctor distinguishes evidence write failure from invalid configuration', async () => {
    await files(await example('simple-form'));
    const outputFile = path.join(workspace, 'not-a-directory');
    await writeFile(outputFile, 'preserve this file');
    await writeFile(
      path.join(workspace, 'config.json'),
      JSON.stringify({ ...policy(), outputDir: outputFile }),
    );
    const result = await call(['doctor', '--config', 'config.json', '--json']);
    expect(result.code).toBe(3);
    const checks = JSON.parse(result.stdout).checks;
    expect(checks).toContainEqual(
      expect.objectContaining({ code: 'CONFIGURATION', status: 'PASS' }),
    );
    expect(checks).toContainEqual(
      expect.objectContaining({
        code: 'EVIDENCE_DIRECTORY',
        status: 'FAIL',
        remediation: expect.any(String),
      }),
    );
    expect(await readFile(outputFile, 'utf8')).toBe('preserve this file');
  });
  it('doctor withholds credential values and blocks incompatible evidence', async () => {
    const input = {
      ...spec([
        open('/'),
        {
          id: 'visible',
          type: 'visible',
          description: 'Heading',
          locator: { role: 'heading' },
        },
      ]),
      requiredEnv: ['PP_DOCTOR_SECRET'],
    };
    await files(input);
    const env = { ...process.env, PP_DOCTOR_SECRET: 'synthetic-doctor-secret' };
    const ready = await call(
      ['doctor', '--config', 'config.json', '--spec', 'spec.json', '--json'],
      env,
    );
    expect(ready.code).toBe(0);
    expect(ready.stdout + ready.stderr).not.toContain(env.PP_DOCTOR_SECRET);
    const missing = await call(
      ['doctor', '--config', 'config.json', '--spec', 'spec.json', '--json'],
      { ...env, PP_DOCTOR_SECRET: '' },
    );
    expect(missing.code).toBe(3);
    expect(JSON.parse(missing.stdout).checks).toContainEqual(
      expect.objectContaining({
        code: 'ENVIRONMENT_VARIABLE',
        status: 'FAIL',
        name: 'PP_DOCTOR_SECRET',
      }),
    );
    await files({ ...input, evidence: { screenshots: true } });
    const unsafe = await call(
      ['doctor', '--config', 'config.json', '--spec', 'spec.json', '--json'],
      env,
    );
    expect(unsafe.code).toBe(2);
    expect(JSON.parse(unsafe.stdout).checks).toContainEqual(
      expect.objectContaining({ code: 'EVIDENCE_POLICY', status: 'FAIL' }),
    );
    expect(unsafe.stdout + unsafe.stderr).not.toContain(env.PP_DOCTOR_SECRET);
  });
  it('doctor marks workflow-specific checks as unchecked without a spec', async () => {
    await files(await example('simple-form'));
    const result = await call(['doctor', '--config', 'config.json', '--json']);
    expect(result.code).toBe(0);
    expect(JSON.parse(result.stdout).checks).toContainEqual(
      expect.objectContaining({ code: 'SPECIFICATION', status: 'NOT_CHECKED' }),
    );
  });
  it('doctor defers captured URLs and rejects traces that may capture credentials', async () => {
    const input = await example('invitation-flow');
    await files(input);
    const deferred = await call([
      'doctor',
      '--config',
      'config.json',
      '--spec',
      'spec.json',
      '--json',
    ]);
    expect(deferred.code).toBe(0);
    expect(JSON.parse(deferred.stdout).checks).toContainEqual(
      expect.objectContaining({ code: 'RUNTIME_URLS', status: 'NOT_CHECKED' }),
    );
    await files({ ...input, evidence: { ...input.evidence, trace: true } });
    const unsafe = await call([
      'doctor',
      '--config',
      'config.json',
      '--spec',
      'spec.json',
      '--json',
    ]);
    expect(unsafe.code).toBe(2);
    expect(JSON.parse(unsafe.stdout).checks).toContainEqual(
      expect.objectContaining({ code: 'EVIDENCE_POLICY', status: 'FAIL' }),
    );
  });
  it('doctor uses the same secret-literal serialization as verification', async () => {
    const input = {
      ...spec([
        open('/'),
        {
          id: 'visible',
          type: 'visible',
          description: 'Heading',
          locator: { role: 'heading' },
        },
      ]),
      requiredEnv: ['PP_DOCTOR_FORMAT_SECRET'],
    };
    await files(input);
    const result = await call(
      ['doctor', '--config', 'config.json', '--spec', 'spec.json', '--json'],
      { ...process.env, PP_DOCTOR_FORMAT_SECRET: ': ' },
    );
    expect(result.code).toBe(2);
    expect(JSON.parse(result.stdout).checks).toContainEqual(
      expect.objectContaining({ code: 'EVIDENCE_POLICY', status: 'FAIL' }),
    );
  });
  it('rejects command errors and report traversal with exit 2', async () => {
    expect((await call(['unknown'])).code).toBe(2);
    expect((await call(['report', '../outside'])).code).toBe(2);
  });
  it('bundled agent skill describes the independently executed contract', async () => {
    const skill = await readFile('skills/promiseproof/SKILL.md', 'utf8');
    expect(skill).toContain('NOT_VERIFIED');
    expect(skill).toContain('revision');
    const input: Spec = JSON.parse(
      await readFile('examples/simple-form/spec.json', 'utf8'),
    );
    expect(input.steps.some((s: Step) => s.type === 'api')).toBe(true);
  });
  it('exports usable agent instructions and refuses to overwrite them', async () => {
    expect(
      (await call(['agent', '--output', 'PROMISEPROOF-AGENT.md'])).code,
    ).toBe(0);
    expect(
      await readFile(path.join(workspace, 'PROMISEPROOF-AGENT.md'), 'utf8'),
    ).toContain('NOT_VERIFIED');
    expect(
      (await call(['agent', '--output', 'PROMISEPROOF-AGENT.md'])).code,
    ).toBe(2);
  });
});
