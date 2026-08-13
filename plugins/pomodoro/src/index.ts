import { definePlugin, type Json, type PluginContext } from '@nightshift/sdk';
import {
  initialState,
  POMODORO_ENTITY,
  pauseSession,
  resetSession,
  skipPhase,
  startSession,
  stopSession,
  tickSession,
  todayKey,
  type PomodoroPhase,
  type PomodoroState,
} from './timer.js';
import { SessionWidget, TodayWidget } from './widgets.js';

interface StoredProgress {
  date: string;
  completedPomodorosToday: number;
  cycleCount: number;
  [key: string]: Json;
}

function isStoredProgress(value: unknown): value is StoredProgress {
  return (
    typeof value === 'object' &&
    value !== null &&
    typeof (value as StoredProgress).date === 'string' &&
    typeof (value as StoredProgress).completedPomodorosToday === 'number' &&
    typeof (value as StoredProgress).cycleCount === 'number'
  );
}

const PHASE_NOTIFY_SLUG: Record<PomodoroPhase, string> = {
  work: 'work',
  shortBreak: 'short-break',
  longBreak: 'long-break',
};

function notifyOnPhaseComplete(
  context: PluginContext,
  phase: PomodoroPhase,
  message: string,
  tone: 'success' | 'accent',
): void {
  context.registerAutomation({
    name: `pomodoro.notify-${PHASE_NOTIFY_SLUG[phase]}-complete`,
    when: { type: 'entity', entity: POMODORO_ENTITY, key: 'status' },
    and: [
      { type: 'equals', entity: POMODORO_ENTITY, key: 'status', value: 'phaseComplete' },
      { type: 'equals', entity: POMODORO_ENTITY, key: 'phase', value: phase },
    ],
    then: [{ command: 'app.notify', args: { message, tone } }],
  });
}

export default definePlugin({
  id: 'pomodoro',
  name: 'Pomodoro',
  version: '0.1.0',
  description: 'Work intervals with short and long breaks.',
  capabilities: [
    'entities:read',
    'entities:write',
    'widgets:register',
    'commands:register',
    'automations:register',
    'storage',
  ],

  async setup(context: PluginContext) {
    const stored = await context.storage.get<StoredProgress>('progress');
    const sameDay = stored && isStoredProgress(stored) && stored.date === todayKey();
    const completedPomodorosToday = sameDay ? stored.completedPomodorosToday : 0;
    const cycleCount = sameDay ? stored.cycleCount : 0;

    context.registerEntity(POMODORO_ENTITY, initialState(completedPomodorosToday, cycleCount), {
      title: 'Pomodoro session',
      unit: 'seconds',
      owner: 'pomodoro',
    });

    const read = (): PomodoroState =>
      context.entities.get<PomodoroState>(POMODORO_ENTITY)?.state ?? initialState();
    const write = (next: PomodoroState): void => void context.entities.set(POMODORO_ENTITY, next);

    const persistProgress = (state: PomodoroState): void => {
      context.storage
        .set('progress', {
          date: todayKey(),
          completedPomodorosToday: state.completedPomodorosToday,
          cycleCount: state.cycleCount,
        })
        .catch((error: unknown) => {
          context.log.warn('Could not save today’s pomodoro progress', { error: `${error}` });
        });
    };

    context.registerCommand({
      id: 'pomodoro.start',
      title: 'Start pomodoro',
      run: () => write(startSession(read())),
    });
    context.registerCommand({
      id: 'pomodoro.pause',
      title: 'Pause pomodoro',
      run: () => write(pauseSession(read())),
    });
    context.registerCommand({
      id: 'pomodoro.stop',
      title: 'Stop pomodoro',
      run: () => write(stopSession(read())),
    });
    context.registerCommand({
      id: 'pomodoro.reset',
      title: 'Reset pomodoro',
      run: () => write(resetSession(read())),
    });
    context.registerCommand({
      id: 'pomodoro.skip',
      title: 'Skip pomodoro phase',
      run: () => write(skipPhase(read())),
    });

    const timer = setInterval(() => {
      const before = read();
      const after = tickSession(before, 1);
      if (after === before) return;
      write(after);

      if (after.status === 'phaseComplete' && after.phase === 'work') {
        persistProgress(after);
      }
    }, 1000);
    timer.unref?.();
    context.own(() => clearInterval(timer));

    context.registerWidget({
      type: 'pomodoro.session',
      title: 'Pomodoro',
      entities: [POMODORO_ENTITY],
      description: 'The running timer, current phase, and start/pause/skip controls.',
      render: SessionWidget,
    });
    context.registerWidget({
      type: 'pomodoro.today',
      title: "Today's pomodoros",
      entities: [POMODORO_ENTITY],
      description: 'How many focus intervals have finished today.',
      render: TodayWidget,
    });

    notifyOnPhaseComplete(context, 'work', 'Pomodoro complete — time for a break.', 'success');
    notifyOnPhaseComplete(context, 'shortBreak', 'Break over — ready to focus?', 'accent');
    notifyOnPhaseComplete(context, 'longBreak', 'Long break over — ready to focus?', 'accent');

    context.log.info('Pomodoro plugin ready');
  },
});

export { POMODORO_ENTITY } from './timer.js';
export {
  DEFAULT_LONG_BREAK_MINUTES,
  DEFAULT_POMODOROS_PER_LONG_BREAK,
  DEFAULT_SHORT_BREAK_MINUTES,
  DEFAULT_WORK_MINUTES,
  formatDuration,
  initialState,
  pauseSession,
  phaseLabel,
  resetSession,
  sessionProgress,
  skipPhase,
  startSession,
  stopSession,
  tickSession,
  todayKey,
  type PomodoroPhase,
  type PomodoroState,
  type PomodoroStatus,
} from './timer.js';
export { SessionWidget, TodayWidget } from './widgets.js';
