import { NightshiftError } from '@nightshift/core';
import type { Capability } from '@nightshift/sdk';

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

/** A per-plugin grant: either a list of capabilities, or `all`. */
export type PluginGrant = readonly Capability[] | 'all';

export function granted(
  pluginId: string,
  capability: Capability,
  grants: Record<string, PluginGrant> = {},
): boolean {
  const grant = grants[pluginId];
  if (grant === 'all') return true;
  if (grant?.includes(capability)) return true;
  return AUTO_GRANTED.includes(capability);
}

/** The capabilities a plugin asked for but has not been given. */
export function missing(
  pluginId: string,
  requested: readonly Capability[],
  grants: Record<string, PluginGrant> = {},
): Capability[] {
  return requested.filter((capability) => !granted(pluginId, capability, grants));
}

/** Throws unless the plugin holds the capability. */
export function assertCapability(
  pluginId: string,
  capability: Capability,
  grants: Record<string, PluginGrant> = {},
): void {
  if (granted(pluginId, capability, grants)) return;
  throw new NightshiftError(
    'PERMISSION_DENIED',
    `Plugin "${pluginId}" does not have the "${capability}" capability.`,
    {
      hint: `Grant it by adding "${pluginId}": ["${capability}"] to "pluginPermissions" in config.json.`,
    },
  );
}
