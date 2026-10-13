import { describe, expect, it } from 'vitest';
import { aggregate, exitCode } from '../src/result.js';
import { parseSpec, parseConfig, ConfigurationError } from '../src/spec.js';
import {
  authorizedUrl,
  environmentNames,
  jsonPath,
  redact,
  resolveValue,
} from '../src/security.js';
import { escapeHtml, renderReport } from '../src/reporter.js';
import type { RunResult } from '../src/result.js';

const base = {
  schemaVersion: '1',
  id: 'test',
  revision: 1,
  goal: 'Observe an outcome',
  baseUrl: 'http://127.0.0.1:4173',
  steps: [
    {
      id: 'visible',
      type: 'visible',
      description: 'Visible outcome',
      locator: { role: 'status' },
    },
  ],
};
const config = parseConfig({
  schemaVersion: '1',
  environment: 'test',
  allowedOrigins: ['http://127.0.0.1:4173'],
});
describe('strict specification', () => {
  it('applies safe defaults', () => {
    expect(parseSpec(base).evidence).toEqual({
      screenshots: false,
      trace: false,
      mask: [],
    });
  });
  it.each(['evaluate', 'shell', 'unknown'])(
    'rejects unsupported action %s',
    (type) => {
      expect(() =>
        parseSpec({ ...base, steps: [{ ...base.steps[0], type }] }),
      ).toThrow(ConfigurationError);
    },
  );
  it('rejects unknown fields', () => {
    expect(() => parseSpec({ ...base, success: true })).toThrow();
  });
  it('requires an actual assertion', () => {
    expect(() =>
      parseSpec({
        ...base,
        steps: [
          { id: 'open', type: 'navigate', url: '/', description: 'Open' },
        ],
      }),
    ).toThrow(/assertion/);
  });
  it('rejects duplicate ids', () => {
    expect(() =>
      parseSpec({ ...base, steps: [...base.steps, ...base.steps] }),
    ).toThrow(/Duplicate/);
  });
  it('rejects cyclic or forward dependencies', () => {
    expect(() =>
      parseSpec({
        ...base,
        steps: [{ ...base.steps[0], dependsOn: ['later'] }],
      }),
    ).toThrow(/earlier/);
  });
  it('validates property value types', () => {
    expect(() =>
      parseSpec({
        ...base,
        steps: [
          {
            id: 'checked',
            type: 'property',
            property: 'checked',
            equals: 'false',
            locator: { css: 'input' },
            description: 'Check',
          },
        ],
      }),
    ).toThrow(/boolean/);
  });
  it('rejects invalid timeouts', () => {
    expect(() => parseSpec({ ...base, timeoutMs: 0 })).toThrow();
  });
  it.each(['token', 'apiKey', 'apikey', 'api_key', 'password', 'secret'])(
    'rejects credential URL literal %s',
    (key) => {
      expect(() =>
        parseSpec({
          ...base,
          steps: [
            {
              id: 'api',
              type: 'api',
              description: 'API',
              url: '/?' + key + '=secret-value',
              status: 200,
            },
          ],
        }),
      ).toThrow(/Credential-bearing/);
    },
  );
  it('rejects literal credential headers and sensitive input values', () => {
    expect(() =>
      parseSpec({
        ...base,
        steps: [
          {
            id: 'api',
            type: 'api',
            description: 'API',
            url: '/',
            status: 200,
            headers: { Authorization: 'Bearer secret' },
          },
        ],
      }),
    ).toThrow(/environment reference/);
    expect(() =>
      parseSpec({
        ...base,
        steps: [
          {
            id: 'password',
            type: 'fill',
            description: 'Password',
            locator: { label: 'Password' },
            value: 'secret',
          },
          ...base.steps,
        ],
      }),
    ).toThrow(/environment references/);
  });
  it('discovers credential references recursively', () => {
    expect(
      environmentNames(
        parseSpec({
          ...base,
          requiredEnv: ['OTHER'],
          steps: [
            {
              id: 'api',
              type: 'api',
              url: '/',
              status: 200,
              headers: { Authorization: { env: 'AUTH' } },
              description: 'API',
            },
          ],
        }),
      ),
    ).toEqual(['OTHER', 'AUTH']);
  });
});
describe('result semantics', () => {
  it.each([
    [[], 'NOT_VERIFIED'],
    [['PASS'], 'PASS'],
    [['PASS', 'NOT_VERIFIED'], 'NOT_VERIFIED'],
    [['FAIL', 'NOT_VERIFIED'], 'FAIL'],
    [['FAIL', 'ERROR'], 'ERROR'],
  ] as const)('aggregates %j as %s', (statuses, status) => {
    expect(aggregate([...statuses])).toBe(status);
  });
  it('never treats incomplete or error states as exit zero', () => {
    expect(
      ['PASS', 'FAIL', 'NOT_VERIFIED', 'ERROR'].map((s) =>
        exitCode(s as RunResult['status']),
      ),
    ).toEqual([0, 1, 1, 3]);
  });
});
describe('security policy', () => {
  it('resolves only allowed URLs', () => {
    expect(authorizedUrl('/form', base.baseUrl, config)).toBe(
      `${base.baseUrl}/form`,
    );
  });
  it.each([
    'https://example.com',
    '//example.com/',
    'file:///tmp/file',
    'http://user:pass@127.0.0.1:4173/',
    'http://127.0.0.1:4174/',
  ])('blocks %s', (url) => {
    expect(() => authorizedUrl(url, base.baseUrl, config)).toThrow();
  });
  it('requires a second remote opt-in', () => {
    const remote = { ...config, allowedOrigins: ['https://example.com'] };
    expect(() =>
      authorizedUrl('https://example.com', base.baseUrl, remote),
    ).toThrow(/allowRemote/);
    expect(
      authorizedUrl('https://example.com', base.baseUrl, {
        ...remote,
        allowRemote: true,
      }),
    ).toBe('https://example.com/');
  });
  it('rejects origin paths and unknown policy fields', () => {
    expect(() =>
      parseConfig({
        ...config,
        allowedOrigins: ['http://localhost:3000/path'],
      }),
    ).toThrow();
    expect(() => parseConfig({ ...config, production: true })).toThrow();
  });
  it('invalid origin diagnostics do not repeat embedded credentials', () => {
    try {
      parseConfig({
        ...config,
        allowedOrigins: ['http://user:synthetic-password@localhost:3000'],
      });
      throw new Error('Expected configuration rejection');
    } catch (error) {
      expect(String(error)).not.toContain('synthetic-password');
      expect(error).toBeInstanceOf(ConfigurationError);
    }
  });
  it('redacts known secrets, encoded values, key names and bearer tokens', () => {
    expect(
      redact(
        {
          text: 'value p@ss p%40ss Bearer abc123',
          password: 'hidden',
          url: 'http://localhost/?token=abc',
        },
        ['p@ss'],
      ),
    ).toEqual({
      text: 'value [REDACTED] [REDACTED] Bearer [REDACTED]',
      password: '[REDACTED]',
      url: 'http://localhost/?token=[REDACTED]',
    });
  });
  it('does not allow prototype traversal', () => {
    expect(jsonPath({ a: [{ b: 2 }] }, 'a.0.b')).toBe(2);
    expect(jsonPath({}, '__proto__')).toBeUndefined();
    expect(jsonPath({}, 'missing')).toBeUndefined();
  });
  it('missing captured values throw instead of interpolating undefined', () => {
    expect(() => resolveValue({ variable: 'missing' }, new Map())).toThrow(
      /no verified value/,
    );
  });
  it('escapes website content in reports', () => {
    expect(escapeHtml('<script>"&')).toBe('&lt;script&gt;&quot;&amp;');
  });
});
it('the report preserves a failing result and uses no external assets', () => {
  const result: RunResult = {
    schemaVersion: '1',
    runnerVersion: '0.1.0',
    runId: 'test',
    specId: 'test',
    revision: 1,
    specDigest: 'abc',
    goal: '<script>alert(1)</script>',
    baseUrl: base.baseUrl,
    environment: 'test',
    preconditions: [],
    status: 'FAIL',
    startedAt: '2026-10-13',
    durationMs: 1,
    steps: [],
    errors: ['Fail'],
    consoleErrors: {},
    network: [],
    traces: [],
    evidenceClasses: [],
    summary: { PASS: 0, FAIL: 1, NOT_VERIFIED: 0, ERROR: 0 },
  };
  const html = renderReport(result);
  expect(html).toContain('FAIL');
  expect(html).toContain('&lt;script&gt;');
  expect(html).not.toContain('<script>');
  expect(html).not.toMatch(/(?:src|href)="https?:/);
  expect(result.status).toBe('FAIL');
});
