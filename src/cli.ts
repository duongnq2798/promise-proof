#!/usr/bin/env node
import { Command, CommanderError } from 'commander';
import {
  access,
  mkdir,
  readFile,
  readdir,
  rm,
  writeFile,
} from 'node:fs/promises';
import { constants } from 'node:fs';
import path from 'node:path';
import { chromium } from '@playwright/test';
import { verify, errorMessage } from './runner.js';
import { ConfigurationError, parseConfig, parseSpec } from './spec.js';
import { environmentNames, redact } from './security.js';
import { exitCode } from './result.js';

async function readJson(file: string): Promise<unknown> {
  try {
    const content = await readFile(file, 'utf8');
    if (Buffer.byteLength(content) > 1024 * 1024)
      throw new Error('JSON input exceeds 1 MiB.');
    return JSON.parse(content) as unknown;
  } catch (error) {
    throw new ConfigurationError(`Cannot read ${file}: ${errorMessage(error)}`);
  }
}
const program = new Command()
  .name('promiseproof')
  .description('AI built it. Prove it works.')
  .version('0.1.0')
  .exitOverride();
const configPath = '.promiseproof/config.json';
program
  .command('agent')
  .description(
    'Export reusable agent instructions without changing agent settings',
  )
  .option('--output <file>', 'Copy instructions to a new file')
  .action(async (options: { output?: string }) => {
    const source = new URL('../skills/promiseproof/SKILL.md', import.meta.url);
    if (options.output) {
      try {
        await writeFile(options.output, await readFile(source), { flag: 'wx' });
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code === 'EEXIST')
          throw new ConfigurationError(
            `Preserving ${options.output}; choose a new output file.`,
          );
        throw error;
      }
      console.log(
        `Ask your coding agent to read and follow ${path.resolve(options.output)}.`,
      );
    } else console.log(await readFile(source, 'utf8'));
  });
program
  .command('init')
  .description(
    'Create local test policy and an example spec without overwriting files',
  )
  .option(
    '--base-url <url>',
    'Authorized local test application',
    'http://127.0.0.1:4173',
  )
  .action(async (options: { baseUrl: string }) => {
    const origin = new URL(options.baseUrl).origin;
    const config = parseConfig({
      schemaVersion: '1',
      allowedOrigins: [origin],
      environment: 'test',
    });
    await mkdir('.promiseproof', { recursive: true });
    const example = {
      schemaVersion: '1',
      id: 'first-outcome',
      revision: 1,
      goal: 'Verify that the application presents the expected heading',
      baseUrl: options.baseUrl,
      preconditions: [
        'Start your application; replace the heading assertion with your actual acceptance criterion.',
      ],
      steps: [
        {
          id: 'open',
          type: 'navigate',
          description: 'Open the application',
          url: '/',
        },
        {
          id: 'heading',
          type: 'visible',
          description: 'The expected heading is visible',
          locator: { role: 'heading', name: 'PromiseProof demo' },
        },
      ],
    };
    for (const [file, value] of [
      [configPath, config],
      ['.promiseproof/example.json', example],
    ] as const) {
      try {
        await writeFile(file, JSON.stringify(value, null, 2) + '\n', {
          flag: 'wx',
          mode: 0o600,
        });
        console.log(`Created ${file}`);
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code === 'EEXIST')
          console.log(`Preserved existing ${file}`);
        else throw error;
      }
    }
    console.log(
      'Start your test app, edit .promiseproof/example.json, then run promiseproof verify .promiseproof/example.json.',
    );
  });
program
  .command('verify')
  .argument('<spec>', 'Versioned JSON specification')
  .option('--config <file>', 'Explicit test policy', configPath)
  .option('--json', 'Print machine-readable result')
  .option('--headed', 'Show the browser')
  .action(
    async (
      file: string,
      options: { config: string; json?: boolean; headed?: boolean },
    ) => {
      const [spec, config] = await Promise.all([
        readJson(file),
        readJson(options.config),
      ]);
      const { result, directory } = await verify(spec, config, {
        headed: options.headed,
      });
      console.log(
        options.json
          ? JSON.stringify({ ...result, directory })
          : `${result.status} · ${result.goal}\nAssertions: ${result.summary.PASS} passed, ${result.summary.FAIL} failed, ${result.summary.NOT_VERIFIED} not verified, ${result.summary.ERROR} errors\nReport: ${path.join(directory, 'report.html')}`,
      );
      process.exitCode = exitCode(result.status);
    },
  );
