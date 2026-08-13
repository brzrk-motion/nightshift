import { useEffect, useState, type ReactNode } from 'react';
import {
  IconButton,
  LineChart,
  Sparkline,
  Toggle,
  Toolbar,
  useCommands,
  useEntity,
  useTheme,
  type WidgetProps,
} from '@nightshift/sdk';
import {
  METRIC_KEYS,
  METRICS_ENTITY,
  settingsFieldForMetric,
  SETTINGS_ENTITY,
  type MetricKey,
  type MetricSample,
  type MonitorMetricsState,
  type MonitorSettings,
} from './entity.js';
import { chartWidthForCell, metricRows, resolveGridColumns } from './layout.js';
import { initialSettings } from './settings.js';

/** Below this height, sparklines and compact settings layout are used. */
export const COMPACT_HEIGHT = 12;

const METRIC_TITLES: Record<MetricKey, string> = {
  cpu: 'CPU',
  gpu: 'GPU',
  network: 'Network',
  ram: 'RAM',
};

function isGraphEnabled(settings: MonitorSettings, metric: MetricKey): boolean {
  return settings[settingsFieldForMetric(metric)] as boolean;
}

function enabledMetrics(settings: MonitorSettings): MetricKey[] {
  return METRIC_KEYS.filter((metric) => isGraphEnabled(settings, metric));
}

function MetricChart({
  sample,
  compact,
  percentScale,
  chartWidth,
}: {
  sample: MetricSample;
  compact: boolean;
  percentScale: boolean;
  chartWidth: number;
}): ReactNode {
  const theme = useTheme();
  const values = sample.history;

  if (sample.status !== 'ok' || values.length === 0) {
    return <text fg={theme.colors.muted}>{sample.error ?? 'Collecting…'}</text>;
  }

  if (compact || values.length < 2) {
    return (
      <Sparkline
        values={values}
        width={chartWidth}
        caption={sample.label}
        {...(percentScale ? { min: 0, max: 100 } : {})}
        tone="accent"
      />
    );
  }

  return (
    <LineChart
      values={values}
      width={chartWidth}
      height={3}
      showAxis={percentScale}
      {...(percentScale ? { min: 0, max: 100 } : {})}
      tone="accent"
    />
  );
}

function MetricCell({
  title,
  sample,
  compact,
  percentScale,
  chartWidth,
}: {
  title: string;
  sample: MetricSample;
  compact: boolean;
  percentScale: boolean;
  chartWidth: number;
}): ReactNode {
  const theme = useTheme();

  return (
    <box
      style={{
        flexDirection: 'column',
        flexGrow: 1,
        flexBasis: 0,
        gap: 0,
        minHeight: 0,
        overflow: 'hidden',
        paddingRight: 1,
      }}
    >
      <box style={{ flexDirection: 'column', gap: 0, flexShrink: 0 }}>
        <text fg={theme.colors.text}>
          <b>{title}</b>
        </text>
        <text fg={theme.colors.muted}>{sample.label}</text>
        {sample.detail ? <text fg={theme.colors.muted}>{sample.detail}</text> : null}
      </box>
      <box style={{ flexGrow: 1, justifyContent: 'flex-end', minHeight: 0 }}>
        <MetricChart
          sample={sample}
          compact={compact}
          percentScale={percentScale}
          chartWidth={chartWidth}
        />
      </box>
    </box>
  );
}

