import { mkdir, mkdtemp, writeFile } from 'node:fs/promises';
import { spawn, type ChildProcess } from 'node:child_process';
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
import { performance } from 'node:perf_hooks';
import path from 'node:path';
import type { Server } from 'node:http';
import { chromium } from '@playwright/test';
import { demoExamples, loadDemoExample, type DemoExample } from './examples.js';
import { ConfigurationError, parseConfig } from './spec.js';
import { verify } from './runner.js';
import { exitCode } from './result.js';

interface QuickstartOptions {
  example: DemoExample;
  install: boolean;
  open: boolean;
}

async function openReport(file: string) {
  const url = pathToFileURL(file).href;
  const executable =
    process.platform === 'win32'
      ? 'rundll32.exe'
      : process.platform === 'darwin'
        ? 'open'
        : 'xdg-open';
  const args =
    process.platform === 'win32' ? ['url.dll,FileProtocolHandler', url] : [url];
  await new Promise<void>((resolve, reject) => {
    const child = spawn(executable, args, {
      detached: true,
      stdio: 'ignore',
      shell: false,
    });
    child.once('error', reject);
    child.once('spawn', () => {
      child.unref();
      resolve();
    });
  });
}

export async function runQuickstart(
  options: QuickstartOptions,
): Promise<number> {
  if (!demoExamples.includes(options.example))
    throw new ConfigurationError('Choose a supported synthetic example.');
  const started = performance.now();
  let server: Server | undefined;
  let installer: ChildProcess | undefined;
  let stopped: Promise<void> | undefined;
  let interrupted = false;
  let verdictCode: number;
  const probeChromium = async () => {
    const browser = await chromium.launch();
    await browser.close();
  };
  const stopServer = () => {
    if (!server?.listening) return stopped ?? Promise.resolve();
    stopped ??= new Promise<void>((resolve, reject) => {
      server!.close((error) => (error ? reject(error) : resolve()));
      server!.closeAllConnections();
    });
    return stopped;
  };
  const interrupt = () => {
    interrupted = true;
    installer?.kill('SIGTERM');
    void stopServer().catch(() => {});
  };
  const checkInterrupted = () => {
    if (interrupted)
      throw new Error(
        'Quickstart interrupted; the owned demo was stopped. Inspect any partial evidence before retrying.',
      );
  };
  process.once('SIGINT', interrupt);
  process.once('SIGTERM', interrupt);
  try {
    console.log(
      'Quickstart: synthetic loopback demo only; this does not verify your application.',
    );
    try {
      await probeChromium();
      console.log('Chromium: reusing the installed browser.');
    } catch {
      checkInterrupted();
      if (!options.install)
        throw new Error(
          'Chromium is missing or cannot launch. Run quickstart without --no-install, or install the matching Playwright Chromium browser and required OS libraries first.',
        );
      console.log(
        'Chromium: downloading the matching browser; first-run time depends on your network.',
      );
      const require = createRequire(import.meta.url);
      const browserCli = path.join(
        path.dirname(require.resolve('playwright/package.json')),
        'cli.js',
      );
      // Downloader logs can contain authenticated host/proxy URLs. Show only
      // our own progress; raw third-party output stays private.
      const progress = setInterval(
        () => console.log('Chromium: installation is still in progress.'),
        5000,
      );
      try {
        await new Promise<void>((resolve, reject) => {
          checkInterrupted();
          installer = spawn(
            process.execPath,
            [browserCli, 'install', 'chromium'],
            { stdio: 'ignore', shell: false },
          );
          installer.once('error', () =>
            reject(
              new Error(
                'Cannot start Chromium installation. Check Node/process permissions.',
              ),
            ),
          );
          installer.once('close', (code) =>
            code === 0
              ? resolve()
              : reject(
                  new Error(
                    'Chromium installation did not finish. Check network access and browser-cache permissions, then rerun quickstart.',
                  ),
                ),
          );
        });
      } catch (error) {
        checkInterrupted();
        throw error;
      } finally {
        clearInterval(progress);
      }
      installer = undefined;
      checkInterrupted();
      await probeChromium().catch(() => {
        checkInterrupted();
        throw new Error(
          'Chromium cannot launch after installation. Check the browser cache and OS libraries; on Linux use npm exec playwright install --with-deps chromium.',
        );
      });
    }
    checkInterrupted();
    console.log(
      'Demo: starting synthetic in-memory fixture on a free loopback port.',
    );
    const { createDemoServer } = (await import(
      new URL('../examples/server.mjs', import.meta.url).href
    )) as { createDemoServer: () => Server };
    server = createDemoServer();
    await new Promise<void>((resolve, reject) => {
      const failed = () => {
        server!.off('listening', ready);
        reject(
          new Error(
            'Cannot start the loopback demo. Check local process/network permissions.',
          ),
        );
      };
      const ready = () => {
        server!.off('error', failed);
        resolve();
      };
      server!.once('error', failed);
      server!.once('listening', ready);
      server!.listen(0, '127.0.0.1');
    });
    checkInterrupted();
    const address = server.address();
    if (!address || typeof address === 'string')
      throw new Error('Demo did not bind a local port.');
    const baseUrl = `http://127.0.0.1:${address.port}`;
    const parent = path.resolve('.promiseproof/quickstarts');
    await mkdir(parent, { recursive: true });
    const workspace = await mkdtemp(path.join(parent, 'quickstart-'));
    const config = parseConfig({
      schemaVersion: '1',
      environment: 'test',
      allowedOrigins: [baseUrl],
    });
    const spec = await loadDemoExample(options.example, baseUrl);
    await mkdir(path.join(workspace, '.promiseproof'));
    for (const [file, value] of [
      ['config.json', config],
      ['example.json', spec],
    ] as const)
      await writeFile(
        path.join(workspace, '.promiseproof', file),
        JSON.stringify(value, null, 2) + '\n',
        { flag: 'wx', mode: 0o600 },
      );
    console.log('Workspace: ' + JSON.stringify(workspace));
    console.log(
      `Verify: ${options.example}; real Chromium, unchanged UI/API assertions.`,
    );
    checkInterrupted();
    const { result, directory } = await verify(spec, config, {
      cwd: workspace,
    });
    checkInterrupted();
    const report = path.join(directory, 'report.html');
    console.log(
      `${result.status} · ${result.goal}\nAssertions: ${result.summary.PASS} passed, ${result.summary.FAIL} failed, ${result.summary.NOT_VERIFIED} not verified, ${result.summary.ERROR} errors`,
    );
    console.log('Report: ' + JSON.stringify(report));
    if (result.status === 'ERROR')
      console.log(
        'Setup repair: use doctor and the recorded error. On Linux, missing OS libraries may require npm exec playwright install --with-deps chromium.',
      );
    if (options.open) {
      await openReport(report).catch(() => {
        console.error(
          'Could not launch the report viewer. Open the printed local Report path manually.',
        );
      });
    }
    checkInterrupted();
    console.log(
      'Next: for your own app, run init --base-url <authorized-test-url> and replace the starter with real acceptance criteria.',
    );
    verdictCode = exitCode(result.status);
  } finally {
    if (installer?.exitCode === null && installer.signalCode === null)
      installer.kill('SIGTERM');
    try {
      await stopServer();
    } finally {
      process.off('SIGINT', interrupt);
      process.off('SIGTERM', interrupt);
    }
    console.log(
      `Quickstart finished in ${((performance.now() - started) / 1000).toFixed(2)}s; any owned demo has stopped. Any created workspace files are retained.`,
    );
  }
  checkInterrupted();
  return verdictCode;
}
