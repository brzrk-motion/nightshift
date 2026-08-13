import { useState, type ReactNode } from 'react';
import { ActionBar } from '../../components/ActionBar.js';
import { Button } from '../../components/controls.js';
import { FooterHint } from '../../components/FooterHint.js';
import { Table, type TableColumn } from '../../components/Table.js';
import { EmptyState } from '../../components/States.js';
import { useListKeyboard } from '../../components/useListKeyboard.js';
import { useRuntime } from '../context.js';
import { useShellContentSize } from '../useShellContentSize.js';
import type { ThemeCatalogRow } from './themeDraft.js';

const COLUMNS: readonly TableColumn<ThemeCatalogRow>[] = [
  {
    key: 'active',
    header: '',
    render: (row) => (row.active ? '●' : '·'),
  },
  { key: 'name', header: 'Name', span: 2 },
  { key: 'appearance', header: 'Look' },
  { key: 'source', header: 'Source' },
];

export interface ThemesListProps {
  themes: readonly ThemeCatalogRow[];
  onCreate: () => void;
  onEdit: (row: ThemeCatalogRow) => void;
  onDelete: (row: ThemeCatalogRow) => void;
  onDuplicate: (row: ThemeCatalogRow) => void;
}

export function ThemesList({
  themes,
  onCreate,
  onEdit,
  onDelete,
  onDuplicate,
}: ThemesListProps): ReactNode {
  const runtime = useRuntime();
  // Inset matches former list body padding (nav + screen gutter).
  const contentSize = useShellContentSize(2);
  const [selected, setSelected] = useState(0);

  const selectedIndex = themes.length === 0 ? 0 : Math.min(selected, themes.length - 1);
  const selectedRow = themes[selectedIndex];

  useListKeyboard({
    count: themes.length,
    selectedIndex,
    onSelect: setSelected,
    onActivate: () => {
      if (selectedRow) void runtime?.commands.run(`theme.activate.${selectedRow.name}`);
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
        <Button label="Add theme" primary onPress={onCreate} />
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
            if (selectedRow) void runtime.commands.run(`theme.activate.${selectedRow.name}`);
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

      <box style={{ flexDirection: 'column', gap: 1, flexGrow: 1, paddingLeft: 1, paddingRight: 1 }}>
        {themes.length === 0 ? (
          <EmptyState message="No themes available." hint="Press Add theme to create one." />
        ) : (
          <Table
            columns={COLUMNS}
            rows={themes}
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
