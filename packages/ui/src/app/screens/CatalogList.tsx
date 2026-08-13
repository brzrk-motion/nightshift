import { useState, type ReactNode } from 'react';
import { ActionBar } from '../../components/ActionBar.js';
import { Button } from '../../components/controls.js';
import { FooterHint } from '../../components/FooterHint.js';
import { Table, type TableColumn } from '../../components/Table.js';
import { EmptyState } from '../../components/States.js';
import { useListKeyboard } from '../../components/useListKeyboard.js';
import { useRuntime } from '../context.js';
import { useShellContentSize } from '../useShellContentSize.js';

export interface CatalogRowBase {
  name: string;
  source: 'built-in' | 'user';
}

export interface CatalogListProps<T extends CatalogRowBase> {
  rows: readonly T[];
  columns: readonly TableColumn<T>[];
  /** Singular label, e.g. "vibe", "theme", "dashboard". */
  itemNoun: string;
  /** When set, primary action runs `runtime.commands.run(\`${prefix}.${row.name}\`)`. */
  activateCommandPrefix?: string;
  /** When set (and no command prefix), primary action calls this callback. */
  onActivate?: (row: T) => void;
  /** Primary toolbar button label. Defaults to "Activate". */
  primaryActionLabel?: string;
  /** Footer hint verb after "enter". Defaults to "activate". */
  enterKeyHint?: string;
  onCreate: () => void;
  onEdit: (row: T) => void;
  onDelete: (row: T) => void;
  onDuplicate: (row: T) => void;
}

export function CatalogList<T extends CatalogRowBase>({
  rows,
  columns,
  itemNoun,
  activateCommandPrefix,
  onActivate,
  primaryActionLabel = 'Activate',
  enterKeyHint = 'activate',
  onCreate,
  onEdit,
  onDelete,
  onDuplicate,
}: CatalogListProps<T>): ReactNode {
  const runtime = useRuntime();
  const contentSize = useShellContentSize(2);
  const [selected, setSelected] = useState(0);

  const selectedIndex = rows.length === 0 ? 0 : Math.min(selected, rows.length - 1);
  const selectedRow = rows[selectedIndex];

  const runPrimaryAction = (row: T): void => {
    if (activateCommandPrefix) {
      void runtime?.commands.run(`${activateCommandPrefix}.${row.name}`);
      return;
    }
    onActivate?.(row);
  };

  useListKeyboard({
    count: rows.length,
    selectedIndex,
    onSelect: setSelected,
    onActivate: () => {
      if (selectedRow) runPrimaryAction(selectedRow);
    },
    onEdit: () => {
      if (selectedRow) onEdit(selectedRow);
    },
    onAdd: onCreate,
  });

  if (!runtime) return <EmptyState message="No runtime available." />;

  const itemNounPlural = `${itemNoun}s`;
  const addLabel = `Add ${itemNoun}`;

  return (
    <box style={{ flexDirection: 'column', flexGrow: 1 }}>
      <ActionBar variant="toolbar">
        <Button label={addLabel} primary onPress={onCreate} />
        <Button
          label="Edit"
          disabled={selectedRow === undefined}
          onPress={() => {
            if (selectedRow) onEdit(selectedRow);
          }}
        />
        <Button
          label={primaryActionLabel}
          disabled={selectedRow === undefined}
          onPress={() => {
            if (selectedRow) runPrimaryAction(selectedRow);
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
        {rows.length === 0 ? (
          <EmptyState
            message={`No ${itemNounPlural} available.`}
            hint={`Press ${addLabel} to create one.`}
          />
        ) : (
          <Table
            columns={columns}
            rows={rows}
            width={contentSize.width}
            selected={selectedIndex}
            onSelect={setSelected}
          />
        )}

        <FooterHint text={`↑↓ move · enter ${enterKeyHint} · e edit · a add`} />
      </box>
    </box>
  );
}
