import { mkdir, open, readFile, rm } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import path from 'node:path';
import { chromium } from '@playwright/test';
import { parseConfig, parseSpec, type Config, type Spec } from './spec.js';
import {
  authorizedUrl,
  environmentNames,
  redact,
  resolveValue,
} from './security.js';

export interface DoctorCheck {
  code: string;
  name: string;
  status: 'PASS' | 'FAIL' | 'NOT_CHECKED';
  detail: string;
  remediation?: string;
}
export interface DoctorReport {
  schemaVersion: '1';
  status: 'READY' | 'BLOCKED';
  outcomesVerified: false;
  exitCode: 0 | 2 | 3;
  checks: DoctorCheck[];
}

async function readInput(file: string): Promise<unknown> {
  const content = await readFile(file, 'utf8');
  if (Buffer.byteLength(content) > 1024 * 1024)
    throw new Error('Input too large');
  return JSON.parse(content) as unknown;
}

export async function runDoctor(options: {
  config: string;
  spec?: string;
}): Promise<DoctorReport> {
  const checks: DoctorCheck[] = [];
  let exitCode: 0 | 2 | 3 = 0;
  const add = (check: DoctorCheck, failure?: 2 | 3) => {
    checks.push(check);
    if (failure === 2 || (failure === 3 && exitCode === 0)) exitCode = failure;
  };
  const [major = 0, minor = 0] = process.versions.node.split('.').map(Number);
  const supported = major > 22 || (major === 22 && minor >= 12);
  add(
    {
      code: 'NODE_JS',
      name: 'Node.js',
      status: supported ? 'PASS' : 'FAIL',
      detail: process.version,
      ...(!supported && { remediation: 'Use Node.js 22.12 or newer.' }),
    },
    supported ? undefined : 3,
  );

  let config: Config | undefined;
  try {
    config = parseConfig(await readInput(options.config));
    add({
      code: 'CONFIGURATION',
      name: 'Configuration',
      status: 'PASS',
      detail: `${config.allowedOrigins.length} exact authorized origins; test environment.`,
    });
  } catch (error) {
    const missing = (error as NodeJS.ErrnoException).code === 'ENOENT';
    add(
      {
        code: missing ? 'CONFIG_MISSING' : 'CONFIG_INVALID',
        name: 'Configuration',
        status: 'FAIL',
        detail: missing
          ? 'Policy file was not found.'
          : 'Policy could not be read or is not valid.',
        remediation: missing
          ? 'Run promiseproof init, or pass --config <policy.json>.'
          : 'Check policy JSON and exact allowedOrigins in docs/specification.md.',
      },
      2,
    );
  }

  let spec: Spec | undefined;
  if (options.spec) {
    try {
      spec = parseSpec(await readInput(options.spec));
      add({
        code: 'SPECIFICATION',
        name: 'Specification',
        status: 'PASS',
        detail: 'Versioned specification is valid.',
      });
    } catch (error) {
      const missing = (error as NodeJS.ErrnoException).code === 'ENOENT';
      add(
        {
          code: missing ? 'SPEC_MISSING' : 'SPEC_INVALID',
          name: 'Specification',
          status: 'FAIL',
          detail: missing
            ? 'Specification file was not found.'
            : 'Specification could not be read or is not valid.',
          remediation:
            'Pass --spec <spec.json>; check JSON, supported steps and dependency order in docs/specification.md.',
        },
        2,
      );
    }
  } else {
    add({
      code: 'SPECIFICATION',
      name: 'Specification',
      status: 'NOT_CHECKED',
      detail:
        'No spec supplied; target, credential and evidence-policy checks were not performed.',
      remediation: 'Pass --spec <spec.json> to check workflow prerequisites.',
    });
  }

  const names = spec ? environmentNames(spec) : [];
  const secrets = names.map((name) => process.env[name] ?? '').filter(Boolean);
  for (const name of names) {
    const present = Boolean(process.env[name]);
    add(
      {
        code: 'ENVIRONMENT_VARIABLE',
        name,
        status: present ? 'PASS' : 'FAIL',
        detail: present
          ? 'Present; value withheld.'
          : 'Required environment variable is missing.',
        ...(!present && {
          remediation:
            'Set the named variable in this process, then rerun doctor.',
        }),
      },
      present ? undefined : 3,
    );
  }

  if (spec && config) {
    try {
      authorizedUrl(spec.baseUrl, spec.baseUrl, config);
      for (const step of [...spec.steps, ...spec.cleanup]) {
        const value =
          'url' in step
            ? step.url
            : step.type === 'url'
              ? step.equals
              : undefined;
        if (
          value !== undefined &&
          (typeof value === 'string' ||
            ('env' in value && process.env[value.env]))
        ) {
          authorizedUrl(resolveValue(value, new Map()), spec.baseUrl, config);
        }
      }
      add({
        code: 'TARGET_POLICY',
        name: 'Target policy',
        status: 'PASS',
        detail:
          'Base URL and available static/environment URL references are authorized.',
      });
    } catch {
      add(
        {
          code: 'TARGET_POLICY',
          name: 'Target policy',
          status: 'FAIL',
          detail: 'A target URL is invalid or rejected by the test policy.',
          remediation:
            'Check HTTP(S) URLs and exact allowedOrigins; enable allowRemote only for an authorized test deployment. Never embed URL credentials.',
        },
        2,
      );
    }
    if (
      [...spec.steps, ...spec.cleanup].some((step) => {
        const value =
          'url' in step
            ? step.url
            : step.type === 'url'
              ? step.equals
              : undefined;
        return value && typeof value !== 'string' && 'variable' in value;
      })
    ) {
      add({
        code: 'RUNTIME_URLS',
        name: 'Captured URLs',
        status: 'NOT_CHECKED',
        detail:
          'Captured URLs are available only during execution; the runner authorizes each resolved URL.',
      });
    }
  }

  if (spec) {
    const unsafeBinary =
      names.length > 0 && (spec.evidence.screenshots || spec.evidence.trace);
    const unsafeCapture =
      spec.evidence.trace &&
      [...spec.steps, ...spec.cleanup].some(
        (step) => step.type === 'api' && step.capture,
      );
    const literalSecret = secrets.some((secret) =>
      (JSON.stringify(spec, null, 2) + '\n').includes(secret),
    );
    const safe = !unsafeBinary && !unsafeCapture && !literalSecret;
    add(
      {
        code: 'EVIDENCE_POLICY',
        name: 'Evidence policy',
        status: safe ? 'PASS' : 'FAIL',
        detail: safe
          ? 'Configured evidence respects credential-reference constraints.'
          : 'Credential references, captured values or literal secrets conflict with safe evidence settings.',
        ...(!safe && {
          remediation:
            'Disable screenshots and traces for environment-reference runs; disable traces for API captures; replace secret literals with environment references.',
        }),
      },
      safe ? undefined : 2,
    );
  }

  if (config && (!options.spec || spec)) {
    try {
      await mkdir(config.outputDir, { recursive: true });
      const probe = path.join(config.outputDir, '.doctor-' + randomUUID());
      const handle = await open(probe, 'wx', 0o600);
      try {
        await handle.writeFile('PromiseProof evidence write probe\n');
      } finally {
        try {
          await handle.close();
        } finally {
          await rm(probe);
        }
      }
      add({
        code: 'EVIDENCE_DIRECTORY',
        name: 'Evidence directory',
        status: 'PASS',
        detail: 'Write and cleanup verified.',
      });
    } catch {
      add(
        {
          code: 'EVIDENCE_DIRECTORY',
          name: 'Evidence directory',
          status: 'FAIL',
          detail:
            'Cannot create and remove a temporary file in the evidence directory.',
          remediation:
            'Choose a writable outputDir in the policy and check filesystem permissions and free space.',
        },
        3,
      );
    }
    try {
      const browser = await chromium.launch({ timeout: 15000 });
      await browser.close();
      add({
        code: 'CHROMIUM',
        name: 'Chromium',
        status: 'PASS',
        detail: 'Launch and shutdown verified; no application request made.',
      });
    } catch {
      add(
        {
          code: 'CHROMIUM',
          name: 'Chromium',
          status: 'FAIL',
          detail: 'Chromium could not launch or shut down successfully.',
          remediation:
            'If binaries are missing, run npm exec playwright install chromium. Linux may need --with-deps. If installed, check OS dependencies, permissions and browser policies.',
        },
        3,
      );
    }
  } else {
    for (const [code, name] of [
      ['EVIDENCE_DIRECTORY', 'Evidence directory'],
      ['CHROMIUM', 'Chromium'],
    ]) {
      add({
        code: code!,
        name: name!,
        status: 'NOT_CHECKED',
        detail: 'Resolve invalid or missing input files first.',
      });
    }
  }

  return {
    schemaVersion: '1',
    status: exitCode === 0 ? 'READY' : 'BLOCKED',
    outcomesVerified: false,
    exitCode,
    checks: checks.map((check) => ({
      ...check,
      name: String(redact(check.name, secrets)),
      detail: String(redact(check.detail, secrets)),
      ...(check.remediation && {
        remediation: String(redact(check.remediation, secrets)),
      }),
    })),
  };
}
