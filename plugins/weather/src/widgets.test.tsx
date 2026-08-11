import { describe, expect, it } from 'vitest';
import { testRender } from '@opentui/react/test-utils';
import { createEntityStore } from '@nightshift/entities';
import {
  createAppRuntime,
  detectRuntime,
  MIDNIGHT_THEME,
  RuntimeProvider,
  ThemeProvider,
} from '@nightshift/ui';
import {
  WEATHER_LOCATIONS_ENTITY,
  emptyLocation,
  initialLocationsState,
  type WeatherLocationsState,
} from './entity.js';
import { applyForecast, upsertSlot } from './state.js';
import { ForecastWidget, NowWidget } from './widgets.js';

const renderable = detectRuntime().ffi;

function readyState(): WeatherLocationsState {
  let state = upsertSlot(initialLocationsState(), 'home', '90210', 'Home');
  state = {
    ...state,
    locations: {
      ...state.locations,
      home: {
        ...emptyLocation('home', '90210'),
        query: '90210',
        label: 'Home',
        placeName: 'Beverly Hills',
        latitude: 34.07,
        longitude: -118.4,
        status: 'ready',
        error: null,
        temperature: 22,
        feelsLike: 21,
        humidity: 40,
        windSpeed: 10,
        windDirection: 180,
        condition: 'Clear',
        weatherCode: 0,
        sunrise: '2026-08-10T06:30',
        sunset: '2026-08-10T20:00',
        days: [
          {
            date: '2026-08-10',
            condition: 'Clear',
            weatherCode: 0,
            tempMax: 25,
            tempMin: 15,
            precipitationSum: 0,
          },
          {
            date: '2026-08-11',
            condition: 'Rain',
            weatherCode: 63,
            tempMax: 20,
            tempMin: 14,
            precipitationSum: 2,
          },
        ],
        hours: [
          { time: '2026-08-10T10:00', temperature: 18, weatherCode: 0 },
          { time: '2026-08-10T12:00', temperature: 22, weatherCode: 0 },
          { time: '2026-08-10T14:00', temperature: 24, weatherCode: 0 },
        ],
        updatedAt: '2026-08-10T12:00:00.000Z',
      },
    },
  };
  return applyForecast(state, 'home', {
    temperature: 22,
    feelsLike: 21,
    humidity: 40,
    windSpeed: 10,
    windDirection: 180,
    weatherCode: 0,
    condition: 'Clear',
    sunrise: '2026-08-10T06:30',
    sunset: '2026-08-10T20:00',
    days: state.locations['home']!.days,
    hours: state.locations['home']!.hours,
  });
}

function nowRuntime(): ReturnType<typeof createAppRuntime> {
  const entities = createEntityStore();
  entities.register(WEATHER_LOCATIONS_ENTITY, readyState());
  const runtime = createAppRuntime({ entities });
  for (const id of [
    'weather.refresh',
    'weather.set-units',
    'weather.configure-location',
    'weather.ensure-location',
  ]) {
    runtime.commands.register({ id, title: id, run: () => {} });
  }
  return runtime;
}

describe.skipIf(!renderable)('NowWidget', () => {
  it('draws the hero temperature, place, metrics and controls', async () => {
    const setup = await testRender(
      <ThemeProvider theme={MIDNIGHT_THEME}>
        <RuntimeProvider runtime={nowRuntime()}>
          <NowWidget options={{ location: 'home' }} width={72} height={22} />
        </RuntimeProvider>
      </ThemeProvider>,
      { width: 76, height: 24 },
    );

    try {
      await setup.renderOnce();
      const frame = setup.captureCharFrame();
      expect(frame).toContain('Beverly Hills');
      expect(frame).toContain('Clear');
      expect(frame).toContain('Humidity');
      expect(frame).toContain('Wind');
      expect(frame).not.toContain('Sun');
      expect(frame).toContain('Refresh');
      expect(frame).toContain('live');
      expect(frame).toContain('--( )--');
      expect(frame).toMatch(/22|°C/);
      expect(frame).toMatch(/%/);
    } finally {
      setup.renderer.destroy();
    }
  });
});

