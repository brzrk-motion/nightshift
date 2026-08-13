import { type ReactNode } from 'react';
import { type TableColumn } from '../../components/Table.js';
import { CatalogList } from './CatalogList.js';
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
  return (
    <CatalogList
      rows={themes}
      columns={COLUMNS}
      itemNoun="theme"
      activateCommandPrefix="theme.activate"
      onCreate={onCreate}
      onEdit={onEdit}
      onDelete={onDelete}
      onDuplicate={onDuplicate}
    />
  );
}
