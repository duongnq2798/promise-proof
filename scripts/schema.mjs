import { mkdir, writeFile } from 'node:fs/promises';
import { z } from 'zod';
import { specSchema, configSchema } from '../dist/spec.js';
await mkdir('schema', { recursive: true });
for (const [name, schema] of [
  ['spec', specSchema],
  ['config', configSchema],
]) {
  await writeFile(
    `schema/${name}.schema.json`,
    JSON.stringify(z.toJSONSchema(schema), null, 2) + '\n',
  );
}
