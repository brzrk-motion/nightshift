import { useState, type ReactNode } from 'react';
import { useKeyboard } from '@opentui/react';
import { Button } from '../../components/controls.js';
import { Table, type TableColumn } from '../../components/Table.js';
import { EmptyState } from '../../components/States.js';
import { useRuntime } from '../context.js';
import { useShellContentSize } from '../useShellContentSize.js';
import type { DashboardCatalogRow } from './dashboardDraft.js';

const COLUMNS: readonly TableColumn<DashboardCatalogRow>[] = [
  {
    key: 'active',
    header: '',
    render: (row) => (row.active ? '●' : '·'),
  },
  { key: 'title', header: 'Dashboard', span: 2 },
  { key: 'name', header: 'Name' },
  { key: 'source', header: 'Source' },
];

export interface DashboardsListProps {
  dashboards: readonly DashboardCatalogRow[];
  onCreate: () => void;
  onEdit: (row: DashboardCatalogRow) => void;
  onOpen: (row: DashboardCatalogRow) => void;
  onDelete: (row: DashboardCatalogRow) => void;
  onDuplicate: (row: DashboardCatalogRow) => void;
}

export function DashboardsList({
  dashboards,
  onCreate,
  onEdit,
  onOpen,
  onDelete,
  onDuplicate,
}: DashboardsListProps): ReactNode {
  const runtime = useRuntime();
  const contentSize = useShellContentSize(2);
  const [selected, setSelected] = useState(0);

  const selectedIndex =
    dashboards.length === 0 ? 0 : Math.min(selected, dashboards.length - 1);
  const selectedRow = dashboards[selectedIndex];

  useKeyboard((key) => {
    if (runtime?.keyboardCapture.isCaptured()) return;
    if (key.name === 'up' || key.name === 'k') {
      setSelected((index) => Math.max(0, index - 1));
    } else if (key.name === 'down' || key.name === 'j') {
      setSelected((index) => Math.min(Math.max(0, dashboards.length - 1), index + 1));
    } else if (key.name === 'return' && selectedRow) {
      onOpen(selectedRow);
    } else if (key.name === 'e' && selectedRow) {
      onEdit(selectedRow);
    } else if (key.name === 'a' && !key.ctrl && !key.meta) {
      onCreate();
    }
  });

  if (!runtime) return <EmptyState message="No runtime available." />;

  return (
    <box style={{ flexDirection: 'column', flexGrow: 1 }}>
      <box
        style={{
          flexDirection: 'row',
          gap: 1,
          flexShrink: 0,
          width: '100%',
          paddingLeft: 1,
          paddingRight: 1,
          backgroundColor: runtime.themes.current.colors.surface,
          alignItems: 'center',
        }}
      >
        <Button label="Add dashboard" primary onPress={onCreate} />
        <Button
          label="Edit"
          disabled={selectedRow === undefined}
          onPress={() => {
            if (selectedRow) onEdit(selectedRow);
          }}
        />
        <Button
          label="Open"
          disabled={selectedRow === undefined}
          onPress={() => {
            if (selectedRow) onOpen(selectedRow);
          }}
        />
        <Button
          label="Duplicate"
          disabled={selectedRow === undefined}
          onPress={() => {
            if (selectedRow) onDuplicate(selectedRow);
          }}
        />
        <Button
          label="Delete"
          disabled={selectedRow === undefined || selectedRow.source === 'built-in'}
          onPress={() => {
            if (selectedRow) onDelete(selectedRow);
          }}
        />
      </box>

      <box style={{ flexDirection: 'column', gap: 1, flexGrow: 1, paddingLeft: 1, paddingRight: 1 }}>
        {dashboards.length === 0 ? (
          <EmptyState message="No dashboards available." hint="Press Add dashboard to create one." />
        ) : (
          <Table
            columns={COLUMNS}
            rows={dashboards}
            width={contentSize.width}
            selected={selectedIndex}
            onSelect={setSelected}
          />
        )}

        <text fg={runtime.themes.current.colors.muted}>
          ↑↓ move · enter open · e edit · a add
        </text>
      </box>
    </box>
  );
}
