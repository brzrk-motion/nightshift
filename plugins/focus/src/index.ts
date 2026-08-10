import { definePlugin, type PluginContext } from '@nightshift/sdk';

/**
 * The focus timer — Nightshift's reference plugin, and proof that the public
 * SDK is enough to build against. Phase 1 registers the entity, the widgets
 * and the commands; Phase 5 makes the timer tick.
 */

export const FOCUS_ENTITY = 'timer.focus' as const;

export type FocusStatus = 'idle' | 'running' | 'paused' | 'finished';

export interface FocusState {
  status: FocusStatus;
  /** Length of the current session, in seconds. */
  durationSeconds: number;
  /** Seconds left in the current session. */
  remainingSeconds: number;
  /** Sessions completed today. */
  completedToday: number;
  [key: string]: string | number;
}

export const DEFAULT_SESSION_MINUTES = 25;

export function initialState(minutes = DEFAULT_SESSION_MINUTES): FocusState {
  return {
    status: 'idle',
    durationSeconds: minutes * 60,
    remainingSeconds: minutes * 60,
    completedToday: 0,
  };
}

/** Formats seconds as `MM:SS`, or `H:MM:SS` past an hour. */
export function formatDuration(totalSeconds: number): string {
  const seconds = Math.max(0, Math.floor(totalSeconds));
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const rest = seconds % 60;
  const pad = (value: number): string => String(value).padStart(2, '0');
  return hours > 0 ? `${hours}:${pad(minutes)}:${pad(rest)}` : `${pad(minutes)}:${pad(rest)}`;
}

export default definePlugin({
  id: 'focus',
  name: 'Focus',
  version: '0.1.0',
  description: 'A focus timer with session tracking.',
  capabilities: ['entities:read', 'entities:write', 'widgets:register', 'commands:register'],

  setup(context: PluginContext) {
    context.registerEntity(FOCUS_ENTITY, initialState(), {
      title: 'Focus session',
      unit: 'seconds',
      owner: 'focus',
    });

    context.registerWidget({
      type: 'focus.session',
      title: 'Focus session',
      entities: [FOCUS_ENTITY],
    });
    context.registerWidget({
      type: 'focus.today',
      title: "Today's focus",
      entities: [FOCUS_ENTITY],
    });

    for (const [id, title] of [
      ['focus.start', 'Start focus session'],
      ['focus.pause', 'Pause focus session'],
      ['focus.stop', 'Stop focus session'],
      ['focus.reset', 'Reset focus timer'],
    ] as const) {
      context.registerCommand({
        id,
        title,
        run: () => {
          // Phase 5 wires these to the timer loop.
          context.log.debug('Focus command invoked', { command: id });
        },
      });
    }

    context.log.info('Focus plugin ready');
  },
});
