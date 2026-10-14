import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { execFile, spawn } from 'node:child_process';
import { once } from 'node:events';
import { mkdir, mkdtemp, readdir, rm } from 'node:fs/promises';
import { createServer } from 'node:http';
import path from 'node:path';
import { promisify } from 'node:util';

const command = promisify(execFile);
const cli = path.resolve('dist/cli.js');
let directory: string;
beforeAll(async () => {
  await mkdir('.smoke', { recursive: true });
  directory = await mkdtemp(path.resolve('.smoke/demo-cli-'));
});
afterAll(async () => {
  await rm(directory, { recursive: true, force: true });
});

async function rejected(args: string[]) {
  try {
    const result = await command(process.execPath, [cli, ...args], {
      cwd: directory,
    });
    return { ...result, code: 0 };
  } catch (error) {
    return error as { code: number; stdout: string; stderr: string };
  }
}

describe('installed-style demo CLI', () => {
  it.each(['word', '65536', '-1', '1.5'])(
    'rejects invalid demo port %s with a repair hint',
    async (port) => {
      const result = await rejected(['demo', '--port', port]);
      expect(result.code).toBe(2);
      expect(result.stderr).toMatch(/port/i);
      expect(result.stderr).toMatch(/0.*65535/);
      expect(await readdir(directory)).toEqual([]);
    },
  );

  it('explains an occupied demo port without replacing the existing listener', async () => {
    const occupied = createServer((_req, response) => response.end('owner'));
    occupied.listen(0, '127.0.0.1');
    await once(occupied, 'listening');
    try {
      const address = occupied.address();
      if (!address || typeof address === 'string') throw new Error('No port');
      const result = await rejected(['demo', '--port', String(address.port)]);
      expect(result.code).toBe(3);
      expect(result.stderr).toMatch(/port.*in use/i);
      expect(result.stderr).toContain('--port');
      expect(
        await (await fetch(`http://127.0.0.1:${address.port}`)).text(),
      ).toBe('owner');
    } finally {
      await new Promise<void>((resolve) => occupied.close(() => resolve()));
    }
  });

  it('serves the real synthetic fixture on an assigned port and releases it on stop', async () => {
    const child = spawn(process.execPath, [cli, 'demo', '--port', '0'], {
      cwd: directory,
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    const closed = once(child, 'close');
    let stdout = '';
    let stderr = '';
    child.stderr.on('data', (chunk) => (stderr += String(chunk)));
    const ready = new Promise<string | undefined>((resolve) => {
      const finish = () => {
        clearTimeout(deadline);
        resolve(stdout.match(/http:\/\/127\.0\.0\.1:\d+/)?.[0]);
      };
      const deadline = setTimeout(finish, 10000);
      child.once('close', finish);
      child.stdout.on('data', (chunk) => {
        stdout += String(chunk);
        if (/http:\/\/127\.0\.0\.1:\d+/.test(stdout)) finish();
      });
    });
    let url: string | undefined;
    try {
      url = await ready;
      expect(typeof url, stderr).toBe('string');
      expect(url, stderr).toMatch(/^http:\/\/127\.0\.0\.1:[1-9]\d*$/);
      const response = await fetch(url! + '/form');
      expect(response.status).toBe(200);
      expect(await response.text()).toContain('A form that saves');
      expect(stdout).toMatch(/synthetic|test data/i);
      expect(await readdir(directory)).toEqual([]);
    } finally {
      if (child.exitCode === null && child.signalCode === null)
        child.kill('SIGTERM');
      const [code] = await closed;
      if (process.platform !== 'win32' && url) expect(code).toBe(0);
    }
    if (url) await expect(fetch(url + '/form')).rejects.toThrow();
  });
});
