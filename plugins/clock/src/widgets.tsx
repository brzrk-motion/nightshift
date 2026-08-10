import { useEffect, useState, type ReactNode } from 'react';
import {
  IconButton,
  TextInput,
  Toggle,
  Toolbar,
  useCommands,
  useEntity,
  useTheme,
  type WidgetProps,
} from '@nightshift/sdk';
import { CLOCK_ENTITY, initialClockSettings, type ClockSettings } from './entity.js';
import { CLOCK_DATE_FORMATS, formatDate, formatTime } from './format.js';

/**
 * Below this many rows there isn't room for the settings panel's column
 * layout without pushing the toolbar's "Done" button out of reach — `Button`
 * alone is a fixed 3 rows tall, so anything using one is a bad fit down here.
 * `visibleDayCount` in the weather plugin's ForecastWidget is the same idea.
 */
const COMPACT_HEIGHT = 10;

/** A pressable label, content-sized rather than `Button`'s fixed 3 rows —
 * what a squeezed settings panel needs instead. */
function Chip({ label, onPress }: { label: string; onPress: () => void }): ReactNode {
  const theme = useTheme();
  return (
    <box onMouseDown={onPress} style={{ flexShrink: 0 }}>
      <text fg={theme.colors.accent}>{`[${label}]`}</text>
    </box>
  );
}

/** Mirrors weather's location editor, but resolves to a timezone rather than
 * a forecast — one text field, submit, cancel. */
function LocationEditor({
  settings,
  onDone,
}: {
  settings: ClockSettings;
  onDone: () => void;
}): ReactNode {
  const theme = useTheme();
  const commands = useCommands();
  const [draft, setDraft] = useState(settings.locationQuery);

  const save = (): void => {
    const query = draft.trim();
    if (query === '') return;
    void commands.run('clock.configure-location', { query });
  };

  return (
    <box style={{ flexDirection: 'column', flexGrow: 1, gap: 1, justifyContent: 'center' }}>
      <text fg={theme.colors.muted}>○ Set a location for the clock's timezone</text>
      <box style={{ flexDirection: 'row', gap: 1, alignItems: 'center' }}>
        <TextInput
          value={draft}
          onInput={setDraft}
          onSubmit={save}
          focused
          placeholder="e.g. 90210, Tokyo, or lat,lon"
        />
        <Chip label="Save" onPress={save} />
        <Chip label="Cancel" onPress={onDone} />
      </box>
      {settings.locationStatus === 'loading' ? (
        <text fg={theme.colors.muted}>Looking up timezone…</text>
      ) : null}
      {settings.locationStatus === 'error' && settings.locationError ? (
        <text fg={theme.colors.warning}>{settings.locationError}</text>
      ) : null}
    </box>
  );
}

function TimezoneRow({
  settings,
  compact,
  onEdit,
}: {
  settings: ClockSettings;
  compact: boolean;
  onEdit: () => void;
}): ReactNode {
  const theme = useTheme();
  const commands = useCommands();
  const fromLocation = settings.timezoneSource === 'location';
  const label = fromLocation
    ? settings.locationLabel || settings.locationQuery || 'Custom location'
    : (settings.timezone ?? 'Unknown — set a location');

  return (
    <box style={{ flexDirection: 'row', gap: 1, alignItems: 'center', flexShrink: 0 }}>
      {compact ? null : <text fg={theme.colors.muted}>Timezone:</text>}
      <text fg={theme.colors.text}>{label}</text>
      <Chip label={compact ? 'TZ' : 'Change'} onPress={onEdit} />
      {fromLocation && !compact ? (
        <Chip label="Use system" onPress={() => void commands.run('clock.use-system-timezone')} />
      ) : null}
    </box>
  );
}

