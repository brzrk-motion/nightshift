import { useState, type ReactNode } from 'react';
import type { Json } from '@nightshift/core';
import { Button } from '../../components/controls.js';
import { Modal } from '../../components/Modal.js';
import { EmptyState } from '../../components/States.js';
import { useEntity, useRuntime, useToasts } from '../context.js';
import { ThemeEditor } from './ThemeEditor.js';
import { ThemesList } from './ThemesList.js';
import {
  draftFromCatalog,
  draftToSaveArgs,
  duplicateDraft,
  emptyDraft,
  type ThemeCatalogRow,
  type ThemeDraft,
} from './themeDraft.js';

interface ThemesCatalogState {
  themes: ThemeCatalogRow[];
  [key: string]: Json;
}

type View =
  | { kind: 'list' }
  | { kind: 'create'; draft: ThemeDraft }
  | { kind: 'edit'; draft: ThemeDraft };

/**
 * Themes catalog and in-screen editor. Reads `nightshift.themes` for the list
 * and persists through `theme.save` / `theme.delete` — never imports theme
 * parse/save or touches the filesystem directly.
 */
export function ThemesScreen(): ReactNode {
  const runtime = useRuntime();
  const toasts = useToasts();
  const catalog = useEntity<ThemesCatalogState>('nightshift.themes');
  const [view, setView] = useState<View>({ kind: 'list' });
  const [pendingDelete, setPendingDelete] = useState<ThemeCatalogRow | null>(null);
  const [pendingOverride, setPendingOverride] = useState<ThemeDraft | null>(null);

  const themes = catalog?.state.themes ?? [];

  const saveDraft = (draft: ThemeDraft): void => {
    try {
      const args = draftToSaveArgs(draft);
      void runtime?.commands.run('theme.save', args as Record<string, Json>).then(
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

  const requestSave = (draft: ThemeDraft): void => {
    const builtIn = themes.find(
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
        <ThemeEditor
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
      <ThemesList
        themes={themes}
        onCreate={() => setView({ kind: 'create', draft: emptyDraft() })}
        onEdit={(row) => setView({ kind: 'edit', draft: draftFromCatalog(row) })}
        onDuplicate={(row) => setView({ kind: 'create', draft: duplicateDraft(row) })}
        onDelete={(row) => setPendingDelete(row)}
      />

      <Modal
        open={pendingDelete !== null}
        title="Delete theme?"
        hint="y confirm · esc cancel"
        width={48}
      >
        <box style={{ flexDirection: 'column', gap: 1 }}>
          <text>
            Delete user theme “{pendingDelete?.name}”? This removes themes/{pendingDelete?.name}.yaml.
          </text>
          <box style={{ flexDirection: 'row', gap: 1 }}>
            <Button
              label="Delete"
              primary
              onPress={() => {
                if (!pendingDelete) return;
                void runtime.commands
                  .run('theme.delete', { name: pendingDelete.name })
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
            A built-in theme named “{pendingOverride?.name}” already exists. Saving will create a
            user file that overrides it.
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
