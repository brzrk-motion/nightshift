import { useState, type ReactNode } from 'react';
import { useKeyboard } from '@opentui/react';
import { ActionBar } from '../../components/ActionBar.js';
import { Button, TextInput } from '../../components/controls.js';
import { FormField } from '../../components/FormField.js';
import { FormSection } from '../../components/FormSection.js';
import { ScreenLayout } from '../../components/ScreenLayout.js';
import { SelectField } from '../../components/SelectField.js';
import { useFormScale } from '../../formLayout.js';
import { useRuntime } from '../context.js';
import type { DashboardDraft } from './dashboardDraft.js';

export interface DashboardEditorProps {
  draft: DashboardDraft;
  /** Name is locked when editing an existing dashboard (file name = dashboard name). */
  nameLocked?: boolean;
  onSave: (draft: DashboardDraft) => void;
  onCancel: () => void;
}

type FocusTarget = 'name' | 'title' | 'theme' | 'refresh';

/**
 * Metadata editor for dashboards — identity and look only. Widget layout stays
 * on Home edit mode.
 */
export function DashboardEditor({
  draft: initialDraft,
  nameLocked = false,
  onSave,
  onCancel,
}: DashboardEditorProps): ReactNode {
  const runtime = useRuntime();
  const scale = useFormScale();
  const [draft, setDraft] = useState(initialDraft);
  const [focus, setFocus] = useState<FocusTarget>(nameLocked ? 'title' : 'name');
  const themeOptions =
    runtime?.themes.list().map((entry) => ({ value: entry.name, label: entry.name })) ?? [];

  useKeyboard((key) => {
    if (runtime?.keyboardCapture.isCaptured()) return;
    if (key.name === 'escape') onCancel();
  });

  const update = (patch: Partial<DashboardDraft>): void => setDraft((current) => ({ ...current, ...patch }));

  const footerHint = scale.shortFooter ? 'esc cancel' : 'esc cancel · layout edits on Home (e)';

  return (
    <ScreenLayout
      scroll={false}
      hint={footerHint}
      actions={
        <ActionBar>
          <Button label="Save dashboard" primary compact={false} onPress={() => onSave(draft)} />
          <Button label="Cancel" compact={false} onPress={onCancel} />
        </ActionBar>
      }
    >
      <box style={{ flexDirection: 'column', gap: scale.tightGaps ? 1 : 2, flexGrow: 1 }}>
        <FormSection title="Identity" scale={scale}>
          <FormField
            label="Name"
            focused={focus === 'name'}
            scale={scale}
            onFocus={() => setFocus('name')}
          >
            {(focused) => (
              <TextInput
                value={draft.name}
                placeholder="work-board"
                focused={!nameLocked && focused}
                onInput={(name) => {
                  if (!nameLocked) update({ name });
                }}
              />
            )}
          </FormField>
          <FormField
            label="Title"
            focused={focus === 'title'}
            scale={scale}
            onFocus={() => setFocus('title')}
          >
            {(focused) => (
              <TextInput
                value={draft.title}
                placeholder={draft.name || 'Display title'}
                focused={focused}
                onInput={(title) => update({ title })}
              />
            )}
          </FormField>
        </FormSection>

        <FormSection title="Look" scale={scale}>
          <FormField
            label="Theme"
            focused={focus === 'theme'}
            scale={scale}
            onFocus={() => setFocus('theme')}
          >
            {(focused) => (
              <SelectField
                value={draft.theme}
                options={themeOptions}
                placeholder="(none)"
                focused={focused}
                onFocus={() => setFocus('theme')}
                onChange={(themeValue) => update({ theme: themeValue })}
              />
            )}
          </FormField>
          <FormField
            label="Refresh"
            focused={focus === 'refresh'}
            scale={scale}
            onFocus={() => setFocus('refresh')}
          >
            {(focused) => (
              <TextInput
                value={draft.refresh}
                placeholder="60 (0 = off)"
                focused={focused}
                onInput={(refresh) => update({ refresh })}
              />
            )}
          </FormField>
        </FormSection>
      </box>
    </ScreenLayout>
  );
}
