import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { execFile } from 'node:child_process';
import { once } from 'node:events';
import {
  mkdir,
  mkdtemp,
  readFile,
  readdir,
  rm,
  writeFile,
} from 'node:fs/promises';
import path from 'node:path';
import { promisify } from 'node:util';
import { createDemoServer } from '../examples/server.mjs';

const command = promisify(execFile);
const cli = path.resolve('dist/cli.js');
const server = createDemoServer();
let root: string;
let baseUrl: string;
beforeAll(async () => {
  await mkdir('.smoke', { recursive: true });
  root = await mkdtemp(path.resolve('.smoke/init-examples-'));
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  baseUrl = `http://127.0.0.1:${(server.address() as { port: number }).port}`;
});
afterAll(async () => {
  await new Promise<void>((resolve) => server.close(() => resolve()));
  await rm(root, { recursive: true, force: true });
});
async function call(directory: string, args: string[]) {
  try {
    const output = await command(process.execPath, [cli, ...args], {
      cwd: directory,
    });
    return { ...output, code: 0 };
  } catch (error) {
    return error as { stdout: string; stderr: string; code: number };
  }
}

describe('runnable init examples', () => {
  it.each([
    ['simple-form', 'saved-contact', 'PASS', 0],
    ['failing-workflow', 'lying-form', 'FAIL', 1],
    ['invitation-flow', 'teammate-invite', 'PASS', 0],
  ] as const)(
    'initializes and runs %s against the real fixture',
    async (name, id, status, code) => {
      const directory = await mkdtemp(path.join(root, name + '-'));
      const initialized = await call(directory, [
        'init',
        '--example',
        name,
        '--base-url',
        baseUrl,
      ]);
      expect(initialized.code, initialized.stderr).toBe(0);
      const spec = JSON.parse(
        await readFile(
          path.join(directory, '.promiseproof/example.json'),
          'utf8',
        ),
      );
      const policy = JSON.parse(
        await readFile(
          path.join(directory, '.promiseproof/config.json'),
          'utf8',
        ),
      );
      expect(spec.id).toBe(id);
      expect(spec.baseUrl).toBe(baseUrl);
      expect(spec.$schema).toBeUndefined();
      expect(spec.preconditions[0]).toContain('promiseproof demo');
      expect(policy.allowedOrigins).toEqual([baseUrl]);
      const run = await call(directory, [
        'verify',
        '.promiseproof/example.json',
        '--json',
      ]);
      expect(run.code, run.stderr).toBe(code);
      const result = JSON.parse(run.stdout);
      expect(result.status).toBe(status);
      const html = await readFile(
        path.join(result.directory, 'report.html'),
        'utf8',
      );
      expect(html).toContain('<title>' + status);
      if (status === 'FAIL') {
        expect(result.summary).toMatchObject({ FAIL: 1, NOT_VERIFIED: 1 });
        expect(
          result.steps.find((step: { id: string }) => step.id === 'persisted')
            .expected.json.equals,
        ).toBe('grace@example.test');
      }
    },
  );

  it('keeps the default starter compatible with init for a custom app', async () => {
    const directory = await mkdtemp(path.join(root, 'starter-'));
    const result = await call(directory, ['init', '--base-url', baseUrl]);
    expect(result.code).toBe(0);
    const spec = JSON.parse(
      await readFile(
        path.join(directory, '.promiseproof/example.json'),
        'utf8',
      ),
    );
    expect(spec.id).toBe('first-outcome');
    expect(spec.steps.map((step: { type: string }) => step.type)).toEqual([
      'navigate',
      'visible',
    ]);
  });

  it.each(['typo', '../outside'])(
    'rejects unsupported example %s before writing files',
    async (name) => {
      const directory = await mkdtemp(path.join(root, 'invalid-'));
      const result = await call(directory, ['init', '--example', name]);
      expect(result.code).toBe(2);
      expect(result.stderr).toContain('simple-form');
      expect(await readdir(directory)).toEqual([]);
    },
  );

  it('preserves both existing files when a different example is selected', async () => {
    const directory = await mkdtemp(path.join(root, 'preserve-'));
    await mkdir(path.join(directory, '.promiseproof'));
    const config = '{"custom-policy":"preserve exactly"}\n';
    const spec = '{"custom-outcome":"preserve exactly"}\n';
    await writeFile(path.join(directory, '.promiseproof/config.json'), config);
    await writeFile(path.join(directory, '.promiseproof/example.json'), spec);
    const result = await call(directory, [
      'init',
      '--example',
      'simple-form',
      '--base-url',
      baseUrl,
    ]);
    expect(result.code, result.stderr).toBe(0);
    expect(result.stdout).toContain('Preserved existing');
    expect(
      await readFile(path.join(directory, '.promiseproof/config.json'), 'utf8'),
    ).toBe(config);
    expect(
      await readFile(
        path.join(directory, '.promiseproof/example.json'),
        'utf8',
      ),
    ).toBe(spec);
  });
});
