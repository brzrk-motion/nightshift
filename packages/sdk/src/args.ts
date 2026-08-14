import type { Json } from '@nightshift/core';

/** Trimmed string from command or vibe args; `undefined` when missing or blank. */
export function argString(args: Record<string, Json> | undefined, key: string): string | undefined {
  const value = args?.[key];
  return typeof value === 'string' && value.trim() !== '' ? value.trim() : undefined;
}
