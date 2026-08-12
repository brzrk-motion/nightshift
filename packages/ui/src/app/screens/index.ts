/**
 * The five built-in nav-rail destinations beyond the dashboard. Each one
 * reads only `entities` and `commands` — the two things every `AppRuntime`
 * already has — so this folder never has to depend on the vibe engine, the
 * plugin host or the automation engine directly. Where a screen needs data
 * only the CLI's runtime wiring can produce (which plugins are loaded, which
 * vibes exist, which vibe is active), it reads it from a well-known entity
 * id (`nightshift.plugins`, `nightshift.vibes`, `nightshift.vibe`,
 * `nightshift.dashboards`, …) and simply shows less if nothing has published
 * one — see `apps/cli/src/runtime.ts`.
 */

import type { Screen } from '../screen.js';
import { AppsScreen } from './AppsScreen.js';
import { AutomationsScreen } from './AutomationsScreen.js';
import { EntitiesScreen } from './EntitiesScreen.js';
import { SettingsScreen } from './SettingsScreen.js';
import { VibesScreen } from './VibesScreen.js';

export const DEFAULT_SCREENS: readonly Screen[] = [
  { id: 'vibes', label: 'Vibes', icon: 'vibes', render: VibesScreen },
  { id: 'apps', label: 'Apps', icon: 'apps', render: AppsScreen },
  { id: 'entities', label: 'Entities', icon: 'entities', render: EntitiesScreen },
  { id: 'automations', label: 'Automations', icon: 'automations', render: AutomationsScreen },
  { id: 'settings', label: 'Settings', icon: 'settings', render: SettingsScreen },
];

export { AppsScreen, AutomationsScreen, EntitiesScreen, SettingsScreen, VibesScreen };
