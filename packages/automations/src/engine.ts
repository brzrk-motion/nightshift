import { createEventBus, type EventBus, type Json, type Unsubscribe } from '@nightshift/core';
import type { EntityStore } from '@nightshift/entities';
import type { AutomationSpec, Condition } from './schema.js';

/**
 * The slice of the command registry the automation engine needs — narrow so
 * the engine stays headless and testable without the terminal UI.
 */
export interface CommandRunner {
  run(id: string, args?: Record<string, Json>): void | Promise<void>;
}

export interface AutomationFireResult {
  name: string;
  /** A failed action does not stop the rest; each failure becomes a warning. */
  warnings: string[];
}

export interface AutomationEngineEvents extends Record<string, unknown[]> {
  fired: [result: AutomationFireResult];
}

export interface AutomationEngine {
  /** Registers an automation. Wires it up immediately if the engine is running. */
  register(automation: AutomationSpec): Unsubscribe;
  unregister(name: string): boolean;
  get(name: string): AutomationSpec | undefined;
  list(): AutomationSpec[];
  /** Wires up interval and entity triggers, and fires every `startup` trigger once. */
  start(): void;
  /** Tears down every interval and subscription. Safe to call repeatedly. */
  stop(): void;
  readonly running: boolean;
  /** Feeds a vibe's activation or deactivation to any `vibe` triggers. */
  notifyVibe(vibe: string, on: 'activate' | 'deactivate'): void;
  readonly events: EventBus<AutomationEngineEvents>;
}

export interface AutomationEngineOptions {
  entities: EntityStore;
  commands: CommandRunner;
}

/**
 * Whether a single condition holds against the entity store right now.
 * Exported so anything else that gates on the same shape of condition — a
 * dashboard widget's conditional visibility, for one — does not have to
 * reimplement `equals`/`above`/`below`.
 */
export function checkCondition(entities: EntityStore, condition: Condition): boolean {
  const entity = entities.get(condition.entity);
  if (!entity) return false;
  const value = (entity.state as Record<string, Json>)[condition.key];

  switch (condition.type) {
    case 'equals':
      return value === condition.value;
    case 'above':
      return typeof value === 'number' && value > condition.value;
    case 'below':
      return typeof value === 'number' && value < condition.value;
  }
}

/**
 * Runs a list of command actions, collecting a warning for each one that fails
 * rather than stopping at the first — shared by the vibe and automation engines.
 */
export async function runActions(
  commands: CommandRunner,
  actions: readonly { command: string; args?: Record<string, Json> }[],
  warnings: string[],
): Promise<void> {
  for (const action of actions) {
    try {
      await commands.run(action.command, action.args);
    } catch (error) {
      warnings.push(
        `"${action.command}" failed: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }
}

/**
 * The automation engine: triggers wire themselves up on `start()`, conditions
 * gate whether a trigger's actions run, and every fire is reported through
 * `events` rather than thrown — the same "report, don't crash" shape as the
 * plugin host and the vibe engine.
 */
export function createAutomationEngine(options: AutomationEngineOptions): AutomationEngine {
  const { entities, commands } = options;
  const automations = new Map<string, AutomationSpec>();
  const teardowns = new Map<string, () => void>();
  const events = createEventBus<AutomationEngineEvents>();
  let running = false;

  const fire = async (automation: AutomationSpec): Promise<void> => {
    if (automation.enabled === false) return;
    if (!(automation.and ?? []).every((condition) => checkCondition(entities, condition))) return;

    const warnings: string[] = [];
    await runActions(commands, automation.then, warnings);
    events.emit('fired', { name: automation.name, warnings });
  };

  const wire = (automation: AutomationSpec): (() => void) => {
    if (automation.enabled === false) return () => {};
    const { when } = automation;

    if (when.type === 'interval') {
      const handle = setInterval(() => void fire(automation), Math.max(1, when.seconds) * 1000);
      handle.unref?.();
      return () => clearInterval(handle);
    }

    if (when.type === 'entity') {
      return entities.events.on('updated', (change) => {
        if (change.entity.id !== when.entity) return;
        if (when.key !== undefined && change.previous !== undefined) {
          const before = (change.previous as Record<string, Json>)[when.key];
          const after = (change.entity.state as Record<string, Json>)[when.key];
          if (before === after) return;
        }
        void fire(automation);
      });
    }

    // `vibe` triggers fire through notifyVibe and `startup` triggers fire once
    // in start(); neither needs an ongoing subscription here.
    return () => {};
  };

  const engine: AutomationEngine = {
    register(automation) {
      automations.set(automation.name, automation);
      if (running) {
        teardowns.set(automation.name, wire(automation));
        if (automation.when.type === 'startup' && automation.enabled !== false)
          void fire(automation);
      }
      return () => void engine.unregister(automation.name);
    },

    unregister(name) {
      teardowns.get(name)?.();
      teardowns.delete(name);
      return automations.delete(name);
    },

    get: (name) => automations.get(name),
    list: () => [...automations.values()].sort((a, b) => a.name.localeCompare(b.name)),

    start() {
      if (running) return;
      running = true;
      for (const automation of automations.values()) {
        teardowns.set(automation.name, wire(automation));
      }
      for (const automation of automations.values()) {
        if (automation.when.type === 'startup' && automation.enabled !== false)
          void fire(automation);
      }
    },

    stop() {
      running = false;
      for (const teardown of teardowns.values()) teardown();
      teardowns.clear();
    },

    get running() {
      return running;
    },

    notifyVibe(vibe, on) {
      if (!running) return;
      for (const automation of automations.values()) {
        const { when } = automation;
        if (when.type === 'vibe' && when.vibe === vibe && when.on === on) void fire(automation);
      }
    },

    events,
  };

  return engine;
}
