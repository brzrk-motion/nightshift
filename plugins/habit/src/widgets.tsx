import { useState, type ReactNode } from 'react';
import {
  Button,
  EmptyState,
  TextInput,
  useCommands,
  useEntity,
  useTheme,
  type WidgetProps,
} from '@nightshift/sdk';
import { HABIT_ENTITY, initialState, type Habit, type HabitState } from './entity.js';
import {
  dayHeaderLabel,
  nameColumnWidth,
  resolveDensity,
  truncateName,
  type HabitDensity,
} from './layout.js';
import { isCompleted } from './habits.js';
import { streakSummary } from './streaks.js';
import { rollingWindow, todayKey } from './window.js';

interface InlineEditorProps {
  initial: string;
  placeholder?: string;
  onSave: (text: string) => void;
  onCancel: () => void;
}

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

function DayHeaders({
  dates,
  density,
  nameWidth,
  showStreaks,
}: {
  dates: readonly string[];
  density: HabitDensity;
  nameWidth: number;
  showStreaks: boolean;
}): ReactNode {
  const theme = useTheme();
  return (
    <box style={{ flexDirection: 'row', gap: 1, alignItems: 'center' }}>
      <text fg={theme.colors.muted}>{''.padEnd(Math.min(nameWidth, 8))}</text>
      {dates.map((date) => (
        <text key={date} fg={theme.colors.muted}>
          {dayHeaderLabel(date, density).padStart(density === 'wide' ? 6 : 3)}
        </text>
      ))}
      {showStreaks ? <text fg={theme.colors.muted}> cur/best</text> : null}
    </box>
  );
}

function HabitRow({
  habit,
  state,
  dates,
  today,
  nameWidth,
  showStreaks,
}: {
  habit: Habit;
  state: HabitState;
  dates: readonly string[];
  today: string;
  nameWidth: number;
  showStreaks: boolean;
}): ReactNode {
  const theme = useTheme();
  const commands = useCommands();
  const [editing, setEditing] = useState(false);
  const streaks = streakSummary(state.completions[habit.id] ?? [], today);

  if (editing) {
    return (
      <InlineEditor
        initial={habit.name}
        onSave={(name) => {
          void commands.run('habit.rename', { id: habit.id, name });
          setEditing(false);
        }}
        onCancel={() => setEditing(false)}
      />
    );
  }

  return (
    <box style={{ flexDirection: 'row', gap: 1, alignItems: 'center' }}>
      <text fg={theme.colors.text}>
        {truncateName(habit.name, nameWidth).padEnd(Math.min(nameWidth, habit.name.length + 1))}
      </text>
      {dates.map((date) => {
        const done = isCompleted(state, habit.id, date);
        return (
          <Button
            key={date}
            label={done ? '[x]' : '[ ]'}
            onPress={() => void commands.run('habit.toggle', { id: habit.id, date })}
          />
        );
      })}
      {showStreaks ? (
        <text fg={theme.colors.accentSecondary}>{` ${streaks.current}/${streaks.longest}`}</text>
      ) : null}
      <box style={{ flexGrow: 1 }} />
      <Button label="Edit" onPress={() => setEditing(true)} />
      <Button label="Del" onPress={() => void commands.run('habit.remove', { id: habit.id })} />
    </box>
  );
}

/**
 * Rolling 7-day habit grid. Density follows allocated widget width; mutations
 * go through commands only.
 */
export function HabitTrackerWidget({ width }: WidgetProps): ReactNode {
  const entity = useEntity<HabitState>(HABIT_ENTITY);
  const commands = useCommands();
  const [adding, setAdding] = useState(false);
  const state = entity?.state ?? initialState();
  const today = todayKey();
  const dates = rollingWindow(today);
  const density = resolveDensity(width);
  const showStreaks = density !== 'compact';
  const nameWidth = nameColumnWidth(width, density);

  return (
    <box style={{ flexDirection: 'column', flexGrow: 1, gap: 1 }}>
      {adding ? (
        <InlineEditor
          initial=""
          placeholder="Add a habit…"
          onSave={(name) => {
            void commands.run('habit.add', { name });
            setAdding(false);
          }}
          onCancel={() => setAdding(false)}
        />
      ) : (
        <Button label="Add habit" onPress={() => setAdding(true)} />
      )}
      {state.habits.length === 0 ? (
        <EmptyState message="No habits yet — add one to start tracking." />
      ) : (
        <>
          <DayHeaders
            dates={dates}
            density={density}
            nameWidth={nameWidth}
            showStreaks={showStreaks}
          />
          <scrollbox style={{ flexGrow: 1 }}>
            {state.habits.map((habit) => (
              <HabitRow
                key={habit.id}
                habit={habit}
                state={state}
                dates={dates}
                today={today}
                nameWidth={nameWidth}
                showStreaks={showStreaks}
              />
            ))}
          </scrollbox>
        </>
      )}
    </box>
  );
}
