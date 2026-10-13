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
