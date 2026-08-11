/**
 * Hand-drawn terminal weather icons for the now-widget hero.
 * Every line is padded to its size's fixed width so Yoga/OpenTUI cannot clip
 * the right edge. Two sizes exist because a widget squeezed small has no room
 * for the 12x5 drawing — `nowScale` in scale.ts picks between them.
 * Temperature / humidity / wind use OpenTUI's built-in ascii fonts
 * (see widgets.tsx).
 */

export type WeatherArtKind =
  'clear' | 'partly' | 'cloudy' | 'fog' | 'rain' | 'snow' | 'storm' | 'unknown';

export type WeatherArtSize = 'large' | 'small';

/** Fixed column width for every weather icon (including trailing padding). */
export const ART_WIDTH = 12;
export const ART_WIDTH_SMALL = 7;

function pad(width: number): (lines: readonly string[]) => readonly string[] {
  return (lines) =>
    lines.map((line) => {
      if (line.length > width) {
        throw new Error(`Weather art line exceeds ${width} cols: ${JSON.stringify(line)}`);
      }
      return line.padEnd(width, ' ');
    });
}

const icon = pad(ART_WIDTH);
const small = pad(ART_WIDTH_SMALL);

export const WEATHER_ART: Record<WeatherArtKind, readonly string[]> = {
  clear: icon(['   \\ | /   ', '    \\|/    ', '  --( )--  ', '    /|\\    ', '   / | \\   ']),
  partly: icon(['      \\|/  ', '   .--(*). ', ' .-(      )', '(         )', " `--------'"]),
  cloudy: icon(['           ', '    .--.   ', ' .-(    )-.', '(         )', " `--------'"]),
  fog: icon(['           ', ' ~  ~  ~  ~', '  ~  ~  ~  ', ' ~  ~  ~  ~', '  ~  ~  ~  ']),
  rain: icon(['    .--.   ', ' .-(    )-.', '(         )', " `|'|'|'|' ", "  ' ' ' '  "]),
  snow: icon(['    .--.   ', ' .-(    )-.', '( *  *  * )', " `* * * *' ", '  *  *  *  ']),
  storm: icon(['    .--.   ', ' .-(====)-.', '(   /\\/\\  )', '   //  \\\\  ', '    \\/     ']),
  unknown: icon(['           ', '    .-.    ', '   ( ? )   ', "    `-'    ", '           ']),
};

/** The same eight families at 7x3, for a widget too small for the full art. */
export const WEATHER_ART_SMALL: Record<WeatherArtKind, readonly string[]> = {
  clear: small(['  \\|/  ', '-( o )-', '  /|\\  ']),
  partly: small(['  \\|/  ', ' -(o).-', '  (___)']),
  cloudy: small(['  .--. ', ' (    )', ' (____)']),
  fog: small([' ~ ~ ~ ', '~ ~ ~ ~', ' ~ ~ ~ ']),
  rain: small(['  .--. ', ' (____)', " ' ' ' "]),
  snow: small(['  .--. ', ' (____)', ' * * * ']),
  storm: small(['  .--. ', ' (====)', '  /\\/  ']),
  unknown: small(['  .-.  ', ' ( ? ) ', "  '-'  "]),
};

export function weatherArt(
  kind: WeatherArtKind,
  size: WeatherArtSize = 'large',
): readonly string[] {
  return size === 'small' ? WEATHER_ART_SMALL[kind] : WEATHER_ART[kind];
}

/** Digits-only label for OpenTUI's ascii fonts (unit shown beside it). */
export function heroDigits(value: number | null): string {
  if (value === null) return '--';
  return String(Math.round(value));
}
