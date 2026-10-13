import {
  expect,
  type BrowserContext,
  type Locator,
  type Page,
} from '@playwright/test';
import { isDeepStrictEqual } from 'node:util';
import { authorizedUrl, jsonPath, resolveValue } from './security.js';
import type { Config, LocatorSpec, Step } from './spec.js';

export interface Session {
  context: BrowserContext;
  page: Page;
  errors: string[];
}
export interface Execution {
  session: Session;
  config: Config;
  baseUrl: string;
  variables: Map<string, string>;
  timeoutMs: number;
  network: { context: string; url: string; status: number; actionId: string }[];
}
export class AssertionFailure extends Error {}
export class MissingEvidence extends Error {}
export function locate(page: Page, spec: LocatorSpec): Locator {
  if ('role' in spec)
    return page.getByRole(spec.role, { name: spec.name, exact: spec.exact });
  if ('label' in spec)
    return page.getByLabel(spec.label, { exact: spec.exact });
  if ('testId' in spec) return page.getByTestId(spec.testId);
  return page.locator(spec.css);
}

export async function executeStep(
  step: Step,
  run: Execution,
): Promise<unknown> {
  const { session, variables, timeoutMs } = run;
  const page = session.page;
  const loc = 'locator' in step ? locate(page, step.locator) : undefined;
  const resolved = (value: Parameters<typeof resolveValue>[0]) =>
    resolveValue(value, variables);
  switch (step.type) {
    case 'navigate': {
      const url = authorizedUrl(resolved(step.url), run.baseUrl, run.config);
      await page.goto(url, {
        timeout: timeoutMs,
        waitUntil: 'domcontentloaded',
      });
      return { url: page.url() };
    }
    case 'click':
      await loc!.click({ timeout: timeoutMs });
      return 'Clicked';
    case 'fill':
      await loc!.fill(resolved(step.value), { timeout: timeoutMs });
      return 'Input filled';
    case 'select':
      await loc!.selectOption(resolved(step.value), { timeout: timeoutMs });
      return 'Option selected';
    case 'check':
      await loc!.setChecked(step.checked, { timeout: timeoutMs });
      return { checked: step.checked };
    case 'wait':
      await loc!.waitFor({ state: step.state, timeout: timeoutMs });
      return { state: step.state };
    case 'visible':
      if (step.expected) await expect(loc!).toBeVisible({ timeout: timeoutMs });
      else await expect(loc!).toBeHidden({ timeout: timeoutMs });
      return { visible: await loc!.isVisible() };
    case 'text':
      await expect(loc!).toHaveText(resolved(step.equals), {
        timeout: timeoutMs,
      });
      return { text: await loc!.textContent() };
    case 'url': {
      const url = authorizedUrl(resolved(step.equals), run.baseUrl, run.config);
      await expect(page).toHaveURL(url, { timeout: timeoutMs });
      return { url: page.url() };
    }
    case 'property':
      if (step.property === 'value')
        await expect(loc!).toHaveValue(String(step.equals), {
          timeout: timeoutMs,
        });
      else if (step.property === 'checked')
        await expect(loc!).toBeChecked({
          checked: Boolean(step.equals),
          timeout: timeoutMs,
        });
      else if (step.property === 'disabled') {
        if (step.equals)
          await expect(loc!).toBeDisabled({ timeout: timeoutMs });
        else await expect(loc!).toBeEnabled({ timeout: timeoutMs });
      } else
        await expect(loc!).toHaveJSProperty('required', step.equals, {
          timeout: timeoutMs,
        });
      return { property: step.property, value: step.equals };
    case 'validation': {
      await expect(loc!).toBeAttached({ timeout: timeoutMs });
      const valid = await loc!.evaluate(
        (element) => {
          if (
            element instanceof HTMLInputElement ||
            element instanceof HTMLSelectElement ||
            element instanceof HTMLTextAreaElement ||
            element instanceof HTMLFormElement
          )
            return element.checkValidity();
          throw new Error(
            'Validation assertion requires a form or form control.',
          );
        },
        undefined,
        { timeout: timeoutMs },
      );
      if (valid !== step.valid)
        throw new AssertionFailure(
          `Expected form validity ${step.valid}; observed ${valid}.`,
        );
      return { valid };
    }
    case 'noErrors':
      if (session.errors.length)
        throw new AssertionFailure(
          `Observed browser errors: ${session.errors.join('\n')}`,
        );
      return { errors: [] };
    case 'api':
      return executeApi(step, run);
    case 'response': {
      const url = authorizedUrl(resolved(step.url), run.baseUrl, run.config);
      await expect
        .poll(
          () =>
            run.network.filter(
              (n) =>
                n.context === step.context &&
                n.url === url &&
                n.actionId === step.after,
            ).length,
          { timeout: timeoutMs },
        )
        .toBeGreaterThan(0);
      const response = run.network
        .filter(
          (n) =>
            n.context === step.context &&
            n.url === url &&
            n.actionId === step.after,
        )
        .at(-1)!;
      if (response.status !== step.status)
        throw new AssertionFailure(
          `Expected response status ${step.status}; observed ${response.status} for ${url}.`,
        );
      return response;
    }
    case 'unverified':
      throw new MissingEvidence(step.reason);
  }
}

async function executeApi(
  step: Extract<Step, { type: 'api' }>,
  run: Execution,
): Promise<unknown> {
  const url = authorizedUrl(
    resolveValue(step.url, run.variables),
    run.baseUrl,
    run.config,
  );
  const headers = Object.fromEntries(
    Object.entries(step.headers).map(([k, v]) => [
      k,
      resolveValue(v, run.variables),
    ]),
  );
  // GET only; redirects are never followed. Explicit origin checks apply before every request.
  const response = await run.session.context.request.get(url, {
    headers,
    timeout: run.timeoutMs,
    maxRedirects: 0,
  });
  try {
    if (response.status() !== step.status)
      throw new AssertionFailure(
        `Expected API status ${step.status}; observed ${response.status()} for ${url}.`,
      );
    let selected: unknown;
    if (step.json || step.capture) {
      if (Number(response.headers()['content-length'] ?? 0) > 1024 * 1024)
        throw new Error('API body exceeds 1 MiB evidence limit.');
      const buffer = await response.body();
      if (buffer.length > 1024 * 1024)
        throw new Error('API body exceeds 1 MiB evidence limit.');
      const body: unknown = JSON.parse(buffer.toString('utf8'));
      if (step.json) {
        selected = jsonPath(body, step.json.path);
        if (!isDeepStrictEqual(selected, step.json.equals))
          throw new AssertionFailure(
            `API field ${step.json.path}: expected ${JSON.stringify(step.json.equals)}; observed ${JSON.stringify(selected) ?? 'missing'}.`,
          );
      }
      if (step.capture) {
        const captured = jsonPath(body, step.capture.path);
        if (typeof captured !== 'string' || !captured)
          throw new MissingEvidence(
            `API field ${step.capture.path} did not contain the required string.`,
          );
        run.variables.set(step.capture.variable, captured);
      }
    }
    return {
      url,
      status: response.status(),
      ...(step.json ? { path: step.json.path, value: selected } : {}),
      ...(step.capture ? { captured: step.capture.variable } : {}),
    };
  } finally {
    await response.dispose();
  }
}
