import { definePlugin, type PluginContext } from '@nightshift/sdk';
import { todayKey, wireCountdownPlugin } from '@nightshift/plugin-shared';
import {
  initialState,
  POMODORO_ENTITY,
  pauseSession,
  resetSession,
  skipPhase,
  startSession,
  stopSession,
  tickSession,
  type PomodoroPhase,
} from './timer.js';
import { SessionWidget, TodayWidget } from './widgets.js';

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
    const { read, write } = await wireCountdownPlugin({
      context,
      entity: {
        id: POMODORO_ENTITY,
        meta: { title: 'Pomodoro session', unit: 'seconds', owner: 'pomodoro' },
      },
      reducers: {
        initialState: (stored) =>
          initialState(
            typeof stored?.completedPomodorosToday === 'number'
              ? stored.completedPomodorosToday
              : 0,
            typeof stored?.cycleCount === 'number' ? stored.cycleCount : 0,
          ),
        tick: tickSession,
        persistOnTick: (_before, after) =>
          after.status === 'phaseComplete' && after.phase === 'work',
        toStoredProgress: (state) => ({
          date: todayKey(),
          completedPomodorosToday: state.completedPomodorosToday,
          cycleCount: state.cycleCount,
        }),
      },
      persistFailedMessage: 'Could not save today’s pomodoro progress',
    });

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
  type PomodoroPhase,
  type PomodoroState,
  type PomodoroStatus,
} from './timer.js';
export { SessionWidget, TodayWidget } from './widgets.js';
