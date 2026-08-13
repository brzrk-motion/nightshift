import { useState, type ReactNode } from 'react';
import type { Json } from '@nightshift/core';
import { ConfirmModal } from '../../components/ConfirmModal.js';
import { EmptyState } from '../../components/States.js';
import { useEntity, useRuntime, useToasts } from '../context.js';
import { VibeEditor } from './VibeEditor.js';
import { VibesList } from './VibesList.js';
import {
  draftFromCatalog,
  draftToSaveArgs,
  duplicateDraft,
  emptyDraft,
  type VibeCatalogRow,
  type VibeDraft,
} from './vibeDraft.js';

interface VibesCatalogState {
  vibes: VibeCatalogRow[];
  [key: string]: Json;
}

type View =
  { kind: 'list' } | { kind: 'create'; draft: VibeDraft } | { kind: 'edit'; draft: VibeDraft };

/**
 * Vibes catalog and in-screen editor. Reads `nightshift.vibes` for the list
 * and persists through `vibe.save` / `vibe.delete` — never imports the vibe
 * engine or touches the filesystem directly. See
 * `specs/003-vibe-editor/contracts/vibe-editor-surface.md`.
 */
export function VibesScreen(): ReactNode {
  const runtime = useRuntime();
  const toasts = useToasts();
  const catalog = useEntity<VibesCatalogState>('nightshift.vibes');
  const [view, setView] = useState<View>({ kind: 'list' });
  const [pendingDelete, setPendingDelete] = useState<VibeCatalogRow | null>(null);
  const [pendingOverride, setPendingOverride] = useState<VibeDraft | null>(null);

  const vibes = catalog?.state.vibes ?? [];

  const saveDraft = (draft: VibeDraft): void => {
    try {
      const args = draftToSaveArgs(draft);
      void runtime?.commands.run('vibe.save', args).then(
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

  const requestSave = (draft: VibeDraft): void => {
    const builtIn = vibes.find(
      (row) => row.name === draft.name.trim() && row.source === 'built-in',
    );
    if (builtIn && view.kind === 'create') {
      setPendingOverride(draft);
      return;
    }
    saveDraft(draft);
  };

  if (!runtime) return <EmptyState message="No runtime available." />;

  if (view.kind === 'create' || view.kind === 'edit') {
    return (
      <box
        style={{
          flexDirection: 'column',
          flexGrow: 1,
          height: '100%',
        }}
      >
        <VibeEditor
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
      <VibesList
        vibes={vibes}
        onCreate={() => setView({ kind: 'create', draft: emptyDraft() })}
        onEdit={(row) => setView({ kind: 'edit', draft: draftFromCatalog(row) })}
        onDuplicate={(row) => setView({ kind: 'create', draft: duplicateDraft(row) })}
        onDelete={(row) => setPendingDelete(row)}
      />

      <ConfirmModal
        open={pendingDelete !== null}
        title="Delete vibe?"
        message={`Delete user vibe “${pendingDelete?.title ?? pendingDelete?.name}”? This removes vibes/${pendingDelete?.name}.yaml.`}
        confirmLabel="Delete"
        width={48}
        onConfirm={() => {
          if (!pendingDelete) return;
          void runtime.commands
            .run('vibe.delete', { name: pendingDelete.name })
            .then(() => setPendingDelete(null));
        }}
        onCancel={() => setPendingDelete(null)}
      />

      <ConfirmModal
        open={pendingOverride !== null}
        title="Override built-in?"
        message={`A built-in vibe named “${pendingOverride?.name}” already exists. Saving will create a user file that overrides it.`}
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
