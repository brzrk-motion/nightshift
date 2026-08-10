import type { Unsubscribe } from './types.js';

/**
 * The event bus every part of the runtime is built on: the entity store, the
 * plugin host, the vibe engine. Events are described by a map of name to
 * argument tuple, so subscribers get their payload typed without any casts.
 *
 * ```ts
 * const bus = createEventBus<{ tick: [count: number] }>();
 * bus.on('tick', (count) => count + 1);
 * bus.emit('tick', 1);
 * ```
 */
export type EventMap = Record<string, unknown[]>;

export type EventListener<Args extends unknown[]> = (...args: Args) => void;

/** Reports a listener that threw, so one bad subscriber cannot stop the rest. */
export type EventErrorHandler = (error: unknown, event: string) => void;

export interface EventBus<Events extends EventMap> {
  on<Name extends keyof Events & string>(
    event: Name,
    listener: EventListener<Events[Name]>,
  ): Unsubscribe;
  /** Subscribes for a single emission. */
  once<Name extends keyof Events & string>(
    event: Name,
    listener: EventListener<Events[Name]>,
  ): Unsubscribe;
  off<Name extends keyof Events & string>(event: Name, listener: EventListener<Events[Name]>): void;
  emit<Name extends keyof Events & string>(event: Name, ...args: Events[Name]): void;
  listenerCount(event?: keyof Events & string): number;
  /** Drops every listener, for one event or for all of them. */
  clear(event?: keyof Events & string): void;
}

export interface EventBusOptions {
  /** Called when a listener throws. Defaults to rethrowing asynchronously. */
  onError?: EventErrorHandler;
}

export function createEventBus<Events extends EventMap>(
  options: EventBusOptions = {},
): EventBus<Events> {
  const listeners = new Map<string, Set<EventListener<never>>>();

  const onError =
    options.onError ??
    ((error: unknown) => {
      // Escaping to the task queue keeps the emitter's loop going while still
      // surfacing the failure as an unhandled error rather than swallowing it.
      queueMicrotask(() => {
        throw error;
      });
    });

  const add = (event: string, listener: EventListener<never>): Unsubscribe => {
    const set = listeners.get(event) ?? new Set<EventListener<never>>();
    listeners.set(event, set);
    set.add(listener);
    let live = true;
    return () => {
      if (!live) return;
      live = false;
      set.delete(listener);
      if (set.size === 0) listeners.delete(event);
    };
  };

  return {
    on(event, listener) {
      return add(event, listener as EventListener<never>);
    },

    once(event, listener) {
      const wrapper = ((...args: unknown[]) => {
        dispose();
        (listener as EventListener<unknown[]>)(...args);
      }) as EventListener<never>;
      const dispose = add(event, wrapper);
      return dispose;
    },

    off(event, listener) {
      const set = listeners.get(event);
      if (!set) return;
      set.delete(listener as EventListener<never>);
      if (set.size === 0) listeners.delete(event);
    },

    emit(event, ...args) {
      const set = listeners.get(event);
      if (!set) return;
      // Iterating a copy means a listener may subscribe or unsubscribe during
      // dispatch without changing who receives this emission.
      for (const listener of [...set]) {
        try {
          (listener as EventListener<unknown[]>)(...args);
        } catch (error) {
          onError(error, event);
        }
      }
    },

    listenerCount(event) {
      if (event !== undefined) return listeners.get(event)?.size ?? 0;
      let total = 0;
      for (const set of listeners.values()) total += set.size;
      return total;
    },

    clear(event) {
      if (event === undefined) listeners.clear();
      else listeners.delete(event);
    },
  };
}
