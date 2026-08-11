import { type ReactNode } from 'react';
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

export interface HeaderProps {
  runtime: AppRuntime;
}

/**
 * The persistent top bar: the wordmark on the left, the active vibe centred
 * when one is set, and compact counts on the right. It reads `nightshift.vibe`
 * and `nightshift.plugins` if something has published them — see the CLI's
 * runtime wiring — and simply omits what nobody has published, so the header
 * works (just quieter) for a shell nothing else has wired up.
 */
export function Header({ runtime }: HeaderProps): ReactNode {
  const theme = useTheme();
  const vibe = useEntity<VibeState>('nightshift.vibe', runtime.entities);
  const plugins = useEntity<PluginsState>('nightshift.plugins', runtime.entities);

  return (
    <box
      style={{
        height: 1,
        flexShrink: 0,
        flexDirection: 'row',
        backgroundColor: theme.colors.surface,
        paddingLeft: 1,
        paddingRight: 1,
      }}
    >
      <box style={{ flexDirection: 'row', gap: 2, flexGrow: 1, flexShrink: 1 }}>
        <text fg={theme.colors.accentSecondary}>
          <b>NIGHTSHIFT</b>
        </text>
      </box>
      <box
        style={{
          flexDirection: 'row',
          gap: 1,
          flexGrow: 1,
          flexShrink: 1,
          justifyContent: 'center',
        }}
      >
        {vibe?.state.active && (
          <>
            <StatusDot tone="accent" />
            <text fg={theme.colors.text}>{(vibe.state.title ?? vibe.state.active).toLowerCase()}</text>
          </>
        )}
      </box>
      <box
        style={{
          flexDirection: 'row',
          gap: 2,
          flexGrow: 1,
          flexShrink: 1,
          justifyContent: 'flex-end',
        }}
      >
        {plugins !== undefined && (
          <text fg={theme.colors.muted}>{`${plugins.state.plugins.length} plugins active`}</text>
        )}
      </box>
    </box>
  );
}
