import { useEffect, useState, type ReactNode } from 'react';
import type { Json } from '@nightshift/core';
import { useEntity, useTheme, type AppRuntime } from './context.js';
import { StatusDot } from '../components/Primitives.js';

interface VibeState {
  active: string | null;
  title: string | null;
  [key: string]: Json;
}

interface PluginSummary {
  id: string;
  [key: string]: Json;
}

interface PluginsState {
  plugins: PluginSummary[];
  [key: string]: Json;
}

function pad(value: number): string {
  return String(value).padStart(2, '0');
}

/** Ticks once a minute — the header shows minutes, not seconds, to stay quiet. */
function useClock(): Date {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 15_000);
    timer.unref?.();
    return () => clearInterval(timer);
  }, []);
  return now;
}

export interface HeaderProps {
  runtime: AppRuntime;
  /** The active screen's name — a dashboard title, or a nav destination's label. */
  title: string;
}

/**
 * The persistent top bar: the wordmark, what is currently showing, the active
 * vibe when there is one, the clock, and a couple of compact counts. It reads
 * `nightshift.vibe` and `nightshift.plugins` if something has published them —
 * see the CLI's runtime wiring — and simply omits what nobody has published,
 * so the header works (just quieter) for a shell nothing else has wired up.
 */
export function Header({ runtime, title }: HeaderProps): ReactNode {
  const theme = useTheme();
  const now = useClock();
  const vibe = useEntity<VibeState>('nightshift.vibe', runtime.entities);
  const plugins = useEntity<PluginsState>('nightshift.plugins', runtime.entities);

  const time = `${pad(now.getHours())}:${pad(now.getMinutes())}`;

  return (
    <box
      style={{
        height: 1,
        flexShrink: 0,
        flexDirection: 'row',
        justifyContent: 'space-between',
        backgroundColor: theme.colors.surface,
        paddingLeft: 1,
        paddingRight: 1,
      }}
    >
      <box style={{ flexDirection: 'row', gap: 2, flexShrink: 1 }}>
        <text fg={theme.colors.accentSecondary}>
          <b>NIGHTSHIFT</b>
        </text>
        <text fg={theme.colors.muted}>{title}</text>
        {vibe?.state.active && (
          <box style={{ flexDirection: 'row', gap: 1 }}>
            <StatusDot tone="accent" />
            <text fg={theme.colors.text}>
              {(vibe.state.title ?? vibe.state.active).toLowerCase()}
            </text>
          </box>
        )}
      </box>
      <box style={{ flexDirection: 'row', gap: 2, flexShrink: 0 }}>
        {plugins !== undefined && (
          <text fg={theme.colors.muted}>{`${plugins.state.plugins.length} plugins`}</text>
        )}
        <text fg={theme.colors.muted}>{time}</text>
      </box>
    </box>
  );
}
