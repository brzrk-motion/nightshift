import { useEffect, useState, type ReactNode } from 'react';
import {
  Button,
  ErrorState,
  Icon,
  LoadingState,
  Sparkline,
  StatusBadge,
  TextInput,
  Toolbar,
  useCommands,
  useEntity,
  useTheme,
  type WidgetProps,
} from '@nightshift/sdk';
import { ART_WIDTH, heroDigits, weatherArt } from './art.js';
import { weatherCodeInfo } from './codes.js';
import {
  WEATHER_LOCATIONS_ENTITY,
  emptyLocation,
  initialLocationsState,
  type WeatherDay,
  type WeatherLocation,
  type WeatherLocationsState,
  type WeatherUnits,
} from './entity.js';
import { formatHiLo, formatTemp, slotId, weekdayShort } from './state.js';

function resolveSlot(
  state: WeatherLocationsState | undefined,
  options: WidgetProps['options'],
): { id: string; location: WeatherLocation | undefined; bootstrapQuery: string } {
  const id = slotId(options['location']);
  const bootstrapQuery =
    typeof options['query'] === 'string' ? options['query'].trim() : '';
  return {
    id,
    location: state?.locations[id],
    bootstrapQuery,
  };
}

function LocationEditor({
  id,
  initial,
  onCancel,
}: {
  id: string;
  initial: string;
  onCancel?: () => void;
}): ReactNode {
  const theme = useTheme();
  const commands = useCommands();
  const [draft, setDraft] = useState(initial);

  const save = (): void => {
    const query = draft.trim();
    if (query === '') return;
    void commands.run('weather.configure-location', { id, query });
  };

  return (
    <box
      style={{
        flexDirection: 'column',
        flexGrow: 1,
        gap: 1,
        justifyContent: 'center',
        paddingLeft: 1,
        paddingRight: 1,
      }}
    >
      <text fg={theme.colors.muted}>○ Set a location</text>
      <text fg={theme.colors.muted}>Zip, city, postal code, or lat,lon</text>
      <box style={{ flexDirection: 'row', gap: 1, alignItems: 'center' }}>
        <TextInput
          value={draft}
          onInput={setDraft}
          onSubmit={save}
          focused
          placeholder="e.g. 90210 or Austin, TX"
        />
        <Button label="Save" onPress={save} />
        {onCancel ? <Button label="Cancel" onPress={onCancel} /> : null}
      </box>
    </box>
  );
}

function useWeatherSlot(options: WidgetProps['options']): {
  id: string;
  state: WeatherLocationsState;
  location: WeatherLocation | undefined;
  bootstrapQuery: string;
} {
  const commands = useCommands();
  const entity = useEntity<WeatherLocationsState>(WEATHER_LOCATIONS_ENTITY);
  const state = entity?.state ?? initialLocationsState();
  const { id, location, bootstrapQuery } = resolveSlot(state, options);

  useEffect(() => {
    if (bootstrapQuery !== '' && (location?.query.trim() ?? '') === '') {
      void commands.run('weather.ensure-location', { id, query: bootstrapQuery });
      return;
    }
    if (location === undefined) {
      void commands.run('weather.ensure-location', { id });
    }
  }, [bootstrapQuery, commands, id, location]);

  return { id, state, location, bootstrapQuery };
}

function placeLabel(slot: WeatherLocation, id: string): string {
  return slot.placeName || slot.label || id;
}

function AsciiBlock({ lines, color }: { lines: readonly string[]; color: string }): ReactNode {
  // Explicit width + no wrap: trailing spaces alone do not reserve layout width
  // in OpenTUI text, so without this the right edge of the art gets clipped.
  const width = Math.max(...lines.map((line) => [...line].length), ART_WIDTH);
  return (
    <box style={{ flexDirection: 'column', flexShrink: 0, width, minWidth: width }}>
      {lines.map((line, index) => (
        <text key={index} fg={color} wrapMode="none">
          {line.padEnd(width, '\u00A0')}
        </text>
      ))}
    </box>
  );
}

/** Block-font value + unit, matching the temperature hero treatment. */
function HeroStat({
  digits,
  unit,
  color,
  label,
  detail,
}: {
  digits: string;
  unit: string;
  color: string;
  label: string;
  detail?: string;
}): ReactNode {
  const theme = useTheme();
  return (
    <box style={{ flexDirection: 'column', gap: 0, flexShrink: 0 }}>
      <box style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 1, flexShrink: 0 }}>
        <ascii-font text={digits} font="block" color={color} />
        <text fg={color} wrapMode="none">
          <b>{unit}</b>
        </text>
      </box>
      <text fg={theme.colors.text}>
        <b>{label}</b>
      </text>
      {/* Always reserve the detail row so sibling heroes share the same height. */}
      <text fg={theme.colors.muted}>{detail ?? '\u00A0'}</text>
    </box>
  );
}

