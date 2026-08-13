import { type ReactNode } from 'react';
import { type TableColumn } from '../../components/Table.js';
import { CatalogList } from './CatalogList.js';
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
  return (
    <CatalogList
      rows={vibes}
      columns={COLUMNS}
      itemNoun="vibe"
      activateCommandPrefix="vibe.activate"
      onCreate={onCreate}
      onEdit={onEdit}
      onDelete={onDelete}
      onDuplicate={onDuplicate}
    />
  );
}
