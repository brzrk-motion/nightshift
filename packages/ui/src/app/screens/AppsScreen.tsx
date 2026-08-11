import type { ReactNode } from 'react';
import type { Json } from '@nightshift/core';
import { Table, type TableColumn } from '../../components/Table.js';
import { EmptyState } from '../../components/States.js';
import { useRuntime } from '../context.js';

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

export function AppsScreen(): ReactNode {
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
