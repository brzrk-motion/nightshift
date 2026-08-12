import type { Json } from '@nightshift/core';
import { useEffect, useState, type ReactNode } from 'react';
import { useKeyboard } from '@opentui/react';
import { Button, TextInput } from '../../components/controls.js';
import { SelectField } from '../../components/SelectField.js';
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

function Section({ title, children }: { title: string; children: ReactNode }): ReactNode {
  const theme = useTheme();
  return (
    <box style={{ flexDirection: 'column', gap: 1 }}>
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
      style={{ flexDirection: 'row', gap: 2, minHeight: 1, alignItems: 'flex-start' }}
    >
      <text fg={theme.colors.muted}>{label.padEnd(12)}</text>
      <box style={{ flexGrow: 1 }}>{children(focused)}</box>
    </box>
  );
}

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
            style={{ flexDirection: 'column', gap: 1, paddingLeft: 2 }}
          >
            <box style={{ flexDirection: 'row', gap: 1, alignItems: 'center' }}>
              <Button
                label="↑"
                disabled={index === 0}
                onPress={() => move(index, -1)}
              />
              <Button
                label="↓"
                disabled={index === actions.length - 1}
                onPress={() => move(index, 1)}
              />
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
              <Button
                label="Remove"
                onPress={() => onChange(actions.filter((_, i) => i !== index))}
              />
            </box>
            <box
              onMouseDown={() => setFocus({ list, index, field: 'args' })}
              style={{ flexDirection: 'row', gap: 2, paddingLeft: 2 }}
            >
              <text fg={theme.colors.muted}>args</text>
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
    if (key.name === 'escape') onCancel();
  });

  useEffect(() => {
    return runtime?.keyboardCapture.acquire();
  }, [runtime]);

  const summary = summariseDraft(draft);

  return (
    <box style={{ flexDirection: 'column', gap: 1, flexGrow: 1 }}>
      <text fg={theme.colors.text}>
        <b>{nameLocked ? `Edit ${draft.name}` : 'New vibe'}</b>
      </text>

      <Section title="Identity">
        <Field
          label="name"
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
        </Field>
        <Field label="title" focused={focus === 'title'} onFocus={() => setFocus('title')}>
          {(focused) => (
            <TextInput
              value={draft.title}
              placeholder="Locked In"
              focused={focused}
              onInput={(title) => patch({ title })}
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
              onInput={(description) => patch({ description })}
            />
          )}
        </Field>
      </Section>

      <Section title="Look">
        <Field label="theme" focused={focus === 'theme'} onFocus={() => setFocus('theme')}>
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
        </Field>
        <Field
          label="dashboard"
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
        </Field>
      </Section>

      <Section title="On activate">
        <ActionListEditor
          label="onActivate"
          list="onActivate"
          actions={draft.onActivate}
          focus={focus}
          setFocus={setFocus}
          onChange={(onActivate) => patch({ onActivate })}
        />
      </Section>

      <Section title="On deactivate">
        <ActionListEditor
          label="onDeactivate"
          list="onDeactivate"
          actions={draft.onDeactivate}
          focus={focus}
          setFocus={setFocus}
          onChange={(onDeactivate) => patch({ onDeactivate })}
        />
      </Section>

      <Section title="Summary">
        {summary.map((line, index) => (
          <text key={index} fg={theme.colors.muted}>
            {line}
          </text>
        ))}
      </Section>

      <box style={{ flexDirection: 'row', gap: 1 }}>
        <Button label="Save" primary onPress={() => onSave(draft)} />
        <Button label="Cancel" onPress={onCancel} />
      </box>

      <text fg={theme.colors.muted}>
        esc cancel · Saves to vibes/&lt;name&gt;.yaml — same format as a hand-edited file.
      </text>
    </box>
  );
}
