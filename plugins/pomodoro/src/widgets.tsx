import type { ReactNode } from 'react';
import {
  TimerSessionWidget,
  TimerTodayWidget,
  type TimerSessionLabels,
} from '@nightshift/plugin-shared';
import { type BadgeTone, type WidgetProps } from '@nightshift/sdk';
import {
  POMODORO_ENTITY,
  initialState,
  phaseLabel,
  type PomodoroPhase,
  type PomodoroState,
  type PomodoroStatus,
} from './timer.js';

const STATUS_TONE: Record<PomodoroStatus, BadgeTone> = {
  idle: 'neutral',
  running: 'accent',
  paused: 'warning',
  phaseComplete: 'success',
};

const PHASE_TONE: Record<PomodoroPhase, BadgeTone> = {
  work: 'accent',
  shortBreak: 'success',
  longBreak: 'success',
};

function headline(state: PomodoroState): string {
  if (state.status === 'phaseComplete' && state.pendingPhase !== null) {
    return `Up next: ${phaseLabel(state.pendingPhase)}`;
  }
  return phaseLabel(state.phase);
}

const SESSION_LABELS: TimerSessionLabels<PomodoroState> = {
  badges: (state) => [
    { label: headline(state), tone: PHASE_TONE[state.phase] },
    { label: state.status, tone: STATUS_TONE[state.status] },
  ],
  start: (state) =>
    state.status === 'paused' ? 'Resume' : state.status === 'phaseComplete' ? 'Continue' : 'Start',
};

export function SessionWidget({ width }: WidgetProps): ReactNode {
  return (
    <TimerSessionWidget
      width={width}
      entity={POMODORO_ENTITY}
      initialState={initialState}
      commands={{
        start: 'pomodoro.start',
        pause: 'pomodoro.pause',
        skip: 'pomodoro.skip',
        stop: 'pomodoro.stop',
        reset: 'pomodoro.reset',
      }}
      labels={SESSION_LABELS}
    />
  );
}

export function TodayWidget(_props: WidgetProps): ReactNode {
  return (
    <TimerTodayWidget<PomodoroState>
      entity={POMODORO_ENTITY}
      getCompletedCount={(state) => state.completedPomodorosToday}
      labels={{ singular: 'pomodoro completed', plural: 'pomodoros completed' }}
    />
  );
}
