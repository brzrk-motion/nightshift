import { useState, type ReactNode } from 'react';
import {
  Button,
  EmptyState,
  TextInput,
  Toggle,
  useCommands,
  useEntity,
  useTheme,
  type WidgetProps,
} from '@nightshift/sdk';
import { TODO_ENTITY, type TodoItem, type TodoState } from './entity.js';
import { visibleTodos } from './todos.js';

interface InlineEditorProps {
  initial: string;
  placeholder?: string;
  onSave: (text: string) => void;
  onCancel: () => void;
}

/**
 * A text field plus Save/Cancel, focused only while it is on screen. A
 * focused `<input>` takes over the whole keyboard (see `CommandPalette.tsx`),
 * so this is mounted for as long as one row is being added or edited and no
 * longer — never left sitting in the widget permanently.
 */
function InlineEditor({ initial, placeholder, onSave, onCancel }: InlineEditorProps): ReactNode {
  const [draft, setDraft] = useState(initial);

  const commit = (): void => {
    const text = draft.trim();
    if (text !== '') onSave(text);
  };

  return (
    <box style={{ flexDirection: 'row', gap: 1, alignItems: 'center' }}>
      <TextInput
        value={draft}
        onInput={setDraft}
        onSubmit={commit}
        focused
        {...(placeholder === undefined ? {} : { placeholder })}
      />
      <Button label="Save" onPress={commit} />
      <Button label="Cancel" onPress={onCancel} />
    </box>
  );
}

/** One todo: its checkbox, its text, and an Edit button — or, while editing,
 * the inline editor in its place. The row holds no todo state of its own
 * beyond whether it is currently being edited. */
function TodoRow({ item, index }: { item: TodoItem; index: number }): ReactNode {
  const theme = useTheme();
  const commands = useCommands();
  const [editing, setEditing] = useState(false);

  if (editing) {
    return (
      <InlineEditor
        initial={item.text}
        onSave={(text) => {
          void commands.run('todo.edit', { index, text });
          setEditing(false);
        }}
        onCancel={() => setEditing(false)}
      />
    );
  }

  return (
    <box style={{ flexDirection: 'row', gap: 1, alignItems: 'center' }}>
      <Button
        label={item.done ? '[x]' : '[ ]'}
        onPress={() => void commands.run('todo.toggle', { index })}
      />
      <text fg={item.done ? theme.colors.muted : theme.colors.text}>{item.text}</text>
      <box style={{ flexGrow: 1 }} />
      <Button label="Edit" onPress={() => setEditing(true)} />
    </box>
  );
}

/**
 * The whole plugin surface: add a todo, check items off, filter completed
 * ones out of view, and edit an existing one in place — all through buttons,
 * reading and writing nothing but the `todo.items` entity, exactly as a
 * plugin widget is meant to.
 */
export function TodoWidget(_props: WidgetProps): ReactNode {
  const entity = useEntity<TodoState>(TODO_ENTITY);
  const commands = useCommands();
  const [adding, setAdding] = useState(false);
  const state = entity?.state ?? { items: [], hideCompleted: false };
  const visible = visibleTodos(state.items, state.hideCompleted);

  return (
    <box style={{ flexDirection: 'column', flexGrow: 1, gap: 1 }}>
      {adding ? (
        <InlineEditor
          initial=""
          placeholder="Add a todo…"
          onSave={(text) => {
            void commands.run('todo.add', { text });
            setAdding(false);
          }}
          onCancel={() => setAdding(false)}
        />
      ) : (
        <Button label="Add todo" onPress={() => setAdding(true)} />
      )}
      <Toggle
        label="Hide completed"
        value={state.hideCompleted}
        onChange={() => void commands.run('todo.filter.toggle')}
      />
      {visible.length === 0 ? (
        <EmptyState
          message={state.items.length === 0 ? 'Nothing to do yet.' : 'Everything is checked off.'}
        />
      ) : (
        // A plain `<box>` grows to fit its content and pushes everything past
        // it off the widget instead of clipping — `<scrollbox>` is OpenTUI's
        // real scrolling container, so a list longer than the widget's height
        // scrolls (mouse wheel) instead of overflowing the dashboard.
        //
        // `flexGrow` only — no `flexDirection` — is deliberate: a scrollbox's
        // own top-level box is internally `row` (its content pane sits beside
        // its vertical scrollbar strip). Setting `flexDirection: 'column'`
        // here would fight that internal layout and starve the content pane
        // of height instead of stacking the rows inside it — the rows stack
        // vertically regardless, since the content pane it's built from
        // already forces `column` beneath this.
        <scrollbox style={{ flexGrow: 1 }}>
          {visible.map(({ item, index }) => (
            <TodoRow key={index} item={item} index={index} />
          ))}
        </scrollbox>
      )}
    </box>
  );
}
