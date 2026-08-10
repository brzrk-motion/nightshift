import { notImplemented, type Json, type Unsubscribe } from '@nightshift/core';
import type { EntityId } from '@nightshift/entities';

/**
 * Automations connect events to actions: "when the focus timer finishes,
 * switch to the break vibe". Phase 4 implements the engine.
 */

export type Trigger =
  | { type: 'startup' }
  | { type: 'entity'; entity: EntityId; /** Fires only when this key changes. */ key?: string }
  | { type: 'vibe'; vibe: string; on: 'activate' | 'deactivate' }
  | { type: 'interval'; seconds: number };

export type Condition =
  | { type: 'equals'; entity: EntityId; key: string; value: Json }
  | { type: 'above'; entity: EntityId; key: string; value: number }
  | { type: 'below'; entity: EntityId; key: string; value: number };

export interface Action {
  command: string;
  args?: Record<string, Json>;
}

export interface AutomationSpec {
  name: string;
  enabled?: boolean;
  when: Trigger;
  /** All conditions must hold for the actions to run. */
  and?: Condition[];
  then: Action[];
}

export interface AutomationEngine {
  register(automation: AutomationSpec): Unsubscribe;
  start(): void;
  stop(): void;
}

/** Builds the automation engine. Implemented in Phase 4. */
export function createAutomationEngine(): AutomationEngine {
  return notImplemented('The automation engine', 'Phase 4');
}
