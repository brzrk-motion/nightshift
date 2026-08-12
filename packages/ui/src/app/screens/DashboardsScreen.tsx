import { useState, type ReactNode } from 'react';
import type { Json } from '@nightshift/core';
import { Button } from '../../components/controls.js';
import { Modal } from '../../components/Modal.js';
import { EmptyState } from '../../components/States.js';
import { useEntity, useRuntime, useToasts } from '../context.js';
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

interface DashboardsCatalogState {
  dashboards: DashboardCatalogRow[];
  [key: string]: Json;
}

type View =
  | { kind: 'list' }
  | { kind: 'create'; draft: DashboardDraft }
  | { kind: 'edit'; draft: DashboardDraft };

/**
 * Dashboards catalog and in-screen metadata editor. Reads `nightshift.dashboards`
 * and persists through `dashboard.save` / `dashboard.delete` — never imports
 * the dashboard package or touches the filesystem directly.
 */
export function DashboardsScreen(): ReactNode {
  const runtime = useRuntime();
  const toasts = useToasts();
  const catalog = useEntity<DashboardsCatalogState>('nightshift.dashboards');
  const [view, setView] = useState<View>({ kind: 'list' });
  const [pendingDelete, setPendingDelete] = useState<DashboardCatalogRow | null>(null);
  const [pendingOverride, setPendingOverride] = useState<DashboardDraft | null>(null);

  const dashboards = catalog?.state.dashboards ?? [];

  const saveDraft = (draft: DashboardDraft): void => {
    try {
      const args = draftToSaveArgs(draft);
      void runtime?.commands.run('dashboard.save', args).then(
        () => setView({ kind: 'list' }),
        () => {
          // Failure is already toasted by AppShell's command listener.
        },
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      toasts.push(message, { tone: 'danger' });
    }
  };

  const requestSave = (draft: DashboardDraft): void => {
    const builtIn = dashboards.find(
      (row) => row.name === draft.name.trim() && row.source === 'built-in',
    );
    if (builtIn && view.kind === 'create') {
      setPendingOverride(draft);
      return;
    }
    saveDraft(draft);
  };

  const openDashboard = (row: DashboardCatalogRow): void => {
    void runtime?.commands.run(`dashboard.open.${row.name}`);
    void runtime?.commands.run('nav.dashboard');
  };

  if (!runtime) return <EmptyState message="No runtime available." />;

  if (view.kind === 'create' || view.kind === 'edit') {
    return (
      <box
        style={{
          flexDirection: 'column',
          flexGrow: 1,
          height: '100%',
          paddingLeft: 1,
          paddingRight: 1,
        }}
      >
        <DashboardEditor
          key={view.kind === 'edit' ? `edit-${view.draft.name}` : 'create'}
          draft={view.draft}
          nameLocked={view.kind === 'edit'}
          onCancel={() => setView({ kind: 'list' })}
          onSave={(draft) => requestSave(draft)}
        />
      </box>
    );
  }

  return (
    <>
      <DashboardsList
        dashboards={dashboards}
        onCreate={() => setView({ kind: 'create', draft: emptyDraft() })}
        onEdit={(row) => setView({ kind: 'edit', draft: draftFromCatalog(row) })}
        onDuplicate={(row) => setView({ kind: 'create', draft: duplicateDraft(row) })}
        onDelete={(row) => setPendingDelete(row)}
        onOpen={openDashboard}
      />

      <Modal
        open={pendingDelete !== null}
        title="Delete dashboard?"
        hint="y confirm · esc cancel"
        width={48}
      >
        <box style={{ flexDirection: 'column', gap: 1 }}>
          <text>
            Delete user dashboard “{pendingDelete?.title ?? pendingDelete?.name}”? This removes{' '}
            dashboards/{pendingDelete?.name}.yaml.
          </text>
          <box style={{ flexDirection: 'row', gap: 1 }}>
            <Button
              label="Delete"
              primary
              onPress={() => {
                if (!pendingDelete) return;
                void runtime.commands
                  .run('dashboard.delete', { name: pendingDelete.name })
                  .then(() => setPendingDelete(null));
              }}
            />
            <Button label="Cancel" onPress={() => setPendingDelete(null)} />
          </box>
        </box>
      </Modal>

      <Modal
        open={pendingOverride !== null}
        title="Override built-in?"
        hint="y confirm · esc cancel"
        width={52}
      >
        <box style={{ flexDirection: 'column', gap: 1 }}>
          <text>
            A built-in dashboard named “{pendingOverride?.name}” already exists. Saving will create
            a user file that overrides it.
          </text>
          <box style={{ flexDirection: 'row', gap: 1 }}>
            <Button
              label="Save anyway"
              primary
              onPress={() => {
                if (!pendingOverride) return;
                const draft = pendingOverride;
                setPendingOverride(null);
                saveDraft(draft);
              }}
            />
            <Button label="Cancel" onPress={() => setPendingOverride(null)} />
          </box>
        </box>
      </Modal>
    </>
  );
}
