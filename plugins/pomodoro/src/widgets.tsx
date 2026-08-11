import type { ReactNode } from 'react';
import {
  Button,
  Card,
  ProgressBar,
  StatusBadge,
  useCommands,
  useEntity,
  type BadgeTone,
  type WidgetProps,
} from '@nightshift/sdk';
import { POMODORO_ENTITY } from './entity.js';
import {
  formatDuration,
  initialState,
  phaseLabel,
  sessionProgress,
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

export function SessionWidget({ width }: WidgetProps): ReactNode {
  const entity = useEntity<PomodoroState>(POMODORO_ENTITY);
  const commands = useCommands();
  const state = entity?.state ?? initialState();
  const starting = state.status === 'phaseComplete';

  return (
    <box style={{ flexDirection: 'column', flexGrow: 1, gap: 1 }}>
      <box style={{ flexDirection: 'row', gap: 2, flexWrap: 'wrap' }}>
        <text>
          <b>{formatDuration(state.remainingSeconds)}</b>
        </text>
        <StatusBadge label={headline(state)} tone={PHASE_TONE[state.phase]} />
        <StatusBadge label={state.status} tone={STATUS_TONE[state.status]} />
      </box>
      <ProgressBar value={sessionProgress(state)} width={Math.max(10, width - 6)} showPercent />
      <box style={{ flexDirection: 'row', gap: 1, flexWrap: 'wrap' }}>
        <Button
          label={state.status === 'paused' ? 'Resume' : starting ? 'Continue' : 'Start'}
          onPress={() => void commands.run('pomodoro.start')}
        />
        <Button label="Pause" onPress={() => void commands.run('pomodoro.pause')} />
        <Button label="Skip" onPress={() => void commands.run('pomodoro.skip')} />
        <Button label="Stop" onPress={() => void commands.run('pomodoro.stop')} />
        <Button label="Reset" onPress={() => void commands.run('pomodoro.reset')} />
      </box>
    </box>
  );
}

export function TodayWidget(_props: WidgetProps): ReactNode {
  const entity = useEntity<PomodoroState>(POMODORO_ENTITY);
  const completed = entity?.state.completedPomodorosToday ?? 0;

  return (
    <Card
      value={String(completed)}
      subtitle={completed === 1 ? 'pomodoro completed' : 'pomodoros completed'}
      tone={completed > 0 ? 'success' : 'default'}
    />
  );
}
