import { argString, definePlugin, type PluginContext } from '@nightshift/sdk';
import {
  CLOCK_ENTITY,
  hydrateClockSettings,
  initialClockSettings,
  type ClockSettings,
} from './entity.js';
import { isClockDateFormat } from './format.js';
import { detectSystemTimezone, geocodeTimezone } from './location.js';
import { ClockWidget } from './widgets.js';

export default definePlugin({
  id: 'clock',
  name: 'Clock',
  version: '0.1.0',
  description: 'The time and date, with 12/24-hour, date format and timezone settings.',
  capabilities: [
    'entities:read',
    'entities:write',
    'widgets:register',
    'commands:register',
    'storage',
    'network',
  ],

  async setup(context: PluginContext) {
    const stored = await context.storage.get('settings');
    const initial = hydrateClockSettings(stored);

    context.registerEntity(CLOCK_ENTITY, initial, { title: 'Clock settings', owner: 'clock' });

    const read = (): ClockSettings =>
      context.entities.get<ClockSettings>(CLOCK_ENTITY)?.state ?? initialClockSettings();

    const write = (next: ClockSettings): void => {
      context.entities.set(CLOCK_ENTITY, next);
      context.storage.set('settings', next).catch((error: unknown) => {
        context.log.warn('Could not save clock settings', { error: `${error}` });
      });
    };

    context.registerCommand({
      id: 'clock.set-hour-format',
      title: 'Set clock hour format',
      run: (args) => {
        const hour12 = args?.['hour12'];
        if (typeof hour12 !== 'boolean') return;
        write({ ...read(), hour12 });
      },
    });

    context.registerCommand({
      id: 'clock.set-show-seconds',
      title: 'Toggle clock seconds',
      run: (args) => {
        const showSeconds = args?.['showSeconds'];
        if (typeof showSeconds !== 'boolean') return;
        write({ ...read(), showSeconds });
      },
    });

    context.registerCommand({
      id: 'clock.set-date-format',
      title: 'Set clock date format',
      run: (args) => {
        const format = args?.['format'];
        if (!isClockDateFormat(format)) return;
        write({ ...read(), dateFormat: format });
      },
    });

    context.registerCommand({
      id: 'clock.use-system-timezone',
      title: 'Use the machine’s timezone for the clock',
      run: () => {
        write({
          ...read(),
          timezone: detectSystemTimezone(),
          timezoneSource: 'system',
          locationQuery: '',
          locationLabel: '',
          locationStatus: 'idle',
          locationError: null,
        });
      },
    });

    context.registerCommand({
      id: 'clock.configure-location',
      title: 'Set clock location',
      run: async (args) => {
        const query = argString(args, 'query');
        if (!query) return;

        write({ ...read(), locationQuery: query, locationStatus: 'loading', locationError: null });
        // The lookup is reachable from the palette and from a vibe, not just
        // from the widget's editor, so the failure is announced rather than
        // left as a line only whoever has the editor open would ever see.
        const failed = (message: string): void => {
          write({ ...read(), locationStatus: 'error', locationError: message });
          context.notify(`Clock: ${message}`, { tone: 'warning', key: 'location' });
        };

        try {
          const place = await geocodeTimezone(context.fetch, query);
          if (!place) {
            failed(`No place found for "${query}".`);
            return;
          }
          write({
            ...read(),
            timezone: place.timezone,
            timezoneSource: 'location',
            locationQuery: query,
            locationLabel: place.name,
            locationStatus: 'ready',
            locationError: null,
          });
        } catch (error) {
          failed(error instanceof Error ? error.message : `${error}`);
          context.log.warn('Clock location lookup failed', { error: `${error}` });
        }
      },
    });

    context.registerWidget({
      type: 'clock.now',
      title: 'Clock',
      entities: [CLOCK_ENTITY],
      description: 'The time and date, in the machine’s timezone or a location you set.',
      render: ClockWidget,
    });

    context.log.info('Clock plugin ready', {
      hour12: initial.hour12,
      dateFormat: initial.dateFormat,
      timezone: initial.timezone,
      timezoneSource: initial.timezoneSource,
    });
  },
});

export {
  CLOCK_ENTITY,
  hydrateClockSettings,
  initialClockSettings,
  type ClockLocationStatus,
  type ClockSettings,
  type ClockTimezoneSource,
} from './entity.js';
export {
  CLOCK_DATE_FORMATS,
  formatDate,
  formatTime,
  isClockDateFormat,
  type ClockDateFormat,
} from './format.js';
export { detectSystemTimezone, geocodeTimezone, type GeocodedTimezone } from './location.js';
export { ClockWidget } from './widgets.js';
