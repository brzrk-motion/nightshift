import { createContext, useCallback, useContext, useMemo, useSyncExternalStore } from 'react';
import type { ReactNode } from 'react';
import type { Json } from '@nightshift/core';
import type { Entity, EntityId, EntityStore } from '@nightshift/entities';
import { MIDNIGHT_THEME, type Theme, type ThemeEngine } from '../theme.js';
import type { CommandRegistry } from '../commands.js';
import type { Keymap } from '../keymap.js';
import type { ToastStore } from '../toasts.js';

/**
 * The runtime a component tree is rendering against. Components read what they
 * need through the hooks below rather than being handed it prop by prop, which
 * is what lets a plugin's widget be dropped into any dashboard.
 */
export interface AppRuntime {
  themes: ThemeEngine;
  entities: EntityStore;
  commands: CommandRegistry;
  keymap: Keymap;
  toasts: ToastStore;
  /** Terminal size, kept up to date by the shell. */
  size: { width: number; height: number };
  /** Shuts the app down cleanly. */
  quit(): void;
}

const ThemeContext = createContext<Theme>(MIDNIGHT_THEME);
const RuntimeContext = createContext<AppRuntime | undefined>(undefined);

export interface ThemeProviderProps {
  theme: Theme;
  children?: ReactNode;
}

/**
 * Provides the palette to everything below. Components fall back to midnight
 * when there is no provider, so a widget can be rendered on its own — in a
 * test, or in isolation — without ceremony.
 */
export function ThemeProvider({ theme, children }: ThemeProviderProps): ReactNode {
  return <ThemeContext.Provider value={theme}>{children}</ThemeContext.Provider>;
}

export function useTheme(): Theme {
  return useContext(ThemeContext);
}

export interface RuntimeProviderProps {
  runtime: AppRuntime;
  children?: ReactNode;
}

export function RuntimeProvider({ runtime, children }: RuntimeProviderProps): ReactNode {
  return <RuntimeContext.Provider value={runtime}>{children}</RuntimeContext.Provider>;
}

/** The runtime, or `undefined` outside a Nightshift app. */
export function useRuntime(): AppRuntime | undefined {
  return useContext(RuntimeContext);
}

/** The runtime, throwing if a component that needs it is used outside the app. */
export function useRequiredRuntime(): AppRuntime {
  const runtime = useContext(RuntimeContext);
  if (!runtime) {
    throw new Error('This component has to be rendered inside a Nightshift <AppShell>.');
  }
  return runtime;
}

export function useEntityStore(): EntityStore {
  return useRequiredRuntime().entities;
}

export function useCommands(): CommandRegistry {
  return useRequiredRuntime().commands;
}

export function useToasts(): ToastStore {
  return useRequiredRuntime().toasts;
}

/**
 * Subscribes to one entity and re-renders when it changes.
 *
 * The store hands out a new frozen entity on every write, so
 * `useSyncExternalStore` can compare snapshots by identity — a write that does
 * not touch this entity costs nothing.
 */
export function useEntity<State extends Json = Json>(
  id: EntityId,
  store?: EntityStore,
): Entity<State> | undefined {
  const runtime = useRuntime();
  const entities = store ?? runtime?.entities;

  const subscribe = useCallback(
    (onChange: () => void) => entities?.subscribe(id, onChange) ?? (() => {}),
    [entities, id],
  );
  const snapshot = useCallback(() => entities?.get<State>(id), [entities, id]);

  return useSyncExternalStore(subscribe, snapshot, snapshot);
}

/** Subscribes to several entities at once. */
export function useEntities(ids: readonly EntityId[], store?: EntityStore): (Entity | undefined)[] {
  const runtime = useRuntime();
  const entities = store ?? runtime?.entities;
  // Joining the ids gives the hooks below a dependency that stays stable even
  // when the caller passes a fresh array on every render.
  const key = ids.join(' ');
  const idList = useMemo(() => (key === '' ? [] : (key.split(' ') as EntityId[])), [key]);

  const subscribe = useCallback(
    (onChange: () => void) => {
      if (!entities) return () => {};
      const offs = idList.map((id) => entities.subscribe(id, onChange));
      return () => {
        for (const off of offs) off();
      };
    },
    [entities, idList],
  );

  // An array of snapshots cannot be compared by identity, so the subscription
  // watches a cheap version number and the array is rebuilt only when it moves.
  const version = useSyncExternalStore(
    subscribe,
    () => idList.reduce((sum, id) => sum + (entities?.get(id)?.updatedAt ?? 0), 0),
    () => 0,
  );

  return useMemo(
    () => idList.map((id) => entities?.get(id)),
    // `version` is what makes this recompute when an entity changes.
    [entities, idList, version],
  );
}
