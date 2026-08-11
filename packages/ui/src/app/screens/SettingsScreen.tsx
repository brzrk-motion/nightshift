import type { ReactNode } from 'react';
import { List } from '../../components/Table.js';
import { StatRow } from '../../components/Primitives.js';
import { EmptyState } from '../../components/States.js';
import { useRuntime } from '../context.js';

export function SettingsScreen(): ReactNode {
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
