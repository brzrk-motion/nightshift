import { useState, type ReactNode } from 'react';
import type { Json } from '@nightshift/core';
import type { EntityId } from '@nightshift/entities';
import { ConfirmModal } from '../../components/ConfirmModal.js';
import { EmptyState } from '../../components/States.js';
import { useEntity, useRuntime, useToasts } from '../context.js';

/** Shared catalog row shape — vibes, themes, and dashboards all publish these fields. */
export interface CatalogRow {
  name: string;
  source: 'built-in' | 'user';
  [key: string]: Json;
}

/** Shared draft shape — every catalog editor names its resource. */
export interface CatalogDraft {
  name: string;
}

export interface CatalogEditorProps<TDraft extends CatalogDraft> {
  key?: string;
  draft: TDraft;
  nameLocked: boolean;
  onCancel: () => void;
  onSave: (draft: TDraft) => void;
}

export interface CatalogListProps<TRow extends CatalogRow> {
  rows: readonly TRow[];
  onCreate: () => void;
  onEdit: (row: TRow) => void;
  onDuplicate: (row: TRow) => void;
  onDelete: (row: TRow) => void;
  onOpen?: (row: TRow) => void;
}

export interface CatalogScreenConfig<TDraft extends CatalogDraft, TRow extends CatalogRow> {
  entityId: EntityId;
  /** Key on the catalog entity state object, e.g. `vibes`, `themes`, `dashboards`. */
  itemsKey: string;
  saveCommand: string;
  deleteCommand: string;
  /** Singular label for modals, e.g. `vibe`, `theme`, `dashboard`. */
  resourceLabel: string;
  /** Config folder name for delete hint, e.g. `vibes`, `themes`, `dashboards`. */
  resourceFolder: string;
  emptyDraft: () => TDraft;
  draftFromCatalog: (row: TRow) => TDraft;
  duplicateDraft: (row: TRow) => TDraft;
  draftToSaveArgs: (draft: TDraft) => Record<string, Json>;
  /** Display name for delete confirmation — defaults to `row.name`. */
  getRowDisplayName?: (row: TRow) => string;
  Editor: (props: CatalogEditorProps<TDraft>) => ReactNode;
  /**
   * List body. Invoked as a function (not `<List />`) so an inline arrow from a
   * wrapper does not remount the list on every parent re-render.
   */
  List: (props: CatalogListProps<TRow>) => ReactNode;
}

type View<TDraft extends CatalogDraft> =
  { kind: 'list' } | { kind: 'create'; draft: TDraft } | { kind: 'edit'; draft: TDraft };

/**
 * Shared list ↔ create/edit shell for vibes, themes, and dashboards. Reads a
 * catalog entity for the list and persists through injected save/delete commands.
 */
export function CatalogScreen<TDraft extends CatalogDraft, TRow extends CatalogRow>(
  config: CatalogScreenConfig<TDraft, TRow>,
): ReactNode {
  const {
    entityId,
    itemsKey,
    saveCommand,
    deleteCommand,
    resourceLabel,
    resourceFolder,
    emptyDraft,
    draftFromCatalog,
    duplicateDraft,
    draftToSaveArgs,
    getRowDisplayName = (row) => row.name,
    Editor,
    List,
  } = config;

  const runtime = useRuntime();
  const toasts = useToasts();
  const catalog = useEntity<Record<string, Json>>(entityId);
  const [view, setView] = useState<View<TDraft>>({ kind: 'list' });
  const [pendingDelete, setPendingDelete] = useState<TRow | null>(null);
  const [pendingOverride, setPendingOverride] = useState<TDraft | null>(null);

  const items = (catalog?.state[itemsKey] as readonly TRow[] | undefined) ?? [];

  const saveDraft = (draft: TDraft): void => {
    try {
      const args = draftToSaveArgs(draft);
      void runtime?.commands.run(saveCommand, args).then(
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

  const requestSave = (draft: TDraft): void => {
    const builtIn = items.find(
      (row) => row.name === draft.name.trim() && row.source === 'built-in',
    );
    if (builtIn && view.kind === 'create') {
      setPendingOverride(draft);
      return;
    }
    saveDraft(draft);
  };

  if (!runtime) return <EmptyState message="No runtime available." />;

  // Keep confirm modals mounted while editing — otherwise `pendingOverride`
  // set from create-save never surfaces (modals lived only on the list branch).
  const body =
    view.kind === 'create' || view.kind === 'edit' ? (
      <box
        style={{
          flexDirection: 'column',
          flexGrow: 1,
          height: '100%',
        }}
      >
        <Editor
          key={view.kind === 'edit' ? `edit-${view.draft.name}` : 'create'}
          draft={view.draft}
          nameLocked={view.kind === 'edit'}
          onCancel={() => setView({ kind: 'list' })}
          onSave={(draft) => requestSave(draft)}
        />
      </box>
    ) : (
      List({
        rows: items,
        onCreate: () => setView({ kind: 'create', draft: emptyDraft() }),
        onEdit: (row) => setView({ kind: 'edit', draft: draftFromCatalog(row) }),
        onDuplicate: (row) => setView({ kind: 'create', draft: duplicateDraft(row) }),
        onDelete: (row) => setPendingDelete(row),
      })
    );

  return (
    <>
      {body}

      <ConfirmModal
        open={pendingDelete !== null}
        title={`Delete ${resourceLabel}?`}
        message={
          pendingDelete
            ? `Delete user ${resourceLabel} “${getRowDisplayName(pendingDelete)}”? This removes ${resourceFolder}/${pendingDelete.name}.yaml.`
            : ''
        }
        confirmLabel="Delete"
        width={48}
        onConfirm={() => {
          if (!pendingDelete) return;
          void runtime.commands
            .run(deleteCommand, { name: pendingDelete.name })
            .then(() => setPendingDelete(null));
        }}
        onCancel={() => setPendingDelete(null)}
      />

      <ConfirmModal
        open={pendingOverride !== null}
        title="Override built-in?"
        message={`A built-in ${resourceLabel} named “${pendingOverride?.name}” already exists. Saving will create a user file that overrides it.`}
        confirmLabel="Save anyway"
        width={52}
        onConfirm={() => {
          if (!pendingOverride) return;
          const draft = pendingOverride;
          setPendingOverride(null);
          saveDraft(draft);
        }}
        onCancel={() => setPendingOverride(null)}
      />
    </>
  );
}
