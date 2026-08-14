import { Writable } from 'node:stream';
import { afterEach, describe, expect, it } from 'vitest';
import { ansi, shouldUseColor } from './ansi.js';

/** Snapshot at load — not a live reference to `process.env`. */
const ORIGINAL_ENV = { ...process.env };

function restoreEnv(): void {
  for (const key of Object.keys(process.env)) {
    if (!(key in ORIGINAL_ENV)) {
      delete process.env[key];
    }
  }
  Object.assign(process.env, ORIGINAL_ENV);
}

afterEach(restoreEnv);

describe('shouldUseColor', () => {
  it('returns false when override is false', () => {
    expect(shouldUseColor({ override: false })).toBe(false);
  });

  it('returns true when override is true', () => {
    expect(shouldUseColor({ override: true })).toBe(true);
  });

  it('honours NO_COLOR', () => {
    process.env['NO_COLOR'] = '1';
    delete process.env['FORCE_COLOR'];
    expect(shouldUseColor({})).toBe(false);
  });

  it('ignores empty NO_COLOR', () => {
    process.env['NO_COLOR'] = '';
    process.env['FORCE_COLOR'] = '1';
    expect(shouldUseColor({})).toBe(true);
  });

  it('honours FORCE_COLOR', () => {
    delete process.env['NO_COLOR'];
    process.env['FORCE_COLOR'] = '1';
    expect(shouldUseColor({})).toBe(true);
  });

  it('treats FORCE_COLOR=0 as unset', () => {
    delete process.env['NO_COLOR'];
    process.env['FORCE_COLOR'] = '0';
    expect(shouldUseColor({ stream: null })).toBe(false);
  });

  it('returns false for a null stream', () => {
    delete process.env['NO_COLOR'];
    delete process.env['FORCE_COLOR'];
    expect(shouldUseColor({ stream: null })).toBe(false);
  });

  it('returns false for a non-TTY stream', () => {
    delete process.env['NO_COLOR'];
    delete process.env['FORCE_COLOR'];
    const stream = new Writable({
      write(_chunk, _encoding, callback) {
        callback();
      },
    });
    expect(shouldUseColor({ stream })).toBe(false);
  });
});

describe('ansi', () => {
  it('returns plain text when colour is disabled', () => {
    expect(ansi(false, 'red', 'hello')).toBe('hello');
  });

  it('wraps text when colour is enabled', () => {
    expect(ansi(true, 'red', 'hello')).toBe('\u001b[31mhello\u001b[39m');
  });
});
