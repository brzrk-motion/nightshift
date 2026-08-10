/**
 * The runtime contract version. Plugins declare the version of the SDK they
 * were built against; the loader compares that against this value before it
 * hands a plugin any capabilities.
 */
export const NIGHTSHIFT_API_VERSION = 1 as const;

/** Human-facing version of the Nightshift runtime. */
export const NIGHTSHIFT_VERSION = '0.1.0';
