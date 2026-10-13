import { describe, expect, it, vi } from 'vitest';
import { mkdir, mkdtemp, readdir, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';

vi.mock('node:fs/promises', async (importOriginal) => {
  const actual = await importOriginal<typeof import('node:fs/promises')>();
  return {
    ...actual,
    open: async (...args: Parameters<typeof actual.open>) => {
      const handle = await actual.open(...args);
      // Simulate a data-write quota failure; creation, close and cleanup stay real.
      vi.spyOn(handle, 'writeFile').mockRejectedValue(
        Object.assign(new Error('Synthetic quota exhausted'), {
          code: 'ENOSPC',
        }),
      );
      return handle;
    },
  };
});
import { runDoctor } from '../src/doctor.js';

describe('diagnostic evidence writes', () => {
  it('blocks setup and cleans its probe when creating a file works but data writes fail', async () => {
    await mkdir('.smoke', { recursive: true });
    const directory = await mkdtemp(path.resolve('.smoke/doctor-quota-'));
    const output = path.join(directory, 'evidence');
    const config = path.join(directory, 'config.json');
    await writeFile(
      config,
      JSON.stringify({
        schemaVersion: '1',
        environment: 'test',
        allowedOrigins: ['http://127.0.0.1:4173'],
        outputDir: output,
      }),
    );
    try {
      const report = await runDoctor({ config });
      expect(report.status).toBe('BLOCKED');
      expect(report.exitCode).toBe(3);
      expect(report.checks).toContainEqual(
        expect.objectContaining({ code: 'EVIDENCE_DIRECTORY', status: 'FAIL' }),
      );
      expect(await readdir(output)).toEqual([]);
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });
});
