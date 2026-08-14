/** Clips a label to the cells available, leaving room for an ellipsis. */
export function clipText(text: string, width: number): string {
  if (width <= 0) return '';
  const characters = [...text];
  if (characters.length <= width) return text;
  if (width === 1) return '…';
  return `${characters.slice(0, width - 1).join('')}…`;
}
