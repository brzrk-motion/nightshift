/** Seconds-based countdown fields shared by timer plugins. */
export interface CountdownTiming {
  durationSeconds: number;
  remainingSeconds: number;
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

/** Progress through the current interval, from 0 to 1. */
export function sessionProgress(state: CountdownTiming): number {
  if (state.durationSeconds <= 0) return 0;
  return 1 - state.remainingSeconds / state.durationSeconds;
}

/** Pauses when `status` equals `runningStatus`. */
export function pauseIfRunning<T extends { status: string }>(
  state: T,
  runningStatus: T['status'],
  pausedStatus: T['status'],
): T {
  return state.status === runningStatus ? { ...state, status: pausedStatus } : state;
}

/**
 * Ticks a running countdown by `elapsedSeconds`. Calls `onComplete` when
 * remaining reaches zero; no-op when `status` is not `runningStatus`.
 */
export function tickCountdown<T extends CountdownTiming & { status: string }>(
  state: T,
  elapsedSeconds: number,
  runningStatus: T['status'],
  onComplete: (state: T) => T,
): T {
  if (state.status !== runningStatus) return state;

  const remainingSeconds = Math.max(0, state.remainingSeconds - elapsedSeconds);
  if (remainingSeconds > 0) return { ...state, remainingSeconds };

  return onComplete({ ...state, remainingSeconds: 0 });
}
