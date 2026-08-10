import { useEffect, useState, type ReactNode } from 'react';
import type { Json } from '@nightshift/core';
import { List, Table, type TableColumn } from '../components/Table.js';
import { StatRow } from '../components/Primitives.js';
import { EmptyState } from '../components/States.js';
import { useRuntime } from './context.js';
import type { Screen } from './screen.js';

/**
 * The five built-in nav-rail destinations beyond the dashboard. Each one
 * reads only `entities` and `commands` — the two things every `AppRuntime`
 * already has — so this file never has to depend on the vibe engine, the
 * plugin host or the automation engine directly. Where a screen needs data
 * only the CLI's runtime wiring can produce (which plugins are loaded, which
 * vibe is active), it reads it from a well-known entity id and simply shows
 * less if nothing has published one — see `apps/cli/src/runtime.ts`.
 */

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
    .slice(0, 4)
    .map(([key, value]) => `${key}=${typeof value === 'object' ? '…' : String(value)}`)
    .join(' ');
}

const ENTITY_COLUMNS: readonly TableColumn<EntityRow>[] = [
  { key: 'id', header: 'Entity', span: 2 },
  { key: 'value', header: 'State', span: 3 },
  { key: 'owner', header: 'Plugin' },
];

function EntitiesScreen(): ReactNode {
  const runtime = useRuntime();
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

  if (rows.length === 0) return <EmptyState message="No entities registered yet." />;
  return <Table columns={ENTITY_COLUMNS} rows={rows} width={(runtime?.size.width ?? 60) - 20} />;
}

interface PluginRow {
  id: string;
  name: string;
  version: string;
  commands: number;
  widgets: number;
  [key: string]: Json;
}

const PLUGIN_COLUMNS: readonly TableColumn<PluginRow>[] = [
  { key: 'name', header: 'Plugin', span: 2 },
  { key: 'version', header: 'Version', align: 'right' },
  { key: 'commands', header: 'Cmds', align: 'right' },
  { key: 'widgets', header: 'Widgets', align: 'right' },
];

function AppsScreen(): ReactNode {
  const runtime = useRuntime();
  const entity = runtime?.entities.get<{ plugins: PluginRow[]; [key: string]: Json }>(
    'nightshift.plugins',
  );

  if (!runtime) return <EmptyState message="No runtime available." />;
  const plugins = entity?.state.plugins ?? [];
  if (plugins.length === 0) {
    return (
      <EmptyState message="No plugins loaded." hint={'Add one to "plugins" in config.json.'} />
    );
  }
  return <Table columns={PLUGIN_COLUMNS} rows={[...plugins]} width={runtime.size.width - 20} />;
}

const VIBE_PREFIX = 'vibe.activate.';

function VibesScreen(): ReactNode {
  const runtime = useRuntime();
  const active = runtime?.entities.get<{ active: string | null; [key: string]: Json }>(
    'nightshift.vibe',
  )?.state.active;
  const vibeCommands = (runtime?.commands.list() ?? []).filter((command) =>
    command.id.startsWith(VIBE_PREFIX),
  );

  if (vibeCommands.length === 0) {
    return <EmptyState message="No vibes available." />;
  }

  return (
    <List
      items={vibeCommands.map((command) => {
        const name = command.id.slice(VIBE_PREFIX.length);
        return {
          id: command.id,
          label: command.title,
          marker: name === active ? '●' : '·',
          ...(name === active ? { detail: 'active' } : {}),
        };
      })}
      onSelect={(_index, item) => void runtime?.commands.run(item.id)}
    />
  );
}

interface AutomationRow {
  name: string;
  trigger: string;
  enabled: boolean;
  [key: string]: Json;
}

const AUTOMATION_COLUMNS: readonly TableColumn<AutomationRow>[] = [
  { key: 'name', header: 'Automation', span: 2 },
  { key: 'trigger', header: 'Trigger' },
  {
    key: 'enabled',
    header: 'State',
    render: (row) => (row.enabled ? 'enabled' : 'disabled'),
  },
];

function AutomationsScreen(): ReactNode {
  const runtime = useRuntime();
  const entity = runtime?.entities.get<{ automations: AutomationRow[]; [key: string]: Json }>(
    'nightshift.automations',
  );

  if (!runtime) return <EmptyState message="No runtime available." />;
  const automations = entity?.state.automations ?? [];
  if (automations.length === 0) return <EmptyState message="No automations registered." />;
  return (
    <Table columns={AUTOMATION_COLUMNS} rows={[...automations]} width={runtime.size.width - 20} />
  );
}

function SettingsScreen(): ReactNode {
  const runtime = useRuntime();
  if (!runtime) return <EmptyState message="No runtime available." />;

  const themes = runtime.themes.list();
  return (
    <box style={{ flexDirection: 'column', gap: 1 }}>
      <StatRow label="Terminal" value={`${runtime.size.width}×${runtime.size.height}`} />
      <List
        items={themes.map((entry) => ({
          id: entry.name,
          label: entry.name,
          marker: entry.name === runtime.themes.current.name ? '●' : '·',
          ...(entry.name === runtime.themes.current.name ? { detail: 'active' } : {}),
        }))}
        onSelect={(_index, item) => void runtime.commands.run(`theme.activate.${item.id}`)}
      />
    </box>
  );
}

export const DEFAULT_SCREENS: readonly Screen[] = [
  { id: 'vibes', label: 'Vibes', icon: 'vibes', render: VibesScreen },
  { id: 'apps', label: 'Apps', icon: 'apps', render: AppsScreen },
  { id: 'entities', label: 'Entities', icon: 'entities', render: EntitiesScreen },
  { id: 'automations', label: 'Automations', icon: 'automations', render: AutomationsScreen },
  { id: 'settings', label: 'Settings', icon: 'settings', render: SettingsScreen },
];

export { AppsScreen, AutomationsScreen, EntitiesScreen, SettingsScreen, VibesScreen };
