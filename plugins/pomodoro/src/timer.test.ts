import { describe, expect, it } from 'vitest';
import {
  DEFAULT_SHORT_BREAK_MINUTES,
  DEFAULT_WORK_MINUTES,
  initialState,
  pauseSession,
  phaseLabel,
  resetSession,
  skipPhase,
  startSession,
  stopSession,
  tickSession,
  type PomodoroState,
} from './timer.js';

describe('phaseLabel', () => {
  it('names each phase for the widget', () => {
    expect(phaseLabel('work')).toBe('Focus');
    expect(phaseLabel('shortBreak')).toBe('Short break');
    expect(phaseLabel('longBreak')).toBe('Long break');
  });
});

describe('initialState', () => {
  it('starts idle on a work interval', () => {
    const state = initialState();
    expect(state).toMatchObject({
      status: 'idle',
      phase: 'work',
      pendingPhase: null,
      durationSeconds: DEFAULT_WORK_MINUTES * 60,
      completedPomodorosToday: 0,
      cycleCount: 0,
    });
  });
});

describe('startSession', () => {
  it('begins work from idle', () => {
    const state = startSession(initialState());
    expect(state).toMatchObject({
      status: 'running',
      phase: 'work',
      remainingSeconds: DEFAULT_WORK_MINUTES * 60,
    });
  });

  it('resumes a paused session', () => {
    const paused = {
      ...startSession(initialState()),
      status: 'paused' as const,
      remainingSeconds: 900,
    };
    expect(startSession(paused)).toMatchObject({ status: 'running', remainingSeconds: 900 });
  });

  it('starts the pending break after work completes', () => {
    const complete: PomodoroState = {
      ...initialState(),
      status: 'phaseComplete',
      phase: 'work',
      pendingPhase: 'shortBreak',
      remainingSeconds: 0,
    };
    const started = startSession(complete);
    expect(started).toMatchObject({
      status: 'running',
      phase: 'shortBreak',
      durationSeconds: DEFAULT_SHORT_BREAK_MINUTES * 60,
    });
  });
});

describe('tickSession', () => {
  it('finishes work and queues a short break', () => {
    const running = { ...startSession(initialState()), remainingSeconds: 1 };
    const finished = tickSession(running, 1);

    expect(finished).toMatchObject({
      status: 'phaseComplete',
      phase: 'work',
      pendingPhase: 'shortBreak',
      completedPomodorosToday: 1,
      cycleCount: 1,
    });
  });

  it('queues a long break after enough work sessions', () => {
    let state = startSession({ ...initialState(), cycleCount: 3 });
    state = { ...state, remainingSeconds: 1 };
    const finished = tickSession(state, 1);

    expect(finished.pendingPhase).toBe('longBreak');
    expect(finished.cycleCount).toBe(0);
    expect(finished.completedPomodorosToday).toBe(1);
  });

  it('finishes a break and queues work', () => {
    const running = {
      ...startSession(initialState()),
      phase: 'shortBreak' as const,
      durationSeconds: DEFAULT_SHORT_BREAK_MINUTES * 60,
      remainingSeconds: 1,
    };
    const finished = tickSession(running, 1);

    expect(finished).toMatchObject({
      status: 'phaseComplete',
      phase: 'shortBreak',
      pendingPhase: 'work',
    });
  });
});

describe('skipPhase', () => {
  it('moves from work to a break without counting a pomodoro', () => {
    const running = startSession(initialState());
    const skipped = skipPhase(running);

    expect(skipped).toMatchObject({
      status: 'running',
      phase: 'shortBreak',
      completedPomodorosToday: 0,
    });
  });

  it('moves from a break back to work', () => {
    const onBreak = {
      ...startSession(initialState()),
      phase: 'shortBreak' as const,
      durationSeconds: DEFAULT_SHORT_BREAK_MINUTES * 60,
      remainingSeconds: 120,
    };
    const skipped = skipPhase(onBreak);

    expect(skipped).toMatchObject({
      status: 'running',
      phase: 'work',
      durationSeconds: DEFAULT_WORK_MINUTES * 60,
    });
  });
});

describe('stopSession', () => {
  it('returns to idle without counting a pomodoro', () => {
    const running = tickSession({ ...startSession(initialState()), remainingSeconds: 30 }, 0);
    const stopped = stopSession(running);

    expect(stopped).toMatchObject({ status: 'idle', phase: 'work', completedPomodorosToday: 0 });
  });
});

describe('resetSession', () => {
  it('keeps today’s count', () => {
    const state = { ...initialState(4), status: 'running' as const };
    expect(resetSession(state).completedPomodorosToday).toBe(4);
    expect(resetSession(state).status).toBe('idle');
  });
});

describe('pauseSession', () => {
  it('pauses a running session', () => {
    expect(pauseSession(startSession(initialState())).status).toBe('paused');
  });
});
