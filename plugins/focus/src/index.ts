import { definePlugin, type Json, type PluginContext } from '@nightshift/sdk';
import { FOCUS_ENTITY } from './entity.js';
import {
  DEFAULT_SESSION_MINUTES,
  initialState,
  pauseSession,
  resetSession,
  startSession,
  stopSession,
  tickSession,
  todayKey,
  type FocusState,
} from './timer.js';
import { SessionWidget, TodayWidget } from './widgets.js';

/**
 * The focus timer — Nightshift's reference plugin, and proof that the public
 * SDK is enough to build against: an entity, a handful of commands, two
 * widgets built from the SDK's component library, and one automation, with
 * nothing reaching outside what `@nightshift/sdk` exports.
 */

interface StoredProgress {
  date: string;
  completedToday: number;
  [key: string]: Json;
}

function isStoredProgress(value: unknown): value is StoredProgress {
  return (
    typeof value === 'object' &&
    value !== null &&
    typeof (value as StoredProgress).date === 'string' &&
    typeof (value as StoredProgress).completedToday === 'number'
  );
}

function minutesArg(args: Record<string, Json> | undefined): number | undefined {
  const minutes = args?.['minutes'];
  return typeof minutes === 'number' && minutes > 0 ? minutes : undefined;
}

export default definePlugin({
  id: 'focus',
  name: 'Focus',
  version: '0.1.0',
  description: 'A focus timer with session tracking.',
  capabilities: [
    'entities:read',
    'entities:write',
    'widgets:register',
    'commands:register',
    'automations:register',
    'storage',
  ],

  async setup(context: PluginContext) {
    // Entities are the only state Nightshift keeps between processes, and it
    // does not persist them — so the running session always starts fresh, but
    // how many sessions finished today is worth remembering across restarts.
    const stored = await context.storage.get<StoredProgress>('progress');
    const completedToday =
      stored && isStoredProgress(stored) && stored.date === todayKey() ? stored.completedToday : 0;

    context.registerEntity(FOCUS_ENTITY, initialState(DEFAULT_SESSION_MINUTES, completedToday), {
      title: 'Focus session',
      unit: 'seconds',
      owner: 'focus',
    });

    const read = (): FocusState =>
      context.entities.get<FocusState>(FOCUS_ENTITY)?.state ?? initialState();
    const write = (next: FocusState): void => void context.entities.set(FOCUS_ENTITY, next);

    context.registerCommand({
      id: 'focus.start',
      title: 'Start focus session',
      run: (args) => write(startSession(read(), minutesArg(args))),
    });
    context.registerCommand({
      id: 'focus.pause',
      title: 'Pause focus session',
      run: () => write(pauseSession(read())),
    });
    context.registerCommand({
      id: 'focus.stop',
      title: 'Stop focus session',
      run: () => write(stopSession(read())),
    });
    context.registerCommand({
      id: 'focus.reset',
      title: 'Reset focus timer',
      run: () => write(resetSession(read())),
    });

    // One interval drives every session rather than one per `start` call, so
    // pausing and resuming never has to juggle timer handles.
    const timer = setInterval(() => {
      const before = read();
      const after = tickSession(before, 1);
      if (after === before) return;
      write(after);

      if (after.status === 'finished') {
        context.storage
          .set('progress', { date: todayKey(), completedToday: after.completedToday })
          .catch((error: unknown) => {
            context.log.warn('Could not save today’s focus progress', { error: `${error}` });
          });
      }
    }, 1000);
    timer.unref?.();
    context.own(() => clearInterval(timer));

    context.registerWidget({
      type: 'focus.session',
      title: 'Focus session',
      entities: [FOCUS_ENTITY],
      description: 'The running timer, its progress, and start/pause/stop/reset controls.',
      render: SessionWidget,
    });
    context.registerWidget({
      type: 'focus.today',
      title: "Today's focus",
      entities: [FOCUS_ENTITY],
      description: 'How many sessions have finished today.',
      render: TodayWidget,
    });

    // Proof that a plugin can react to its own state changing, not just
    // expose commands for something else to react to.
    context.registerAutomation({
      name: 'focus.notify-finished',
      when: { type: 'entity', entity: FOCUS_ENTITY, key: 'status' },
      and: [{ type: 'equals', entity: FOCUS_ENTITY, key: 'status', value: 'finished' }],
      then: [
        {
          command: 'app.notify',
          args: { message: 'Focus session complete. Nice work.', tone: 'success' },
        },
      ],
    });

    context.log.info('Focus plugin ready');
  },
});

export { FOCUS_ENTITY } from './entity.js';
export {
  DEFAULT_SESSION_MINUTES,
  formatDuration,
  initialState,
  pauseSession,
  resetSession,
  sessionProgress,
  startSession,
  stopSession,
  tickSession,
  todayKey,
  type FocusState,
  type FocusStatus,
} from './timer.js';
export { SessionWidget, TodayWidget } from './widgets.js';
