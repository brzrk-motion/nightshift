import { shellContentSize, type TerminalSize } from '../../layout.js';

/** How the vibe editor reshapes itself for the cells it has. */
export type VibeEditorLayout = 'compact' | 'regular';

export interface VibeEditorScale {
  layout: VibeEditorLayout;
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

/** Content area inside the shell, after the nav rail and screen padding. */
export function vibeEditorContentSize(
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
export function vibeEditorScale(contentWidth: number, contentHeight: number): VibeEditorScale {
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
