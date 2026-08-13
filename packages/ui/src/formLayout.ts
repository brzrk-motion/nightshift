import { useRuntime } from './app/context.js';
import { isNavRailCollapsed, shellContentSize, type TerminalSize } from './layout.js';

/** How a form screen reshapes itself for the cells it has. */
export type FormLayout = 'compact' | 'regular';

export interface FormScale {
  layout: FormLayout;
  /** Label above the control instead of beside it. */
  stackFields: boolean;
  /** Action move/remove controls on their own row above the command picker. */
  stackActionRows: boolean;
  /** Glyph-only move/remove controls instead of bordered buttons. */
  compactActionControls: boolean;
  /** Shorter save hint at the bottom. */
  shortFooter: boolean;
  /** Drop section gaps to reclaim rows. */
  tightGaps: boolean;
}

export interface FormScaleOptions {
  /** Horizontal inset subtracted from shell content width. */
  padding?: number;
}

/** Content area inside the shell, after the nav rail and screen padding. */
export function formContentSize(
  size: TerminalSize,
  navCollapsed: boolean,
  padding = 2,
): TerminalSize {
  const content = shellContentSize(size, navCollapsed);
  return {
    width: Math.max(0, content.width - padding),
    height: content.height,
  };
}

/** Pure size → treatment. JSX should branch on these names, not raw numbers. */
export function formScale(contentWidth: number, contentHeight: number): FormScale {
  const stackFields = contentWidth < 52;
  const stackActionRows = contentWidth < 58;
  const compactActionControls = contentWidth < 64;
  const shortFooter = contentWidth < 68;
  const tightGaps = contentHeight < 20;
  const layout =
    stackFields || stackActionRows || compactActionControls || tightGaps ? 'compact' : 'regular';

  return {
    layout,
    stackFields,
    stackActionRows,
    compactActionControls,
    shortFooter,
    tightGaps,
  };
}

/** Terminal size → form scale flags for the active shell canvas. */
export function useFormScale(options?: FormScaleOptions): FormScale {
  const runtime = useRuntime();
  const size = runtime?.size ?? { width: 80, height: 24 };
  const padding = options?.padding ?? 2;
  const content = formContentSize(size, isNavRailCollapsed(size.width), padding);
  return formScale(content.width, content.height);
}
