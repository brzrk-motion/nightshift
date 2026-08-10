import { describe, expect, it } from 'vitest';
import plugin, { DEFAULT_SESSION_MINUTES, formatDuration, initialState } from './index.js';

describe('formatDuration', () => {
  it('pads minutes and seconds', () => {
    expect(formatDuration(0)).toBe('00:00');
    expect(formatDuration(65)).toBe('01:05');
    expect(formatDuration(25 * 60)).toBe('25:00');
  });

  it('adds an hours segment past an hour', () => {
    expect(formatDuration(3661)).toBe('1:01:01');
  });

  it('clamps negatives and truncates fractions', () => {
    expect(formatDuration(-10)).toBe('00:00');
    expect(formatDuration(59.9)).toBe('00:59');
  });
});

describe('initialState', () => {
  it('starts idle with a full session', () => {
    const state = initialState();
    expect(state.status).toBe('idle');
    expect(state.durationSeconds).toBe(DEFAULT_SESSION_MINUTES * 60);
    expect(state.remainingSeconds).toBe(state.durationSeconds);
    expect(state.completedToday).toBe(0);
  });
});

describe('manifest', () => {
  it('declares only the capabilities it uses', () => {
    expect(plugin.manifest.id).toBe('focus');
    expect(plugin.manifest.capabilities).toEqual([
      'entities:read',
      'entities:write',
      'widgets:register',
      'commands:register',
    ]);
  });
});