function ActionBar({
  id,
  units,
  onEditLocation,
  showUnits = false,
}: {
  id: string;
  units: WeatherUnits;
  onEditLocation: () => void;
  showUnits?: boolean;
}): ReactNode {
  const commands = useCommands();
  return (
    <Toolbar>
      <Button label="Refresh" onPress={() => void commands.run('weather.refresh', { id })} />
      {showUnits ? (
        <Button
          label={units === 'metric' ? '°F' : '°C'}
          onPress={() =>
            void commands.run('weather.set-units', {
              units: units === 'metric' ? 'imperial' : 'metric',
            })
          }
        />
      ) : null}
      <Button label="Location" onPress={onEditLocation} />
    </Toolbar>
  );
}

function ForecastDayRow({ day }: { day: WeatherDay }): ReactNode {
  const theme = useTheme();
  const info = weatherCodeInfo(day.weatherCode);
  const toneColor = info.tone === 'neutral' ? theme.colors.text : theme.colors[info.tone];

  return (
    <box style={{ flexDirection: 'row', gap: 1, height: 1, alignItems: 'center' }}>
      <text fg={theme.colors.muted}>{weekdayShort(day.date).padEnd(3)}</text>
      <box style={{ flexDirection: 'row', gap: 2, alignItems: 'center' }}>
        <Icon name={info.icon} color={toneColor} />
        <text fg={theme.colors.text}>{info.label}</text>
      </box>
      <box style={{ flexGrow: 1 }} />
      <text fg={theme.colors.muted}>{Math.round(day.tempMin)}°</text>
      <text fg={theme.colors.text}>
        <b>{Math.round(day.tempMax)}°</b>
      </text>
    </box>
  );
}

/** Compact day cell for the short-height horizontal strip. */
function ForecastDayColumn({ day }: { day: WeatherDay }): ReactNode {
  const theme = useTheme();
  const info = weatherCodeInfo(day.weatherCode);
  const toneColor = info.tone === 'neutral' ? theme.colors.text : theme.colors[info.tone];

  return (
    <box
      style={{
        flexDirection: 'column',
        gap: 0,
        flexShrink: 0,
        alignItems: 'center',
      }}
    >
      <text fg={theme.colors.muted}>{weekdayShort(day.date)}</text>
      <Icon name={info.icon} color={toneColor} />
      <text fg={theme.colors.text}>
        <b>{Math.round(day.tempMax)}°</b>
      </text>
      <text fg={theme.colors.muted}>{Math.round(day.tempMin)}°</text>
    </box>
  );
}

/** Below this height the day list flips to a horizontal strip. */
const HORIZONTAL_FORECAST_HEIGHT = 24;

function visibleDayCount(height: number): number {
  // Each day is one text row plus a gap cell between rows.
  return Math.max(3, Math.min(7, Math.floor((height - 5) / 2)));
}

function visibleDayCountHorizontal(width: number): number {
  // Weekday + icon + hi/lo needs roughly 6 columns per day with padding.
  return Math.max(3, Math.min(7, Math.floor((width - 2) / 6)));
}

/** Current conditions — ASCII weather art + block temperature as the hero. */
export function NowWidget({ options, width }: WidgetProps): ReactNode {
  const theme = useTheme();
  const { id, state, location, bootstrapQuery } = useWeatherSlot(options);
  const [editing, setEditing] = useState(false);
  const slot = location ?? emptyLocation(id, bootstrapQuery);
  const needsConfig = slot.query.trim() === '' && bootstrapQuery === '';
  const code = weatherCodeInfo(slot.weatherCode);

  if (editing || needsConfig) {
    return (
      <LocationEditor
        id={id}
        initial={slot.query || bootstrapQuery}
        {...(editing && !needsConfig ? { onCancel: () => setEditing(false) } : {})}
      />
    );
  }

  if (slot.status === 'loading' && slot.temperature === null) {
    return <LoadingState message="Fetching weather…" />;
  }

  if (slot.status === 'error' && slot.temperature === null) {
    return (
      <box style={{ flexDirection: 'column', flexGrow: 1, gap: 1, justifyContent: 'space-between' }}>
        <ErrorState message={slot.error ?? 'Could not load weather'} hint="Try another location" />
        <Button label="Change location" onPress={() => setEditing(true)} />
      </box>
    );
  }

  const place = placeLabel(slot, id);
  const toneColor = code.tone === 'neutral' ? theme.colors.accent : theme.colors[code.tone];
  const art = weatherArt(code.art);
  const tempUnit = `°${state.units === 'imperial' ? 'F' : 'C'}`;
  const windUnit = state.units === 'imperial' ? 'mph' : 'km/h';
  const compact = width < 48;
  const heroesInline = width >= 64;

  const tempStat = (
    <HeroStat
      digits={heroDigits(slot.temperature)}
      unit={tempUnit}
      color={toneColor}
      label={slot.condition || code.label}
      detail={`Feels ${formatTemp(slot.feelsLike, state.units)}`}
    />
  );
  const humidityStat = (
    <HeroStat
      digits={heroDigits(slot.humidity)}
      unit="%"
      color={toneColor}
      label="Humidity"
    />
  );
  const windStat = (
    <HeroStat
      digits={heroDigits(slot.windSpeed)}
      unit={windUnit}
      color={toneColor}
      label="Wind"
    />
  );

  return (
    <box
      style={{
        flexDirection: 'column',
        flexGrow: 1,
        gap: 1,
        justifyContent: 'space-between',
      }}
    >
      <box style={{ flexDirection: 'column', gap: 1, flexGrow: 1 }}>
        <box style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
          <text fg={theme.colors.muted}>{place}</text>
          <StatusBadge
            label={slot.status === 'loading' ? 'updating' : 'live'}
            tone={slot.status === 'error' ? 'warning' : 'success'}
            dot
          />
        </box>

        <box
          style={{
            flexDirection: compact ? 'column' : 'row',
            gap: compact ? 1 : 3,
            alignItems: compact ? 'flex-start' : 'center',
            flexGrow: 1,
            justifyContent: 'center',
          }}
        >
          <AsciiBlock lines={art} color={toneColor} />
          {heroesInline ? (
            <box
              style={{
                flexDirection: 'row',
                alignItems: 'flex-start',
                flexGrow: 1,
                justifyContent: 'space-between',
              }}
            >
              {tempStat}
              {humidityStat}
              {windStat}
            </box>
          ) : (
            <box style={{ flexDirection: 'column', gap: 1, flexGrow: 1 }}>
              {tempStat}
              <box
                style={{
                  flexDirection: 'row',
                  alignItems: 'flex-start',
                  flexGrow: 1,
                  justifyContent: 'space-between',
                }}
              >
                {humidityStat}
                {windStat}
              </box>
            </box>
          )}
        </box>
      </box>

      <ActionBar id={id} units={state.units} showUnits onEditLocation={() => setEditing(true)} />
    </box>
  );
}