describe.skipIf(!renderable)('NowWidget at small sizes', () => {
  it('keeps the big temperature and steps the stats down to plain text', async () => {
    const setup = await testRender(
      <ThemeProvider theme={MIDNIGHT_THEME}>
        <RuntimeProvider runtime={nowRuntime()}>
          <NowWidget options={{ location: 'home' }} width={48} height={16} />
        </RuntimeProvider>
      </ThemeProvider>,
      { width: 52, height: 18 },
    );

    try {
      await setup.renderOnce();
      const frame = setup.captureCharFrame();
      expect(frame).toContain('-( o )-');
      expect(frame).not.toContain('--( )--');
      // Humidity and wind read as themselves rather than as ascii glyphs.
      expect(frame).toContain('40 %');
      expect(frame).toContain('10 km/h');
      expect(frame).toContain('█');
    } finally {
      setup.renderer.destroy();
    }
  });

  it('steps the temperature to the tiny font and trades the buttons for chips', async () => {
    const setup = await testRender(
      <ThemeProvider theme={MIDNIGHT_THEME}>
        <RuntimeProvider runtime={nowRuntime()}>
          <NowWidget options={{ location: 'home' }} width={30} height={11} />
        </RuntimeProvider>
      </ThemeProvider>,
      { width: 34, height: 13 },
    );

    try {
      await setup.renderOnce();
      const frame = setup.captureCharFrame();
      expect(frame).not.toContain('--( )--');
      expect(frame).toContain('-( o )-');
      // 22 in the two-row `tiny` font — twice the height of plain text.
      expect(frame).toContain('▀█ ▀█');
      expect(frame).toContain('°C');
      expect(frame).toContain('10 km/h');
      expect(frame).toContain('[Refresh]');
      expect(frame).toContain('[Loc]');
      // The three-row bordered buttons are what freed the hero's rows.
      expect(frame).not.toContain('╭─────────╮');
    } finally {
      setup.renderer.destroy();
    }
  });

  it('keeps the temperature drawn rather than typed at its smallest', async () => {
    const setup = await testRender(
      <ThemeProvider theme={MIDNIGHT_THEME}>
        <RuntimeProvider runtime={nowRuntime()}>
          <NowWidget options={{ location: 'home' }} width={24} height={9} />
        </RuntimeProvider>
      </ThemeProvider>,
      { width: 28, height: 11 },
    );

    try {
      await setup.renderOnce();
      const frame = setup.captureCharFrame();
      // Nine rows: humidity and wind go, but the number the widget exists for
      // still gets both of its rows.
      expect(frame).toContain('▀█ ▀█');
      expect(frame).toContain('Clear');
      expect(frame).not.toContain('km/h');
    } finally {
      setup.renderer.destroy();
    }
  });
});

describe.skipIf(!renderable)('ForecastWidget', () => {
  it('draws the place, day rows and toolbar', async () => {
    const entities = createEntityStore();
    entities.register(WEATHER_LOCATIONS_ENTITY, readyState());
    const runtime = createAppRuntime({ entities });
    for (const id of ['weather.refresh', 'weather.configure-location', 'weather.ensure-location']) {
      runtime.commands.register({ id, title: id, run: () => {} });
    }

    const setup = await testRender(
      <ThemeProvider theme={MIDNIGHT_THEME}>
        <RuntimeProvider runtime={runtime}>
          <ForecastWidget options={{ location: 'home' }} width={40} height={26} />
        </RuntimeProvider>
      </ThemeProvider>,
      { width: 44, height: 28 },
    );

    try {
      await setup.renderOnce();
      const frame = setup.captureCharFrame();
      expect(frame).toContain('Beverly Hills');
      expect(frame).toContain('Clear');
      expect(frame).toContain('Rain');
      expect(frame).toContain('Refresh');
      expect(frame).toContain('Location');
    } finally {
      setup.renderer.destroy();
    }
  });

  it('switches to a horizontal day strip when short', async () => {
    const entities = createEntityStore();
    entities.register(WEATHER_LOCATIONS_ENTITY, readyState());
    const runtime = createAppRuntime({ entities });
    for (const id of ['weather.refresh', 'weather.configure-location', 'weather.ensure-location']) {
      runtime.commands.register({ id, title: id, run: () => {} });
    }

    const setup = await testRender(
      <ThemeProvider theme={MIDNIGHT_THEME}>
        <RuntimeProvider runtime={runtime}>
          <ForecastWidget options={{ location: 'home' }} width={48} height={20} />
        </RuntimeProvider>
      </ThemeProvider>,
      { width: 52, height: 22 },
    );

    try {
      await setup.renderOnce();
      const frame = setup.captureCharFrame();
      expect(frame).toContain('Beverly Hills');
      expect(frame).toContain('25°');
      expect(frame).toContain('20°');
      expect(frame).toContain('2-day');
      // Vertical list labels are omitted in the compact strip.
      expect(frame).not.toContain('Today ');
      expect(frame).toContain('Refresh');
    } finally {
      setup.renderer.destroy();
    }
  });
});
