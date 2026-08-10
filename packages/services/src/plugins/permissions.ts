import { NightshiftError } from '@nightshift/core';
import { CAPABILITIES, type Capability } from '@nightshift/sdk';

/**
 * The permission model.
 *
 * Capabilities that only touch Nightshift's own state are granted on install:
 * a plugin that could not register an entity or a widget would have nothing to
 * offer. The two that reach outside the process — the network and the shell —
 * are withheld until the user grants them in `config.json`, because those are
 * the ones with consequences beyond the dashboard.
 */
export const AUTO_GRANTED: readonly Capability[] = [
  'entities:read',
  'entities:write',
  'widgets:register',
  'commands:register',
  'automations:register',
  'storage',
];

/** Capabilities that always need an explicit grant. */
export const SENSITIVE: readonly Capability[] = CAPABILITIES.filter(
  (capability) => !AUTO_GRANTED.includes(capability),
);

/** A per-plugin grant: either a list of capabilities, or `all`. */
export type PluginGrant = readonly Capability[] | 'all';

export interface PermissionPolicy {
  granted(pluginId: string, capability: Capability): boolean;
  /** The capabilities a plugin asked for but has not been given. */
  missing(pluginId: string, requested: readonly Capability[]): Capability[];
}

export interface PermissionPolicyOptions {
  /** Grants from configuration, keyed by plugin id. */
  grants?: Record<string, PluginGrant> | undefined;
  /** Capabilities every plugin gets. Defaults to `AUTO_GRANTED`. */
  autoGrant?: readonly Capability[];
}

export function createPermissionPolicy(options: PermissionPolicyOptions = {}): PermissionPolicy {
  const auto = options.autoGrant ?? AUTO_GRANTED;
  const grants = options.grants ?? {};

  const policy: PermissionPolicy = {
    granted(pluginId, capability) {
      const grant = grants[pluginId];
      if (grant === 'all') return true;
      if (grant?.includes(capability)) return true;
      return auto.includes(capability);
    },

    missing(pluginId, requested) {
      return requested.filter((capability) => !policy.granted(pluginId, capability));
    },
  };

  return policy;
}

/** Throws unless the plugin holds the capability. */
export function assertCapability(
  policy: PermissionPolicy,
  pluginId: string,
  capability: Capability,
): void {
  if (policy.granted(pluginId, capability)) return;
  throw new NightshiftError(
    'PERMISSION_DENIED',
    `Plugin "${pluginId}" does not have the "${capability}" capability.`,
    {
      hint: `Grant it by adding "${pluginId}": ["${capability}"] to "pluginPermissions" in config.json.`,
    },
  );
}
