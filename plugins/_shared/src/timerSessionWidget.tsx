import type { ReactNode } from 'react';
import {
  Button,
  Card,
  ProgressBar,
  StatusBadge,
  useCommands,
  useEntity,
  type BadgeTone,
  type EntityId,
  type Json,
} from '@nightshift/sdk';
import { formatDuration, sessionProgress, type CountdownTiming } from './countdown.js';

export interface TimerSessionCommands {
  start: string;
  pause: string;
  stop: string;
  reset: string;
  skip?: string;
}

export interface TimerSessionBadge {
  label: string;
  tone: BadgeTone;
}

export interface TimerSessionLabels<TState> {
  badges: (state: TState) => TimerSessionBadge[];
  start: (state: TState) => string;
}

export interface TimerSessionWidgetProps<TState extends CountdownTiming & { [key: string]: Json }> {
  width: number;
  entity: EntityId;
  initialState: () => TState;
  commands: TimerSessionCommands;
  labels: TimerSessionLabels<TState>;
}

/** Shared session layout for countdown timer plugins (duration, badges, progress, controls). */
export function TimerSessionWidget<TState extends CountdownTiming & { [key: string]: Json }>({
  width,
  entity,
  initialState,
  commands,
  labels,
}: TimerSessionWidgetProps<TState>): ReactNode {
  const entityState = useEntity<TState>(entity);
  const commandRunner = useCommands();
  const state = entityState?.state ?? initialState();
  const skipCommand = commands.skip;

  return (
    <box style={{ flexDirection: 'column', flexGrow: 1, gap: 1 }}>
      <box style={{ flexDirection: 'row', gap: 2, flexWrap: 'wrap' }}>
        <text>
          <b>{formatDuration(state.remainingSeconds)}</b>
        </text>
        {labels.badges(state).map((badge, index) => (
          <StatusBadge key={index} label={badge.label} tone={badge.tone} />
        ))}
      </box>
      <ProgressBar value={sessionProgress(state)} width={Math.max(10, width - 6)} showPercent />
      <box style={{ flexDirection: 'row', gap: 1, flexWrap: 'wrap' }}>
        <Button
          label={labels.start(state)}
          onPress={() => void commandRunner.run(commands.start)}
        />
        <Button label="Pause" onPress={() => void commandRunner.run(commands.pause)} />
        {skipCommand !== undefined ? (
          <Button label="Skip" onPress={() => void commandRunner.run(skipCommand)} />
        ) : null}
        <Button label="Stop" onPress={() => void commandRunner.run(commands.stop)} />
        <Button label="Reset" onPress={() => void commandRunner.run(commands.reset)} />
      </box>
    </box>
  );
}

export interface TimerTodayLabels {
  singular: string;
  plural: string;
}

export interface TimerTodayWidgetProps<TState extends { [key: string]: Json }> {
  entity: EntityId;
  getCompletedCount: (state: TState) => number;
  labels: TimerTodayLabels;
}

/** Shared today counter card for timer plugins. */
export function TimerTodayWidget<TState extends { [key: string]: Json }>({
  entity,
  getCompletedCount,
  labels,
}: TimerTodayWidgetProps<TState>): ReactNode {
  const entityState = useEntity<TState>(entity);
  const completed = entityState?.state !== undefined ? getCompletedCount(entityState.state) : 0;

  return (
    <Card
      value={String(completed)}
      subtitle={completed === 1 ? labels.singular : labels.plural}
      tone={completed > 0 ? 'success' : 'default'}
    />
  );
}
