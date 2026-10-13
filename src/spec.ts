import { z } from 'zod';

const id = z.string().regex(/^[a-zA-Z][a-zA-Z0-9_-]{0,79}$/);
const text = z.string().min(1).max(4000);
const locator = z.union([
  z.strictObject({
    role: z.enum([
      'button',
      'link',
      'textbox',
      'heading',
      'checkbox',
      'combobox',
      'status',
      'alert',
      'option',
    ]),
    name: text.optional(),
    exact: z.boolean().default(true),
  }),
  z.strictObject({ label: text, exact: z.boolean().default(true) }),
  z.strictObject({ testId: text }),
  z.strictObject({ css: text }),
]);
const value = z.union([
  z.string().max(4000),
  z.strictObject({ env: id }),
  z.strictObject({ variable: id }),
]);
const common = {
  id,
  description: text,
  context: id.default('default'),
  dependsOn: z.array(id).max(100).optional(),
  timeoutMs: z.number().int().min(100).max(60000).optional(),
};
const target = { locator };
const api = {
  url: value,
  status: z.number().int().min(100).max(599),
  headers: z.record(z.string(), value).default({}),
  json: z
    .strictObject({ path: z.string().max(500), equals: z.json() })
    .optional(),
  capture: z.strictObject({ variable: id, path: text }).optional(),
};
export const stepSchema = z.discriminatedUnion('type', [
  z.strictObject({ ...common, type: z.literal('navigate'), url: value }),
  z.strictObject({ ...common, ...target, type: z.literal('click') }),
  z.strictObject({ ...common, ...target, type: z.literal('fill'), value }),
  z.strictObject({ ...common, ...target, type: z.literal('select'), value }),
  z.strictObject({
    ...common,
    ...target,
    type: z.literal('check'),
    checked: z.boolean().default(true),
  }),
  z.strictObject({
    ...common,
    ...target,
    type: z.literal('wait'),
    state: z
      .enum(['visible', 'hidden', 'attached', 'detached'])
      .default('visible'),
  }),
  z.strictObject({
    ...common,
    ...target,
    type: z.literal('visible'),
    expected: z.boolean().default(true),
  }),
  z.strictObject({
    ...common,
    ...target,
    type: z.literal('text'),
    equals: value,
  }),
  z.strictObject({ ...common, type: z.literal('url'), equals: value }),
  z.strictObject({
    ...common,
    ...target,
    type: z.literal('property'),
    property: z.enum(['value', 'checked', 'disabled', 'required']),
    equals: z.union([z.string(), z.boolean()]),
  }),
  z.strictObject({
    ...common,
    ...target,
    type: z.literal('validation'),
    valid: z.boolean(),
  }),
  z.strictObject({ ...common, type: z.literal('noErrors') }),
  z.strictObject({ ...common, ...api, type: z.literal('api') }),
  z.strictObject({
    ...common,
    type: z.literal('response'),
    after: id,
    url: value,
    status: z.number().int().min(100).max(599),
  }),
  z.strictObject({ ...common, type: z.literal('unverified'), reason: text }),
]);
export const specSchema = z.strictObject({
  $schema: z.string().optional(),
  schemaVersion: z.literal('1'),
  id,
  revision: z.number().int().positive(),
  goal: text,
  baseUrl: z.url(),
  environment: text.default('local test'),
  preconditions: z.array(text).default([]),
  requiredEnv: z.array(id).default([]),
  tags: z.array(text).default([]),
  metadata: z.record(z.string(), z.string()).default({}),
  timeoutMs: z.number().int().min(100).max(60000).default(5000),
  evidence: z
    .strictObject({
      screenshots: z.boolean().default(false),
      trace: z.boolean().default(false),
      mask: z.array(locator).default([]),
    })
    .default({ screenshots: false, trace: false, mask: [] }),
  steps: z.array(stepSchema).min(1).max(200),
  cleanup: z.array(stepSchema).max(30).default([]),
});
export const configSchema = z.strictObject({
  $schema: z.string().optional(),
  schemaVersion: z.literal('1'),
  allowedOrigins: z.array(z.url()).min(1).max(30),
  allowRemote: z.boolean().default(false),
  environment: z.literal('test'),
  outputDir: z.string().min(1).default('.promiseproof/runs'),
});
export type Spec = z.infer<typeof specSchema>;
export type Step = z.infer<typeof stepSchema>;
export type LocatorSpec = z.infer<typeof locator>;
export type Value = z.infer<typeof value>;
export type Config = z.infer<typeof configSchema>;
export const assertionTypes = new Set([
  'visible',
  'text',
  'url',
  'property',
  'validation',
  'noErrors',
  'api',
  'response',
  'unverified',
]);
export class ConfigurationError extends Error {}

