import type { VibeDraft } from './vibeDraft.js';

/** Plain-language lines describing what a vibe will do on activate. */
export function summariseDraft(draft: VibeDraft): string[] {
  const lines: string[] = [];

  const title = draft.title.trim();
  if (title !== '') lines.push(`Activates as “${title}”.`);

  const theme = draft.theme.trim();
  if (theme !== '') lines.push(`Switches theme to ${theme}.`);

  const dashboard = draft.dashboard.trim();
  if (dashboard !== '') lines.push(`Opens the ${dashboard} dashboard.`);

  const commands = draft.onActivate
    .map((action) => action.command.trim())
    .filter((command) => command !== '');
  if (commands.length === 1) {
    lines.push(`Runs ${commands[0]} on activate.`);
  } else if (commands.length > 1) {
    lines.push(`Runs ${commands.length} commands on activate (${commands.join(', ')}).`);
  }

  const deactivate = draft.onDeactivate
    .map((action) => action.command.trim())
    .filter((command) => command !== '');
  if (deactivate.length === 1) {
    lines.push(`Runs ${deactivate[0]} on deactivate.`);
  } else if (deactivate.length > 1) {
    lines.push(`Runs ${deactivate.length} commands on deactivate.`);
  }

  if (draft.entities !== undefined) {
    const count = Object.keys(draft.entities).length;
    if (count > 0) {
      lines.push(`Merges state into ${count} entit${count === 1 ? 'y' : 'ies'}.`);
    }
  }

  if (lines.length === 0) {
    lines.push('No activate effects configured yet.');
  }

  return lines;
}
