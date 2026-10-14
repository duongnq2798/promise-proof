import { readFile } from 'node:fs/promises';
import { ConfigurationError, parseSpec } from './spec.js';

export const demoExamples = [
  'simple-form',
  'failing-workflow',
  'invitation-flow',
] as const;
export type DemoExample = (typeof demoExamples)[number];

export async function loadDemoExample(name: DemoExample, baseUrl: string) {
  if (!demoExamples.includes(name))
    throw new ConfigurationError(
      'Choose a bundled demo example: ' + demoExamples.join(', '),
    );
  const bundled = JSON.parse(
    await readFile(
      new URL(`../examples/${name}/spec.json`, import.meta.url),
      'utf8',
    ),
  ) as Record<string, unknown>;
  delete bundled.$schema;
  const spec = parseSpec({ ...bundled, baseUrl });
  spec.preconditions = spec.preconditions.map((condition) =>
    condition.replace(
      'Run npm run demo.',
      'Run promiseproof demo at the configured base URL.',
    ),
  );
  return spec;
}
