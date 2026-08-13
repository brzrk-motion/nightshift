import { describe, expect, it } from 'vitest';
import { parseStoredVersion } from './storage.js';

interface SampleStored {
  version: 1;
  token: string;
}

function isSampleBody(
  record: Record<string, unknown>,
): record is Record<string, unknown> & SampleStored {
  return typeof record['token'] === 'string' && record['token'].trim() !== '';
}

describe('parseStoredVersion', () => {
  it('returns null for non-objects and wrong versions', () => {
    expect(parseStoredVersion(undefined, 1, isSampleBody)).toBeNull();
    expect(parseStoredVersion(null, 1, isSampleBody)).toBeNull();
    expect(parseStoredVersion('nope', 1, isSampleBody)).toBeNull();
    expect(parseStoredVersion({ version: 2, token: 'x' }, 1, isSampleBody)).toBeNull();
  });

  it('returns null when the guard rejects the body', () => {
    expect(parseStoredVersion({ version: 1, token: '' }, 1, isSampleBody)).toBeNull();
    expect(parseStoredVersion({ version: 1 }, 1, isSampleBody)).toBeNull();
  });

  it('returns the parsed blob when version and guard pass', () => {
    const stored = { version: 1 as const, token: 'secret' };
    expect(parseStoredVersion(stored, 1, isSampleBody)).toEqual(stored);
  });
});
