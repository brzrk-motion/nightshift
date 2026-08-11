import type { ReactNode } from 'react';
import type { Json } from '@nightshift/core';
import { List } from '../../components/Table.js';
import { EmptyState } from '../../components/States.js';
import { useRuntime } from '../context.js';

const VIBE_PREFIX = 'vibe.activate.';

export function VibesScreen(): ReactNode {
  const runtime = useRuntime();
  const active = runtime?.entities.get<{ active: string | null; [key: string]: Json }>(
    'nightshift.vibe',
  )?.state.active;
  const vibeCommands = (runtime?.commands.list() ?? []).filter((command) =>
    command.id.startsWith(VIBE_PREFIX),
  );

  if (vibeCommands.length === 0) {
    return <EmptyState message="No vibes available." />;
  }

  return (
    <List
      items={vibeCommands.map((command) => {
        const name = command.id.slice(VIBE_PREFIX.length);
        return {
          id: command.id,
          label: command.title,
          marker: name === active ? '●' : '·',
          ...(name === active ? { detail: 'active' } : {}),
        };
      })}
      onSelect={(_index, item) => void runtime?.commands.run(item.id)}
    />
  );
}
