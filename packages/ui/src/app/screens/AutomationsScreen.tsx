import type { ReactNode } from 'react';
import type { Json } from '@nightshift/core';
import { Table, type TableColumn } from '../../components/Table.js';
import { EmptyState } from '../../components/States.js';
import { useRuntime } from '../context.js';
import { useShellContentSize } from '../useShellContentSize.js';

interface AutomationRow {
  name: string;
  trigger: string;
  enabled: boolean;
  [key: string]: Json;
}

const AUTOMATION_COLUMNS: readonly TableColumn<AutomationRow>[] = [
  { key: 'name', header: 'Automation', span: 2 },
  { key: 'trigger', header: 'Trigger' },
  {
    key: 'enabled',
    header: 'State',
    render: (row) => (row.enabled ? 'enabled' : 'disabled'),
  },
];

export function AutomationsScreen(): ReactNode {
  const runtime = useRuntime();
  const contentSize = useShellContentSize();
  const entity = runtime?.entities.get<{ automations: AutomationRow[]; [key: string]: Json }>(
    'nightshift.automations',
  );

  if (!runtime) return <EmptyState message="No runtime available." />;
  const automations = entity?.state.automations ?? [];
  if (automations.length === 0) return <EmptyState message="No automations registered." />;
  return <Table columns={AUTOMATION_COLUMNS} rows={[...automations]} width={contentSize.width} />;
}
