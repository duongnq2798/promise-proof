import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { execFile } from 'node:child_process';
import {
  mkdir,
  mkdtemp,
  readFile,
  readdir,
  rm,
  symlink,
  writeFile,
} from 'node:fs/promises';
import path from 'node:path';
import { promisify } from 'node:util';
import { createServer } from 'node:http';
import { once } from 'node:events';
import { chromium } from '@playwright/test';

const command = promisify(execFile);
const cli = path.resolve('dist/cli.js');
let root: string;
beforeAll(async () => {
  await mkdir('.smoke', { recursive: true });
  root = await mkdtemp(path.resolve('.smoke/quickstart-tests-'));
});
afterAll(async () => {
  await rm(root, { recursive: true, force: true });
});
async function call(cwd: string, args: string[], env = process.env) {
  try {
    return {
      ...(await command(process.execPath, [cli, ...args], { cwd, env })),
      code: 0,
    };
  } catch (error) {
    return error as { stdout: string; stderr: string; code: number };
  }
}
function outputPath(stdout: string, label: string) {
  const value = stdout.match(new RegExp('^' + label + ': (.*)$', 'm'))?.[1];
  if (!value) throw new Error('Missing ' + label + ': ' + stdout);
  return JSON.parse(value) as string;
}
describe('one-command synthetic quickstart', () => {
  it('checks the headless browser before running when only full Chromium is cached', async () => {
    const cwd = await mkdtemp(path.join(root, 'partial-cache-'));
    const cache = path.join(cwd, 'cache');
    await mkdir(cache);
    let full = path.dirname(chromium.executablePath());
    while (!/^chromium-\d+$/.test(path.basename(full))) {
      const parent = path.dirname(full);
      if (parent === full)
        throw new Error('Cannot locate the matching test browser cache');
      full = parent;
    }
    await symlink(
      full,
      path.join(cache, path.basename(full)),
      process.platform === 'win32' ? 'junction' : 'dir',
    );
    const run = await call(cwd, ['quickstart', '--no-install', '--no-open'], {
      ...process.env,
      PLAYWRIGHT_BROWSERS_PATH: cache,
    });
    expect(run.code).toBe(3);
    expect(run.stdout).not.toMatch(/^Demo:|^Workspace:|^Report:/m);
    expect(await readdir(cwd)).toEqual(['cache']);
  });
  it('withholds credential-bearing installer output and preserves a setup repair hint', async () => {
    const cwd = await mkdtemp(path.join(root, 'private-download-'));
    const host = createServer((_req, res) => {
      res.writeHead(404);
      res.end('No browser archive');
    });
    host.listen(0, '127.0.0.1');
    await once(host, 'listening');
    const canary = 'download-private-canary';
    const url = `http://user:${canary}@127.0.0.1:${(host.address() as { port: number }).port}`;
    try {
      const run = await call(cwd, ['quickstart', '--no-open'], {
        ...process.env,
        PLAYWRIGHT_BROWSERS_PATH: path.join(cwd, 'cache'),
        PLAYWRIGHT_DOWNLOAD_HOST: url,
        PLAYWRIGHT_CHROMIUM_DOWNLOAD_HOST: url,
      });
      expect(run.code).toBe(3);
      expect(run.stdout + run.stderr).not.toContain(canary);
      expect(run.stderr).toMatch(
        /installation.*(network|settings|permissions)/i,
      );
      expect(run.stdout).not.toMatch(/^Demo:|^Workspace:|^Report:/m);
    } finally {
      host.closeAllConnections();
      await new Promise<void>((resolve) => host.close(() => resolve()));
    }
  });
  it.each([
    ['simple-form', 'PASS', 0],
    ['failing-workflow', 'FAIL', 1],
    ['invitation-flow', 'PASS', 0],
  ] as const)(
    'runs %s and stops its owned demo',
    async (example, status, code) => {
      const cwd = await mkdtemp(path.join(root, 'real-'));
      const run = await call(cwd, [
        'quickstart',
        '--example',
        example,
        '--no-open',
        '--no-install',
      ]);
      expect(run.code, run.stderr).toBe(code);
      const report = outputPath(run.stdout, 'Report');
      const workspace = outputPath(run.stdout, 'Workspace');
      expect(
        workspace.startsWith(
          path.join(cwd, '.promiseproof/quickstarts') + path.sep,
        ),
      ).toBe(true);
      const result = JSON.parse(
        await readFile(path.join(path.dirname(report), 'result.json'), 'utf8'),
      );
      expect(result.status).toBe(status);
      expect(await readFile(report, 'utf8')).toContain('<title>' + status);
      expect(result.baseUrl).toMatch(/^http:\/\/127\.0\.0\.1:\d+$/);
      await expect(fetch(result.baseUrl)).rejects.toThrow();
      const policy = JSON.parse(
        await readFile(
          path.join(workspace, '.promiseproof/config.json'),
          'utf8',
        ),
      );
      expect(policy.allowedOrigins).toEqual([result.baseUrl]);
      if (status === 'FAIL') {
        expect(
          result.steps.find((s: { id: string }) => s.id === 'persisted'),
        ).toMatchObject({
          status: 'FAIL',
          expected: { json: { equals: 'grace@example.test' } },
        });
        expect(
          result.steps.find((s: { id: string }) => s.id === 'downstream'),
        ).toMatchObject({ status: 'NOT_VERIFIED', attempts: 0 });
      }
    },
  );

  it('preserves project config/spec and makes separate workspaces on repeated use', async () => {
    const cwd = await mkdtemp(path.join(root, 'preserve-'));
    await mkdir(path.join(cwd, '.promiseproof'));
    const sentinel = '{"existing":"keep these exact bytes"}\n';
    for (const file of ['config.json', 'example.json'])
      await writeFile(path.join(cwd, '.promiseproof', file), sentinel);
    const first = await call(cwd, ['quickstart', '--no-open', '--no-install']);
    const second = await call(cwd, ['quickstart', '--no-open', '--no-install']);
    expect(first.code, first.stderr).toBe(0);
    expect(second.code, second.stderr).toBe(0);
    expect(outputPath(first.stdout, 'Workspace')).not.toBe(
      outputPath(second.stdout, 'Workspace'),
    );
    for (const file of ['config.json', 'example.json'])
      expect(
        await readFile(path.join(cwd, '.promiseproof', file), 'utf8'),
      ).toBe(sentinel);
  });

  it.each(['starter', '../outside'])(
    'rejects unsupported demo %s without writing',
    async (example) => {
      const cwd = await mkdtemp(path.join(root, 'invalid-'));
      const run = await call(cwd, [
        'quickstart',
        '--example',
        example,
        '--no-open',
      ]);
      expect(run.code).toBe(2);
      expect(run.stderr).toContain('simple-form');
      expect(await readdir(cwd)).toEqual([]);
    },
  );

  it('reports a missing browser without downloading or starting a demo when install is disabled', async () => {
    const cwd = await mkdtemp(path.join(root, 'browser-'));
    const browserPath = path.join(cwd, 'empty-browser-cache');
    const run = await call(cwd, ['quickstart', '--no-install', '--no-open'], {
      ...process.env,
      PLAYWRIGHT_BROWSERS_PATH: browserPath,
    });
    expect(run.code).toBe(3);
    expect(run.stderr).toMatch(/Chromium.*(install|missing)/i);
    expect(run.stdout).not.toMatch(/Demo:|Report:/);
    expect(await readdir(cwd)).toEqual([]);
  });

  it.each([false, true])(
    'exports valid %s policy/spec schema without a checkout or side effects',
    async (policy) => {
      const cwd = await mkdtemp(path.join(root, 'schema-'));
      const run = await call(cwd, ['schema', ...(policy ? ['--policy'] : [])]);
      expect(run.code, run.stderr).toBe(0);
      const schema = JSON.parse(run.stdout);
      expect(schema.type).toBe('object');
      expect(schema.required).toContain(policy ? 'allowedOrigins' : 'steps');
      expect(await readdir(cwd)).toEqual([]);
    },
  );
});
