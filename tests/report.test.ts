import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { chromium, type Browser } from '@playwright/test';
import { cp, mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { renderReport } from '../src/reporter.js';
import type { RunResult } from '../src/result.js';

let browser: Browser;
let directory: string;
let result: RunResult;
beforeAll(async () => {
  await mkdir('.smoke', { recursive: true });
  directory = await mkdtemp(path.resolve('.smoke/report-'));
  result = JSON.parse(
    await readFile('docs/sample-report/failing/result.json', 'utf8'),
  );
  await cp('docs/sample-report/failing', directory, { recursive: true });
  await writeFile(path.join(directory, 'report.html'), renderReport(result));
  browser = await chromium.launch();
});
afterAll(async () => {
  await browser.close();
  await rm(directory, { recursive: true, force: true });
});
async function pageFor(file = 'report.html') {
  const page = await browser.newPage({
    viewport: { width: 1440, height: 1000 },
    colorScheme: 'dark',
  });
  await page.goto(pathToFileURL(path.join(directory, file)).href);
  return page;
}
describe('offline report interactions', () => {
  it('offers next steps, links the recorded failed assertion and exposes replay tools by keyboard', async () => {
    const page = await pageFor();
    try {
      const before = JSON.stringify(result);
      expect(await page.locator('#next-steps').count()).toBe(1);
      await page
        .getByRole('link', { name: 'View next steps', exact: true })
        .click();
      expect(new URL(page.url()).hash).toBe('#next-steps');
      expect(
        await page
          .locator('#next-steps .guide-focus-link')
          .getAttribute('href'),
      ).toBe('#step-persisted');
      expect(
        await page.locator('#step-persisted .step-guidance').textContent(),
      ).toContain('API');
      const disclosure = page.locator('#next-steps .guide-tools > summary');
      await disclosure.focus();
      await page.keyboard.press('Enter');
      const commands = await page
        .locator('#next-steps .guide-tools')
        .textContent();
      expect(commands).toContain(
        'promiseproof doctor --spec spec.json --config <policy.json>',
      );
      expect(commands).toContain(
        'promiseproof verify spec.json --config <policy.json>',
      );
      expect(commands).toContain('playwright show-trace trace-default.zip');
      for (const width of [320, 390]) {
        await page.setViewportSize({ width, height: 844 });
        expect(
          await page.evaluate(
            () => document.documentElement.scrollWidth <= innerWidth,
          ),
        ).toBe(true);
      }
      expect(JSON.stringify(result)).toBe(before);
      expect(
        await page.locator('#step-persisted').getAttribute('data-status'),
      ).toBe('FAIL');
    } finally {
      await page.close();
    }
  });
  it('links a blocked step to its actual failed prerequisite', async () => {
    const page = await pageFor();
    try {
      await page.locator('#step-downstream > summary').click();
      const link = page.locator(
        '#step-downstream .step-guidance a[href="#step-persisted"]',
      );
      expect(await link.count()).toBe(1);
      await link.click();
      expect(new URL(page.url()).hash).toBe('#step-persisted');
      expect(
        await page.locator('#step-downstream').getAttribute('data-status'),
      ).toBe('NOT_VERIFIED');
    } finally {
      await page.close();
    }
  });
  it('does not blame an unrelated earlier failure when the step is independent', async () => {
    const independent: RunResult = {
      ...result,
      steps: result.steps.map((step) =>
        step.id === 'downstream'
          ? {
              ...step,
              expected: { ...(step.expected as object), dependsOn: [] },
            }
          : step,
      ),
    };
    await writeFile(
      path.join(directory, 'independent.html'),
      renderReport(independent),
    );
    const page = await pageFor('independent.html');
    try {
      await page.locator('#step-downstream > summary').click();
      expect(
        await page.locator('#step-downstream .step-guidance').count(),
      ).toBe(1);
      expect(
        await page
          .locator('#step-downstream .step-guidance a[href^="#step-"]')
          .count(),
      ).toBe(0);
    } finally {
      await page.close();
    }
  });
  it('routes run-level errors to diagnostics before recommending application checks', async () => {
    const runtime: RunResult = {
      ...result,
      status: 'ERROR',
      errors: ['Synthetic browser launch failure'],
      steps: result.steps.map((step) => ({
        ...step,
        status: 'NOT_VERIFIED',
        attempts: 0,
      })),
    };
    await writeFile(
      path.join(directory, 'runtime.html'),
      renderReport(runtime),
    );
    const page = await pageFor('runtime.html');
    try {
      expect(await page.locator('#next-steps').count()).toBe(1);
      expect(
        await page
          .locator('#next-steps .guide-focus-link')
          .getAttribute('href'),
      ).toBe('#runtime-observations');
      await page.locator('#next-steps .guide-focus-link').click();
      expect(new URL(page.url()).hash).toBe('#runtime-observations');
      expect(
        await page.locator('#runtime-observations').textContent(),
      ).toContain('Synthetic browser launch failure');
      expect(await page.locator('#next-steps').textContent()).toContain(
        'environment',
      );
    } finally {
      await page.close();
    }
  });
  it('prioritizes recorded cleanup errors over a workflow assertion failure', async () => {
    const cleanup: RunResult = {
      ...result,
      status: 'ERROR',
      steps: [
        ...result.steps,
        {
          ...result.steps[0]!,
          id: 'restore-fixture',
          description: 'Restore synthetic test state',
          phase: 'cleanup',
          status: 'ERROR',
          observed: 'Synthetic cleanup failure',
        },
      ],
    };
    await writeFile(
      path.join(directory, 'cleanup.html'),
      renderReport(cleanup),
    );
    const page = await pageFor('cleanup.html');
    try {
      expect(await page.locator('#next-steps').count()).toBe(1);
      expect(
        await page
          .locator('#next-steps .guide-focus-link')
          .getAttribute('href'),
      ).toBe('#step-restore-fixture');
      expect(
        (
          await page
            .locator('#step-restore-fixture .step-guidance')
            .textContent()
        )?.toLowerCase(),
      ).toContain('cleanup');
      expect(
        await page.locator('#step-persisted').getAttribute('data-status'),
      ).toBe('FAIL');
    } finally {
      await page.close();
    }
  });
  it('shows missing-evidence guidance without inventing an earlier failure', async () => {
    const missing: RunResult = {
      ...result,
      status: 'NOT_VERIFIED',
      traces: [],
      steps: [
        {
          ...result.steps[0]!,
          id: 'external-source',
          type: 'unverified',
          assertion: true,
          status: 'NOT_VERIFIED',
          attempts: 1,
          expected: { type: 'unverified' },
          observed: 'Synthetic unavailable source',
        },
      ],
    };
    await writeFile(
      path.join(directory, 'missing.html'),
      renderReport(missing),
    );
    const page = await pageFor('missing.html');
    try {
      expect(await page.locator('#next-steps').count()).toBe(1);
      expect(
        await page
          .locator('#next-steps .guide-focus-link')
          .getAttribute('href'),
      ).toBe('#step-external-source');
      expect(
        (await page.locator('#next-steps').textContent())?.toLowerCase(),
      ).toContain('evidence');
      expect(
        await page.locator('#next-steps .guide-tools').textContent(),
      ).not.toContain('show-trace');
    } finally {
      await page.close();
    }
  });
  it('only offers trace commands for safe ZIP basenames and omits failure prompts on PASS', async () => {
    const unsafe: RunResult = {
      ...result,
      traces: [
        'javascript:alert(1).zip',
        'trace-default.png',
        'trace-safe.zip',
      ],
    };
    await writeFile(
      path.join(directory, 'trace-safety.html'),
      renderReport(unsafe),
    );
    const passed: RunResult = JSON.parse(
      await readFile('docs/sample-report/passing/result.json', 'utf8'),
    );
    const before = JSON.stringify(passed);
    await writeFile(path.join(directory, 'passed.html'), renderReport(passed));
    expect(JSON.stringify(passed)).toBe(before);
    const page = await pageFor('trace-safety.html');
    try {
      expect(await page.locator('#next-steps').count()).toBe(1);
      const commands = await page
        .locator('#next-steps .guide-tools')
        .textContent();
      expect(commands).toContain('show-trace trace-safe.zip');
      expect(commands).not.toContain('javascript:');
      expect(commands).not.toContain('show-trace trace-default.png');
      await page.goto(pathToFileURL(path.join(directory, 'passed.html')).href);
      expect(await page.locator('#next-steps').count()).toBe(0);
      expect(await page.locator('.step-guidance').count()).toBe(0);
    } finally {
      await page.close();
    }
  });
  it('preserves every status and expands the actual failed assertion', async () => {
    const page = await pageFor();
    try {
      expect(await page.locator('.badge').first().textContent()).toBe(
        result.status,
      );
      for (const step of result.steps) {
        expect(
          await page.locator('#step-' + step.id).getAttribute('data-status'),
        ).toBe(step.status);
      }
      expect(
        await page.locator('#step-persisted').getAttribute('open'),
      ).not.toBeNull();
      expect(
        await page.locator('#step-downstream').getAttribute('data-status'),
      ).toBe('NOT_VERIFIED');
      await page
        .locator('#step-persisted > .step-content > .technical > summary')
        .click();
      expect(
        await page.locator('#step-persisted .technical-grid').isVisible(),
      ).toBe(true);
      expect(
        await page.locator('#step-persisted .technical-grid').textContent(),
      ).toContain('record.email');
    } finally {
      await page.close();
    }
  });
  it('switches System, Light and Dark themes without JavaScript', async () => {
    const page = await pageFor();
    try {
      const background = () =>
        page
          .locator('body')
          .evaluate((el) => getComputedStyle(el).backgroundColor);
      expect(await background()).toBe('rgb(20, 21, 23)');
      await page
        .getByRole('radio', { name: 'Light theme', exact: true })
        .check();
      expect(await background()).toBe('rgb(255, 255, 255)');
      await page
        .getByRole('radio', { name: 'Dark theme', exact: true })
        .check();
      expect(await background()).toBe('rgb(20, 21, 23)');
      await page
        .getByRole('radio', { name: 'System theme', exact: true })
        .check();
      await page.emulateMedia({ colorScheme: 'light' });
      expect(await background()).toBe('rgb(255, 255, 255)');
      expect(await page.locator('script').count()).toBe(0);
    } finally {
      await page.close();
    }
  });
  it('supports keyboard theme selection and disclosure', async () => {
    const page = await pageFor();
    try {
      await page
        .getByRole('radio', { name: 'System theme', exact: true })
        .focus();
      await page.keyboard.press('ArrowRight');
      expect(
        await page
          .getByRole('radio', { name: 'Light theme', exact: true })
          .isChecked(),
      ).toBe(true);
      await page.locator('#step-ui > summary').focus();
      await page.keyboard.press('Enter');
      expect(
        await page.locator('#step-ui').getAttribute('open'),
      ).not.toBeNull();
      expect(
        await page.locator('#step-ui > .step-content').textContent(),
      ).toContain('Success');
    } finally {
      await page.close();
    }
  });
  it('has no external asset dependencies and loads its embedded font and captures', async () => {
    const page = await browser.newPage();
    const remote: string[] = [];
    page.on('request', (request) => {
      if (/^https?:/.test(request.url())) remote.push(request.url());
    });
    try {
      await page.goto(pathToFileURL(path.join(directory, 'report.html')).href);
      await page.evaluate(() => document.fonts.ready);
      expect(
        await page.evaluate(() => document.fonts.check('14px Geist')),
      ).toBe(true);
      expect(
        await page
          .locator('.capture-image img')
          .evaluate(
            (img: HTMLImageElement) => img.complete && img.naturalWidth > 0,
          ),
      ).toBe(true);
      await page.locator('.capture-list > summary').click();
      expect(await page.locator('.capture-grid').isVisible()).toBe(true);
      expect(await page.locator('.capture-thumb').count()).toBe(
        result.steps.filter((s) => s.screenshot).length,
      );
      expect(remote).toEqual([]);
    } finally {
      await page.close();
    }
  });
  it('keeps small mobile and tablet layouts within the viewport', async () => {
    const page = await pageFor();
    try {
      for (const width of [320, 390, 768, 1024]) {
        await page.setViewportSize({ width, height: 844 });
        expect(
          await page.evaluate(
            () => document.documentElement.scrollWidth <= window.innerWidth,
          ),
        ).toBe(true);
      }
      await page.setViewportSize({ width: 390, height: 844 });
      const selectedColor = await page
        .locator('.navigation a[href="#overview"]')
        .evaluate((el) => getComputedStyle(el).borderBottomColor);
      await page.getByRole('link', { name: 'Evidence', exact: true }).click();
      expect(await page.locator('#evidence').isVisible()).toBe(true);
      expect(
        await page
          .locator('.navigation a[href="#evidence"]')
          .evaluate((el) => getComputedStyle(el).borderBottomColor),
      ).toBe(selectedColor);
    } finally {
      await page.close();
    }
  });
  it('handles missing screenshots and long untrusted text without overflow or active links', async () => {
    const input: RunResult = {
      ...result,
      goal: 'Long outcome ' + 'x'.repeat(500),
      traces: ['javascript:alert(1).zip'],
      steps: result.steps.map((step) => ({
        ...step,
        screenshot: 'javascript:alert(1).png',
        observed: '<script>alert(1)</script> ' + 'x'.repeat(2000),
      })),
    };
    await writeFile(path.join(directory, 'edge.html'), renderReport(input));
    const page = await pageFor('edge.html');
    try {
      await page.setViewportSize({ width: 390, height: 844 });
      expect(await page.locator('script').count()).toBe(0);
      expect(await page.locator('a[href^="javascript:"]').count()).toBe(0);
      expect(
        await page
          .getByText('No screenshots collected.', { exact: true })
          .isVisible(),
      ).toBe(true);
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= window.innerWidth,
        ),
      ).toBe(true);
    } finally {
      await page.close();
    }
  });
});
