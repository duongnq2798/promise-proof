import { afterEach, expect, it, vi } from 'vitest';
import { EventEmitter } from 'node:events';
import { mkdir, mkdtemp, rm } from 'node:fs/promises';
import path from 'node:path';
import { Server } from 'node:http';
import { chromium } from '@playwright/test';
import { spawn } from 'node:child_process';

vi.mock('node:child_process', async (importOriginal) => ({
  ...(await importOriginal<typeof import('node:child_process')>()),
  // Stub OS subprocess boundaries; ordinary verification still uses real Chromium/HTTP.
  spawn: vi.fn((_executable, args: string[]) => {
    const child = Object.assign(new EventEmitter(), { unref: () => {} });
    queueMicrotask(() => {
      if (args.includes('install')) child.emit('close', 1);
      else {
        process.emit('SIGINT');
        child.emit('spawn');
      }
    });
    return child;
  }),
}));
import { runQuickstart } from '../src/quickstart.js';

const originalCwd = process.cwd();
afterEach(() => {
  process.chdir(originalCwd);
  vi.restoreAllMocks();
});

it('starts no installer when interrupted during the initial browser probe', async () => {
  vi.mocked(spawn).mockClear();
  vi.spyOn(chromium, 'launch').mockImplementationOnce(async () => {
    process.emit('SIGTERM');
    throw new Error('Browser launch interrupted');
  });
  await expect(
    runQuickstart({ example: 'simple-form', open: false, install: true }),
  ).rejects.toThrow(/interrupted/i);
  expect(spawn).not.toHaveBeenCalled();
});

it('cannot return success when interrupted during final demo cleanup', async () => {
  await mkdir('.smoke', { recursive: true });
  const cwd = await mkdtemp(path.resolve('.smoke/interrupt-cleanup-'));
  const close = Server.prototype.close;
  vi.spyOn(Server.prototype, 'close').mockImplementation(function (
    this: Server,
    callback,
  ) {
    return close.call(this, (error) => {
      process.emit('SIGTERM');
      callback?.(error);
    });
  });
  const listeners = process.listenerCount('SIGTERM');
  process.chdir(cwd);
  try {
    await expect(
      runQuickstart({ example: 'simple-form', open: false, install: false }),
    ).rejects.toThrow(/interrupted/i);
    expect(process.listenerCount('SIGTERM')).toBe(listeners);
  } finally {
    process.chdir(originalCwd);
    await rm(cwd, { recursive: true, force: true });
  }
});
it('cannot complete successfully when interrupted while launching the report viewer', async () => {
  await mkdir('.smoke', { recursive: true });
  const cwd = await mkdtemp(path.resolve('.smoke/interrupt-'));
  const signalListeners = process.listenerCount('SIGINT');
  process.chdir(cwd);
  try {
    await expect(
      runQuickstart({ example: 'simple-form', open: true, install: false }),
    ).rejects.toThrow(/interrupted/i);
    expect(process.listenerCount('SIGINT')).toBe(signalListeners);
  } finally {
    process.chdir(originalCwd);
    await rm(cwd, { recursive: true, force: true });
  }
});
