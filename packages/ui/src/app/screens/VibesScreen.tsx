import { useState, type ReactNode } from 'react';
import { useKeyboard } from '@opentui/react';
import type { Json } from '@nightshift/core';
import { Button } from '../../components/controls.js';
import { Table, type TableColumn } from '../../components/Table.js';
import { EmptyState } from '../../components/States.js';
import { useEntity, useRuntime, useToasts } from '../context.js';
import { VibeEditor } from './VibeEditor.js';
import {
  draftFromCatalog,
  draftToSaveArgs,
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
 * Vibes catalog: a table of every registered vibe, plus an in-screen form for
 * creating or editing one. Save goes through the `vibe.save` command the CLI
 * registers — this screen never touches the vibe engine or the filesystem.
 */
export function VibesScreen(): ReactNode {
  const runtime = useRuntime();
  const toasts = useToasts();
  const catalog = useEntity<VibesCatalogState>('nightshift.vibes');
  const [view, setView] = useState<View>({ kind: 'list' });
  const [selected, setSelected] = useState(0);

  const vibes = catalog?.state.vibes ?? [];
  const selectedIndex = vibes.length === 0 ? 0 : Math.min(selected, vibes.length - 1);
  const selectedRow = vibes[selectedIndex];

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
        draft={view.draft}
        nameLocked={view.kind === 'edit'}
        onChange={(draft) => setView({ ...view, draft })}
        onCancel={() => setView({ kind: 'list' })}
        onSave={() => {
          try {
            const args = draftToSaveArgs(view.draft);
            void runtime.commands.run('vibe.save', args).then(
              () => setView({ kind: 'list' }),
              () => {
                // Failure is already toasted by AppShell's command listener.
              },
            );
          } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            toasts.push(message, { tone: 'danger' });
          }
        }}
      />
    );
  }

  return (
    <box style={{ flexDirection: 'column', gap: 1, flexGrow: 1 }}>
      <box style={{ flexDirection: 'row', gap: 1, flexShrink: 0 }}>
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
      </box>

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
  );
}
