import {
  formatDuration,
  pauseIfRunning,
  sessionProgress,
  tickCountdown,
  todayKey,
} from '@nightshift/plugin-shared';

/**
 * Pomodoro reducers: work → short/long break → work cycles. Pure functions
 * with no interval or entity store — the same testable split other timer
 * plugins use. The entity id lives here too so widgets can import it without
 * pulling in `setup()`.
 */
export const POMODORO_ENTITY = 'pomodoro.session' as const;

export { formatDuration, sessionProgress, todayKey };

export type PomodoroPhase = 'work' | 'shortBreak' | 'longBreak';
export type PomodoroStatus = 'idle' | 'running' | 'paused' | 'phaseComplete';

export interface PomodoroState {
  status: PomodoroStatus;
  /** The phase currently in progress, or the one that just finished. */
  phase: PomodoroPhase;
  /** When status is `phaseComplete`, the phase that starts on the next start. */
  pendingPhase: PomodoroPhase | null;
  durationSeconds: number;
  remainingSeconds: number;
  completedPomodorosToday: number;
  /** Work sessions since the last long break. */
  cycleCount: number;
  workMinutes: number;
  shortBreakMinutes: number;
  longBreakMinutes: number;
  pomodorosPerLongBreak: number;
  [key: string]: string | number | null;
}

export const DEFAULT_WORK_MINUTES = 25;
export const DEFAULT_SHORT_BREAK_MINUTES = 5;
export const DEFAULT_LONG_BREAK_MINUTES = 15;
export const DEFAULT_POMODOROS_PER_LONG_BREAK = 4;

export function initialState(completedPomodorosToday = 0, cycleCount = 0): PomodoroState {
  const durationSeconds = DEFAULT_WORK_MINUTES * 60;
  return {
    status: 'idle',
    phase: 'work',
    pendingPhase: null,
    durationSeconds,
    remainingSeconds: durationSeconds,
    completedPomodorosToday,
    cycleCount,
    workMinutes: DEFAULT_WORK_MINUTES,
    shortBreakMinutes: DEFAULT_SHORT_BREAK_MINUTES,
    longBreakMinutes: DEFAULT_LONG_BREAK_MINUTES,
    pomodorosPerLongBreak: DEFAULT_POMODOROS_PER_LONG_BREAK,
  };
}

export function phaseLabel(phase: PomodoroPhase): string {
  switch (phase) {
    case 'work':
      return 'Focus';
    case 'shortBreak':
      return 'Short break';
    case 'longBreak':
      return 'Long break';
  }
}

export function phaseDurationSeconds(state: PomodoroState, phase: PomodoroPhase): number {
  const minutes =
    phase === 'work'
      ? state.workMinutes
      : phase === 'shortBreak'
        ? state.shortBreakMinutes
        : state.longBreakMinutes;
  return Math.max(1, Math.round(minutes * 60));
}

function breakPhaseAfterWork(state: PomodoroState): PomodoroPhase {
  const nextCount = state.cycleCount + 1;
  return nextCount >= state.pomodorosPerLongBreak ? 'longBreak' : 'shortBreak';
}

function beginPhase(state: PomodoroState, phase: PomodoroPhase, running: boolean): PomodoroState {
  const durationSeconds = phaseDurationSeconds(state, phase);
  return {
    ...state,
    status: running ? 'running' : state.status,
    phase,
    pendingPhase: null,
    durationSeconds,
    remainingSeconds: durationSeconds,
  };
}

export function startSession(state: PomodoroState): PomodoroState {
  if (state.status === 'paused') return { ...state, status: 'running' };
  if (state.status === 'running') return state;

  if (state.status === 'phaseComplete' && state.pendingPhase !== null) {
    return beginPhase(state, state.pendingPhase, true);
  }

  return beginPhase(state, 'work', true);
}

export function pauseSession(state: PomodoroState): PomodoroState {
  return pauseIfRunning(state, 'running', 'paused');
}

/** Ends the current phase early and returns to idle at a fresh work interval. */
export function stopSession(state: PomodoroState): PomodoroState {
  if (state.status === 'idle') return state;
  const durationSeconds = phaseDurationSeconds(state, 'work');
  return {
    ...state,
    status: 'idle',
    phase: 'work',
    pendingPhase: null,
    durationSeconds,
    remainingSeconds: durationSeconds,
  };
}

/** Returns to idle with default phase lengths; keeps today's count. */
export function resetSession(state: PomodoroState): PomodoroState {
  return initialState(state.completedPomodorosToday, 0);
}

/**
 * Skip the rest of the current phase and move to the next one without
 * counting a completed pomodoro when leaving work early.
 */
export function skipPhase(state: PomodoroState): PomodoroState {
  if (state.status === 'idle' || state.status === 'phaseComplete') return state;

  if (state.phase === 'work') {
    return beginPhase(state, breakPhaseAfterWork(state), true);
  }

  return beginPhase(state, 'work', true);
}

function completePhase(state: PomodoroState): PomodoroState {
  if (state.phase === 'work') {
    const cycleCount = state.cycleCount + 1;
    const longBreak = cycleCount >= state.pomodorosPerLongBreak;
    return {
      ...state,
      status: 'phaseComplete',
      pendingPhase: longBreak ? 'longBreak' : 'shortBreak',
      completedPomodorosToday: state.completedPomodorosToday + 1,
      cycleCount: longBreak ? 0 : cycleCount,
      remainingSeconds: 0,
    };
  }

  return {
    ...state,
    status: 'phaseComplete',
    pendingPhase: 'work',
    remainingSeconds: 0,
  };
}

export function tickSession(state: PomodoroState, elapsedSeconds = 1): PomodoroState {
  return tickCountdown(state, elapsedSeconds, 'running', completePhase);
}
