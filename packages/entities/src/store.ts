import { createEventBus, NightshiftError, type Json, type Unsubscribe } from '@nightshift/core';
import {
  isEntityId,
  type Entity,
  type EntityChange,
  type EntityEvents,
  type EntityId,
  type EntityListener,
  type EntityMeta,
  type EntityStore,
} from './types.js';

export interface EntityStoreOptions {
  /** Entities to register up front. */
  initial?: { id: EntityId; state: Json; meta?: EntityMeta }[];
  /** Clock used for `updatedAt`. Injectable so tests stay deterministic. */
  now?: () => number;
  /** Called when a subscriber throws, instead of letting it escape the emit. */
  onListenerError?: (error: unknown, event: string) => void;
}

function isPlainObject(value: unknown): value is Record<string, Json> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * The entity store: a registry of observable state plus the bus that announces
 * every change.
 *
 * Each write produces a *new* frozen `Entity` object rather than mutating the
 * one already handed out. Widgets can therefore compare by identity to decide
 * whether to re-render, and a listener can hold on to the value it received
 * without it changing underneath.
 */
export function createEntityStore(options: EntityStoreOptions = {}): EntityStore {
  const now = options.now ?? Date.now;
  const entities = new Map<EntityId, Entity>();
  const events = createEventBus<EntityEvents>(
    options.onListenerError ? { onError: options.onListenerError } : {},
  );

  const assertId = (id: EntityId): void => {
    if (!isEntityId(id)) {
      throw new NightshiftError('ENTITY_NOT_FOUND', `"${id}" is not a valid entity id.`, {
        hint: 'Ids look like `<domain>.<name>`, in lower case — for example `timer.focus`.',
      });
    }
  };

  const require_ = (id: EntityId): Entity => {
    const entity = entities.get(id);
    if (!entity) {
      throw new NightshiftError('ENTITY_NOT_FOUND', `No entity registered as "${id}".`, {
        hint: 'Register it first, or check that the plugin that owns it is loaded.',
      });
    }
    return entity;
  };

  const commit = (entity: Entity, change: EntityChange): void => {
    entities.set(entity.id, entity);
    events.emit('change', change);
    if (change.kind === 'registered') events.emit('registered', entity);
    else events.emit('updated', change);
  };

  const write = <State extends Json>(id: EntityId, state: State, merge: boolean): Entity<State> => {
    const current = require_(id);
    const previous = current.state;
    const next =
      merge && isPlainObject(previous) && isPlainObject(state)
        ? ({ ...previous, ...state } as Json)
        : (state as Json);

    const entity = Object.freeze({
      id,
      state: next,
      meta: current.meta,
      updatedAt: now(),
    }) as Entity;

    commit(entity, { kind: 'updated', entity, previous });
    return entity as Entity<State>;
  };

  const store: EntityStore = {
    get<State extends Json = Json>(id: EntityId): Entity<State> | undefined {
      return entities.get(id) as Entity<State> | undefined;
    },

    has(id) {
      return entities.has(id);
    },

    list() {
      return [...entities.values()].sort((a, b) => a.id.localeCompare(b.id));
    },

    register<State extends Json = Json>(
      id: EntityId,
      state: State,
      meta: EntityMeta = {},
    ): Entity<State> {
      assertId(id);
      const entity = Object.freeze({
        id,
        state: state as Json,
        meta: Object.freeze({ ...meta }),
        updatedAt: now(),
      }) as Entity;

      commit(entity, { kind: 'registered', entity });
      return entity as Entity<State>;
    },

    update<State extends Json = Json>(id: EntityId, state: Partial<State>): Entity<State> {
      return write(id, state as State, true);
    },

    set<State extends Json = Json>(id: EntityId, state: State): Entity<State> {
      return write(id, state, false);
    },

    remove(id) {
      const entity = entities.get(id);
      if (!entity) return false;
      entities.delete(id);
      events.emit('change', { kind: 'removed', entity, previous: entity.state });
      events.emit('removed', entity);
      return true;
    },

    subscribe<State extends Json = Json>(
      id: EntityId,
      listener: EntityListener<State>,
    ): Unsubscribe {
      return events.on('change', (change) => {
        if (change.entity.id === id) listener(change.entity as Entity<State>);
      });
    },

    subscribeAll(listener) {
      return events.on('change', (change) => listener(change.entity));
    },

    events,

    clear() {
      for (const id of [...entities.keys()]) store.remove(id);
    },
  };

  for (const entry of options.initial ?? []) {
    store.register(entry.id, entry.state, entry.meta);
  }

  return store;
}
