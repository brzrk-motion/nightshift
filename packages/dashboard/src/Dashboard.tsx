import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { useTerminalDimensions } from '@opentui/react';
import { checkCondition } from '@nightshift/automations';
import {
  Panel,
  isNavRailCollapsed,
  planLayout,
  shellContentSize,
  useEntity,
  useRuntime,
  useTheme,
  type PlacedItem,
} from '@nightshift/ui';
import type { WidgetProps } from '@nightshift/sdk';
import type { EntityId } from '@nightshift/entities';
import type { DashboardSpec, WidgetSpec } from './schema.js';
import { DEFAULT_DASHBOARD_REFRESH } from './schema.js';
import type { WidgetRegistry } from './registry.js';
import type { WidgetAddress } from './edit.js';
import { MissingWidget } from './widgets.js';

/** Placeholder id for `useEntity`'s required argument when a widget has no
 * `when` — no entity is ever registered under it, so the subscription is a
 * harmless no-op. */
const NO_CONDITION: EntityId = 'nightshift.none';

export interface DashboardProps {
  dashboard: DashboardSpec;
  registry: WidgetRegistry;
  /**
   * When true (default), layout uses the AppShell canvas size rather than the
   * full terminal — header, footer and nav rail are subtracted.
   */
  shell?: boolean;
  /**
   * Bumping this remounts every widget — how `dashboard.refresh` and the
   * refresh command force a redraw of widgets holding their own state.
   */
  generation?: number;
  /** Draws the selected widget's border in the accent colour and makes every
   * widget clickable to select, for edit mode. */
  editing?: boolean;
  selected?: WidgetAddress | null;
  onSelectWidget?: (address: WidgetAddress) => void;
}

function WidgetSlot({
  placed,
  address,
  registry,
  height,
  generation,
  editing,
  active,
  onSelect,
}: {
  placed: PlacedItem<WidgetSpec>;
  address: WidgetAddress;
  registry: WidgetRegistry;
  height: number;
  generation: number;
  editing: boolean;
  active: boolean;
  onSelect?: (address: WidgetAddress) => void;
}): ReactNode {
  const spec = placed.item;
  const definition = registry.get(spec.type);
  const runtime = useRuntime();
  const theme = useTheme();
  // Subscribed unconditionally — hooks cannot be skipped — so the slot
  // re-renders the moment the condition's own entity changes, not just
  // whenever something else in the dashboard does.
  useEntity(spec.when?.entity ?? NO_CONDITION, runtime?.entities);
  const visible = !spec.when || !runtime || checkCondition(runtime.entities, spec.when);

  const props: WidgetProps = {
    options: spec.options ?? {},
    width: placed.width,
    height,
    ...(spec.title === undefined ? {} : { title: spec.title }),
  };

  const select = (): void => {
    if (editing) onSelect?.(address);
  };

  // A hidden widget still owns its slot — the row does not reflow around it
  // — so a `when` toggling does not shuffle its neighbours on every change.
  // While editing it stays visible but dimmed, so it can still be selected
  // and un-hidden rather than disappearing out from under the cursor.
  if (!visible) {
    if (!editing) return <box style={{ flexGrow: placed.grow, flexBasis: 0 }} />;
    return (
      <box
        onMouseDown={select}
        style={{ flexGrow: placed.grow, flexBasis: 0, flexDirection: 'column' }}
      >
        <Panel
          title={spec.title ?? definition?.title ?? spec.type}
          active={active}
          density="compact"
        >
          <text fg={theme.colors.muted}>hidden — condition not met</text>
        </Panel>
      </box>
    );
  }

  if (!definition) {
    return (
      <box
        onMouseDown={select}
        style={{ flexGrow: placed.grow, flexBasis: 0, flexDirection: 'column' }}
      >
        <MissingWidget type={spec.type} />
      </box>
    );
  }

  const Render = definition.render;

  return (
    <box
      onMouseDown={select}
      style={{ flexGrow: placed.grow, flexBasis: 0, flexDirection: 'column' }}
    >
      <Panel title={spec.title ?? definition.title} active={active}>
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
export function Dashboard({
  dashboard,
  registry,
  shell = true,
  generation = 0,
  editing = false,
  selected = null,
  onSelectWidget,
}: DashboardProps): ReactNode {
  const theme = useTheme();
  const runtime = useRuntime();
  const terminalSize = useTerminalDimensions();
  const [tick, setTick] = useState(0);

  const layoutSize = useMemo(() => {
    if (!shell) return terminalSize;
    return shellContentSize(terminalSize, isNavRailCollapsed(terminalSize.width));
  }, [shell, terminalSize]);

  const plan = useMemo(
    () =>
      planLayout<WidgetSpec>(
        dashboard.rows.map((row) => ({ height: row.height, items: row.widgets })),
        layoutSize,
      ),
    [dashboard.rows, layoutSize],
  );

  // A dashboard can ask to be redrawn on an interval, for widgets whose data
  // ages rather than being pushed to them. Skip a tick while a plugin
  // TextInput holds keyboard capture — remounting widgets would erase in-progress
  // text (see `keyboardCapture.ts`).
  useEffect(() => {
    const seconds = dashboard.refresh ?? DEFAULT_DASHBOARD_REFRESH;
    if (seconds <= 0) return;
    const timer = setInterval(() => {
      if (runtime?.keyboardCapture.isCaptured()) return;
      setTick((current) => current + 1);
    }, seconds * 1000);
    timer.unref?.();
    return () => clearInterval(timer);
  }, [dashboard.refresh, runtime]);

  if (plan.rows.length === 0) {
    return (
      <box style={{ flexGrow: 1, alignItems: 'center', justifyContent: 'center' }}>
        <text fg={theme.colors.muted}>{`"${dashboard.name}" has no widgets.`}</text>
      </box>
    );
  }

  return (
    <box
      style={{ flexGrow: 1, flexDirection: 'column', width: '100%', height: '100%', minHeight: 0 }}
    >
      {plan.rows.map((row, index) => (
        <box
          key={`${row.source}:${index}`}
          style={{ flexDirection: 'row', flexGrow: row.grow, flexBasis: 0 }}
        >
          {row.items.map((placed) => {
            const address: WidgetAddress = { row: row.source, widget: placed.index };
            return (
              <WidgetSlot
                key={`${row.source}:${placed.index}`}
                placed={placed}
                address={address}
                registry={registry}
                height={row.height}
                generation={generation + tick}
                editing={editing}
                active={
                  editing && selected?.row === address.row && selected.widget === address.widget
                }
                {...(onSelectWidget === undefined ? {} : { onSelect: onSelectWidget })}
              />
            );
          })}
        </box>
      ))}
    </box>
  );
}
