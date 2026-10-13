import { cp, mkdir, readFile, rm } from 'node:fs/promises';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { once } from 'node:events';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { chromium } from '@playwright/test';
import { createDemoServer } from '../examples/server.mjs';

const server = createDemoServer();
const command = promisify(execFile);
const writeDocs = process.argv.includes('--write-docs');
server.listen(4173, '127.0.0.1');
await once(server, 'listening');
try {
  for (const [name, source, code] of [
    ['passing', 'simple-form', 0],
    ['failing', 'failing-workflow', 1],
    ['invitation', 'invitation-flow', 0],
  ]) {
    let actualCode = 0;
    let stdout;
    try {
      ({ stdout } = await command(process.execPath, [
        'dist/cli.js',
        'verify',
        'examples/' + source + '/spec.json',
        '--config',
        'examples/config.json',
        '--json',
      ]));
    } catch (error) {
      actualCode = error.code;
      stdout = error.stdout;
    }
    if (actualCode !== code)
      throw new Error(
        name +
          ' expected exit ' +
          code +
          '; observed ' +
          actualCode +
          ' ' +
          stdout,
      );
    const result = JSON.parse(stdout);
    console.log(
      name +
        ': ' +
        result.status +
        ' (exit ' +
        actualCode +
        ') ' +
        result.directory,
    );
    if (writeDocs) {
      const target = path.resolve('docs/sample-report', name);
      if (path.dirname(target) !== path.resolve('docs/sample-report'))
        throw new Error('Sample destination escaped its intended directory');
      await rm(target, { recursive: true, force: true });
      await cp(result.directory, target, { recursive: true });
      if (name === 'failing') {
        const browser = await chromium.launch();
        try {
          const page = await browser.newPage({
            viewport: { width: 1440, height: 1100 },
            colorScheme: 'dark',
          });
          await page.goto(pathToFileURL(path.join(target, 'report.html')).href);
          await page.evaluate(async () => {
            await document.fonts.ready;
            await Promise.all(
              Array.from(document.images)
                .filter((image) => {
                  const bounds = image.getBoundingClientRect();
                  return bounds.width > 0 && bounds.top < innerHeight;
                })
                .map((image) => image.decode()),
            );
            await new Promise((resolve) =>
              requestAnimationFrame(() => requestAnimationFrame(resolve)),
            );
          });
          await page.screenshot({
            path: 'docs/report-preview.png',
            animations: 'disabled',
          });
          await page
            .getByRole('radio', { name: 'Light theme', exact: true })
            .check();
          await page.screenshot({
            path: 'docs/report-preview-light.png',
            animations: 'disabled',
          });
          await page
            .getByRole('radio', { name: 'Dark theme', exact: true })
            .check();
          await page.setViewportSize({ width: 390, height: 844 });
          await mkdir('.smoke', { recursive: true });
          await page.screenshot({
            path: '.smoke/report-mobile.png',
            animations: 'disabled',
          });
          await page.locator('#evidence').scrollIntoViewIfNeeded();
          await page.screenshot({
            path: '.smoke/report-mobile-evidence.png',
            animations: 'disabled',
          });
        } finally {
          await browser.close();
        }
      }
    }
    const persisted = JSON.parse(
      await readFile(path.join(result.directory, 'result.json'), 'utf8'),
    );
    if (persisted.status !== result.status)
      throw new Error('Persisted verdict differs from CLI');
  }
} finally {
  await new Promise((resolve) => server.close(resolve));
}
