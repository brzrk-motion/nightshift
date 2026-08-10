export type { Action, AutomationSpec, Condition, Trigger } from './schema.js';
export {
  createAutomationEngine,
  type AutomationEngine,
  type AutomationEngineEvents,
  type AutomationEngineOptions,
  type AutomationFireResult,
  type CommandRunner,
} from './engine.js';
