import { useState, type ReactNode } from 'react';
import { Button, TextInput } from '../../components/controls.js';
import { useTheme } from '../context.js';
import type { ActionDraft, VibeDraft } from './vibeDraft.js';

export interface VibeEditorProps {
  draft: VibeDraft;
  /** Name is locked when editing an existing vibe (file name = vibe name). */
  nameLocked?: boolean;
  onChange: (draft: VibeDraft) => void;
  onSave: () => void;
  onCancel: () => void;
}

type FocusTarget =
  | 'name'
  | 'title'
  | 'description'
  | 'theme'
  | 'dashboard'
  | { list: 'onActivate' | 'onDeactivate'; index: number; field: 'command' | 'args' };

function ActionListEditor({
  label,
  actions,
  list,
  focus,
  setFocus,
  onChange,
}: {
  label: string;
  actions: ActionDraft[];
  list: 'onActivate' | 'onDeactivate';
  focus: FocusTarget;
  setFocus: (target: FocusTarget) => void;
  onChange: (actions: ActionDraft[]) => void;
}): ReactNode {
  const theme = useTheme();

  return (
    <box style={{ flexDirection: 'column', gap: 1 }}>
      <box style={{ flexDirection: 'row', gap: 2, alignItems: 'center' }}>
        <text fg={theme.colors.muted}>{label}</text>
        <Button
          label="+ command"
          onPress={() => {
            onChange([...actions, { command: '', args: '' }]);
            setFocus({ list, index: actions.length, field: 'command' });
          }}
        />
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
            style={{ flexDirection: 'row', gap: 1, alignItems: 'center' }}
          >
            <box
              onMouseDown={() => setFocus({ list, index, field: 'command' })}
              style={{ flexGrow: 1 }}
            >
              <TextInput
                value={action.command}
                placeholder="command.id"
                focused={commandFocused}
                onInput={(command) => {
                  const next = [...actions];
                  next[index] = { ...action, command };
                  onChange(next);
                }}
              />
            </box>
            <box
              onMouseDown={() => setFocus({ list, index, field: 'args' })}
              style={{ flexGrow: 1 }}
            >
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
            <Button
              label="Remove"
              onPress={() => onChange(actions.filter((_, i) => i !== index))}
            />
          </box>
        );
      })}
    </box>
  );
}

function Field({
  label,
  focused,
  onFocus,
  children,
}: {
  label: string;
  focused: boolean;
  onFocus: () => void;
  children: (focused: boolean) => ReactNode;
}): ReactNode {
  const theme = useTheme();
  return (
    <box
      onMouseDown={onFocus}
      style={{ flexDirection: 'row', gap: 2, height: 1, alignItems: 'center' }}
    >
      <text fg={theme.colors.muted}>{label.padEnd(12)}</text>
      {children(focused)}
    </box>
  );
}

/**
 * Form for creating or editing a vibe. Fields mirror the YAML keys a person
 * would type in `vibes/<name>.yaml`, minus the free-form `entities` map
 * (preserved on save when editing).
 */
export function VibeEditor({
  draft,
  nameLocked = false,
  onChange,
  onSave,
  onCancel,
}: VibeEditorProps): ReactNode {
  const theme = useTheme();
  const [focus, setFocus] = useState<FocusTarget>(nameLocked ? 'title' : 'name');

  const set = (patch: Partial<VibeDraft>): void => onChange({ ...draft, ...patch });

  return (
    <box style={{ flexDirection: 'column', gap: 1, flexGrow: 1 }}>
      <text fg={theme.colors.text}>
        <b>{nameLocked ? `Edit ${draft.name}` : 'New vibe'}</b>
      </text>

      <Field label="name" focused={!nameLocked && focus === 'name'} onFocus={() => setFocus('name')}>
        {(focused) => (
          <TextInput
            value={draft.name}
            placeholder="locked-in"
            focused={focused}
            onInput={(name) => {
              if (!nameLocked) set({ name });
            }}
          />
        )}
      </Field>
      <Field label="title" focused={focus === 'title'} onFocus={() => setFocus('title')}>
        {(focused) => (
          <TextInput
            value={draft.title}
            placeholder="Locked In"
            focused={focused}
            onInput={(title) => set({ title })}
          />
        )}
      </Field>
      <Field
        label="description"
        focused={focus === 'description'}
        onFocus={() => setFocus('description')}
      >
        {(focused) => (
          <TextInput
            value={draft.description}
            placeholder="Deep work."
            focused={focused}
            onInput={(description) => set({ description })}
          />
        )}
      </Field>
      <Field label="theme" focused={focus === 'theme'} onFocus={() => setFocus('theme')}>
        {(focused) => (
          <TextInput
            value={draft.theme}
            placeholder="midnight"
            focused={focused}
            onInput={(themeName) => set({ theme: themeName })}
          />
        )}
      </Field>
      <Field
        label="dashboard"
        focused={focus === 'dashboard'}
        onFocus={() => setFocus('dashboard')}
      >
        {(focused) => (
          <TextInput
            value={draft.dashboard}
            placeholder="home"
            focused={focused}
            onInput={(dashboard) => set({ dashboard })}
          />
        )}
      </Field>

      <ActionListEditor
        label="onActivate"
        list="onActivate"
        actions={draft.onActivate}
        focus={focus}
        setFocus={setFocus}
        onChange={(onActivate) => set({ onActivate })}
      />
      <ActionListEditor
        label="onDeactivate"
        list="onDeactivate"
        actions={draft.onDeactivate}
        focus={focus}
        setFocus={setFocus}
        onChange={(onDeactivate) => set({ onDeactivate })}
      />

      <box style={{ flexDirection: 'row', gap: 1 }}>
        <Button label="Save" primary onPress={onSave} />
        <Button label="Cancel" onPress={onCancel} />
      </box>

      <text fg={theme.colors.muted}>
        {'Saves to vibes/<name>.yaml — same format as a hand-edited vibe file.'}
      </text>
    </box>
  );
}
