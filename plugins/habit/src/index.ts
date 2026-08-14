import { argString, definePlugin, type PluginContext } from '@nightshift/sdk';
import { todayKey } from '@nightshift/plugin-shared';
import { HABIT_ENTITY, initialState, type HabitState } from './entity.js';
import { addHabit, removeHabit, renameHabit, toggleCompletion } from './habits.js';
import { parseStored, serializeState, STORAGE_KEY } from './storage.js';
import { HabitTrackerWidget } from './widgets.js';

export default definePlugin({
  id: 'habit',
  name: 'Habit Tracker',
  version: '0.1.0',
  description: 'Rolling 7-day habit grid with current and longest streaks.',
  capabilities: [
    'entities:read',
    'entities:write',
    'widgets:register',
    'commands:register',
    'storage',
  ],

  async setup(context: PluginContext) {
    const stored = await context.storage.get(STORAGE_KEY).catch((error: unknown) => {
      context.log.warn('Could not read habit storage; starting empty', {
        error: `${error}`,
      });
      return undefined;
    });
    const initial = parseStored(stored);

    context.registerEntity(HABIT_ENTITY, initial, {
      title: 'Habit tracker',
      owner: 'habit',
    });

    const read = (): HabitState =>
      context.entities.get<HabitState>(HABIT_ENTITY)?.state ?? initialState();

    const write = (next: HabitState): void => {
      context.entities.set(HABIT_ENTITY, next);
      context.storage.set(STORAGE_KEY, serializeState(next)).catch((error: unknown) => {
        context.log.warn('Could not save habit state', { error: `${error}` });
      });
    };

    context.registerCommand({
      id: 'habit.add',
      title: 'Add habit',
      run: (args) => {
        write(addHabit(read(), argString(args, 'name') ?? ''));
      },
    });

    context.registerCommand({
      id: 'habit.toggle',
      title: 'Toggle habit day',
      run: (args) => {
        const id = argString(args, 'id') ?? '';
        const dateArg = argString(args, 'date');
        const today = todayKey();
        const date = dateArg ?? today;
        write(toggleCompletion(read(), id, date, today));
      },
    });

    context.registerCommand({
      id: 'habit.rename',
      title: 'Rename habit',
      run: (args) => {
        write(renameHabit(read(), argString(args, 'id') ?? '', argString(args, 'name') ?? ''));
      },
    });

    context.registerCommand({
      id: 'habit.remove',
      title: 'Remove habit',
      run: (args) => {
        write(removeHabit(read(), argString(args, 'id') ?? ''));
      },
    });

    context.registerWidget({
      type: 'habit.tracker',
      title: 'Habits',
      entities: [HABIT_ENTITY],
      description: 'Rolling 7-day habit grid with streaks — add, toggle, rename, delete.',
      render: HabitTrackerWidget,
    });

    context.log.info('Habit plugin ready');
  },
});

export { HABIT_ENTITY, initialState, type Habit, type HabitState } from './entity.js';
export { addHabit, isCompleted, removeHabit, renameHabit, toggleCompletion } from './habits.js';
export {
  addDays,
  dayHeaderLabel,
  isDateKey,
  nameColumnWidth,
  resolveDensity,
  rollingWindow,
  truncateName,
  type HabitDensity,
} from './layout.js';
export { parseStored, serializeState, STORAGE_KEY, STORAGE_VERSION } from './storage.js';
export { currentStreak, longestStreak, streakSummary } from './streaks.js';
export { HabitTrackerWidget } from './widgets.js';
