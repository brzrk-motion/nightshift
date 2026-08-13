export {
  BUILT_IN_THEMES,
  createThemeEngine,
  DAYLIGHT_THEME,
  EMBER_THEME,
  extendTheme,
  getTheme,
  HEX_COLOR,
  MIDNIGHT_THEME,
  THEME_COLOR_KEYS,
  type Theme,
  type ThemeColorKey,
  type ThemeColors,
  type ThemeEngine,
  type ThemeEngineOptions,
  type ThemeOverride,
} from './theme.js';

export {
  deleteTheme,
  loadThemes,
  mergeThemes,
  parseTheme,
  saveTheme,
  serializeTheme,
  type ParseThemeOptions,
  type ThemeLoadResult,
} from './theme/parse.js';

export { themeFromMidnight, type ThemeSpec } from './theme/schema.js';

export { BORDERS, SPACING, type BorderToken, type SpacingToken } from './tokens.js';

export {
  formContentSize,
  formScale,
  useFormScale,
  type FormLayout,
  type FormScale,
  type FormScaleOptions,
} from './formLayout.js';

export { useShellContentSize } from './app/useShellContentSize.js';

export {
  COMPACT_WIDTH,
  distribute,
  isNavRailCollapsed,
  isRenderable,
  MIN_HEIGHT,
  MIN_WIDTH,
  NAV_RAIL_WIDTH,
  NAV_RAIL_WIDTH_COLLAPSED,
  planLayout,
  resolveBreakpoint,
  SHELL_FOOTER_ROWS,
  SHELL_HEADER_ROWS,
  shellContentSize,
  WIDE_WIDTH,
  type Breakpoint,
  type LayoutItem,
  type LayoutPlan,
  type LayoutRow,
  type PlacedItem,
  type PlacedRow,
  type TerminalSize,
} from './layout.js';

export {
  createKeymap,
  DEFAULT_KEYBINDINGS,
  formatChord,
  matchesChord,
  parseChord,
  type KeyBinding,
  type KeyChord,
  type KeyEventLike,
  type Keymap,
  type ResolvedBinding,
} from './keymap.js';

export {
  createCommandRegistry,
  scoreCommand,
  type Command,
  type CommandEvents,
  type CommandRegistry,
} from './commands.js';

export {
  createToastStore,
  type Toast,
  type ToastOptions,
  type ToastStore,
  type ToastStoreOptions,
  type ToastTone,
} from './toasts.js';

export { createKeyboardCapture, type KeyboardCapture } from './keyboardCapture.js';

export {
  activityStrip,
  barChart,
  lineChart,
  normalise,
  resample,
  resolveScale,
  sparkline,
  SPARK_CHARS,
  truncate,
  type BarChartOptions,
  type BarChartRow,
  type BarDatum,
  type LineChartOptions,
  type Scale,
  type SparklineOptions,
} from './charts.js';

export {
  RuntimeProvider,
  ThemeProvider,
  useCommands,
  useEntities,
  useEntity,
  useRequiredRuntime,
  useRuntime,
  useTheme,
  useToasts,
  type AppRuntime,
  type RuntimeProviderProps,
  type ThemeProviderProps,
} from './app/context.js';

export { createAppRuntime, type CreateAppRuntimeOptions } from './app/app.js';
export { AppShell, type AppShellProps, type Overlay } from './app/AppShell.js';
export { CommandPalette, type CommandPaletteProps } from './app/CommandPalette.js';
export { HelpOverlay, type HelpOverlayProps } from './app/HelpOverlay.js';
export { Header, type HeaderProps } from './app/Header.js';
export { NavRail, type NavRailProps } from './app/NavRail.js';
export type { Screen } from './app/screen.js';
export {
  AppsScreen,
  AutomationsScreen,
  DEFAULT_SCREENS,
  EntitiesScreen,
  SettingsScreen,
  ThemesScreen,
  VibesScreen,
} from './app/screens/index.js';
export { DASHBOARD_NAME } from './app/screens/dashboardDraft.js';
export { VIBE_NAME } from './app/screens/vibeDraft.js';
export { THEME_NAME } from './app/screens/themeDraft.js';
export {
  assertRenderable,
  detectRuntime,
  MIN_NODE_FFI,
  type RuntimeSupport,
} from './app/runtime.js';
export { startApp, type AppHandle, type StartAppOptions } from './app/start.js';

export * from './components/index.js';
