import { NightshiftError } from './errors.js';

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export interface ConfigFailOptions {
  hint?: string;
  /** Override the default `{path} must be {expected}.` message. */
  message?: string;
}

export function configFail(
  path: string,
  expected: string,
  hintOrOptions?: string | ConfigFailOptions,
): never {
  const options: ConfigFailOptions =
    typeof hintOrOptions === 'string' ? { hint: hintOrOptions } : (hintOrOptions ?? {});
  const message = options.message ?? `${path} must be ${expected}.`;
  throw new NightshiftError(
    'CONFIG_INVALID',
    message,
    options.hint === undefined ? undefined : { hint: options.hint },
  );
}

export function assertRecord(
  value: unknown,
  path: string,
  expected: string,
  hint?: string,
): asserts value is Record<string, unknown> {
  if (!isRecord(value)) {
    configFail(path, expected, hint);
  }
}
