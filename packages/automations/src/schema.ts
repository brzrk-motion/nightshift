import type { Json } from '@nightshift/core';
import type { EntityId } from '@nightshift/entities';

/**
 * Automations connect events to actions: "when the focus timer finishes,
 * notify me." They are the reactive counterpart to a vibe's `onActivate` —
 * a vibe applies state once, on command; an automation watches and fires
 * itself.
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
  /** Set to `false` to keep an automation registered but dormant. */
  enabled?: boolean;
  when: Trigger;
  /** All conditions must hold for the actions to run. */
  and?: Condition[];
  then: Action[];
}
