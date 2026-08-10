import { useEffect, useState, type ReactNode } from 'react';
import { List, Panel, Table, useRuntime, useTheme } from '@nightshift/ui';
import type { WidgetProps } from '@nightshift/sdk';
import type { WidgetDefinition } from './registry.js';

/**
 * The widgets Nightshift itself provides. They are deliberately few: enough to
 * make an empty install useful and to prove the registry works, and no more —
 * everything domain-specific belongs in a plugin.
 */

function pad(value: number): string {
  return String(value).padStart(2, '0');
}

function Clock({ options }: WidgetProps): ReactNode {
  const theme = useTheme();
  const showSeconds = options['seconds'] !== false;
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), showSeconds ? 1000 : 15_000);
    timer.unref?.();
    return () => clearInterval(timer);
  }, [showSeconds]);

  const time = showSeconds
    ? `${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`
    : `${pad(now.getHours())}:${pad(now.getMinutes())}`;

  return (
    <box style={{ flexGrow: 1, alignItems: 'center', justifyContent: 'center' }}>
      <text fg={theme.colors.accent}>
        <b>{time}</b>
      </text>
      <text fg={theme.colors.muted}>
        {now.toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long' })}
      </text>
    </box>
  );
}

function Note({ options }: WidgetProps): ReactNode {
  const theme = useTheme();
  const text = typeof options['text'] === 'string' ? options['text'] : '';
  return <text fg={theme.colors.text}>{text}</text>;
}

interface EntityRow {
  id: string;
  value: string;
  owner: string;
}

function summarise(state: unknown): string {
  if (state === null || state === undefined) return '—';
  if (typeof state !== 'object') return String(state);
  if (Array.isArray(state)) return `${state.length} items`;
  return Object.entries(state)
    .slice(0, 3)
    .map(([key, value]) => `${key}=${typeof value === 'object' ? '…' : String(value)}`)
    .join(' ');
}

function Entities({ width }: WidgetProps): ReactNode {
  const runtime = useRuntime();
  const theme = useTheme();
  const [rows, setRows] = useState<EntityRow[]>([]);

  useEffect(() => {
    const entities = runtime?.entities;
    if (!entities) return;

    const read = (): void =>
      setRows(
        entities.list().map((entity) => ({
          id: entity.id,
          value: summarise(entity.state),
          owner: entity.meta.owner ?? '—',
        })),
      );

    read();
    return entities.subscribeAll(read);
  }, [runtime]);

  if (rows.length === 0) {
    return <text fg={theme.colors.muted}>No plugin has published state yet.</text>;
  }

  return (
    <Table
      width={width - 4}
      columns={[
        { key: 'id', header: 'Entity', span: 2 },
        { key: 'value', header: 'State', span: 3 },
        { key: 'owner', header: 'Plugin' },
      ]}
      rows={rows}
    />
  );
}

function Commands({ width }: WidgetProps): ReactNode {
  const runtime = useRuntime();
  const commands = runtime?.commands.search('').slice(0, Math.max(1, width / 10)) ?? [];

  return (
    <List
      empty="No commands registered."
      items={commands.map((command) => ({ id: command.id, label: command.title }))}
    />
  );
}

/** Drawn in place of a widget whose type nothing has registered. */
export function MissingWidget({ type }: { type: string }): ReactNode {
  const theme = useTheme();
  return (
    <Panel title="Unknown widget">
      <text fg={theme.colors.warning}>{`No widget registered as "${type}".`}</text>
      <text fg={theme.colors.muted}>Is the plugin that provides it installed and enabled?</text>
    </Panel>
  );
}

export const BUILT_IN_WIDGETS: readonly WidgetDefinition[] = [
  {
    type: 'core.clock',
    title: 'Clock',
    entities: [],
    description: 'The time and date. Set `seconds: false` to update once a minute.',
    render: Clock,
  },
  {
    type: 'core.note',
    title: 'Note',
    entities: [],
    description: 'A fixed line of text from the dashboard file, via `text`.',
    render: Note,
  },
  {
    type: 'core.entities',
    title: 'Entities',
    entities: [],
    description: 'Every entity in the store and the plugin that owns it.',
    render: Entities,
  },
  {
    type: 'core.commands',
    title: 'Commands',
    entities: [],
    description: 'What the command palette would offer right now.',
    render: Commands,
  },
];
