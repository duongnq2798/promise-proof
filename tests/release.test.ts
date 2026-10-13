import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';
import { parse } from 'yaml';
import { z } from 'zod';
import { configSchema, specSchema } from '../src/spec.js';

describe('release contracts', () => {
  it('emits strict editor schemas', () => {
    const schema = z.toJSONSchema(specSchema);
    expect(schema.additionalProperties).toBe(false);
    expect(schema.required).toContain('steps');
    expect(z.toJSONSchema(configSchema).additionalProperties).toBe(false);
  });
  it('CI YAML parses and uploads evidence on failure', async () => {
    const ci = parse(await readFile('.github/workflows/ci.yml', 'utf8'));
    expect(ci.on).toHaveProperty('pull_request');
    expect(ci.jobs.verify.strategy.matrix.os).toHaveLength(3);
    expect(
      ci.jobs.verify.steps.find((s: { uses?: string }) =>
        s.uses?.startsWith('actions/upload-artifact'),
      ).with['include-hidden-files'],
    ).toBe(true);
    expect(
      ci.jobs.verify.steps.find((s: { uses?: string }) =>
        s.uses?.startsWith('actions/upload-artifact'),
      ).if,
    ).toBe('always()');
    const consumer = parse(await readFile('docs/ci-example.yml', 'utf8'));
    expect(
      consumer.jobs.outcome.steps.some(
        (s: { run?: string }) => s.run === 'npm run verify:outcome',
      ),
    ).toBe(true);
  });
});
