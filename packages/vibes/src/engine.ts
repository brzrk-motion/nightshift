import { runActions, type CommandRunner } from '@nightshift/automations';
import { createEventBus, NightshiftError, type EventBus } from '@nightshift/core';
import type { EntityStore } from '@nightshift/entities';
import type { VibeSpec } from './schema.js';

export type { CommandRunner };

/**
 * The narrow slices of the theme engine and command registry the vibe engine
 * needs. Defined here rather than imported from `@nightshift/ui` so that
 * package — the terminal UI and its React components — never has to be pulled
 * into a headless vibe engine, in tests or otherwise.
 */
export interface ThemeSwitcher {
  resolve(name: string): unknown | undefined;
  activate(name: string): unknown;
}

export interface VibeActivationResult {
  vibe: VibeSpec;
  /** Problems that did not stop activation — an unknown theme, a failed action. */
  warnings: string[];
}

export interface VibeEngineEvents extends Record<string, unknown[]> {
  activated: [result: VibeActivationResult];
  deactivated: [name: string, warnings: string[]];
}

export interface VibeEngine {
  register(vibe: VibeSpec): () => void;
  get(name: string): VibeSpec | undefined;
  list(): VibeSpec[];
  /** Name of the active vibe, or `undefined` when none is. */
  readonly current: string | undefined;
  /** Applies a vibe's theme, dashboard, entities and activation actions. */
  activate(name: string): Promise<VibeActivationResult>;
  /** Runs the active vibe's deactivation actions and clears it. */
  deactivate(): Promise<void>;
  readonly events: EventBus<VibeEngineEvents>;
}

export interface VibeEngineOptions {
  themes: ThemeSwitcher;
  entities: EntityStore;
  commands: CommandRunner;
}

export function createVibeEngine(options: VibeEngineOptions): VibeEngine {
  const { themes, entities, commands } = options;
  const vibes = new Map<string, VibeSpec>();
  const events = createEventBus<VibeEngineEvents>();
  let current: string | undefined;

  const engine: VibeEngine = {
    register(vibe) {
      vibes.set(vibe.name, vibe);
      return () => {
        vibes.delete(vibe.name);
        if (current === vibe.name) current = undefined;
      };
    },

    get: (name) => vibes.get(name),
    list: () => [...vibes.values()].sort((a, b) => a.name.localeCompare(b.name)),
    get current() {
      return current;
    },

    async activate(name) {
      const vibe = vibes.get(name);
      if (!vibe) {
        throw new NightshiftError('VIBE_NOT_FOUND', `No vibe named "${name}".`, {
          hint: 'Run `nightshift vibe --list` to see what is available.',
        });
      }

      const warnings: string[] = [];

      // The outgoing vibe gets to wind down — stop its timers, drop its
      // theme — before the incoming one applies anything.
      if (current && current !== name) await engine.deactivate();

      if (vibe.theme !== undefined) {
        if (themes.resolve(vibe.theme)) themes.activate(vibe.theme);
        else warnings.push(`Theme "${vibe.theme}" is not registered.`);
      }

      for (const [id, state] of Object.entries(vibe.entities ?? {})) {
        try {
          entities.update(id as `${string}.${string}`, state);
        } catch (error) {
          const reason = error instanceof Error ? error.message : String(error);
          warnings.push(`Could not update "${id}": ${reason}`);
        }
      }

      if (vibe.dashboard !== undefined) {
        try {
          await commands.run(`dashboard.open.${vibe.dashboard}`);
        } catch {
          warnings.push(`Dashboard "${vibe.dashboard}" is not available.`);
        }
      }

      await runActions(commands, vibe.onActivate ?? [], warnings);

      current = vibe.name;
      const result: VibeActivationResult = { vibe, warnings };
      events.emit('activated', result);
      return result;
    },

    async deactivate() {
      if (!current) return;
      const vibe = vibes.get(current);
      const name = current;
      current = undefined;
      const warnings: string[] = [];
      if (vibe?.onDeactivate) await runActions(commands, vibe.onDeactivate, warnings);
      events.emit('deactivated', name, warnings);
    },

    events,
  };

  return engine;
}
