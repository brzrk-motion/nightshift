import { Writable } from 'node:stream';
import { afterEach, describe, expect, it } from 'vitest';
import { ansi, shouldUseColor } from './ansi.js';

const env = process.env;

afterEach(() => {
  process.env = { ...env };
});

describe('shouldUseColor', () => {
  it('returns false when override is false', () => {
    expect(shouldUseColor({ override: false })).toBe(false);
  });

  it('returns true when override is true', () => {
    expect(shouldUseColor({ override: true })).toBe(true);
  });

  it('honours NO_COLOR', () => {
    process.env['NO_COLOR'] = '1';
    expect(shouldUseColor({})).toBe(false);
  });

  it('honours FORCE_COLOR', () => {
    delete process.env['NO_COLOR'];
    process.env['FORCE_COLOR'] = '1';
    expect(shouldUseColor({})).toBe(true);
  });

  it('returns false for a null stream', () => {
    expect(shouldUseColor({ stream: null })).toBe(false);
  });

  it('returns false for a non-TTY stream', () => {
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
