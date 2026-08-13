import { type ReactNode } from 'react';
import { CatalogScreen } from './CatalogScreen.js';
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

/**
 * Themes catalog and in-screen editor. Reads `nightshift.themes` for the list
 * and persists through `theme.save` / `theme.delete` — never imports theme
 * parse/save or touches the filesystem directly.
 */
export function ThemesScreen(): ReactNode {
  return (
    <CatalogScreen<ThemeDraft, ThemeCatalogRow>
      entityId="nightshift.themes"
      itemsKey="themes"
      saveCommand="theme.save"
      deleteCommand="theme.delete"
      resourceLabel="theme"
      resourceFolder="themes"
      emptyDraft={emptyDraft}
      draftFromCatalog={draftFromCatalog}
      duplicateDraft={duplicateDraft}
      draftToSaveArgs={draftToSaveArgs}
      Editor={ThemeEditor}
      List={(props) => (
        <ThemesList
          themes={props.rows}
          onCreate={props.onCreate}
          onEdit={props.onEdit}
          onDuplicate={props.onDuplicate}
          onDelete={props.onDelete}
        />
      )}
    />
  );
}
