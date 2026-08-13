import { type ReactNode } from 'react';
import { useRuntime } from '../context.js';
import { CatalogScreen } from './CatalogScreen.js';
import { DashboardEditor } from './DashboardEditor.js';
import { DashboardsList } from './DashboardsList.js';
import {
  draftFromCatalog,
  draftToSaveArgs,
  duplicateDraft,
  emptyDraft,
  type DashboardCatalogRow,
  type DashboardDraft,
} from './dashboardDraft.js';

/**
 * Dashboards catalog and in-screen metadata editor. Reads `nightshift.dashboards`
 * and persists through `dashboard.save` / `dashboard.delete` — never imports
 * the dashboard package or touches the filesystem directly.
 */
export function DashboardsScreen(): ReactNode {
  const runtime = useRuntime();

  const openDashboard = (row: DashboardCatalogRow): void => {
    void runtime?.commands.run(`dashboard.open.${row.name}`);
    void runtime?.commands.run('nav.dashboard');
  };

  return (
    <CatalogScreen<DashboardDraft, DashboardCatalogRow>
      entityId="nightshift.dashboards"
      itemsKey="dashboards"
      saveCommand="dashboard.save"
      deleteCommand="dashboard.delete"
      resourceLabel="dashboard"
      resourceFolder="dashboards"
      emptyDraft={emptyDraft}
      draftFromCatalog={draftFromCatalog}
      duplicateDraft={duplicateDraft}
      draftToSaveArgs={draftToSaveArgs}
      getRowDisplayName={(row) => row.title ?? row.name}
      Editor={DashboardEditor}
      List={(props) => (
        <DashboardsList
          dashboards={props.rows}
          onCreate={props.onCreate}
          onEdit={props.onEdit}
          onDuplicate={props.onDuplicate}
          onDelete={props.onDelete}
          onOpen={openDashboard}
        />
      )}
    />
  );
}
