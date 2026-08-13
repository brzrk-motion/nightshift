import { useState, type ReactNode } from 'react';
import { ActionBar } from '../../components/ActionBar.js';
import { Button } from '../../components/controls.js';
import { FooterHint } from '../../components/FooterHint.js';
import { Table, type TableColumn } from '../../components/Table.js';
import { EmptyState } from '../../components/States.js';
import { useListKeyboard } from '../../components/useListKeyboard.js';
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

  const selectedIndex = dashboards.length === 0 ? 0 : Math.min(selected, dashboards.length - 1);
  const selectedRow = dashboards[selectedIndex];

  useListKeyboard({
    count: dashboards.length,
    selectedIndex,
    onSelect: setSelected,
    onActivate: () => {
      if (selectedRow) onOpen(selectedRow);
    },
    onEdit: () => {
      if (selectedRow) onEdit(selectedRow);
    },
    onAdd: onCreate,
  });

  if (!runtime) return <EmptyState message="No runtime available." />;

  return (
    <box style={{ flexDirection: 'column', flexGrow: 1 }}>
      <ActionBar variant="toolbar">
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
      </ActionBar>

      <box
        style={{ flexDirection: 'column', gap: 1, flexGrow: 1, paddingLeft: 1, paddingRight: 1 }}
      >
        {dashboards.length === 0 ? (
          <EmptyState
            message="No dashboards available."
            hint="Press Add dashboard to create one."
          />
        ) : (
          <Table
            columns={COLUMNS}
            rows={dashboards}
            width={contentSize.width}
            selected={selectedIndex}
            onSelect={setSelected}
          />
        )}

        <FooterHint text="↑↓ move · enter open · e edit · a add" />
      </box>
    </box>
  );
}