function SettingsPanel({
  settings,
  compact,
}: {
  settings: ClockSettings;
  compact: boolean;
}): ReactNode {
  const theme = useTheme();
  const commands = useCommands();
  const [editingLocation, setEditingLocation] = useState(settings.timezone === null);
  const formatIndex = CLOCK_DATE_FORMATS.findIndex((format) => format.id === settings.dateFormat);
  const currentFormat = CLOCK_DATE_FORMATS[formatIndex < 0 ? 0 : formatIndex]!;

  if (editingLocation) {
    return <LocationEditor settings={settings} onDone={() => setEditingLocation(false)} />;
  }

  const cycleDateFormat = (): void => {
    const next = CLOCK_DATE_FORMATS[(formatIndex + 1) % CLOCK_DATE_FORMATS.length]!;
    void commands.run('clock.set-date-format', { format: next.id });
  };

  const hourToggle = (
    <Toggle
      label={settings.hour12 ? '12-hour' : '24-hour'}
      value={settings.hour12}
      onChange={(hour12) => void commands.run('clock.set-hour-format', { hour12 })}
    />
  );
  const secondsToggle = (
    <Toggle
      label={compact ? 'Seconds' : 'Show seconds'}
      value={settings.showSeconds}
      onChange={(showSeconds) => void commands.run('clock.set-show-seconds', { showSeconds })}
    />
  );
  const dateChip = <Chip label={currentFormat.label} onPress={cycleDateFormat} />;
  const timezoneRow = (
    <TimezoneRow settings={settings} compact={compact} onEdit={() => setEditingLocation(true)} />
  );

  if (compact) {
    return (
      <box style={{ flexDirection: 'row', gap: 2, alignItems: 'center', flexGrow: 1 }}>
        {hourToggle}
        {secondsToggle}
        {dateChip}
        {timezoneRow}
      </box>
    );
  }

  return (
    <box style={{ flexDirection: 'column', flexGrow: 1, gap: 1, justifyContent: 'center' }}>
      {hourToggle}
      {secondsToggle}
      <box style={{ flexDirection: 'row', gap: 1, alignItems: 'center', flexShrink: 0 }}>
        <text fg={theme.colors.muted}>Date format:</text>
        {dateChip}
      </box>
      {timezoneRow}
    </box>
  );
}

function ClockFace({ settings, showDate }: { settings: ClockSettings; showDate: boolean }): ReactNode {
  const theme = useTheme();
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), settings.showSeconds ? 1000 : 15_000);
    timer.unref?.();
    return () => clearInterval(timer);
  }, [settings.showSeconds]);

  const date = showDate
    ? formatDate(now, { timezone: settings.timezone, format: settings.dateFormat })
    : '';

  return (
    <box
      style={{ flexDirection: 'column', flexGrow: 1, alignItems: 'center', justifyContent: 'center' }}
    >
      <text fg={theme.colors.accent}>
        <b>
          {formatTime(now, {
            timezone: settings.timezone,
            hour12: settings.hour12,
            showSeconds: settings.showSeconds,
          })}
        </b>
      </text>
      {date !== '' ? <text fg={theme.colors.muted}>{date}</text> : null}
    </box>
  );
}

export function ClockWidget({ height, options }: WidgetProps): ReactNode {
  const entity = useEntity<ClockSettings>(CLOCK_ENTITY);
  const settings = entity?.state ?? initialClockSettings();
  // A widget just added from the picker (options.startInSettings) or one
  // that couldn't resolve a timezone at all opens straight into settings
  // instead of a blank or system-guessed face.
  const [editing, setEditing] = useState(
    options['startInSettings'] === true || settings.timezone === null,
  );
  const compact = height < COMPACT_HEIGHT;

  return (
    <box style={{ flexDirection: 'column', flexGrow: 1, justifyContent: 'space-between' }}>
      {/* `overflow: 'hidden'` clips this box's own content rather than letting
          it spill past the toolbar below — OpenTUI boxes don't clip by
          default, so without this a widget squeezed smaller than its content
          would draw over the "Done" button instead of just losing detail. */}
      <box style={{ flexGrow: 1, overflow: 'hidden' }}>
        {editing ? (
          <SettingsPanel settings={settings} compact={compact} />
        ) : (
          <ClockFace settings={settings} showDate={!compact} />
        )}
      </box>
      <Toolbar>
        <IconButton
          icon="settings"
          label={editing ? 'Done' : 'Settings'}
          active={editing}
          onPress={() => setEditing((value) => !value)}
        />
      </Toolbar>
    </box>
  );
}
