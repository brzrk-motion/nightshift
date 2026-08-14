// `import type` (not `import { type … }`) so emit fully elides the SDK import —
// otherwise verbatimModuleSyntax leaves `import {} from '@nightshift/sdk'` at runtime.
import type { EntityId, EntityMeta, Json, PluginContext } from '@nightshift/sdk';
import { todayKey } from './dates.js';

/** Storage blob keyed by calendar date for daily progress counters. */
export interface DatedProgress {
  date: string;
  [key: string]: Json;
}

export function isDatedProgress(value: unknown): value is DatedProgress {
  return (
    typeof value === 'object' && value !== null && typeof (value as DatedProgress).date === 'string'
  );
}

export interface CountdownEntityConfig {
  id: EntityId;
  meta?: EntityMeta;
}

type CountdownReducersBase<TState extends Json> = {
  /** Build entity state from today's stored progress, or fresh defaults when absent. */
  initialState: (stored: DatedProgress | undefined) => TState;
  tick: (state: TState, elapsedSeconds: number) => TState;
};

/**
 * Persistence is all-or-nothing: `persistOnTick` without `toStoredProgress`
 * would overwrite storage with a bare `{ date }`, wiping daily counters.
 */
export type CountdownReducers<TState extends Json> = CountdownReducersBase<TState> &
  (
    | {
        persistOnTick?: undefined;
        toStoredProgress?: undefined;
      }
    | {
        persistOnTick: (before: TState, after: TState) => boolean;
        toStoredProgress: (state: TState) => DatedProgress;
      }
  );

export interface WireCountdownPluginOptions<TState extends Json> {
  context: PluginContext;
  entity: CountdownEntityConfig;
  reducers: CountdownReducers<TState>;
  storageKey?: string;
  persistFailedMessage?: string;
}

export interface CountdownWire<TState> {
  read: () => TState;
  write: (state: TState) => void;
}

/**
 * Registers a countdown entity, restores dated storage, and runs a shared 1 Hz
 * tick loop with optional progress persistence — the boilerplate duplicated by
 * timer plugins.
 */
export async function wireCountdownPlugin<TState extends Json>(
  options: WireCountdownPluginOptions<TState>,
): Promise<CountdownWire<TState>> {
  const { context, entity, reducers } = options;
  const storageKey = options.storageKey ?? 'progress';

  const raw = await context.storage.get(storageKey);
  const stored = raw && isDatedProgress(raw) && raw.date === todayKey() ? raw : undefined;

  context.registerEntity(entity.id, reducers.initialState(stored), entity.meta);

  const read = (): TState =>
    context.entities.get<TState>(entity.id)?.state ?? reducers.initialState(undefined);
  const write = (next: TState): void => void context.entities.set(entity.id, next);

  const timer = setInterval(() => {
    const before = read();
    const after = reducers.tick(before, 1);
    if (after === before) return;
    write(after);

    const { persistOnTick, toStoredProgress } = reducers;
    if (persistOnTick === undefined || !persistOnTick(before, after)) return;

    context.storage.set(storageKey, toStoredProgress(after)).catch((error: unknown) => {
      const message = options.persistFailedMessage ?? 'Could not save countdown progress';
      context.log.warn(message, { error: `${error}` });
    });
  }, 1000);
  timer.unref?.();
  context.own(() => clearInterval(timer));

  return { read, write };
}
