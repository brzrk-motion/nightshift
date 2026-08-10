/**
 * Hand-drawn terminal weather icons for the now-widget hero.
 * Every line is padded to ART_WIDTH so Yoga/OpenTUI cannot clip the right edge.
 * Temperature / humidity / wind use OpenTUI's built-in `block` ascii-font
 * (see widgets.tsx).
 */

export type WeatherArtKind =
  | 'clear'
  | 'partly'
  | 'cloudy'
  | 'fog'
  | 'rain'
  | 'snow'
  | 'storm'
  | 'unknown';

/** Fixed column width for every weather icon (including trailing padding). */
export const ART_WIDTH = 12;

function icon(lines: readonly string[]): readonly string[] {
  return lines.map((line) => {
    if (line.length > ART_WIDTH) {
      throw new Error(`Weather art line exceeds ${ART_WIDTH} cols: ${JSON.stringify(line)}`);
    }
    return line.padEnd(ART_WIDTH, ' ');
  });
}

export const WEATHER_ART: Record<WeatherArtKind, readonly string[]> = {
  clear: icon([
    '   \\ | /   ',
    '    \\|/    ',
    '  --( )--  ',
    '    /|\\    ',
    '   / | \\   ',
  ]),
  partly: icon([
    '      \\|/  ',
    '   .--(*). ',
    ' .-(      )',
    '(         )',
    " `--------'",
  ]),
  cloudy: icon([
    '           ',
    '    .--.   ',
    ' .-(    )-.',
    '(         )',
    " `--------'",
  ]),
  fog: icon([
    '           ',
    ' ~  ~  ~  ~',
    '  ~  ~  ~  ',
    ' ~  ~  ~  ~',
    '  ~  ~  ~  ',
  ]),
  rain: icon([
    '    .--.   ',
    ' .-(    )-.',
    '(         )',
    " `|'|'|'|' ",
    "  ' ' ' '  ",
  ]),
  snow: icon([
    '    .--.   ',
    ' .-(    )-.',
    '( *  *  * )',
    " `* * * *' ",
    '  *  *  *  ',
  ]),
  storm: icon([
    '    .--.   ',
    ' .-(====)-.',
    '(   /\\/\\  )',
    '   //  \\\\  ',
    '    \\/     ',
  ]),
  unknown: icon([
    '           ',
    '    .-.    ',
    '   ( ? )   ',
    "    `-'    ",
    '           ',
  ]),
};

export function weatherArt(kind: WeatherArtKind): readonly string[] {
  return WEATHER_ART[kind];
}

/** Digits-only label for OpenTUI's block ascii-font (unit shown beside it). */
export function heroDigits(value: number | null): string {
  if (value === null) return '--';
  return String(Math.round(value));
}
