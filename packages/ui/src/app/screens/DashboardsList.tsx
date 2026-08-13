import { type ReactNode } from 'react';
import { type TableColumn } from '../../components/Table.js';
import { CatalogList } from './CatalogList.js';
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
  return (
    <CatalogList
      rows={dashboards}
      columns={COLUMNS}
      itemNoun="dashboard"
      onActivate={onOpen}
      primaryActionLabel="Open"
      enterKeyHint="open"
      onCreate={onCreate}
      onEdit={onEdit}
      onDelete={onDelete}
      onDuplicate={onDuplicate}
    />
  );
}
