import { isNavRailCollapsed, shellContentSize, type TerminalSize } from '../layout.js';
import { useRuntime } from './context.js';

/** Canvas size inside AppShell, optionally inset further for screen padding. */
export function useShellContentSize(padding = 0): TerminalSize {
  const runtime = useRuntime();
  const size = runtime?.size ?? { width: 80, height: 24 };
  const content = shellContentSize(size, isNavRailCollapsed(size.width));
  if (padding === 0) return content;
  return {
    width: Math.max(0, content.width - padding),
    height: content.height,
  };
}
