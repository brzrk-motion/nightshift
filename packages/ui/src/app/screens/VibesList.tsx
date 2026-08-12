import { useState, type ReactNode } from 'react';
import { useKeyboard } from '@opentui/react';
import { Button } from '../../components/controls.js';
import { Modal } from '../../components/Modal.js';
import { Table, type TableColumn } from '../../components/Table.js';
import { EmptyState } from '../../components/States.js';
import { useRuntime } from '../context.js';
import { useShellContentSize } from '../useShellContentSize.js';
import {
  draftFromCatalog,
  duplicateDraft,
  emptyDraft,
  type VibeCatalogRow,
} from './vibeDraft.js';

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

  useKeyboard((key) => {
    if (runtime?.keyboardCapture.isCaptured()) return;
    if (key.name === 'up' || key.name === 'k') {
      setSelected((index) => Math.max(0, index - 1));
    } else if (key.name === 'down' || key.name === 'j') {
      setSelected((index) => Math.min(Math.max(0, vibes.length - 1), index + 1));
    } else if (key.name === 'return' && selectedRow) {
      void runtime?.commands.run(`vibe.activate.${selectedRow.name}`);
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
      </box>

      <box style={{ flexDirection: 'column', gap: 1, flexGrow: 1, paddingLeft: 1, paddingRight: 1 }}>
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

        <text fg={runtime.themes.current.colors.muted}>
          ↑↓ move · enter activate · e edit · a add
        </text>
      </box>
    </box>
  );
}