program
  .command('report')
  .argument('<run-id>', 'A run id from promiseproof list')
  .option('--config <file>', 'Test policy', configPath)
  .action(async (id: string, options: { config: string }) => {
    if (!/^[a-zA-Z0-9_-]+$/.test(id))
      throw new ConfigurationError(
        'Expected a run id; path traversal is not permitted.',
      );
    const config = parseConfig(await readJson(options.config));
    const file = path.resolve(config.outputDir, id, 'report.html');
    await access(file, constants.R_OK);
    console.log(file);
  });
program
  .command('list')
  .option('--config <file>', 'Test policy', configPath)
  .action(async (options: { config: string }) => {
    const config = parseConfig(await readJson(options.config));
    try {
      for (const item of (
        await readdir(config.outputDir, { withFileTypes: true })
      )
        .filter((i) => i.isDirectory())
        .sort((a, b) => b.name.localeCompare(a.name)))
        console.log(item.name);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT')
        console.log('No verification runs yet.');
      else throw error;
    }
  });
program
  .command('doctor')
  .option('--config <file>', 'Test policy', configPath)
  .option('--spec <file>', 'Check required environment variables')
  .action(async (options: { config: string; spec?: string }) => {
    const checks: { name: string; ok: boolean; detail: string }[] = [];
    checks.push({
      name: 'Node.js',
      ok:
        Number(process.versions.node.split('.')[0]) > 22 ||
        (Number(process.versions.node.split('.')[0]) === 22 &&
          Number(process.versions.node.split('.')[1]) >= 12),
      detail: process.version,
    });
    try {
      const browser = await chromium.launch({ timeout: 15000 });
      await browser.close();
      checks.push({
        name: 'Chromium',
        ok: true,
        detail: 'Launch and shutdown verified',
      });
    } catch {
      checks.push({
        name: 'Chromium',
        ok: false,
        detail:
          'Install browser binaries: npm exec playwright install chromium (Linux: add --with-deps)',
      });
    }
    try {
      const config = parseConfig(await readJson(options.config));
      checks.push({
        name: 'Configuration',
        ok: true,
        detail: `${config.allowedOrigins.length} explicit origins; test environment`,
      });
      await mkdir(config.outputDir, { recursive: true });
      const probe = path.join(config.outputDir, `.doctor-${process.pid}`);
      await writeFile(probe, '', { flag: 'wx' });
      await rm(probe);
      checks.push({ name: 'Evidence directory', ok: true, detail: 'Writable' });
    } catch (error) {
      checks.push({
        name: 'Configuration / evidence directory',
        ok: false,
        detail: errorMessage(error),
      });
    }
    if (options.spec) {
      const spec = parseSpec(await readJson(options.spec));
      for (const name of environmentNames(spec))
        checks.push({
          name,
          ok: Boolean(process.env[name]),
          detail: process.env[name]
            ? 'Present (value withheld)'
            : 'Missing: set this environment variable',
        });
    }
    for (const check of checks)
      console.log(
        `${check.ok ? 'OK' : 'ERROR'} ${check.name}: ${check.detail}`,
      );
    if (checks.some((c) => !c.ok)) process.exitCode = 3;
  });
try {
  await program.parseAsync();
} catch (error) {
  if (error instanceof CommanderError)
    process.exitCode = error.exitCode === 0 ? 0 : 2;
  else {
    console.error(
      `${error instanceof ConfigurationError || error instanceof TypeError ? 'Invalid configuration' : 'Runtime error'}: ${String(redact(errorMessage(error)))}`,
    );
    process.exitCode =
      error instanceof ConfigurationError || error instanceof TypeError ? 2 : 3;
  }
}
