import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { useTerminalDimensions } from '@opentui/react';
import { Panel, planLayout, useTheme, type PlacedItem } from '@nightshift/ui';
import type { WidgetProps } from '@nightshift/sdk';
import type { DashboardSpec, WidgetSpec } from './schema.js';
import type { WidgetRegistry } from './registry.js';
import { MissingWidget } from './widgets.js';

export interface DashboardProps {
  dashboard: DashboardSpec;
  registry: WidgetRegistry;
  /**
   * Bumping this remounts every widget — how `dashboard.refresh` and the
   * refresh command force a redraw of widgets holding their own state.
   */
  generation?: number;
}

function WidgetSlot({
  placed,
  registry,
  height,
  generation,
}: {
  placed: PlacedItem<WidgetSpec>;
  registry: WidgetRegistry;
  height: number;
  generation: number;
}): ReactNode {
  const spec = placed.item;
  const definition = registry.get(spec.type);

  const props: WidgetProps = {
    options: spec.options ?? {},
    width: placed.width,
    height,
    ...(spec.title === undefined ? {} : { title: spec.title }),
  };

  if (!definition) {
    return (
      <box style={{ flexGrow: placed.grow, flexBasis: 0, flexDirection: 'column' }}>
        <MissingWidget type={spec.type} />
      </box>
    );
  }

  const Render = definition.render;

  return (
    <box style={{ flexGrow: placed.grow, flexBasis: 0, flexDirection: 'column' }}>
      <Panel title={spec.title ?? definition.title}>
        <Render key={generation} {...props} />
      </Panel>
    </box>
  );
}

/**
 * Draws a dashboard.
 *
 * The layout is solved once per size against the authored rows, so a widget
 * knows how many cells it has before it renders — charts and tables need that
 * — and a narrow terminal restacks rather than squashing them.
 */
export function Dashboard({ dashboard, registry, generation = 0 }: DashboardProps): ReactNode {
  const theme = useTheme();
  const size = useTerminalDimensions();
  const [tick, setTick] = useState(0);

  const plan = useMemo(
    () =>
      planLayout<WidgetSpec>(
        dashboard.rows.map((row) => ({ height: row.height, items: row.widgets })),
        // The status bar owns the bottom row.
        { width: size.width, height: Math.max(1, size.height - 1) },
      ),
    [dashboard.rows, size.height, size.width],
  );

  // A dashboard can ask to be redrawn on an interval, for widgets whose data
  // ages rather than being pushed to them.
  useEffect(() => {
    const seconds = dashboard.refresh ?? 0;
    if (seconds <= 0) return;
    const timer = setInterval(() => setTick((current) => current + 1), seconds * 1000);
    timer.unref?.();
    return () => clearInterval(timer);
  }, [dashboard.refresh]);

  if (plan.rows.length === 0) {
    return (
      <box style={{ flexGrow: 1, alignItems: 'center', justifyContent: 'center' }}>
        <text fg={theme.colors.muted}>{`"${dashboard.name}" has no widgets.`}</text>
      </box>
    );
  }

  return (
    <box style={{ flexGrow: 1, flexDirection: 'column' }}>
      {plan.rows.map((row, index) => (
        <box
          key={`${row.source}:${index}`}
          style={{ flexDirection: 'row', flexGrow: row.grow, flexBasis: 0 }}
        >
          {row.items.map((placed) => (
            <WidgetSlot
              key={`${row.source}:${placed.index}`}
              placed={placed}
              registry={registry}
              height={row.height}
              generation={generation + tick}
            />
          ))}
        </box>
      ))}
    </box>
  );
}
