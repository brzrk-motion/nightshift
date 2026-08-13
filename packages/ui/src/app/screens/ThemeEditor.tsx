import { useState, type ReactNode } from 'react';
import { useKeyboard } from '@opentui/react';
import { ActionBar } from '../../components/ActionBar.js';
import { Button, TextInput } from '../../components/controls.js';
import { ColorField } from '../../components/ColorField.js';
import { FormField } from '../../components/FormField.js';
import { FormSection } from '../../components/FormSection.js';
import { ScreenLayout } from '../../components/ScreenLayout.js';
import { SelectField } from '../../components/SelectField.js';
import { type ThemeColorKey } from '../../theme.js';
import { useFormScale } from '../../formLayout.js';
import { useRuntime, useTheme } from '../context.js';
import type { ThemeDraft } from './themeDraft.js';

export interface ThemeEditorProps {
  draft: ThemeDraft;
  nameLocked?: boolean;
  onSave: (draft: ThemeDraft) => void;
  onCancel: () => void;
}

type FocusTarget = 'name' | 'appearance' | ThemeColorKey;

const COLOR_GROUPS: readonly { title: string; keys: readonly ThemeColorKey[] }[] = [
  { title: 'Background', keys: ['background'] },
  { title: 'Surfaces', keys: ['surface', 'border', 'borderMuted'] },
  { title: 'Text', keys: ['text', 'muted'] },
  { title: 'Accents', keys: ['accent', 'accentSecondary'] },
  { title: 'Status', keys: ['success', 'warning', 'danger'] },
];

/**
 * Theme palette editor — identity, grouped color fields, and a live preview strip.
 */
export function ThemeEditor({
  draft: initialDraft,
  nameLocked = false,
  onSave,
  onCancel,
}: ThemeEditorProps): ReactNode {
  const runtime = useRuntime();
  const theme = useTheme();
  const scale = useFormScale();
  const [draft, setDraft] = useState(initialDraft);
  const [focus, setFocus] = useState<FocusTarget>(nameLocked ? 'background' : 'name');

  useKeyboard((key) => {
    if (runtime?.keyboardCapture.isCaptured()) return;
    if (key.name === 'escape') onCancel();
  });

  const updateColor = (key: ThemeColorKey, value: string): void => {
    setDraft((current) => ({ ...current, colors: { ...current.colors, [key]: value } }));
  };

  const previewTheme = {
    ...theme,
    colors: { ...theme.colors, ...draft.colors },
  };

  return (
    <ScreenLayout
      actions={
        <ActionBar>
          <Button label="Save" primary compact={false} onPress={() => onSave(draft)} />
          <Button label="Cancel" compact={false} onPress={onCancel} />
        </ActionBar>
      }
    >
      <box
        style={{
          flexDirection: 'column',
          gap: scale.tightGaps ? 1 : 2,
        }}
      >
        <box
          style={{
            flexDirection: 'row',
            gap: 1,
            paddingLeft: 1,
            paddingRight: 1,
            backgroundColor: previewTheme.colors.background,
            border: true,
            borderColor: previewTheme.colors.border,
          }}
        >
          <text fg={previewTheme.colors.text}>Preview </text>
          <text fg={previewTheme.colors.accent}>accent</text>
          <text fg={previewTheme.colors.muted}>muted</text>
          <text fg={previewTheme.colors.success}>ok</text>
          <text fg={previewTheme.colors.warning}>warn</text>
          <text fg={previewTheme.colors.danger}>err</text>
        </box>

        <FormSection title="Identity" scale={scale}>
          <box style={{ flexDirection: 'column', gap: 1 }}>
            <FormField
              label="Name"
              scale={scale}
              focused={focus === 'name'}
              onFocus={() => setFocus('name')}
            >
              {(focused) => (
                <TextInput
                  value={draft.name}
                  focused={focused && !nameLocked}
                  onInput={(name) => setDraft((current) => ({ ...current, name }))}
                  placeholder="forest"
                />
              )}
            </FormField>
            <FormField
              label="Appearance"
              scale={scale}
              focused={focus === 'appearance'}
              onFocus={() => setFocus('appearance')}
            >
              {(focused) => (
                <SelectField
                  value={draft.appearance}
                  options={[
                    { value: 'dark', label: 'dark' },
                    { value: 'light', label: 'light' },
                  ]}
                  focused={focused}
                  onFocus={() => setFocus('appearance')}
                  onChange={(appearance) =>
                    setDraft((current) => ({
                      ...current,
                      appearance: appearance as ThemeDraft['appearance'],
                    }))
                  }
                />
              )}
            </FormField>
          </box>
        </FormSection>

        {COLOR_GROUPS.map((group) => (
          <FormSection key={group.title} title={group.title} scale={scale}>
            <box style={{ flexDirection: 'column', gap: 1 }}>
              {group.keys.map((key) => (
                <ColorField
                  key={key}
                  label={key}
                  value={draft.colors[key]}
                  focused={focus === key}
                  onFocus={() => setFocus(key)}
                  onChange={(value) => updateColor(key, value)}
                />
              ))}
            </box>
          </FormSection>
        ))}
      </box>
    </ScreenLayout>
  );
}
