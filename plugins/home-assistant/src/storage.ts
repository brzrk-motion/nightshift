import type { Json } from '@nightshift/sdk';

export const CREDENTIALS_STORAGE_KEY = 'credentials';

export interface Credentials {
  version: 1;
  baseUrl: string;
  token: string;
  [key: string]: Json;
}

export function isCredentials(value: unknown): value is Credentials {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return false;
  const record = value as Record<string, unknown>;
  return (
    record['version'] === 1 &&
    typeof record['baseUrl'] === 'string' &&
    record['baseUrl'].trim() !== '' &&
    typeof record['token'] === 'string' &&
    record['token'].trim() !== ''
  );
}

/** Defensive parse — corrupt/partial storage becomes null (unconfigured). */
export function parseCredentials(value: Json | undefined): Credentials | null {
  if (value === undefined) return null;
  return isCredentials(value) ? value : null;
}

export function serializeCredentials(baseUrl: string, token: string): Credentials {
  return { version: 1, baseUrl, token };
}
