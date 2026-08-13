import { createRequire } from 'node:module';
import { isAbsolute } from 'node:path';
import { pathToFileURL } from 'node:url';

/**
 * Turning a plugin specifier into something `import()` can load.
 *
 * A bare specifier like `@nightshift/plugin-pomodoro` would otherwise resolve
 * relative to *this* package, which does not depend on any plugin — so it
 * would never be found. Resolution therefore happens against bases the caller
 * chooses: the user's config directory first, so a plugin installed there
 * wins, then the application itself.
 */
export type ResolveBase = string;

function isUrl(specifier: string): boolean {
  return /^[a-z][a-z0-9+.-]*:/i.test(specifier);
}

/** Resolves one specifier, or returns it unchanged when it is already loadable. */
export function resolvePluginSpecifier(
  specifier: string,
  bases: readonly ResolveBase[] = [],
): string {
  if (isUrl(specifier)) return specifier;
  if (isAbsolute(specifier)) return pathToFileURL(specifier).href;

  for (const base of bases) {
    // `createRequire` wants a file, not a directory; a package.json that need
    // not exist is the conventional way to name a resolution root.
    const from = isUrl(base) ? base : pathToFileURL(base).href;
    try {
      const resolved = createRequire(from).resolve(specifier);
      return pathToFileURL(resolved).href;
    } catch {
      // Try the next base.
    }
  }

  // Nothing matched, so hand the specifier to Node and let its own resolution
  // — and its own error message — take over.
  return specifier;
}
