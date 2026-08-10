export {
  BUILT_IN_DASHBOARDS,
  DASHBOARD_SCHEMA_VERSION,
  DEFAULT_DASHBOARD,
  MINIMAL_DASHBOARD,
  NIGHTSHIFT_DASHBOARD,
  type DashboardSpec,
  type RowSpec,
  type WidgetSpec,
} from './schema.js';
export {
  loadDashboardFile,
  loadDashboards,
  mergeDashboards,
  parseDashboard,
  saveDashboard,
  serializeDashboard,
  type DashboardLoadResult,
  type ParseDashboardOptions,
} from './parse.js';
export {
  addWidget,
  clampAddress,
  cloneDashboard,
  flattenAddresses,
  moveHorizontal,
  moveVertical,
  nextAddress,
  removeWidget,
  resizeRowHeight,
  resizeSpan,
  swapWidget,
  newWeatherLocationId,
  specForPickedWidget,
  type EditResult,
  type WidgetAddress,
} from './edit.js';
export { createWidgetRegistry, type WidgetDefinition, type WidgetRegistry } from './registry.js';
export { BUILT_IN_WIDGETS, MissingWidget } from './widgets.js';
export { Dashboard, type DashboardProps } from './Dashboard.js';
export { DashboardApp, type DashboardAppProps } from './DashboardApp.js';
export { WidgetPicker, type WidgetPickerProps } from './WidgetPicker.js';
export { OnboardingModal, type OnboardingModalProps } from './Onboarding.js';
