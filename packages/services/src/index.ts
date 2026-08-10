export { resolvePaths, type NightshiftPaths, type ResolvePathsOptions } from './paths.js';
export {
  CONFIG_VERSION,
  DEFAULT_CONFIG,
  LOG_LEVELS,
  ensureConfigDirs,
  loadConfig,
  parseConfig,
  saveConfig,
  type LoadedConfig,
  type LogLevel,
  type NightshiftConfig,
} from './config.js';
export {
  createLogger,
  createNullLogger,
  isLogLevel,
  type LogFields,
  type LogRecord,
  type Logger,
  type LoggerOptions,
} from './logger.js';
export {
  createSettingsStore,
  type SettingsEvents,
  type SettingsStore,
  type SettingsStoreOptions,
} from './settings.js';
export {
  discoverPlugins,
  type DiscoverOptions,
  type PluginOrigin,
  type PluginSource,
} from './plugins/discovery.js';
export {
  assertCapability,
  AUTO_GRANTED,
  createPermissionPolicy,
  SENSITIVE,
  type PermissionPolicy,
  type PermissionPolicyOptions,
  type PluginGrant,
} from './plugins/permissions.js';
export {
  clearPluginStorage,
  createPluginStorage,
  storagePath,
  type PluginStorageOptions,
} from './plugins/storage.js';
export { resolvePluginSpecifier, type ResolveBase } from './plugins/resolve.js';
export {
  createPluginHost,
  type LoadedPlugin,
  type PluginFailure,
  type PluginHost,
  type PluginHostEvents,
  type PluginHostOptions,
} from './plugins/host.js';