/** Multi-day forecast for the location bound by `options.location`. */
export function ForecastWidget({ options, width, height }: WidgetProps): ReactNode {
  const theme = useTheme();
  const { id, state, location, bootstrapQuery } = useWeatherSlot(options);
  const [editing, setEditing] = useState(false);
  const slot = location ?? emptyLocation(id, bootstrapQuery);
  const needsConfig = slot.query.trim() === '' && bootstrapQuery === '';

  if (editing || needsConfig) {
    return (
      <LocationEditor
        id={id}
        initial={slot.query || bootstrapQuery}
        {...(editing && !needsConfig ? { onCancel: () => setEditing(false) } : {})}
      />
    );
  }

  if (slot.status === 'loading' && slot.days.length === 0) {
    return <LoadingState message="Fetching forecast…" />;
  }

  if (slot.status === 'error' && slot.days.length === 0) {
    return (
      <box style={{ flexDirection: 'column', flexGrow: 1, gap: 1, justifyContent: 'space-between' }}>
        <ErrorState message={slot.error ?? 'Could not load forecast'} />
        <Button label="Change location" onPress={() => setEditing(true)} />
      </box>
    );
  }

  const place = placeLabel(slot, id);
  const spark = slot.hours.map((hour) => hour.temperature);
  const sparkWidth = Math.max(10, Math.min(28, width - 8));
  const horizontal = height < HORIZONTAL_FORECAST_HEIGHT;
  const visibleDays = slot.days.slice(
    0,
    horizontal ? visibleDayCountHorizontal(width) : visibleDayCount(height),
  );
  const latest = spark.at(-1);
  const today = visibleDays[0];
  const showSpark = spark.length > 1 && (!horizontal || height >= 10);

  return (
    <box
      style={{
        flexDirection: 'column',
        flexGrow: 1,
        gap: 1,
        justifyContent: 'space-between',
      }}
    >
      <box style={{ flexDirection: 'column', gap: 1, flexGrow: 1 }}>
        <box style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
          <text fg={theme.colors.text}>
            <b>{place}</b>
          </text>
          <text fg={theme.colors.muted}>{visibleDays.length}-day</text>
        </box>

        {showSpark ? (
          <Sparkline
            values={spark}
            width={sparkWidth}
            tone="accent"
            {...(latest === undefined ? {} : { caption: formatTemp(latest, state.units) })}
          />
        ) : null}

        {horizontal ? (
          <box
            style={{
              flexDirection: 'row',
              flexGrow: 1,
              justifyContent: 'space-between',
              alignItems: 'flex-start',
            }}
          >
            {visibleDays.map((day) => (
              <ForecastDayColumn key={day.date} day={day} />
            ))}
          </box>
        ) : (
          <box style={{ flexDirection: 'column', gap: 1, flexGrow: 1 }}>
            {visibleDays.map((day) => (
              <ForecastDayRow key={day.date} day={day} />
            ))}
          </box>
        )}

        {!horizontal && today ? (
          <text fg={theme.colors.muted}>Today {formatHiLo(today.tempMin, today.tempMax)}</text>
        ) : null}
      </box>

      <ActionBar id={id} units={state.units} onEditLocation={() => setEditing(true)} />
    </box>
  );
}
