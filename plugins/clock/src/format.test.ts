import { describe, expect, it } from 'vitest';
import { CLOCK_DATE_FORMATS, formatDate, formatTime, isClockDateFormat } from './format.js';

// A fixed UTC instant plus a named zone keeps these deterministic regardless
// of the machine running the suite — unlike constructing a local `Date` and
// trusting the host's own zone.
const ZONE = 'America/New_York'; // UTC-5 in March, before DST starts.

// Wednesday, 4 March 2026, 09:05:07 America/New_York — midday would hide the
// 12/24 distinction, and single-digit fields catch missing zero-padding.
const MORNING = new Date(Date.UTC(2026, 2, 4, 14, 5, 7));
// 8pm America/New_York — the 12-hour boundary that would otherwise show as `20` or `0`.
const EVENING = new Date(Date.UTC(2026, 2, 5, 1, 5, 7));
// Midnight America/New_York — `h12 % 12 || 12` is the part that gets this wrong if dropped.
const MIDNIGHT = new Date(Date.UTC(2026, 2, 4, 5, 5, 7));

describe('formatTime', () => {
  it('pads a 24-hour time with seconds', () => {
    expect(formatTime(MORNING, { timezone: ZONE, hour12: false, showSeconds: true })).toBe(
      '09:05:07',
    );
  });

  it('drops seconds when asked to', () => {
    expect(formatTime(MORNING, { timezone: ZONE, hour12: false, showSeconds: false })).toBe(
      '09:05',
    );
  });

  it('renders 12-hour mornings without a leading zero, with AM', () => {
    expect(formatTime(MORNING, { timezone: ZONE, hour12: true, showSeconds: true })).toBe(
      '9:05:07 AM',
    );
  });

  it('renders 12-hour evenings as PM, hours wrapped back to 1-12', () => {
    expect(formatTime(EVENING, { timezone: ZONE, hour12: true, showSeconds: true })).toBe(
      '8:05:07 PM',
    );
  });

  it('renders 12-hour midnight as 12, not 0', () => {
    expect(formatTime(MIDNIGHT, { timezone: ZONE, hour12: true, showSeconds: false })).toBe(
      '12:05 AM',
    );
  });

  it('renders 24-hour midnight as 00', () => {
    expect(formatTime(MIDNIGHT, { timezone: ZONE, hour12: false, showSeconds: false })).toBe(
      '00:05',
    );
  });

  it('renders a different wall-clock time in a different zone, same instant', () => {
    const inNewYork = formatTime(MORNING, { timezone: ZONE, hour12: false, showSeconds: false });
    const inTokyo = formatTime(MORNING, {
      timezone: 'Asia/Tokyo',
      hour12: false,
      showSeconds: false,
    });
    expect(inNewYork).not.toBe(inTokyo);
  });

  it('falls back to the local zone when timezone is null', () => {
    const local = new Date(2026, 2, 4, 9, 5, 7);
    expect(formatTime(local, { timezone: null, hour12: false, showSeconds: true })).toBe(
      '09:05:07',
    );
  });
});

describe('formatDate', () => {
  it('renders iso as YYYY-MM-DD', () => {
    expect(formatDate(MORNING, { timezone: ZONE, format: 'iso' })).toBe('2026-03-04');
  });

  it('renders none as an empty string', () => {
    expect(formatDate(MORNING, { timezone: ZONE, format: 'none' })).toBe('');
  });

  it('renders long with a weekday and month name', () => {
    expect(formatDate(MORNING, { timezone: ZONE, format: 'long' })).toMatch(/Wednesday/);
    expect(formatDate(MORNING, { timezone: ZONE, format: 'long' })).toMatch(/March/);
  });

  it('renders medium with a year', () => {
    expect(formatDate(MORNING, { timezone: ZONE, format: 'medium' })).toMatch(/2026/);
  });

  it('renders short as a numeric date', () => {
    expect(formatDate(MORNING, { timezone: ZONE, format: 'short' })).toMatch(
      /\d{2}\/\d{2}\/2026|2026/,
    );
  });

  it('can land on a different calendar day in a different zone', () => {
    // EVENING is already the next UTC day; Tokyo is far enough ahead that it
    // reads as the day after Wellington isn't — Auckland/Kiritimati would be
    // simpler but this stays within IANA zones guaranteed to exist everywhere.
    const inNewYork = formatDate(EVENING, { timezone: ZONE, format: 'iso' });
    const inTokyo = formatDate(EVENING, { timezone: 'Asia/Tokyo', format: 'iso' });
    expect(inNewYork).not.toBe(inTokyo);
  });
});

describe('isClockDateFormat', () => {
  it('accepts every declared preset id', () => {
    for (const format of CLOCK_DATE_FORMATS) {
      expect(isClockDateFormat(format.id)).toBe(true);
    }
  });

  it('rejects anything else', () => {
    expect(isClockDateFormat('bogus')).toBe(false);
    expect(isClockDateFormat(undefined)).toBe(false);
    expect(isClockDateFormat(12)).toBe(false);
  });
});
