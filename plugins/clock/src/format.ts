export type ClockDateFormat = 'long' | 'medium' | 'short' | 'iso' | 'none';

export interface ClockDateFormatOption {
  id: ClockDateFormat;
  label: string;
}

/** Presets offered from the widget's settings panel, in cycle order. */
export const CLOCK_DATE_FORMATS: readonly ClockDateFormatOption[] = [
  { id: 'long', label: 'Long' },
  { id: 'medium', label: 'Medium' },
  { id: 'short', label: 'Short' },
  { id: 'iso', label: 'ISO' },
  { id: 'none', label: 'Hidden' },
];

export function isClockDateFormat(value: unknown): value is ClockDateFormat {
  return CLOCK_DATE_FORMATS.some((format) => format.id === value);
}

export interface TimeFormatOptions {
  /** IANA zone, e.g. `America/New_York`. `null` formats in the local zone. */
  timezone: string | null;
  hour12: boolean;
  showSeconds: boolean;
}

/** `HH:mm[:ss]` in 24-hour, or `h:mm[:ss] AM/PM` in 12-hour, in `timezone`. */
export function formatTime(
  date: Date,
  { timezone, hour12, showSeconds }: TimeFormatOptions,
): string {
  return new Intl.DateTimeFormat('en-US', {
    ...(timezone ? { timeZone: timezone } : {}),
    hour12,
    hour: hour12 ? 'numeric' : '2-digit',
    minute: '2-digit',
    ...(showSeconds ? { second: '2-digit' } : {}),
  }).format(date);
}

export interface DateFormatOptions {
  timezone: string | null;
  format: ClockDateFormat;
}

export function formatDate(date: Date, { timezone, format }: DateFormatOptions): string {
  const zone = timezone ? { timeZone: timezone } : {};
  switch (format) {
    case 'long':
      return date.toLocaleDateString(undefined, {
        ...zone,
        weekday: 'long',
        day: 'numeric',
        month: 'long',
      });
    case 'medium':
      return date.toLocaleDateString(undefined, {
        ...zone,
        weekday: 'short',
        day: 'numeric',
        month: 'short',
        year: 'numeric',
      });
    case 'short':
      return date.toLocaleDateString(undefined, {
        ...zone,
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
      });
    case 'iso':
      // en-CA is the one built-in locale that formats as YYYY-MM-DD.
      return new Intl.DateTimeFormat('en-CA', {
        ...zone,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
      }).format(date);
    case 'none':
      return '';
  }
}
