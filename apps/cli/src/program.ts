import { Command, type OptionValues } from 'commander';
import { NIGHTSHIFT_VERSION, isNightshiftError } from '@nightshift/core';
import { LOG_LEVELS } from '@nightshift/services';
import { createContext, type GlobalOptions } from './context.js';
import { runDashboard } from './commands/dashboard.js';
import { runDoctor } from './commands/doctor.js';
import { runVibe } from './commands/vibe.js';
import { createStyle, shouldUseColor } from './lib/output.js';

/** Reads the root program's options from anywhere in the command tree. */
function globals(command: Command): GlobalOptions {
  const root = command.parent ?? command;
  const opts: OptionValues = root.opts();
  return {
    configDir: opts['configDir'] as string | undefined,
    logLevel: opts['logLevel'] as string | undefined,
    verbose: opts['verbose'] as boolean | undefined,
    // Commander sets `color: false` for --no-color and leaves it undefined otherwise.
    color: opts['color'] === false ? false : undefined,
    json: command.opts()['json'] as boolean | undefined,
  };
}

export function buildProgram(): Command {
  const program = new Command();

  program
    .name('nightshift')
    .description('Nightshift — a programmable workspace for deep focus.')
    .version(NIGHTSHIFT_VERSION, '-V, --version', 'Print the Nightshift version.')
    .option('--config-dir <path>', 'Override the configuration directory.')
    .option(`--log-level <level>`, `Log verbosity (${LOG_LEVELS.join(', ')}).`)
    .option('-v, --verbose', 'Shorthand for --log-level debug.')
    .option('--no-color', 'Disable ANSI colour.')
    .showHelpAfterError('(run `nightshift --help` for usage)')
    .enablePositionalOptions();

  program
    .command('doctor')
    .description('Check that the environment, config and plugins are healthy.')
    .option('--json', 'Emit the report as JSON.')
    .action(async (_options, command: Command) => {
      const options = globals(command);
      const context = await createContext(options);
      try {
        process.exitCode = await runDoctor(context, {
          ...(options.color === undefined ? {} : { color: options.color }),
        });
      } finally {
        await context.log.close();
      }
    });

  program
    .command('dashboard', { isDefault: true })
    .argument('[name]', 'Dashboard to open. Defaults to the configured dashboard.')
    .description('Open a dashboard.')
    .option('-l, --list', 'List available dashboards instead of opening one.')
    .option('--check', 'Report what would be opened without taking over the terminal.')
    .option('--json', 'Emit machine-readable output.')
    .action(async (name: string | undefined, cmdOptions: OptionValues, command: Command) => {
      const options = globals(command);
      const context = await createContext(options);
      try {
        process.exitCode = await runDashboard(context, name, {
          list: cmdOptions['list'] as boolean | undefined,
          check: cmdOptions['check'] as boolean | undefined,
          ...(options.color === undefined ? {} : { color: options.color }),
        });
      } finally {
        await context.log.close();
      }
    });

  program
    .command('vibe')
    .argument('[name]', 'Vibe to activate. Omit to list what is available.')
    .description('Activate a vibe, or list them.')
    .option('-l, --list', 'List available vibes.')
    .option('--set-default', 'Also record this vibe as the startup default.')
    .option('--check', 'Report what would be activated without taking over the terminal.')
    .option('--json', 'Emit machine-readable output.')
    .action(async (name: string | undefined, cmdOptions: OptionValues, command: Command) => {
      const options = globals(command);
      const context = await createContext(options);
      try {
        process.exitCode = await runVibe(context, name, {
          list: cmdOptions['list'] as boolean | undefined,
          setDefault: cmdOptions['setDefault'] as boolean | undefined,
          check: cmdOptions['check'] as boolean | undefined,
          ...(options.color === undefined ? {} : { color: options.color }),
        });
      } finally {
        await context.log.close();
      }
    });

  return program;
}

/**
 * Runs the CLI and resolves to a process exit code. Errors Nightshift raises
 * on purpose print as a message plus a hint; anything else keeps its stack,
 * because an unexpected crash is a bug worth seeing in full.
 */
export async function run(argv: string[] = process.argv): Promise<number> {
  const program = buildProgram();
  try {
    await program.parseAsync(argv);
    return typeof process.exitCode === 'number' ? process.exitCode : 0;
  } catch (error) {
    const style = createStyle(shouldUseColor());
    if (isNightshiftError(error)) {
      process.stderr.write(`\n  ${style.danger(error.message)}\n`);
      if (error.hint) process.stderr.write(`  ${style.dim(error.hint)}\n`);
      process.stderr.write('\n');
      return 1;
    }
    if (error instanceof Error && 'exitCode' in error && typeof error.exitCode === 'number') {
      // Commander's own exits (--help, --version, bad usage).
      return error.exitCode;
    }
    throw error;
  }
}
