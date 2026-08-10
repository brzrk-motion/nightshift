import { describe, expect, it } from 'vitest';
import {
  DEFAULT_SESSION_MINUTES,
  formatDuration,
  initialState,
  pauseSession,
  resetSession,
  sessionProgress,
  startSession,
  stopSession,
  tickSession,
  todayKey,
} from './timer.js';

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

  it('accepts a custom length and a starting count', () => {
    const state = initialState(50, 3);
    expect(state.durationSeconds).toBe(50 * 60);
    expect(state.completedToday).toBe(3);
  });
});

describe('startSession', () => {
  it('begins a full session from idle', () => {
    const state = startSession(initialState(), 50);
    expect(state).toMatchObject({
      status: 'running',
      durationSeconds: 3000,
      remainingSeconds: 3000,
    });
  });

  it('defaults to the standard length when none is given', () => {
    expect(startSession(initialState()).durationSeconds).toBe(DEFAULT_SESSION_MINUTES * 60);
  });

  it('resumes a paused session without resetting the remaining time', () => {
    const paused = { ...initialState(50), status: 'paused' as const, remainingSeconds: 1200 };
    const resumed = startSession(paused, 25);

    expect(resumed.status).toBe('running');
    expect(resumed.remainingSeconds).toBe(1200);
    expect(resumed.durationSeconds).toBe(3000);
  });

  it('is a no-op on an already-running session', () => {
    const running = startSession(initialState(), 50);
    expect(startSession(running, 10)).toBe(running);
  });

  it('starts a fresh session after one finishes', () => {
    const finished = { ...initialState(), status: 'finished' as const, remainingSeconds: 0 };
    const started = startSession(finished, 10);
    expect(started).toMatchObject({ status: 'running', remainingSeconds: 600 });
  });

  it('never produces a zero-length session', () => {
    expect(startSession(initialState(), 0).durationSeconds).toBe(1);
  });
});

describe('pauseSession', () => {
  it('pauses a running session', () => {
    const running = startSession(initialState());
    expect(pauseSession(running).status).toBe('paused');
  });

  it('leaves an idle session alone', () => {
    const idle = initialState();
    expect(pauseSession(idle)).toBe(idle);
  });
});

describe('stopSession', () => {
  it('returns to idle and restores the full duration', () => {
    const ticking = tickSession(startSession(initialState(), 1), 30);
    const stopped = stopSession(ticking);

    expect(stopped.status).toBe('idle');
    expect(stopped.remainingSeconds).toBe(stopped.durationSeconds);
  });

  it('is a no-op when already idle', () => {
    const idle = initialState();
    expect(stopSession(idle)).toBe(idle);
  });

  it('does not touch completedToday', () => {
    const running = startSession(initialState(), 1);
    expect(stopSession(running).completedToday).toBe(0);
  });
});

describe('resetSession', () => {
  it('returns to the default session length regardless of what was running', () => {
    const custom = startSession(initialState(), 90);
    const reset = resetSession(custom);

    expect(reset).toMatchObject({
      status: 'idle',
      durationSeconds: DEFAULT_SESSION_MINUTES * 60,
      remainingSeconds: DEFAULT_SESSION_MINUTES * 60,
    });
  });

  it('keeps completedToday', () => {
    const state = { ...initialState(), completedToday: 5 };
    expect(resetSession(state).completedToday).toBe(5);
  });
});

describe('tickSession', () => {
  it('counts down while running', () => {
    const running = startSession(initialState(), 1);
    expect(tickSession(running, 10).remainingSeconds).toBe(50);
  });

  it('leaves a non-running session untouched', () => {
    const idle = initialState();
    expect(tickSession(idle)).toBe(idle);
    const paused = pauseSession(startSession(idle));
    expect(tickSession(paused)).toBe(paused);
  });

  it('finishes and counts toward today when time runs out', () => {
    const almostDone = { ...startSession(initialState(), 1), remainingSeconds: 3 };
    const finished = tickSession(almostDone, 5);

    expect(finished.status).toBe('finished');
    expect(finished.remainingSeconds).toBe(0);
    expect(finished.completedToday).toBe(1);
  });

  it('never goes negative', () => {
    const almostDone = { ...startSession(initialState(), 1), remainingSeconds: 1 };
    expect(tickSession(almostDone, 100).remainingSeconds).toBe(0);
  });

  it('only finishes once, at the exact tick it reaches zero', () => {
    const finished = tickSession({ ...startSession(initialState(), 1), remainingSeconds: 1 }, 1);
    // A finished session is not "running", so a further tick is a no-op —
    // the count does not climb every second the finish sits unacknowledged.
    expect(tickSession(finished, 1)).toBe(finished);
  });
});

describe('sessionProgress', () => {
  it('is 0 at the start and 1 when finished', () => {
    const running = startSession(initialState(), 10);
    expect(sessionProgress(running)).toBe(0);
    expect(sessionProgress(tickSession(running, 600))).toBe(1);
  });

  it('is halfway at the halfway point', () => {
    const running = startSession(initialState(), 10);
    expect(sessionProgress(tickSession(running, 300))).toBeCloseTo(0.5);
  });

  it('is 0 for a zero-length duration rather than dividing by zero', () => {
    expect(
      sessionProgress({
        status: 'idle',
        durationSeconds: 0,
        remainingSeconds: 0,
        completedToday: 0,
      }),
    ).toBe(0);
  });
});

describe('todayKey', () => {
  it('formats as YYYY-MM-DD in local time', () => {
    expect(todayKey(new Date(2026, 2, 5))).toBe('2026-03-05');
  });

  it('pads single-digit months and days', () => {
    expect(todayKey(new Date(2026, 0, 1))).toBe('2026-01-01');
  });

  it('gives two different days different keys', () => {
    expect(todayKey(new Date(2026, 0, 1))).not.toBe(todayKey(new Date(2026, 0, 2)));
  });
});
