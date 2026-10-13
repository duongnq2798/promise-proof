import {
  ConfigurationError,
  type Config,
  type Spec,
  type Value,
} from './spec.js';

export function authorizedUrl(
  input: string,
  baseUrl: string,
  config: Config,
): string {
  const url = new URL(input, baseUrl);
  if (
    !['http:', 'https:'].includes(url.protocol) ||
    url.username ||
    url.password
  )
    throw new ConfigurationError(
      'Only HTTP(S) URLs without embedded credentials are supported.',
    );
  if (!config.allowedOrigins.includes(url.origin))
    throw new ConfigurationError(
      `Target origin ${url.origin} is not in allowedOrigins.`,
    );
  const local = ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname);
  if (!local && !config.allowRemote)
    throw new ConfigurationError(
      `Non-local origin ${url.origin} requires allowRemote: true for an authorized test environment.`,
    );
  return url.href;
}

export function environmentNames(spec: Spec): string[] {
  const names = new Set(spec.requiredEnv);
  function visit(item: unknown) {
    if (!item || typeof item !== 'object') return;
    if ('env' in item && typeof item.env === 'string') names.add(item.env);
    for (const v of Object.values(item)) visit(v);
  }
  visit(spec);
  return [...names];
}

export function resolveValue(
  value: Value,
  variables: Map<string, string>,
): string {
  if (typeof value === 'string') return value;
  if ('env' in value) {
    const result = process.env[value.env];
    if (!result)
      throw new ConfigurationError(
        `Required environment variable ${value.env} is missing.`,
      );
    return result;
  }
  const result = variables.get(value.variable);
  if (result === undefined)
    throw new Error(`Variable ${value.variable} has no verified value.`);
  return result;
}

export function redact(input: unknown, secrets: string[] = []): unknown {
  if (typeof input === 'string') {
    let result = input;
    for (const secret of [...secrets]
      .filter(Boolean)
      .sort((a, b) => b.length - a.length)) {
      result = result
        .split(secret)
        .join('[REDACTED]')
        .split(encodeURIComponent(secret))
        .join('[REDACTED]');
    }
    return result
      .replace(/(bearer\s+)[^\s"<]+/gi, '$1[REDACTED]')
      .replace(
        /([?&](?:token|key|secret|password|authorization)=)[^&\s"<]*/gi,
        '$1[REDACTED]',
      );
  }
  if (Array.isArray(input)) return input.map((v) => redact(v, secrets));
  if (input && typeof input === 'object')
    return Object.fromEntries(
      Object.entries(input).map(([key, v]) => [
        key,
        /password|secret|token|authorization|cookie|api[_-]?key/i.test(key)
          ? '[REDACTED]'
          : redact(v, secrets),
      ]),
    );
  return input;
}

export function jsonPath(input: unknown, path: string): unknown {
  let current = input;
  for (const key of path ? path.split('.') : []) {
    if (
      ['__proto__', 'prototype', 'constructor'].includes(key) ||
      !current ||
      typeof current !== 'object' ||
      !Object.hasOwn(current, key)
    )
      return undefined;
    current = (current as Record<string, unknown>)[key];
  }
  return current;
}
