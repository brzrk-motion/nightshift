import { useState, type ReactNode } from 'react';
import { useKeyboard } from '@opentui/react';
import { Button, TextInput } from '../../components/controls.js';
import { ColorField } from '../../components/ColorField.js';
import { SelectField } from '../../components/SelectField.js';
import { THEME_COLOR_KEYS, type ThemeColorKey } from '../../theme.js';
import { useRuntime, useTheme } from '../context.js';
import { vibeEditorContentSize, vibeEditorScale } from './vibeEditorLayout.js';
import type { ThemeDraft } from './themeDraft.js';

export interface ThemeEditorProps {
  draft: ThemeDraft;
  nameLocked?: boolean;
  onSave: (draft: ThemeDraft) => void;
  onCancel: () => void;
}

type FocusTarget = 'name' | ThemeColorKey;

const COLOR_GROUPS: readonly { title: string; keys: readonly ThemeColorKey[] }[] = [
  { title: 'Background', keys: ['background'] },
  { title: 'Surfaces', keys: ['surface', 'border', 'borderMuted'] },
  { title: 'Text', keys: ['text', 'muted'] },
  { title: 'Accents', keys: ['accent', 'accentSecondary'] },
  { title: 'Status', keys: ['success', 'warning', 'danger'] },
];

function Section({
  title,
  scale,
  children,
}: {
  title: string;
  scale: ReturnType<typeof vibeEditorScale>;
  children: ReactNode;
}): ReactNode {
  const theme = useTheme();
  return (
    <box style={{ flexDirection: 'column', gap: scale.tightGaps ? 0 : 1 }}>
      <text fg={theme.colors.accent}>
        <b>{title}</b>
      </text>
      {children}
    </box>
  );
}

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
  const [draft, setDraft] = useState(initialDraft);
  const [focus, setFocus] = useState<FocusTarget>(nameLocked ? 'background' : 'name');
  const contentSize = vibeEditorContentSize(runtime?.size ?? { width: 80, height: 24 }, false);
  const scale = vibeEditorScale(contentSize.width, contentSize.height);

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
    <box style={{ flexDirection: 'column', flexGrow: 1, height: '100%' }}>
      <scrollbox style={{ flexGrow: 1 }}>
        <box
          style={{
            flexDirection: 'column',
            gap: scale.tightGaps ? 1 : 2,
            paddingLeft: 1,
            paddingRight: 1,
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

          <Section title="Identity" scale={scale}>
            <box style={{ flexDirection: 'column', gap: 1 }}>
              <box style={{ flexDirection: 'row', gap: 2, alignItems: 'center' }}>
                <text fg={theme.colors.muted}>{'Name'.padEnd(12)}</text>
                <TextInput
                  value={draft.name}
                  focused={focus === 'name' && !nameLocked}
                  onInput={(name) => setDraft((current) => ({ ...current, name }))}
                  placeholder="forest"
                />
              </box>
              <box style={{ flexDirection: 'row', gap: 2, alignItems: 'center' }}>
                <text fg={theme.colors.muted}>{'Appearance'.padEnd(12)}</text>
                <SelectField
                  value={draft.appearance}
                  options={[
                    { value: 'dark', label: 'dark' },
                    { value: 'light', label: 'light' },
                  ]}
                  onChange={(appearance) =>
                    setDraft((current) => ({
                      ...current,
                      appearance: appearance as ThemeDraft['appearance'],
                    }))
                  }
                />
              </box>
            </box>
          </Section>

          {COLOR_GROUPS.map((group) => (
            <Section key={group.title} title={group.title} scale={scale}>
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
            </Section>
          ))}
        </box>
      </scrollbox>

      <box
        style={{
          flexDirection: 'row',
          gap: 1,
          flexShrink: 0,
          width: '100%',
          backgroundColor: theme.colors.surface,
          alignItems: 'center',
          paddingLeft: 1,
          paddingRight: 1,
        }}
      >
        <Button label="Save" primary compact={false} onPress={() => onSave(draft)} />
        <Button label="Cancel" compact={false} onPress={onCancel} />
      </box>
    </box>
  );
}
