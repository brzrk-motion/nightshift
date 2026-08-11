import { describe, expect, it } from 'vitest';
import { parseCredentials, serializeCredentials } from './storage.js';

describe('parseCredentials', () => {
  it('returns null for undefined / empty', () => {
    expect(parseCredentials(undefined)).toBeNull();
  });

  it('returns null for corrupt shapes', () => {
    expect(parseCredentials(null)).toBeNull();
    expect(parseCredentials('nope')).toBeNull();
    expect(parseCredentials({})).toBeNull();
    expect(parseCredentials({ version: 1, baseUrl: '', token: 'x' })).toBeNull();
    expect(parseCredentials({ version: 1, baseUrl: 'http://a', token: '' })).toBeNull();
    expect(parseCredentials({ version: 2, baseUrl: 'http://a', token: 't' })).toBeNull();
  });

  it('accepts a valid v1 blob', () => {
    const creds = serializeCredentials('http://192.168.1.10:8123', 'token');
    expect(parseCredentials(creds)).toEqual(creds);
  });
});
