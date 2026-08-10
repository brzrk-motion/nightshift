const ESC = '\u001b';

export interface Style {
  bold(text: string): string;
  dim(text: string): string;
  accent(text: string): string;
  success(text: string): string;
  warning(text: string): string;
  danger(text: string): string;
}

function wrap(code: string, enabled: boolean) {
  return (text: string): string => (enabled ? `${ESC}[${code}m${text}${ESC}[0m` : text);
}

export function createStyle(enabled: boolean): Style {
  return {
    bold: wrap('1', enabled),
    dim: wrap('2', enabled),
    accent: wrap('36', enabled),
    success: wrap('32', enabled),
    warning: wrap('33', enabled),
    danger: wrap('31', enabled),
  };
}

/** Whether ANSI colour should be used, honouring NO_COLOR and --no-color. */
export function shouldUseColor(override?: boolean): boolean {
  if (override !== undefined) return override;
  if (process.env['NO_COLOR'] !== undefined && process.env['NO_COLOR'] !== '') return false;
  if (process.env['FORCE_COLOR'] !== undefined && process.env['FORCE_COLOR'] !== '0') return true;
  return process.stdout.isTTY === true;
}

/** Renders `label: value` pairs with the labels aligned. */
export function renderPairs(pairs: [string, string][], style: Style): string {
  const width = pairs.reduce((max, [label]) => Math.max(max, label.length), 0);
  return pairs.map(([label, value]) => `  ${style.dim(label.padEnd(width))}  ${value}`).join('\n');
}
