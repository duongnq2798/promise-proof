import { z } from 'zod';
import { aggregate, type RunResult, type Status } from './result.js';
import { assertionTypes, ConfigurationError, stepSchema } from './spec.js';
import { stepGuidance } from './report-guidance.js';
import { redact } from './security.js';

const statusSchema = z.enum(['PASS', 'FAIL', 'NOT_VERIFIED', 'ERROR']);
const statuses: Status[] = ['PASS', 'FAIL', 'NOT_VERIFIED', 'ERROR'];
const summaryByteLimit = 1024 * 1024;
const identifier = z.string().regex(/^[a-zA-Z][a-zA-Z0-9_-]{0,79}$/);
const nonnegative = z.number().nonnegative();
const stepResultSchema = z.strictObject({
  id: identifier,
  type: z.string(),
  description: z.string(),
  context: identifier,
  assertion: z.boolean(),
  phase: z.enum(['workflow', 'cleanup']),
  status: statusSchema,
  expected: z.json(),
  observed: z.json(),
  durationMs: nonnegative,
  startedAt: z.iso.datetime(),
  attempts: z.number().int().nonnegative(),
  screenshot: z.string().optional(),
});
const resultSchema = z.strictObject({
  schemaVersion: z.literal('1'),
  runnerVersion: z.string(),
  runId: z.string().regex(/^[a-zA-Z0-9_-]+$/),
  specId: identifier,
  revision: z.number().int().positive(),
  specDigest: z.string().regex(/^[a-f0-9]{64}$/),
  goal: z.string(),
  baseUrl: z.string(),
  environment: z.string(),
  preconditions: z.array(z.string()),
  status: statusSchema,
  startedAt: z.iso.datetime(),
  durationMs: nonnegative,
  steps: z.array(stepResultSchema),
  errors: z.array(z.string()),
  consoleErrors: z.record(
    z.string(),
    z
      .union([z.array(z.string()), z.literal('[REDACTED]')])
      .transform((bucket) =>
        // The runner can redact a whole context bucket. Normalize only the in-memory shape.
        Array.isArray(bucket) ? bucket : [bucket],
      ),
  ),
  network: z.array(
    z.strictObject({
      context: z.string(),
      url: z.string(),
      status: z.number().int(),
      actionId: z.string(),
    }),
  ),
  traces: z.array(z.string()),
  evidenceClasses: z.array(z.string()),
  summary: z.strictObject({
    PASS: z.number().int().nonnegative(),
    FAIL: z.number().int().nonnegative(),
    NOT_VERIFIED: z.number().int().nonnegative(),
    ERROR: z.number().int().nonnegative(),
  }),
});
const stepTypes = new Set<string>(
  stepSchema.options.map((option) => option.shape.type.value),
);

function invalidResult(): never {
  throw new ConfigurationError(
    'Invalid saved result. Use result.json from a completed supported run; input contents are withheld.',
  );
}

function parseShape(raw: unknown) {
  try {
    return resultSchema.safeParse(raw);
  } catch {
    // Recursive schema validation can reject deeply nested JSON by throwing.
    return invalidResult();
  }
}

export function parseSavedResult(raw: unknown, runId: string): RunResult {
  const parsed = parseShape(raw);
  if (!parsed.success) invalidResult();
  const result = parsed.data;
  if (result.runId !== runId) invalidResult();
  const known = new Set<string>();
  const counts = { PASS: 0, FAIL: 0, NOT_VERIFIED: 0, ERROR: 0 };
  for (const step of result.steps) {
    if (
      known.has(step.id) ||
      !stepTypes.has(step.type) ||
      step.assertion !== assertionTypes.has(step.type) ||
      (['PASS', 'FAIL'].includes(step.status) && step.attempts === 0)
    )
      invalidResult();
    const expected =
      step.expected &&
      typeof step.expected === 'object' &&
      !Array.isArray(step.expected)
        ? step.expected
        : {};
    if (Object.hasOwn(expected, 'dependsOn')) {
      const dependencies = expected.dependsOn;
      if (
        !Array.isArray(dependencies) ||
        dependencies.some(
          (id) =>
            typeof id !== 'string' || (id !== '[REDACTED]' && !known.has(id)),
        )
      )
        invalidResult();
    }
    known.add(step.id);
    if (step.assertion && step.phase === 'workflow') counts[step.status]++;
  }
  if (
    !Object.values(counts).some((count) => count > 0) ||
    statuses.some((status) => counts[status] !== result.summary[status]) ||
    result.status !==
      aggregate([
        ...result.steps.map((step) => step.status),
        ...(result.errors.length ? ['ERROR' as const] : []),
      ])
  )
    invalidResult();
  return result;
}

