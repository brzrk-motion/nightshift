export { DEFAULT_DASHBOARD, type DashboardSpec, type RowSpec, type WidgetSpec } from './schema.js';
export {
  loadDashboardFile,
  loadDashboards,
  parseDashboard,
  type DashboardLoadResult,
  type ParseDashboardOptions,
} from './parse.js';
export { createWidgetRegistry, type WidgetDefinition, type WidgetRegistry } from './registry.js';
export { BUILT_IN_WIDGETS, MissingWidget } from './widgets.js';
export { Dashboard, type DashboardProps } from './Dashboard.js';
export { DashboardApp, type DashboardAppProps } from './DashboardApp.js';
