import { ansi, shouldUseColor as coreShouldUseColor } from '@nightshift/core';

export interface Style {
  bold(text: string): string;
  dim(text: string): string;
  accent(text: string): string;
  success(text: string): string;
  warning(text: string): string;
  danger(text: string): string;
}

export function createStyle(enabled: boolean): Style {
  return {
    bold: (text) => ansi(enabled, 'bold', text),
    dim: (text) => ansi(enabled, 'dim', text),
    accent: (text) => ansi(enabled, 'cyan', text),
    success: (text) => ansi(enabled, 'green', text),
    warning: (text) => ansi(enabled, 'yellow', text),
    danger: (text) => ansi(enabled, 'red', text),
  };
}

/** Whether ANSI colour should be used, honouring NO_COLOR and --no-color. */
export function shouldUseColor(override?: boolean): boolean {
  return coreShouldUseColor({
    stream: process.stdout,
    ...(override !== undefined ? { override } : {}),
  });
}

/** Renders `label: value` pairs with the labels aligned. */
export function renderPairs(pairs: [string, string][], style: Style): string {
  const width = pairs.reduce((max, [label]) => Math.max(max, label.length), 0);
  return pairs.map(([label, value]) => `  ${style.dim(label.padEnd(width))}  ${value}`).join('\n');
}
