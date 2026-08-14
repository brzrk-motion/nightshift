import { describe, expect, it } from 'vitest';
import { isNightshiftError } from './errors.js';
import { assertRecord, configFail, isRecord } from './yamlUtils.js';

describe('isRecord', () => {
  it('accepts plain objects', () => {
    expect(isRecord({})).toBe(true);
    expect(isRecord({ a: 1 })).toBe(true);
  });

  it('rejects non-objects', () => {
    expect(isRecord(null)).toBe(false);
    expect(isRecord([])).toBe(false);
    expect(isRecord('x')).toBe(false);
  });
});

describe('configFail', () => {
  it('throws CONFIG_INVALID with the default message', () => {
    try {
      configFail('rows[0]', 'a row object', 'see the guide');
      expect.unreachable('should have thrown');
    } catch (error) {
      expect(isNightshiftError(error)).toBe(true);
      if (!isNightshiftError(error)) return;
      expect(error.code).toBe('CONFIG_INVALID');
      expect(error.message).toBe('rows[0] must be a row object.');
      expect(error.hint).toBe('see the guide');
    }
  });

  it('accepts a custom message', () => {
    try {
      configFail('version', 'an integer', {
        message: 'config: "version" must be an integer.',
        hint: 'fix it',
      });
      expect.unreachable('should have thrown');
    } catch (error) {
      expect(isNightshiftError(error)).toBe(true);
      if (!isNightshiftError(error)) return;
      expect(error.code).toBe('CONFIG_INVALID');
      expect(error.message).toBe('config: "version" must be an integer.');
      expect(error.hint).toBe('fix it');
    }
  });
});

describe('assertRecord', () => {
  it('narrows to a record', () => {
    const value: unknown = { rows: [] };
    assertRecord(value, 'doc', 'a YAML mapping');
    expect(value.rows).toEqual([]);
  });

  it('throws when the value is not a record', () => {
    expect(() => assertRecord([], 'doc', 'a YAML mapping', 'hint')).toThrow(
      /doc must be a YAML mapping/,
    );
  });
});
