import type { Json, Unsubscribe } from '@nightshift/core';

/**
 * Entities are the shared state layer. Every plugin publishes its state as
 * entities, and dashboards and vibes read and write nothing else — which is
 * what keeps widgets decoupled from the plugins behind them.
 *
 * Ids are namespaced `<domain>.<name>`, e.g. `timer.focus`.
 */
export type EntityId = `${string}.${string}`;

export interface EntityMeta {
  /** Short label suitable for a widget header. */
  title?: string;
  /** Unit for numeric entities, e.g. `seconds`. */
  unit?: string;
  /** Plugin that owns this entity. */
  owner?: string;
}

export interface Entity<State extends Json = Json> {
  id: EntityId;
  state: State;
  meta: EntityMeta;
  /** Epoch milliseconds of the last state change. */
  updatedAt: number;
}

export type EntityListener<State extends Json = Json> = (entity: Entity<State>) => void;

/**
 * The read/write surface the runtime hands to plugins, dashboards and vibes.
 * Implemented in Phase 2.
 */
export interface EntityStore {
  get<State extends Json = Json>(id: EntityId): Entity<State> | undefined;
  list(): Entity[];
  /** Registers an entity, or replaces one already registered under this id. */
  register<State extends Json = Json>(id: EntityId, state: State, meta?: EntityMeta): Entity<State>;
  /** Merges a partial state update and notifies subscribers. */
  update<State extends Json = Json>(id: EntityId, state: Partial<State>): Entity<State>;
  remove(id: EntityId): boolean;
  /** Subscribes to one entity, or to every entity when `id` is omitted. */
  subscribe<State extends Json = Json>(id: EntityId, listener: EntityListener<State>): Unsubscribe;
  subscribeAll(listener: EntityListener): Unsubscribe;
}

const ENTITY_ID = /^[a-z][a-z0-9_-]*\.[a-z][a-z0-9_-]*$/;

export function isEntityId(value: unknown): value is EntityId {
  return typeof value === 'string' && ENTITY_ID.test(value);
}
