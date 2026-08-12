import { useState, type ReactNode } from 'react';
import { useKeyboard } from '@opentui/react';
import type { Json } from '@nightshift/core';
import { Button } from '../../components/controls.js';
import { Modal } from '../../components/Modal.js';
import { Table, type TableColumn } from '../../components/Table.js';
import { EmptyState } from '../../components/States.js';
import { useEntity, useRuntime, useToasts } from '../context.js';
import { VibeEditor } from './VibeEditor.js';
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

type View =
  | { kind: 'list' }
  | { kind: 'create'; draft: VibeDraft }
  | { kind: 'edit'; draft: VibeDraft };

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
  const [selected, setSelected] = useState(0);
  const [pendingDelete, setPendingDelete] = useState<VibeCatalogRow | null>(null);
  const [pendingOverride, setPendingOverride] = useState<VibeDraft | null>(null);

  const vibes = catalog?.state.vibes ?? [];
  const selectedIndex = vibes.length === 0 ? 0 : Math.min(selected, vibes.length - 1);
  const selectedRow = vibes[selectedIndex];

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

  useKeyboard((key) => {
    if (view.kind !== 'list') return;
    if (runtime?.keyboardCapture.isCaptured()) return;
    if (key.name === 'up' || key.name === 'k') {
      setSelected((index) => Math.max(0, index - 1));
    } else if (key.name === 'down' || key.name === 'j') {
      setSelected((index) => Math.min(Math.max(0, vibes.length - 1), index + 1));
    } else if (key.name === 'return' && selectedRow) {
      void runtime?.commands.run(`vibe.activate.${selectedRow.name}`);
    } else if (key.name === 'e' && selectedRow) {
      setView({ kind: 'edit', draft: draftFromCatalog(selectedRow) });
    } else if (key.name === 'a' && !key.ctrl && !key.meta) {
      setView({ kind: 'create', draft: emptyDraft() });
    }
  });

  if (!runtime) return <EmptyState message="No runtime available." />;

  if (view.kind === 'create' || view.kind === 'edit') {
    return (
      <VibeEditor
        key={view.kind === 'edit' ? `edit-${view.draft.name}` : 'create'}
        draft={view.draft}
        nameLocked={view.kind === 'edit'}
        onCancel={() => setView({ kind: 'list' })}
        onSave={(draft) => requestSave(draft)}
      />
    );
  }

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
          paddingTop: 0,
          paddingBottom: 0,
          backgroundColor: runtime.themes.current.colors.surface,
          alignItems: 'center',
        }}
      >
        <Button
          label="Add vibe"
          primary
          onPress={() => setView({ kind: 'create', draft: emptyDraft() })}
        />
        <Button
          label="Edit"
          disabled={selectedRow === undefined}
          onPress={() => {
            if (selectedRow) setView({ kind: 'edit', draft: draftFromCatalog(selectedRow) });
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
            if (selectedRow) setView({ kind: 'create', draft: duplicateDraft(selectedRow) });
          }}
        />
        <Button
          label="Delete"
          disabled={selectedRow === undefined || selectedRow.source === 'built-in'}
          onPress={() => {
            if (selectedRow) setPendingDelete(selectedRow);
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
            width={runtime.size.width - 20}
            selected={selectedIndex}
            onSelect={setSelected}
          />
        )}

        <text fg={runtime.themes.current.colors.muted}>
          ↑↓ move · enter activate · e edit · a add
        </text>
      </box>

      <Modal
        open={pendingDelete !== null}
        title="Delete vibe?"
        hint="y confirm · esc cancel"
        width={48}
      >
        <box style={{ flexDirection: 'column', gap: 1 }}>
          <text>
            Delete user vibe “{pendingDelete?.title ?? pendingDelete?.name}”? This removes{' '}
            vibes/{pendingDelete?.name}.yaml.
          </text>
          <box style={{ flexDirection: 'row', gap: 1 }}>
            <Button
              label="Delete"
              primary
              onPress={() => {
                if (!pendingDelete) return;
                void runtime.commands
                  .run('vibe.delete', { name: pendingDelete.name })
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
            A built-in vibe named “{pendingOverride?.name}” already exists. Saving will create a
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
    </box>
  );
}
