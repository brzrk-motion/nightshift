import { useEffect, useState, type ReactNode } from 'react';
import { Table, type TableColumn } from '../../components/Table.js';
import { EmptyState } from '../../components/States.js';
import { useRuntime } from '../context.js';
import { useShellContentSize } from '../useShellContentSize.js';

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

export function EntitiesScreen(): ReactNode {
  const runtime = useRuntime();
  const contentSize = useShellContentSize();
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
  return <Table columns={ENTITY_COLUMNS} rows={rows} width={contentSize.width} />;
}
