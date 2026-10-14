#!/usr/bin/env node
import { Command, CommanderError, Option } from 'commander';
import { access, mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import { constants } from 'node:fs';
import path from 'node:path';
import type { Server } from 'node:http';
import { runDoctor } from './doctor.js';
import { verify, errorMessage } from './runner.js';
import { ConfigurationError, parseConfig } from './spec.js';
import { redact } from './security.js';
import { exitCode } from './result.js';
import { parseSavedResult, renderSummary } from './summary.js';
import { demoExamples, loadDemoExample, type DemoExample } from './examples.js';
import { runQuickstart } from './quickstart.js';

async function readJson(file: string): Promise<unknown> {
  let content: string;
  try {
    content = await readFile(file, 'utf8');
  } catch (error) {
    const missing = (error as NodeJS.ErrnoException).code === 'ENOENT';
    throw new ConfigurationError(
      missing
        ? `Input file ${file} was not found. Check the path relative to the current directory.`
        : `Cannot read input file ${file}. Check that the path is a readable file and that you have permission to access it.`,
    );
  }
  if (Buffer.byteLength(content) > 1024 * 1024)
    throw new ConfigurationError(
      `JSON input ${file} exceeds 1 MiB. Use a smaller input file.`,
    );
  try {
    return JSON.parse(content) as unknown;
  } catch {
    throw new ConfigurationError(
      `Invalid JSON in ${file}. Check syntax, including quotes, commas and brackets; input contents are withheld.`,
    );
  }
}
const program = new Command()
  .name('promiseproof')
  .description('AI built it. Prove it works.')
  .version('0.1.0')
  .exitOverride();
const configPath = '.promiseproof/config.json';
program
  .command('quickstart')
  .description(
    'Run a complete synthetic example; prepare Chromium and open its local report',
  )
  .addOption(
    new Option('--example <name>', 'Synthetic example')
      .choices([...demoExamples])
      .default('simple-form'),
  )
  .option('--no-install', 'Do not download a missing Chromium browser')
  .option('--no-open', 'Print the report path without launching a viewer')
  .action(
    async (options: {
      example: DemoExample;
      install: boolean;
      open: boolean;
    }) => {
      process.exitCode = await runQuickstart(options);
    },
  );
program
  .command('schema')
  .description(
    'Print the bundled JSON Schema without requiring a source checkout',
  )
  .option(
    '--policy',
    'Print the test-origin policy schema instead of the spec schema',
  )
  .action(async (options: { policy?: boolean }) => {
    console.log(
      await readFile(
        new URL(
          `../schema/${options.policy ? 'config' : 'spec'}.schema.json`,
          import.meta.url,
        ),
        'utf8',
      ),
    );
  });
program
  .command('demo')
  .description('Run the bundled synthetic test app on loopback only')
  .option('--port <number>', 'Local port; 0 selects an available port', '4173')
  .action(async (options: { port: string }) => {
    const port = Number(options.port);
    if (!/^\d{1,5}$/.test(options.port) || port > 65535)
      throw new ConfigurationError(
        'Demo port must be an integer from 0 to 65535. Use --port 4173 or --port 0.',
      );
    const { createDemoServer } = (await import(
      new URL('../examples/server.mjs', import.meta.url).href
    )) as { createDemoServer: () => Server };
    const server = createDemoServer();
    await new Promise<void>((resolve, reject) => {
      const failed = (error: NodeJS.ErrnoException) => {
        server.off('listening', ready);
        reject(
          new Error(
            error.code === 'EADDRINUSE'
              ? `Demo port ${port} is already in use. Stop the other local app or choose another --port.`
              : 'Cannot start the loopback demo. Check the local port and process permissions.',
          ),
        );
      };
      const ready = () => {
        server.off('error', failed);
        resolve();
      };
      server.once('error', failed);
      server.once('listening', ready);
      server.listen(port, '127.0.0.1');
    });
    const stop = () => {
      server.close();
      server.closeAllConnections();
      process.off('SIGINT', stop);
      process.off('SIGTERM', stop);
    };
    process.once('SIGINT', stop);
    process.once('SIGTERM', stop);
    const address = server.address();
    if (!address || typeof address === 'string') {
      stop();
      throw new Error('Demo did not bind a local TCP port.');
    }
    console.log(
      `PromiseProof demo: http://127.0.0.1:${address.port}\nSynthetic test data only; in-memory records reset on restart. Keep this terminal running; stop with Ctrl+C.`,
    );
  });
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
  .addOption(
    new Option('--example <name>', 'Starter or runnable synthetic demo example')
      .choices([
        'starter',
        'simple-form',
        'failing-workflow',
        'invitation-flow',
      ])
      .default('starter'),
  )
  .action(async (options: { baseUrl: string; example: string }) => {
    const origin = new URL(options.baseUrl).origin;
    const config = parseConfig({
      schemaVersion: '1',
      allowedOrigins: [origin],
      environment: 'test',
    });
    let example: unknown = {
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
    if (options.example !== 'starter') {
      example = await loadDemoExample(
        options.example as DemoExample,
        options.baseUrl,
      );
    }
    await mkdir('.promiseproof', { recursive: true });
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
      options.example === 'starter'
        ? 'Start your test app, edit .promiseproof/example.json, then run promiseproof verify .promiseproof/example.json.'
        : 'Bundled examples target the synthetic demo. Match its port to --base-url; use a fresh directory to choose another example. Existing files stay unchanged. Next: promiseproof doctor --spec .promiseproof/example.json, then promiseproof verify .promiseproof/example.json. For your own app, edit the acceptance criteria.',
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
  .command('summary')
  .description(
    'Summarize a saved run as Markdown; exit code reflects its recorded verdict',
  )
  .argument('<run-id>', 'A run id from promiseproof list')
  .option('--config <file>', 'Test policy', configPath)
  .option(
    '--artifact-url <url>',
    'HTTPS link to a downloaded CI evidence artifact',
  )
  .action(
    async (id: string, options: { config: string; artifactUrl?: string }) => {
      if (!/^[a-zA-Z0-9_-]+$/.test(id))
        throw new ConfigurationError(
          'Expected a run id; path traversal is not permitted.',
        );
      const config = parseConfig(await readJson(options.config));
      const result = parseSavedResult(
        await readJson(path.resolve(config.outputDir, id, 'result.json')),
        id,
      );
      console.log(renderSummary(result, options.artifactUrl));
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
  .description(
    'Diagnose local setup and show repair steps without testing application outcomes',
  )
  .option('--config <file>', 'Test policy', configPath)
  .option(
    '--spec <file>',
    'Validate workflow prerequisites and policy compatibility',
  )
  .option('--json', 'Print structured setup checks and repair hints')
  .action(
    async (options: { config: string; spec?: string; json?: boolean }) => {
      const report = await runDoctor(options);
      if (options.json) console.log(JSON.stringify(report));
      else {
        for (const check of report.checks) {
          const label =
            check.status === 'PASS'
              ? 'OK'
              : check.status === 'FAIL'
                ? 'ERROR'
                : 'NOT CHECKED';
          console.log(
            `${label} ${check.name} [${check.code}]: ${check.detail}`,
          );
          if (check.remediation) console.log(`  Next: ${check.remediation}`);
        }
        console.log(
          `${report.status === 'READY' ? 'Setup ready for the checks performed.' : 'Setup blocked; resolve the failed checks.'} Application outcomes have not been verified.`,
        );
        console.log(
          'Next: run promiseproof verify <spec.json> --config <policy.json> after setup is ready.',
        );
      }
      process.exitCode = report.exitCode;
    },
  );
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