function OverviewPanel({
  settings,
  metrics,
  width,
  height,
}: {
  settings: MonitorSettings;
  metrics: MonitorMetricsState;
  width: number;
  height: number;
}): ReactNode {
  const theme = useTheme();
  const visible = enabledMetrics(settings);

  if (metrics.platform === 'unsupported') {
    return (
      <box style={{ flexGrow: 1, justifyContent: 'center', paddingLeft: 1, paddingRight: 1 }}>
        <text fg={theme.colors.muted}>System metrics are only available on Linux in v1.</text>
      </box>
    );
  }

  if (visible.length === 0) {
    return (
      <box style={{ flexGrow: 1, justifyContent: 'center', paddingLeft: 1, paddingRight: 1 }}>
        <text fg={theme.colors.muted}>No graphs enabled. Open Settings to turn metrics on.</text>
      </box>
    );
  }

  const columns = resolveGridColumns(width, visible.length);
  const rows = metricRows(visible, width);
  const chartWidth = chartWidthForCell(width, columns);
  const compact = height < COMPACT_HEIGHT || rows.length > 1;

  return (
    <box
      style={{
        flexDirection: 'column',
        flexGrow: 1,
        gap: 1,
        paddingLeft: 1,
        paddingRight: 1,
        minHeight: 0,
      }}
    >
      {rows.map((row, rowIndex) => (
        <box
          key={rowIndex}
          style={{
            flexDirection: 'row',
            flexGrow: 1,
            flexBasis: 0,
            gap: 1,
            minHeight: 0,
          }}
        >
          {row.map((metric) => (
            <MetricCell
              key={metric}
              title={METRIC_TITLES[metric]}
              sample={metrics.metrics[metric]}
              compact={compact}
              percentScale={metric === 'cpu' || metric === 'ram' || metric === 'gpu'}
              chartWidth={chartWidth}
            />
          ))}
        </box>
      ))}
    </box>
  );
}

function SettingsPanel({
  settings,
  width,
  compact,
}: {
  settings: MonitorSettings;
  width: number;
  compact: boolean;
}): ReactNode {
  const commands = useCommands();

  const toggle = (metric: MetricKey, enabled: boolean): void => {
    void commands.run('system-monitor.set-graph-enabled', { metric, enabled });
  };

  if (compact) {
    return (
      <box
        style={{
          flexDirection: 'row',
          gap: 2,
          alignItems: 'center',
          flexWrap: 'wrap',
          flexGrow: 1,
          paddingLeft: 1,
        }}
      >
        {METRIC_KEYS.map((metric) => (
          <Toggle
            key={metric}
            label={METRIC_TITLES[metric]}
            value={isGraphEnabled(settings, metric)}
            onChange={(enabled) => toggle(metric, enabled)}
          />
        ))}
      </box>
    );
  }

  const columns = resolveGridColumns(width, METRIC_KEYS.length);
  const rows = metricRows(METRIC_KEYS, width);

  return (
    <box
      style={{
        flexDirection: 'column',
        flexGrow: 1,
        gap: 1,
        justifyContent: 'center',
        paddingLeft: 1,
        minHeight: 0,
      }}
    >
      {rows.map((row, rowIndex) => (
        <box key={rowIndex} style={{ flexDirection: 'row', gap: 2, flexGrow: 1, flexBasis: 0 }}>
          {row.map((metric) => (
            <box key={metric} style={{ flexGrow: 1, flexBasis: 0 }}>
              <Toggle
                label={METRIC_TITLES[metric]}
                value={isGraphEnabled(settings, metric)}
                onChange={(enabled) => toggle(metric, enabled)}
              />
            </box>
          ))}
          {row.length < columns
            ? Array.from({ length: columns - row.length }, (_, index) => (
                <box key={`pad-${index}`} style={{ flexGrow: 1, flexBasis: 0 }} />
              ))
            : null}
        </box>
      ))}
    </box>
  );
}

export function OverviewWidget({ width, height, options }: WidgetProps): ReactNode {
  const commands = useCommands();
  const settingsEntity = useEntity<MonitorSettings>(SETTINGS_ENTITY);
  const metricsEntity = useEntity<MonitorMetricsState>(METRICS_ENTITY);
  const settings = settingsEntity?.state ?? initialSettings();
  const metrics = metricsEntity?.state;
  const compact = height < COMPACT_HEIGHT;
  const [editing, setEditing] = useState(options['startInSettings'] === true);

  useEffect(() => {
    void commands.run('system-monitor.widget-mounted');
    return () => {
      void commands.run('system-monitor.widget-unmounted');
    };
  }, [commands]);

  if (!metrics) {
    return null;
  }

  return (
    <box style={{ flexDirection: 'column', flexGrow: 1, justifyContent: 'space-between' }}>
      <box style={{ flexGrow: 1, overflow: 'hidden', minHeight: 0 }}>
        {editing ? (
          <SettingsPanel settings={settings} width={width} compact={compact} />
        ) : (
          <OverviewPanel settings={settings} metrics={metrics} width={width} height={height} />
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
