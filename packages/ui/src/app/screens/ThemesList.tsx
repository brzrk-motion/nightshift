import { useState, type ReactNode } from 'react';
import { useKeyboard } from '@opentui/react';
import { Button } from '../../components/controls.js';
import { Table, type TableColumn } from '../../components/Table.js';
import { EmptyState } from '../../components/States.js';
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
  const contentSize = useShellContentSize(2);
  const [selected, setSelected] = useState(0);

  const selectedIndex = themes.length === 0 ? 0 : Math.min(selected, themes.length - 1);
  const selectedRow = themes[selectedIndex];

  useKeyboard((key) => {
    if (runtime?.keyboardCapture.isCaptured()) return;
    if (key.name === 'up' || key.name === 'k') {
      setSelected((index) => Math.max(0, index - 1));
    } else if (key.name === 'down' || key.name === 'j') {
      setSelected((index) => Math.min(Math.max(0, themes.length - 1), index + 1));
    } else if (key.name === 'return' && selectedRow) {
      void runtime?.commands.run(`theme.activate.${selectedRow.name}`);
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
      </box>

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

        <text fg={runtime.themes.current.colors.muted}>
          ↑↓ move · enter activate · e edit · a add
        </text>
      </box>
    </box>
  );
}