export function parseSpec(raw: unknown): Spec {
  const result = specSchema.safeParse(raw);
  if (!result.success)
    throw new ConfigurationError(z.prettifyError(result.error));
  const spec = result.data;
  const checkLiteralUrl = (input: string) => {
    const url = new URL(input, spec.baseUrl);
    if (
      url.username ||
      url.password ||
      [...url.searchParams.keys()].some((key) =>
        /password|secret|token|authorization|cookie|api.?key|(?:^|[_-])key(?:$|[_-])/i.test(
          key,
        ),
      )
    )
      throw new ConfigurationError(
        'Credential-bearing URL literals are not permitted. Use an environment or captured-variable reference.',
      );
  };
  checkLiteralUrl(spec.baseUrl);
  if (
    Object.keys(spec.metadata).some((key) =>
      /password|secret|token|authorization|cookie|api.?key/i.test(key),
    )
  )
    throw new ConfigurationError(
      'Metadata must not contain credential fields.',
    );
  if (!spec.steps.some((s) => assertionTypes.has(s.type)))
    throw new ConfigurationError('At least one outcome assertion is required.');
  const known = new Set<string>();
  for (const step of [...spec.steps, ...spec.cleanup]) {
    const literalUrl =
      'url' in step ? step.url : step.type === 'url' ? step.equals : undefined;
    if (typeof literalUrl === 'string') checkLiteralUrl(literalUrl);
    if (
      step.type === 'property' &&
      (step.property === 'value'
        ? typeof step.equals !== 'string'
        : typeof step.equals !== 'boolean')
    )
      throw new ConfigurationError(
        `${step.id}: value expects a string; checked, disabled and required expect a boolean.`,
      );
    if (known.has(step.id))
      throw new ConfigurationError(`Duplicate step id: ${step.id}`);
    for (const dependency of step.dependsOn ?? []) {
      if (!known.has(dependency))
        throw new ConfigurationError(
          `${step.id}: dependency ${dependency} must refer to an earlier step.`,
        );
    }
    if (step.type === 'response') {
      const trigger = [...spec.steps, ...spec.cleanup].find(
        (s) => s.id === step.after,
      );
      if (
        !known.has(step.after) ||
        trigger?.context !== step.context ||
        !trigger ||
        assertionTypes.has(trigger.type)
      )
        throw new ConfigurationError(
          `${step.id}: after must reference an earlier action in the same context.`,
        );
    }
    if (step.type === 'api') {
      for (const [header, value] of Object.entries(step.headers)) {
        if (
          /authorization|cookie|token|key|secret/i.test(header) &&
          (typeof value === 'string' || !('env' in value))
        )
          throw new ConfigurationError(
            `${step.id}: credential header ${header} requires an environment reference.`,
          );
      }
    }
    if (
      step.type === 'fill' &&
      /password|secret|token|api.?key/i.test(JSON.stringify(step.locator)) &&
      (typeof step.value === 'string' || !('env' in step.value))
    )
      throw new ConfigurationError(
        `${step.id}: sensitive inputs require environment references.`,
      );
    known.add(step.id);
  }
  return spec;
}

export function parseConfig(raw: unknown): Config {
  const result = configSchema.safeParse(raw);
  if (!result.success)
    throw new ConfigurationError(z.prettifyError(result.error));
  for (const origin of result.data.allowedOrigins) {
    if (new URL(origin).origin !== origin)
      throw new ConfigurationError(
        'Use exact origins without credentials, paths, query strings or trailing slashes.',
      );
  }
  return result.data;
}
