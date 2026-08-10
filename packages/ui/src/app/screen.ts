import type { ReactNode } from 'react';
import type { IconName } from '../components/Icon.js';

/**
 * One destination in the nav rail. `packages/ui` only knows the shape — what
 * a "Vibes" or "Apps" screen actually shows lives wherever has the data for
 * it, which keeps this package from having to depend on the vibe engine, the
 * plugin host, or anything else that is not already part of the shell.
 */
export interface Screen {
  id: string;
  label: string;
  icon: IconName | string;
  render(): ReactNode;
}
