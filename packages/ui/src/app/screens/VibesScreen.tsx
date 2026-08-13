import { type ReactNode } from 'react';
import { CatalogScreen } from './CatalogScreen.js';
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

/**
 * Vibes catalog and in-screen editor. Reads `nightshift.vibes` for the list
 * and persists through `vibe.save` / `vibe.delete` — never imports the vibe
 * engine or touches the filesystem directly. See
 * `specs/003-vibe-editor/contracts/vibe-editor-surface.md`.
 */
export function VibesScreen(): ReactNode {
  return (
    <CatalogScreen<VibeDraft, VibeCatalogRow>
      entityId="nightshift.vibes"
      itemsKey="vibes"
      saveCommand="vibe.save"
      deleteCommand="vibe.delete"
      resourceLabel="vibe"
      resourceFolder="vibes"
      emptyDraft={emptyDraft}
      draftFromCatalog={draftFromCatalog}
      duplicateDraft={duplicateDraft}
      draftToSaveArgs={draftToSaveArgs}
      getRowDisplayName={(row) => row.title ?? row.name}
      Editor={VibeEditor}
      List={(props) => (
        <VibesList
          vibes={props.rows}
          onCreate={props.onCreate}
          onEdit={props.onEdit}
          onDuplicate={props.onDuplicate}
          onDelete={props.onDelete}
        />
      )}
    />
  );
}