function text(value: string): string {
  return String(redact(value))
    .replace(/\s+/g, ' ')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(
      /[\\\x60*_{}[\]()!|#~:]/g,
      (character) => '&#' + character.charCodeAt(0) + ';',
    );
}

function artifactLink(raw?: string): string | undefined {
  if (raw === undefined) return undefined;
  try {
    const url = new URL(raw);
    if (
      url.protocol !== 'https:' ||
      url.username ||
      url.password ||
      /[\r\n]/.test(raw) ||
      [...url.searchParams.keys()].some((key) =>
        /password|secret|token|authorization|cookie|api[_-]?key|credential|signature|(?:^|[_-])(?:key|sig)(?:$|[_-])/i.test(
          key,
        ),
      )
    )
      throw new Error();
    return url.href.replace(
      /[<>"'()[\]\x60\\]/g,
      (character) => '%' + character.charCodeAt(0).toString(16).toUpperCase(),
    );
  } catch {
    throw new ConfigurationError(
      'Artifact URL must be an HTTPS URL without embedded credentials, sensitive query keys or newlines.',
    );
  }
}

function checkRows(result: RunResult): string[] {
  return result.steps.flatMap((step, index) => {
    if (!step.assertion && step.status === 'PASS') return [];
    const kind = step.phase + ' ' + (step.assertion ? 'assertion' : 'action');
    const guidance = stepGuidance(result, index);
    const blockers = guidance?.dependencies.map((blocker) => blocker.id);
    const note = blockers?.length
      ? 'Blocked by: ' + blockers.map(text).join(', ')
      : step.status === 'NOT_VERIFIED' && step.attempts === 0
        ? 'Not executed; inspect the saved evidence'
        : step.status !== 'PASS'
          ? 'Inspect result.json and report.html'
          : '';
    return [
      '| ' +
        [text(step.id), kind, step.status, text(step.description), note].join(
          ' | ',
        ) +
        ' |',
    ];
  });
}

export function renderSummary(result: RunResult, url?: string): string {
  const link = artifactLink(url);
  const markdown = [
    '# PromiseProof saved-run summary',
    '',
    'Recorded outcome: **' + result.status + '**',
    '',
    text(result.goal),
    '',
    'Run: ' + text(result.runId),
    'Contract: ' + text(result.specId) + ' · revision ' + result.revision,
    'Spec SHA-256: ' + result.specDigest,
    '',
    '## Workflow assertions',
    '',
    '| Status | Count |',
    '| --- | --- |',
    ...statuses.map(
      (status) => '| ' + status + ' | ' + result.summary[status] + ' |',
    ),
    '',
    'Counts cover workflow assertions. Failed actions and cleanup also affect the recorded outcome.',
    'Runtime errors: ' +
      result.errors.length +
      ' (details in the evidence bundle).',
    '',
    '## Checks to review',
    '',
    '| Step | Kind | Status | Check | Next |',
    '| --- | --- | --- | --- | --- |',
    ...checkRows(result),
    '',
    '## Evidence',
    '',
    ...(link ? ['[Download evidence artifact](<' + link + '>)', ''] : []),
    'Open ' + result.runId + '/report.html in the downloaded run folder.',
    'Recorded data: ' + result.runId + '/result.json',
    'Executed contract: ' + result.runId + '/spec.json',
    '',
    'This summarizes recorded evidence; it does not rerun verification or authenticate editable bundles.',
    'Raw observations, request data and binary artifacts remain in the bundle. Review it before sharing.',
    '',
  ].join('\n');
  if (Buffer.byteLength(markdown) >= summaryByteLimit)
    throw new ConfigurationError(
      'Summary exceeds the 1 MiB CI size limit. Inspect the complete evidence bundle.',
    );
  return markdown;
}
