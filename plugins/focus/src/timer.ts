/**
 * The timer's reducers: pure functions from one `FocusState` to the next.
 * `setup()` wires these to real commands and a real clock; keeping the rules
 * here, with no interval or entity store in sight, is what makes them
 * testable without waiting on a clock.
 */
/** Entity id shared by index/widgets so widgets avoid importing setup(). */
export const FOCUS_ENTITY = 'timer.focus' as const;

export type FocusStatus = 'idle' | 'running' | 'paused' | 'finished';

export interface FocusState {
  status: FocusStatus;
  /** Length of the current session, in seconds. */
  durationSeconds: number;
  /** Seconds left in the current session. */
  remainingSeconds: number;
  /** Sessions completed today. */
  completedToday: number;
  [key: string]: string | number;
}

export const DEFAULT_SESSION_MINUTES = 25;

export function initialState(minutes = DEFAULT_SESSION_MINUTES, completedToday = 0): FocusState {
  const durationSeconds = Math.max(1, Math.round(minutes * 60));
  return {
    status: 'idle',
    durationSeconds,
    remainingSeconds: durationSeconds,
    completedToday,
  };
}

/** Formats seconds as `MM:SS`, or `H:MM:SS` past an hour. */
export function formatDuration(totalSeconds: number): string {
  const seconds = Math.max(0, Math.floor(totalSeconds));
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const rest = seconds % 60;
  const pad = (value: number): string => String(value).padStart(2, '0');
  return hours > 0 ? `${hours}:${pad(minutes)}:${pad(rest)}` : `${pad(minutes)}:${pad(rest)}`;
}

/**
 * Starts a session. Resuming from a pause keeps the time already spent;
 * starting fresh from idle or finished always begins a full session, even if
 * one is already ticking — a second `focus.start` is not a way to restart
 * early, `focus.reset` is.
 */
export function startSession(state: FocusState, minutes?: number): FocusState {
  if (state.status === 'paused') return { ...state, status: 'running' };
  if (state.status === 'running') return state;

  const durationSeconds = Math.max(1, Math.round((minutes ?? DEFAULT_SESSION_MINUTES) * 60));
  return { ...state, status: 'running', durationSeconds, remainingSeconds: durationSeconds };
}

export function pauseSession(state: FocusState): FocusState {
  return state.status === 'running' ? { ...state, status: 'paused' } : state;
}

/** Ends the session early: back to idle, with nothing counted as completed. */
export function stopSession(state: FocusState): FocusState {
  return state.status === 'idle'
    ? state
    : { ...state, status: 'idle', remainingSeconds: state.durationSeconds };
}

/** Returns to a full, default-length session — the "start over" button. */
export function resetSession(state: FocusState): FocusState {
  const durationSeconds = DEFAULT_SESSION_MINUTES * 60;
  return { ...state, status: 'idle', durationSeconds, remainingSeconds: durationSeconds };
}

/**
 * Advances a running session by `elapsedSeconds`. A session that reaches zero
 * finishes and counts toward today's total; anything not running is
 * untouched, so the interval driving this can tick every second regardless of
 * whether a session happens to be active.
 */
export function tickSession(state: FocusState, elapsedSeconds = 1): FocusState {
  if (state.status !== 'running') return state;

  const remainingSeconds = Math.max(0, state.remainingSeconds - elapsedSeconds);
  if (remainingSeconds > 0) return { ...state, remainingSeconds };

  return {
    ...state,
    status: 'finished',
    remainingSeconds: 0,
    completedToday: state.completedToday + 1,
  };
}

/** Progress through the current session, from 0 to 1. */
export function sessionProgress(state: FocusState): number {
  if (state.durationSeconds <= 0) return 0;
  return 1 - state.remainingSeconds / state.durationSeconds;
}

/** A stable per-day key, local time, for keying "sessions completed today". */
export function todayKey(now: Date = new Date()): string {
  const pad = (value: number): string => String(value).padStart(2, '0');
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}
