import {
  mkdir,
  mkdtemp,
  readFile,
  realpath,
  writeFile,
} from 'node:fs/promises';
import path from 'node:path';
import { once } from 'node:events';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { createDemoServer } from '../examples/server.mjs';

const archive = process.argv[2];
if (!archive)
  throw new Error('Usage: node scripts/package-smoke.mjs <local-tarball>');
const command = promisify(execFile);
await mkdir('.smoke', { recursive: true });
const directory = await mkdtemp(path.resolve('.smoke/package-'));
await writeFile(
  path.join(directory, 'package.json'),
  JSON.stringify({ name: 'package-smoke', private: true, type: 'module' }),
);
let npmExecutable = process.env.npm_execpath;
if (!npmExecutable) {
  const which = process.platform === 'win32' ? 'where.exe' : 'which';
  const { stdout } = await command(which, ['npm']);
  const npmPath = await realpath(stdout.trim().split(/\r?\n/)[0]);
  npmExecutable = npmPath.endsWith('.js')
    ? npmPath
    : path.join(path.dirname(npmPath), 'node_modules/npm/bin/npm-cli.js');
}
await command(
  process.execPath,
  [
    npmExecutable,
    'install',
    path.resolve(archive),
    '--cache',
    path.resolve('.npm-cache'),
    '--no-audit',
    '--no-fund',
  ],
  { cwd: directory },
);
const installed = path.join(directory, 'node_modules/promiseproof-local');
const cli = path.join(installed, 'dist/cli.js');
const server = createDemoServer();
server.listen(0, '127.0.0.1');
await once(server, 'listening');
const baseUrl = 'http://127.0.0.1:' + server.address().port;
try {
  const bin = await command(
    process.execPath,
    [npmExecutable, 'exec', '--offline', '--', 'promiseproof', '--version'],
    { cwd: directory },
  );
  if (!bin.stdout.includes('0.1.0'))
    throw new Error('Installed CLI bin did not resolve');
  await command(process.execPath, [cli, 'init', '--base-url', baseUrl], {
    cwd: directory,
  });
  await writeFile(
    path.join(directory, 'policy.json'),
    JSON.stringify({
      schemaVersion: '1',
      environment: 'test',
      allowedOrigins: [baseUrl],
    }),
  );
  const privateMarker = 'private-canary-93';
  await writeFile(path.join(directory, 'malformed.json'), privateMarker);
  let rejectedInput;
  try {
    await command(
      process.execPath,
      [cli, 'verify', 'malformed.json', '--config', 'policy.json'],
      { cwd: directory },
    );
  } catch (error) {
    rejectedInput = error;
  }
  if (
    !rejectedInput ||
    rejectedInput.code !== 2 ||
    (rejectedInput.stdout + rejectedInput.stderr).includes(privateMarker) ||
    !rejectedInput.stderr.includes('JSON')
  )
    throw new Error('Packaged CLI did not withhold malformed input safely');
  console.log('Packaged invalid JSON: exit 2; input contents withheld');
  for (const [name, expectedCode] of [
    ['simple-form', 0],
    ['failing-workflow', 1],
    ['invitation-flow', 0],
  ]) {
    const spec = JSON.parse(
      await readFile(
        path.join(installed, 'examples', name, 'spec.json'),
        'utf8',
      ),
    );
    spec.baseUrl = baseUrl;
    await writeFile(path.join(directory, 'spec.json'), JSON.stringify(spec));
    if (name === 'simple-form') {
      const { stdout: doctorOutput } = await command(
        process.execPath,
        [
          cli,
          'doctor',
          '--spec',
          'spec.json',
          '--config',
          'policy.json',
          '--json',
        ],
        { cwd: directory },
      );
      const diagnosis = JSON.parse(doctorOutput);
      if (
        diagnosis.status !== 'READY' ||
        diagnosis.outcomesVerified !== false ||
        diagnosis.exitCode !== 0
      )
        throw new Error(
          'Packaged doctor did not report setup readiness correctly',
        );
      console.log('Packaged doctor: READY (outcomesVerified false)');
    }
    let code = 0;
    let stdout;
    try {
      ({ stdout } = await command(
        process.execPath,
        [cli, 'verify', 'spec.json', '--config', 'policy.json', '--json'],
        { cwd: directory },
      ));
    } catch (error) {
      code = error.code;
      stdout = error.stdout;
    }
    if (code !== expectedCode)
      throw new Error(
        name +
          ' packaged CLI expected ' +
          expectedCode +
          ', got ' +
          code +
          ' ' +
          stdout,
      );
    const result = JSON.parse(stdout);
    const html = await readFile(
      path.join(result.directory, 'report.html'),
      'utf8',
    );
    if (!html.includes('<title>' + result.status))
      throw new Error('HTML/JSON verdict mismatch');
    if ((result.status !== 'PASS') !== html.includes('id="next-steps"'))
      throw new Error(
        'Packaged report guidance did not match the recorded verdict',
      );
    console.log(
      'Packaged ' + name + ': ' + result.status + ' (exit ' + code + ')',
    );
  }
  await command(
    process.execPath,
    [cli, 'agent', '--output', 'PROMISEPROOF-AGENT.md'],
    { cwd: directory },
  );
  await writeFile(
    path.join(directory, 'exports-smoke.mjs'),
    "import { verify, parseSpec, renderReport } from 'promiseproof-local';\nif ([verify, parseSpec, renderReport].some(value => typeof value !== 'function')) throw new Error('Invalid ESM exports');\n",
  );
  await command(process.execPath, ['exports-smoke.mjs'], { cwd: directory });
  await readFile(path.join(installed, 'ARCHITECTURE.md'));
  console.log(
    'Package smoke PASS: init, private input errors, doctor, exports, agent instructions, three real browser workflows; ' +
      directory,
  );
} finally {
  await new Promise((resolve) => server.close(resolve));
}
