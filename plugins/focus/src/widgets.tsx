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
import { FOCUS_ENTITY } from './entity.js';
import {
  formatDuration,
  initialState,
  sessionProgress,
  type FocusState,
  type FocusStatus,
} from './timer.js';

const STATUS_TONE: Record<FocusStatus, BadgeTone> = {
  idle: 'neutral',
  running: 'accent',
  paused: 'warning',
  finished: 'success',
};

/**
 * The session widget: the clock, the state, the controls. Every button just
 * runs the command a keybinding or the palette would run — the widget has no
 * logic of its own beyond reading the entity and asking for a redraw.
 */
export function SessionWidget({ width }: WidgetProps): ReactNode {
  const entity = useEntity<FocusState>(FOCUS_ENTITY);
  const commands = useCommands();
  const state = entity?.state ?? initialState();

  return (
    <box style={{ flexDirection: 'column', flexGrow: 1, gap: 1 }}>
      <box style={{ flexDirection: 'row', gap: 2 }}>
        <text>
          <b>{formatDuration(state.remainingSeconds)}</b>
        </text>
        <StatusBadge label={state.status} tone={STATUS_TONE[state.status]} />
      </box>
      <ProgressBar value={sessionProgress(state)} width={Math.max(10, width - 6)} showPercent />
      <box style={{ flexDirection: 'row', gap: 1 }}>
        <Button
          label={state.status === 'paused' ? 'Resume' : 'Start'}
          onPress={() => void commands.run('focus.start')}
        />
        <Button label="Pause" onPress={() => void commands.run('focus.pause')} />
        <Button label="Stop" onPress={() => void commands.run('focus.stop')} />
        <Button label="Reset" onPress={() => void commands.run('focus.reset')} />
      </box>
    </box>
  );
}

/** Today's total: a glance at how the day is going, not the live session. */
export function TodayWidget(_props: WidgetProps): ReactNode {
  const entity = useEntity<FocusState>(FOCUS_ENTITY);
  const completed = entity?.state.completedToday ?? 0;

  return (
    <Card
      value={String(completed)}
      subtitle={completed === 1 ? 'session completed' : 'sessions completed'}
      tone={completed > 0 ? 'success' : 'default'}
    />
  );
}
