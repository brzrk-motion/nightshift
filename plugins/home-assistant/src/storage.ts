import { parseStoredVersion, type Json } from '@nightshift/sdk';

export const CREDENTIALS_STORAGE_KEY = 'credentials';
export const CREDENTIALS_VERSION = 1 as const;

export interface Credentials {
  version: typeof CREDENTIALS_VERSION;
  baseUrl: string;
  token: string;
  [key: string]: Json;
}

function isCredentialsBody(
  record: Record<string, unknown>,
): record is Record<string, unknown> & Credentials {
  return (
    typeof record['baseUrl'] === 'string' &&
    record['baseUrl'].trim() !== '' &&
    typeof record['token'] === 'string' &&
    record['token'].trim() !== ''
  );
}

export function isCredentials(value: unknown): value is Credentials {
  return parseStoredVersion(value, CREDENTIALS_VERSION, isCredentialsBody) !== null;
}

/** Defensive parse — corrupt/partial storage becomes null (unconfigured). */
export function parseCredentials(value: Json | undefined): Credentials | null {
  if (value === undefined) return null;
  return parseStoredVersion(value, CREDENTIALS_VERSION, isCredentialsBody);
}

export function serializeCredentials(baseUrl: string, token: string): Credentials {
  return { version: CREDENTIALS_VERSION, baseUrl, token };
}
