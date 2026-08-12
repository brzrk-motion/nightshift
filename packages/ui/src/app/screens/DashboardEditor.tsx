import { useState, type ReactNode } from 'react';
import { useKeyboard } from '@opentui/react';
import { Button, TextInput } from '../../components/controls.js';
import { SelectField } from '../../components/SelectField.js';
import { useRuntime, useTheme } from '../context.js';
import { vibeEditorContentSize, vibeEditorScale } from './vibeEditorLayout.js';
import type { DashboardDraft } from './dashboardDraft.js';

export interface DashboardEditorProps {
  draft: DashboardDraft;
  /** Name is locked when editing an existing dashboard (file name = dashboard name). */
  nameLocked?: boolean;
  onSave: (draft: DashboardDraft) => void;
  onCancel: () => void;
}

type FocusTarget = 'name' | 'title' | 'theme' | 'refresh';

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

function Field({
  label,
  focused,
  scale,
  onFocus,
  children,
}: {
  label: string;
  focused: boolean;
  scale: ReturnType<typeof vibeEditorScale>;
  onFocus: () => void;
  children: (focused: boolean) => ReactNode;
}): ReactNode {
  const theme = useTheme();
  return (
    <box
      onMouseDown={onFocus}
      style={{
        flexDirection: scale.stackFields ? 'column' : 'row',
        gap: scale.stackFields ? 0 : 2,
        minHeight: 1,
        alignItems: scale.stackFields ? 'stretch' : 'flex-start',
      }}
    >
      <text fg={theme.colors.muted}>{scale.stackFields ? label : label.padEnd(12)}</text>
      <box style={{ flexGrow: 1 }}>{children(focused)}</box>
    </box>
  );
}

/**
 * Metadata editor for dashboards — identity and look only. Widget layout stays
 * on Home edit mode. Mirrors `VibeEditor` responsive conventions.
 */
export function DashboardEditor({
  draft: initialDraft,
  nameLocked = false,
  onSave,
  onCancel,
}: DashboardEditorProps): ReactNode {
  const runtime = useRuntime();
  const theme = useTheme();
  const [draft, setDraft] = useState(initialDraft);
  const [focus, setFocus] = useState<FocusTarget>(nameLocked ? 'title' : 'name');
  const contentSize = vibeEditorContentSize(runtime?.size ?? { width: 80, height: 24 }, false);
  const scale = vibeEditorScale(contentSize.width, contentSize.height);
  const themeOptions =
    runtime?.themes.list().map((entry) => ({ value: entry.name, label: entry.name })) ?? [];

  useKeyboard((key) => {
    if (runtime?.keyboardCapture.isCaptured()) return;
    if (key.name === 'escape') onCancel();
  });

  const update = (patch: Partial<DashboardDraft>): void => setDraft((current) => ({ ...current, ...patch }));

  return (
    <box style={{ flexDirection: 'column', flexGrow: 1, gap: scale.tightGaps ? 1 : 2 }}>
      <Section title="Identity" scale={scale}>
        <Field label="Name" focused={focus === 'name'} scale={scale} onFocus={() => setFocus('name')}>
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
        </Field>
        <Field label="Title" focused={focus === 'title'} scale={scale} onFocus={() => setFocus('title')}>
          {(focused) => (
            <TextInput
              value={draft.title}
              placeholder={draft.name || 'Display title'}
              focused={focused}
              onInput={(title) => update({ title })}
            />
          )}
        </Field>
      </Section>

      <Section title="Look" scale={scale}>
        <Field label="Theme" focused={focus === 'theme'} scale={scale} onFocus={() => setFocus('theme')}>
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
        </Field>
        <Field
          label="Refresh"
          focused={focus === 'refresh'}
          scale={scale}
          onFocus={() => setFocus('refresh')}
        >
          {(focused) => (
            <TextInput
              value={draft.refresh}
              placeholder="Seconds (empty = default)"
              focused={focused}
              onInput={(refresh) => update({ refresh })}
            />
          )}
        </Field>
      </Section>

      <box
        style={{
          flexDirection: 'row',
          gap: 1,
          flexShrink: 0,
          width: '100%',
          backgroundColor: theme.colors.surface,
          alignItems: 'center',
        }}
      >
        <Button label="Save dashboard" primary onPress={() => onSave(draft)} />
        <Button label="Cancel" onPress={onCancel} />
      </box>

      <text fg={theme.colors.muted}>
        {scale.shortFooter ? 'esc cancel' : 'esc cancel · layout edits on Home (e)'}
      </text>
    </box>
  );
}
