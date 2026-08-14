import { describe, expect, it } from 'vitest';
import { formatDuration, pauseIfRunning, sessionProgress, tickCountdown } from './countdown.js';

describe('formatDuration', () => {
  it('pads minutes and seconds', () => {
    expect(formatDuration(0)).toBe('00:00');
    expect(formatDuration(65)).toBe('01:05');
    expect(formatDuration(25 * 60)).toBe('25:00');
  });

  it('includes hours past an hour', () => {
    expect(formatDuration(3661)).toBe('1:01:01');
  });
});

describe('sessionProgress', () => {
  it('is halfway at the halfway point', () => {
    expect(sessionProgress({ durationSeconds: 100, remainingSeconds: 50 })).toBeCloseTo(0.5);
    expect(sessionProgress({ durationSeconds: 0, remainingSeconds: 0 })).toBe(0);
  });
});

describe('pauseIfRunning', () => {
  it('pauses only while running', () => {
    type Status = 'idle' | 'running' | 'paused';
    const running = { status: 'running' as Status, remainingSeconds: 30 };
    expect(pauseIfRunning(running, 'running', 'paused')).toEqual({
      status: 'paused',
      remainingSeconds: 30,
    });
    expect(pauseIfRunning({ status: 'idle' as Status }, 'running', 'paused').status).toBe('idle');
  });
});

describe('tickCountdown', () => {
  it('subtracts elapsed time while running', () => {
    type Status = 'running' | 'idle' | 'finished';
    const state = {
      status: 'running' as Status,
      durationSeconds: 60,
      remainingSeconds: 10,
    };
    expect(tickCountdown(state, 3, 'running', (next) => next)).toMatchObject({
      remainingSeconds: 7,
    });
  });

  it('calls onComplete at zero and ignores non-running states', () => {
    type Status = 'running' | 'idle' | 'finished';
    const running = {
      status: 'running' as Status,
      durationSeconds: 60,
      remainingSeconds: 1,
    };
    const finished = tickCountdown(running, 1, 'running', (next) => ({
      ...next,
      status: 'finished' as Status,
      completedToday: 1,
    }));
    expect(finished).toMatchObject({ status: 'finished', remainingSeconds: 0, completedToday: 1 });

    const idle = { status: 'idle' as Status, durationSeconds: 60, remainingSeconds: 30 };
    expect(tickCountdown(idle, 1, 'running', (next) => next)).toBe(idle);
  });
});
