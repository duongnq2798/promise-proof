import {
  chromium,
  errors as playwrightErrors,
  type Browser,
  type Request,
} from '@playwright/test';
import { createHash, randomUUID } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import {
  AssertionFailure,
  executeStep,
  locate,
  MissingEvidence,
  type Session,
} from './browser.js';
import { aggregate, type RunResult, type StepResult } from './result.js';
import {
  authorizedUrl,
  environmentNames,
  redact,
  resolveValue,
} from './security.js';
import {
  assertionTypes,
  ConfigurationError,
  parseConfig,
  parseSpec,
  type Step,
} from './spec.js';
import { renderReport } from './reporter.js';

export interface RunOptions {
  cwd?: string;
  headed?: boolean;
}
export async function verify(
  rawSpec: unknown,
  rawConfig: unknown,
  options: RunOptions = {},
): Promise<{ result: RunResult; directory: string }> {
  const spec = parseSpec(rawSpec);
  const config = parseConfig(rawConfig);
  authorizedUrl(spec.baseUrl, spec.baseUrl, config);
  const envNames = environmentNames(spec);
  for (const name of envNames)
    if (!process.env[name])
      throw new ConfigurationError(
        `Required environment variable ${name} is missing.`,
      );
  const secrets = envNames.map((name) => process.env[name]!).filter(Boolean);
  if (envNames.length && (spec.evidence.screenshots || spec.evidence.trace))
    throw new ConfigurationError(
      'Screenshots and traces must be disabled when environment credentials are used; binary artifacts cannot be reliably redacted.',
    );
  if (
    spec.evidence.trace &&
    [...spec.steps, ...spec.cleanup].some((s) => s.type === 'api' && s.capture)
  )
    throw new ConfigurationError(
      'Traces must be disabled when API values are captured; captured links may contain credentials.',
    );
  const specText = JSON.stringify(spec, null, 2) + '\n';
  if (secrets.some((secret) => specText.includes(secret)))
    throw new ConfigurationError(
      'Specification contains a configured secret literal. Replace it with an environment reference.',
    );
  for (const step of [...spec.steps, ...spec.cleanup]) {
    const candidate =
      'url' in step ? step.url : step.type === 'url' ? step.equals : undefined;
    if (
      candidate !== undefined &&
      (typeof candidate === 'string' || 'env' in candidate)
    )
      authorizedUrl(resolveValue(candidate, new Map()), spec.baseUrl, config);
  }
  const runId = `${spec.id}-${new Date().toISOString().replace(/[:.]/g, '-')}-${randomUUID().slice(0, 8)}`;
  const directory = path.resolve(
    options.cwd ?? process.cwd(),
    config.outputDir,
    runId,
  );
  await mkdir(directory, { recursive: true, mode: 0o700 });
  const start = Date.now();
  const result: RunResult = {
    schemaVersion: '1',
    runnerVersion: '0.1.0',
    runId,
    specId: spec.id,
    revision: spec.revision,
    specDigest: createHash('sha256').update(specText).digest('hex'),
    goal: spec.goal,
    baseUrl: spec.baseUrl,
    environment: spec.environment,
    preconditions: spec.preconditions,
    status: 'NOT_VERIFIED',
    startedAt: new Date(start).toISOString(),
    durationMs: 0,
    steps: [],
    errors: [],
    consoleErrors: {},
    network: [],
    traces: [],
    evidenceClasses: [],
    summary: { PASS: 0, FAIL: 0, NOT_VERIFIED: 0, ERROR: 0 },
  };
  const sessions = new Map<string, Session>();
  const variables = new Map<string, string>();
  let browser: Browser | undefined;
  let activeStepId = '';
  const policyErrors: string[] = [];
  async function getSession(name: string): Promise<Session> {
    const existing = sessions.get(name);
    if (existing) return existing;
    const context = await browser!.newContext({
      serviceWorkers: 'block',
      acceptDownloads: false,
    });
    const session: Session = {
      context,
      page: await context.newPage(),
      errors: [],
    };
    sessions.set(name, session);
    await context.route('**/*', async (route) => {
      try {
        authorizedUrl(route.request().url(), spec.baseUrl, config);
      } catch (error) {
        policyErrors.push(errorMessage(error));
        await route.abort('blockedbyclient');
        return;
      }
      try {
        // Playwright does not call user routes for every HTTP redirect hop.
        // Fetch exactly one authorized hop, validate Location, then return it to the browser.
        const response = await route.fetch({ maxRedirects: 0, timeout: 10000 });
        try {
          const location = response.headers()['location'];
          if (response.status() >= 300 && response.status() < 400 && location) {
            authorizedUrl(location, route.request().url(), config);
            throw new Error(
              'Browser HTTP redirects are unsupported in the guarded MVP. Navigate directly to the final test URL.',
            );
          }
          await route.fulfill({ response });
        } finally {
          await response.dispose();
        }
      } catch (error) {
        policyErrors.push(`Guarded browser request: ${errorMessage(error)}`);
        await route.abort('blockedbyclient');
      }
    });
    await context.routeWebSocket('**/*', (socket) => {
      policyErrors.push('WebSocket traffic is unsupported and blocked.');
      socket.close();
    });
    const listen = (page: Session['page']) => {
      const requestActions = new WeakMap<Request, string>();
      page.on('request', (request) =>
        requestActions.set(request, activeStepId),
      );
      page.on('console', (message) => {
        if (message.type() === 'error' && session.errors.length < 100)
          session.errors.push(message.text());
      });
      page.on('pageerror', (error) => {
        if (session.errors.length < 100) session.errors.push(error.message);
      });
      page.on('response', (response) => {
        const selected = spec.steps.some((s) => {
          if (s.type !== 'response' || s.context !== name) return false;
          try {
            return (
              authorizedUrl(
                resolveValue(s.url, variables),
                spec.baseUrl,
                config,
              ) === response.url()
            );
          } catch {
            return false;
          }
        });
        if (selected && result.network.length < 200)
          result.network.push({
            context: name,
            url: response.url(),
            status: response.status(),
            actionId: requestActions.get(response.request()) ?? '',
          });
      });
    };
    listen(session.page);
    context.on('page', listen);
    if (spec.evidence.trace)
      await context.tracing.start({
        screenshots: true,
        snapshots: true,
        sources: false,
      });
    return session;
  }
  async function runStep(
    step: Step,
    phase: StepResult['phase'],
    previous?: string,
  ): Promise<void> {
    const stepStart = Date.now();
    const row: StepResult = {
      id: step.id,
      type: step.type,
      description: step.description,
      context: step.context,
      assertion: assertionTypes.has(step.type),
      phase,
      status: 'NOT_VERIFIED',
      expected: step,
      observed: '',
      durationMs: 0,
      startedAt: new Date(stepStart).toISOString(),
      attempts: 0,
    };
    result.steps.push(row);
    const dependencies = step.dependsOn ?? (previous ? [previous] : []);
    const blocked = dependencies.filter(
      (id) => result.steps.find((s) => s.id === id)?.status !== 'PASS',
    );
    if (blocked.length) {
      row.observed = `Dependencies did not pass: ${blocked.join(', ')}`;
      return;
    }
    let session: Session | undefined;
    try {
      session = await getSession(step.context);
      const timeoutMs = step.timeoutMs ?? spec.timeoutMs;
      session.page.setDefaultTimeout(timeoutMs);
      row.attempts = 1;
      activeStepId = step.id;
      row.observed = await executeStep(step, {
        session,
        config,
        baseUrl: spec.baseUrl,
        variables,
        timeoutMs,
        network: result.network,
      });
      row.status = 'PASS';
    } catch (error) {
      row.status =
        error instanceof MissingEvidence
          ? 'NOT_VERIFIED'
          : error instanceof AssertionFailure ||
              error instanceof playwrightErrors.TimeoutError ||
              (error instanceof Error &&
                error.name === 'Error' &&
                /expect\(/.test(error.message))
            ? 'FAIL'
            : 'ERROR';
      row.observed = errorMessage(error);
    } finally {
      row.durationMs = Date.now() - stepStart;
      if (
        session &&
        spec.evidence.screenshots &&
        (row.assertion || step.type === 'navigate') &&
        step.type !== 'unverified'
      ) {
        try {
          const screenshot = `${String(result.steps.length).padStart(3, '0')}-${step.id}.png`;
          await session.page.screenshot({
            path: path.join(directory, screenshot),
            fullPage: true,
            timeout: 5000,
            mask: [
              session.page.locator('input[type=password]'),
              ...spec.evidence.mask.map((mask) => locate(session!.page, mask)),
            ],
          });
          row.screenshot = screenshot;
        } catch (error) {
          result.errors.push(`Screenshot ${step.id}: ${errorMessage(error)}`);
        }
      }
      row.durationMs = Date.now() - stepStart;
    }
  }
  try {
    browser = await chromium.launch({
      headless: !options.headed,
      timeout: 20000,
    });
    for (let i = 0; i < spec.steps.length; i++)
      await runStep(spec.steps[i]!, 'workflow', spec.steps[i - 1]?.id);
  } catch (error) {
    result.errors.push(errorMessage(error));
    for (const step of spec.steps.slice(result.steps.length))
      result.steps.push({
        id: step.id,
        type: step.type,
        description: step.description,
        context: step.context,
        assertion: assertionTypes.has(step.type),
        phase: 'workflow',
        status: 'NOT_VERIFIED',
        expected: step,
        observed: 'Runner unavailable; workflow was not executed.',
        attempts: 0,
        durationMs: 0,
        startedAt: new Date().toISOString(),
      });
  } finally {
    if (browser) {
      for (let i = 0; i < spec.cleanup.length; i++)
        await runStep(spec.cleanup[i]!, 'cleanup', spec.cleanup[i - 1]?.id);
      for (const [name, session] of sessions) {
        result.consoleErrors[name] = session.errors;
        try {
          if (spec.evidence.trace) {
            const trace = `trace-${name}.zip`;
            await session.context.tracing.stop({
              path: path.join(directory, trace),
            });
            result.traces.push(trace);
          }
          await session.context.close();
        } catch (error) {
          result.errors.push(`Context shutdown: ${errorMessage(error)}`);
        }
      }
      try {
        await browser.close();
      } catch (error) {
        result.errors.push(`Browser shutdown: ${errorMessage(error)}`);
      }
    }
  }
  result.errors.push(...policyErrors);
  result.status = aggregate([
    ...result.steps.map((s) => s.status),
    ...(result.errors.length ? ['ERROR' as const] : []),
  ]);
  for (const step of result.steps.filter(
    (s) => s.assertion && s.phase === 'workflow',
  ))
    result.summary[step.status]++;
  const verified = result.steps.filter(
    (s) => s.assertion && s.status === 'PASS' && s.phase === 'workflow',
  );
  if (verified.some((s) => s.type === 'api' || s.type === 'response'))
    result.evidenceClasses.push('API-confirmed assertions');
  if (verified.some((s) => !['api', 'response'].includes(s.type)))
    result.evidenceClasses.push('UI assertions');
  if (new Set(verified.map((s) => s.context)).size > 1)
    result.evidenceClasses.push('Cross-context assertions');
  if (result.steps.some((s) => s.status === 'NOT_VERIFIED'))
    result.evidenceClasses.push('Insufficient evidence');
  result.durationMs = Date.now() - start;
  // Preserve protocol fields and verdicts even when a secret happens to equal "PASS".
  const safe = (value: unknown) => redact(value, secrets);
  const safeResult: RunResult = {
    ...result,
    goal: safe(result.goal) as string,
    baseUrl: safe(result.baseUrl) as string,
    environment: safe(result.environment) as string,
    preconditions: safe(result.preconditions) as string[],
    errors: safe(result.errors) as string[],
    consoleErrors: safe(result.consoleErrors) as Record<string, string[]>,
    network: result.network.map((n) => ({ ...n, url: safe(n.url) as string })),
    steps: result.steps.map((s) => ({
      ...s,
      description: safe(s.description) as string,
      expected: safe(s.expected),
      observed: safe(s.observed),
    })),
  };
  await writeFile(path.join(directory, 'spec.json'), specText, {
    mode: 0o600,
    flag: 'wx',
  });
  await writeFile(
    path.join(directory, 'result.json'),
    JSON.stringify(safeResult, null, 2) + '\n',
    { mode: 0o600 },
  );
  await writeFile(
    path.join(directory, 'report.html'),
    renderReport(safeResult),
    { mode: 0o600 },
  );
  return { result: safeResult, directory };
}
export function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
