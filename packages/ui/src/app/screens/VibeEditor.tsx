import type { Json } from '@nightshift/core';
import { useState, type ReactNode } from 'react';
import { useKeyboard } from '@opentui/react';
import { ActionBar } from '../../components/ActionBar.js';
import { Button, TextInput } from '../../components/controls.js';
import { FormField } from '../../components/FormField.js';
import { FormSection } from '../../components/FormSection.js';
import { ScreenLayout } from '../../components/ScreenLayout.js';
import { SelectField } from '../../components/SelectField.js';
import { IconButton } from '../../components/Toolbar.js';
import { type FormScale, useFormScale } from '../../formLayout.js';
import { useEntity, useRuntime, useTheme } from '../context.js';
import { CommandPicker } from './CommandPicker.js';
import type { ActionDraft, VibeDraft } from './vibeDraft.js';
import { summariseDraft } from './vibeSummary.js';

export interface VibeEditorProps {
  draft: VibeDraft;
  /** Name is locked when editing an existing vibe (file name = vibe name). */
  nameLocked?: boolean;
  onSave: (draft: VibeDraft) => void;
  onCancel: () => void;
}

type FocusTarget =
  | 'name'
  | 'title'
  | 'description'
  | 'theme'
  | 'dashboard'
  | { list: 'onActivate' | 'onDeactivate'; index: number; field: 'command' | 'args' };

interface DashboardCatalogState {
  dashboards: Array<{ name: string; title: string }>;
  [key: string]: Json;
}

function ActionListEditor({
  label,
  actions,
  list,
  focus,
  scale,
  setFocus,
  onChange,
}: {
  label: string;
  actions: ActionDraft[];
  list: 'onActivate' | 'onDeactivate';
  focus: FocusTarget;
  scale: FormScale;
  setFocus: (target: FocusTarget) => void;
  onChange: (actions: ActionDraft[]) => void;
}): ReactNode {
  const theme = useTheme();

  const move = (index: number, direction: -1 | 1): void => {
    const next = index + direction;
    if (next < 0 || next >= actions.length) return;
    const copy = [...actions];
    const temp = copy[index];
    copy[index] = copy[next]!;
    copy[next] = temp!;
    onChange(copy);
    setFocus({ list, index: next, field: 'command' });
  };

  const addAction = (): void => {
    onChange([...actions, { command: '', args: '' }]);
    setFocus({ list, index: actions.length, field: 'command' });
  };

  const removeAction = (index: number): void => {
    onChange(actions.filter((_, i) => i !== index));
  };

  const moveControls = (index: number): ReactNode =>
    scale.compactActionControls ? (
      <>
        <IconButton icon="↑" disabled={index === 0} onPress={() => move(index, -1)} />
        <IconButton
          icon="↓"
          disabled={index === actions.length - 1}
          onPress={() => move(index, 1)}
        />
        <IconButton icon="✖" onPress={() => removeAction(index)} />
      </>
    ) : (
      <>
        <Button label="↑" disabled={index === 0} onPress={() => move(index, -1)} />
        <Button label="↓" disabled={index === actions.length - 1} onPress={() => move(index, 1)} />
        <Button label="Remove" onPress={() => removeAction(index)} />
      </>
    );

  return (
    <box style={{ flexDirection: 'column', gap: scale.tightGaps ? 0 : 1 }}>
      <box style={{ flexDirection: 'row', gap: 1, alignItems: 'center', flexShrink: 0 }}>
        <text fg={theme.colors.muted}>{label}</text>
        {scale.compactActionControls ? (
          <IconButton icon="+" label="command" onPress={addAction} />
        ) : (
          <Button label="+ command" onPress={addAction} />
        )}
      </box>
      {actions.map((action, index) => {
        const commandFocused =
          typeof focus === 'object' &&
          focus.list === list &&
          focus.index === index &&
          focus.field === 'command';
        const argsFocused =
          typeof focus === 'object' &&
          focus.list === list &&
          focus.index === index &&
          focus.field === 'args';
        return (
          <box
            key={`${list}-${index}`}
            style={{
              flexDirection: 'column',
              gap: scale.tightGaps ? 0 : 1,
              paddingLeft: scale.stackActionRows ? 0 : 2,
            }}
          >
            {scale.stackActionRows ? (
              <>
                <box style={{ flexDirection: 'row', gap: 1, alignItems: 'center', flexShrink: 0 }}>
                  {moveControls(index)}
                </box>
                <CommandPicker
                  value={action.command}
                  focused={commandFocused}
                  onFocus={() => setFocus({ list, index, field: 'command' })}
                  onChange={(command) => {
                    const next = [...actions];
                    next[index] = { ...action, command };
                    onChange(next);
                  }}
                />
              </>
            ) : (
              <box style={{ flexDirection: 'row', gap: 1, alignItems: 'center' }}>
                {moveControls(index)}
                <box style={{ flexGrow: 1 }}>
                  <CommandPicker
                    value={action.command}
                    focused={commandFocused}
                    onFocus={() => setFocus({ list, index, field: 'command' })}
                    onChange={(command) => {
                      const next = [...actions];
                      next[index] = { ...action, command };
                      onChange(next);
                    }}
                  />
                </box>
              </box>
            )}
            <box
              onMouseDown={() => setFocus({ list, index, field: 'args' })}
              style={{
                flexDirection: scale.stackFields ? 'column' : 'row',
                gap: scale.stackFields ? 0 : 2,
                paddingLeft: scale.stackActionRows ? 0 : 2,
              }}
            >
              <text fg={theme.colors.muted}>{scale.stackFields ? 'args' : 'args'.padEnd(12)}</text>
              <TextInput
                value={action.args}
                placeholder='{"minutes":50}'
                focused={argsFocused}
                onInput={(args) => {
                  const next = [...actions];
                  next[index] = { ...action, args };
                  onChange(next);
                }}
              />
            </box>
          </box>
        );
      })}
    </box>
  );
}

