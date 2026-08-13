import { useState, type ReactNode } from 'react';
import { ActionBar } from '../../components/ActionBar.js';
import { Button } from '../../components/controls.js';
import { FooterHint } from '../../components/FooterHint.js';
import { Table, type TableColumn } from '../../components/Table.js';
import { EmptyState } from '../../components/States.js';
import { useListKeyboard } from '../../components/useListKeyboard.js';
import { useRuntime } from '../context.js';
import { useShellContentSize } from '../useShellContentSize.js';
import type { VibeCatalogRow } from './vibeDraft.js';

const COLUMNS: readonly TableColumn<VibeCatalogRow>[] = [
  {
    key: 'active',
    header: '',
    render: (row) => (row.active ? '●' : '·'),
  },
  { key: 'title', header: 'Vibe', span: 2 },
  { key: 'theme', header: 'Theme' },
  { key: 'dashboard', header: 'Dashboard' },
  { key: 'source', header: 'Source' },
];

export interface VibesListProps {
  vibes: readonly VibeCatalogRow[];
  onCreate: () => void;
  onEdit: (row: VibeCatalogRow) => void;
  onDelete: (row: VibeCatalogRow) => void;
  onDuplicate: (row: VibeCatalogRow) => void;
}

export function VibesList({
  vibes,
  onCreate,
  onEdit,
  onDelete,
  onDuplicate,
}: VibesListProps): ReactNode {
  const runtime = useRuntime();
  const contentSize = useShellContentSize(2);
  const [selected, setSelected] = useState(0);

  const selectedIndex = vibes.length === 0 ? 0 : Math.min(selected, vibes.length - 1);
  const selectedRow = vibes[selectedIndex];

  useListKeyboard({
    count: vibes.length,
    selectedIndex,
    onSelect: setSelected,
    onActivate: () => {
      if (selectedRow) void runtime?.commands.run(`vibe.activate.${selectedRow.name}`);
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
        <Button label="Add vibe" primary onPress={onCreate} />
        <Button
          label="Edit"
          disabled={selectedRow === undefined}
          onPress={() => {
            if (selectedRow) onEdit(selectedRow);
          }}
        />
        <Button
          label="Activate"
          disabled={selectedRow === undefined}
          onPress={() => {
            if (selectedRow) void runtime.commands.run(`vibe.activate.${selectedRow.name}`);
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
        {vibes.length === 0 ? (
          <EmptyState message="No vibes available." hint="Press Add vibe to create one." />
        ) : (
          <Table
            columns={COLUMNS}
            rows={vibes}
            width={contentSize.width}
            selected={selectedIndex}
            onSelect={setSelected}
          />
        )}

        <FooterHint text="↑↓ move · enter activate · e edit · a add" />
      </box>
    </box>
  );
}
