import type { ReactNode } from 'react';
import { StatRow } from '../../components/Primitives.js';
import { EmptyState } from '../../components/States.js';
import { useRuntime } from '../context.js';

export function SettingsScreen(): ReactNode {
  const runtime = useRuntime();
  if (!runtime) return <EmptyState message="No runtime available." />;

  return (
    <box style={{ flexDirection: 'column', gap: 1, paddingLeft: 1 }}>
      <StatRow label="Terminal" value={`${runtime.size.width}×${runtime.size.height}`} />
      <text fg={runtime.themes.current.colors.muted}>
        Themes → create, edit, and activate color palettes.
      </text>
    </box>
  );
}