/**
 * Sectioned form for creating or editing a vibe. Fields mirror vibe YAML keys;
 * the `entities` map is preserved on save when editing but not edited here yet.
 */
export function VibeEditor({
  draft: initialDraft,
  nameLocked = false,
  onSave,
  onCancel,
}: VibeEditorProps): ReactNode {
  const theme = useTheme();
  const runtime = useRuntime();
  const dashboards = useEntity<DashboardCatalogState>('nightshift.dashboards');
  const [draft, setDraft] = useState(initialDraft);
  const [focus, setFocus] = useState<FocusTarget>(nameLocked ? 'title' : 'name');

  const scale = useFormScale();
  const sectionGap = scale.tightGaps ? 0 : 1;

  const patch = (partial: Partial<VibeDraft>): void => {
    setDraft((current) => ({ ...current, ...partial }));
  };

  const themeOptions =
    runtime?.themes.list().map((entry) => ({ value: entry.name, label: entry.name })) ?? [];
  const dashboardOptions =
    dashboards?.state.dashboards.map((entry) => ({
      value: entry.name,
      label: entry.title,
    })) ?? [];

  useKeyboard((key) => {
    if (runtime?.keyboardCapture.isCaptured()) return;
    if (key.name === 'escape') onCancel();
  });

  const summary = summariseDraft(draft);
  const footerHint = scale.shortFooter
    ? 'esc cancel · saves vibes/<name>.yaml'
    : 'esc cancel · Saves to vibes/<name>.yaml — same format as a hand-edited file.';

  return (
    <ScreenLayout
      title={
        <text fg={theme.colors.text}>
          <b>{nameLocked ? `Edit ${draft.name}` : 'New vibe'}</b>
        </text>
      }
      hint={footerHint}
      actions={
        <ActionBar>
          <Button label="Save" primary compact={false} onPress={() => onSave(draft)} />
          <Button label="Cancel" compact={false} onPress={onCancel} />
        </ActionBar>
      }
    >
      <box style={{ flexDirection: 'column', gap: sectionGap }}>
        <FormSection title="Identity" scale={scale}>
          <FormField
            label="name"
            scale={scale}
            focused={!nameLocked && focus === 'name'}
            onFocus={() => {
              if (!nameLocked) setFocus('name');
            }}
          >
            {(focused) => (
              <TextInput
                value={draft.name}
                placeholder="locked-in"
                focused={focused}
                onInput={(name) => {
                  if (!nameLocked) patch({ name });
                }}
              />
            )}
          </FormField>
          <FormField
            label="title"
            scale={scale}
            focused={focus === 'title'}
            onFocus={() => setFocus('title')}
          >
            {(focused) => (
              <TextInput
                value={draft.title}
                placeholder="Locked In"
                focused={focused}
                onInput={(title) => patch({ title })}
              />
            )}
          </FormField>
          <FormField
            label="description"
            scale={scale}
            focused={focus === 'description'}
            onFocus={() => setFocus('description')}
          >
            {(focused) => (
              <TextInput
                value={draft.description}
                placeholder="Deep work."
                focused={focused}
                onInput={(description) => patch({ description })}
              />
            )}
          </FormField>
        </FormSection>

        <FormSection title="Look" scale={scale}>
          <FormField
            label="theme"
            scale={scale}
            focused={focus === 'theme'}
            onFocus={() => setFocus('theme')}
          >
            {(focused) => (
              <SelectField
                value={draft.theme}
                options={themeOptions}
                placeholder="(none)"
                focused={focused}
                onFocus={() => setFocus('theme')}
                onChange={(themeName) => patch({ theme: themeName })}
              />
            )}
          </FormField>
          <FormField
            label="dashboard"
            scale={scale}
            focused={focus === 'dashboard'}
            onFocus={() => setFocus('dashboard')}
          >
            {(focused) => (
              <SelectField
                value={draft.dashboard}
                options={dashboardOptions}
                placeholder="(none)"
                focused={focused}
                onFocus={() => setFocus('dashboard')}
                onChange={(dashboard) => patch({ dashboard })}
              />
            )}
          </FormField>
        </FormSection>

        <FormSection title="On activate" scale={scale}>
          <ActionListEditor
            label="onActivate"
            list="onActivate"
            actions={draft.onActivate}
            focus={focus}
            scale={scale}
            setFocus={setFocus}
            onChange={(onActivate) => patch({ onActivate })}
          />
        </FormSection>

        <FormSection title="On deactivate" scale={scale}>
          <ActionListEditor
            label="onDeactivate"
            list="onDeactivate"
            actions={draft.onDeactivate}
            focus={focus}
            scale={scale}
            setFocus={setFocus}
            onChange={(onDeactivate) => patch({ onDeactivate })}
          />
        </FormSection>

        <FormSection title="Summary" scale={scale}>
          {summary.map((line, index) => (
            <text key={index} fg={theme.colors.muted}>
              {line}
            </text>
          ))}
        </FormSection>
      </box>
    </ScreenLayout>
  );
}
