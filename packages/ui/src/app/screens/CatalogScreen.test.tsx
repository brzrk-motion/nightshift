import { describe, expect, it, vi } from 'vitest';
import { testRender } from '@opentui/react/test-utils';
import { act } from 'react';
import { createEntityStore } from '@nightshift/entities';
import { detectRuntime } from '../runtime.js';
import { createAppRuntime } from '../app.js';
import { RuntimeProvider, ThemeProvider } from '../context.js';
import { MIDNIGHT_THEME } from '../../theme.js';
import {
  CatalogScreen,
  type CatalogEditorProps,
  type CatalogListProps,
  type CatalogRow,
} from './CatalogScreen.js';

const renderable = detectRuntime().ffi;

interface TestDraft {
  name: string;
}

interface TestRow extends CatalogRow {
  name: string;
  source: 'built-in' | 'user';
  title?: string;
}

async function clickLabel(
  setup: Awaited<ReturnType<typeof testRender>>,
  label: string,
  options: { preferButtonRow?: boolean } = {},
): Promise<void> {
  const frame = setup.captureCharFrame();
  const lines = frame.split('\n');
  const row = options.preferButtonRow
    ? lines.findIndex((line) => line.includes(label) && line.includes('Cancel'))
    : lines.findIndex((line) => line.includes(label));
  expect(row, `expected frame to contain "${label}"`).toBeGreaterThanOrEqual(0);
  const col = lines[row]!.indexOf(label);
  await act(async () => {
    await setup.mockMouse.click(col + 1, row);
    await Promise.resolve();
  });
  await setup.renderOnce();
}

describe.skipIf(!renderable)('CatalogScreen', () => {
  it('shows the override confirm on create and saves only after confirm', async () => {
    const entities = createEntityStore();
    entities.register('nightshift.test-catalog', {
      items: [{ name: 'midnight', source: 'built-in' }] satisfies TestRow[],
    });

    const save = vi.fn(async () => {});
    const runtime = createAppRuntime({
      entities,
      commandList: [
        { id: 'test.save', title: 'Save', run: save },
        { id: 'test.delete', title: 'Delete', run: async () => {} },
      ],
    });

    let listApi: CatalogListProps<TestRow> | undefined;
    let editorApi: CatalogEditorProps<TestDraft> | undefined;

    const setup = await testRender(
      <ThemeProvider theme={MIDNIGHT_THEME}>
        <RuntimeProvider runtime={runtime}>
          <CatalogScreen<TestDraft, TestRow>
            entityId="nightshift.test-catalog"
            itemsKey="items"
            saveCommand="test.save"
            deleteCommand="test.delete"
            resourceLabel="theme"
            resourceFolder="themes"
            emptyDraft={() => ({ name: '' })}
            draftFromCatalog={(row) => ({ name: row.name })}
            duplicateDraft={(row) => ({ name: `${row.name}-copy` })}
            draftToSaveArgs={(draft) => ({ name: draft.name.trim() })}
            Editor={(props) => {
              editorApi = props;
              return <text>Editor</text>;
            }}
            List={(props) => {
              listApi = props;
              return <text>List</text>;
            }}
          />
        </RuntimeProvider>
      </ThemeProvider>,
      { width: 80, height: 24 },
    );

    try {
      await setup.renderOnce();
      await act(async () => {
        listApi?.onCreate();
      });
      await setup.renderOnce();

      await act(async () => {
        editorApi?.onSave({ name: 'midnight' });
      });
      await setup.renderOnce();

      // Regression: override modal must render while still on the create editor.
      expect(setup.captureCharFrame()).toContain('Override built-in?');
      expect(setup.captureCharFrame()).toContain('midnight');
      expect(save).not.toHaveBeenCalled();

      await clickLabel(setup, 'Save anyway');

      expect(save).toHaveBeenCalledWith({ name: 'midnight' });
      expect(setup.captureCharFrame()).toContain('List');
      expect(setup.captureCharFrame()).not.toContain('Override built-in?');
    } finally {
      setup.renderer.destroy();
    }
  });

  it('runs delete after confirming from the list', async () => {
    const entities = createEntityStore();
    entities.register('nightshift.test-catalog', {
      items: [{ name: 'forest', source: 'user', title: 'Forest' }] satisfies TestRow[],
    });

    const del = vi.fn(async () => {});
    const runtime = createAppRuntime({
      entities,
      commandList: [
        { id: 'test.save', title: 'Save', run: async () => {} },
        { id: 'test.delete', title: 'Delete', run: del },
      ],
    });

    let listApi: CatalogListProps<TestRow> | undefined;

    const setup = await testRender(
      <ThemeProvider theme={MIDNIGHT_THEME}>
        <RuntimeProvider runtime={runtime}>
          <CatalogScreen<TestDraft, TestRow>
            entityId="nightshift.test-catalog"
            itemsKey="items"
            saveCommand="test.save"
            deleteCommand="test.delete"
            resourceLabel="theme"
            resourceFolder="themes"
            emptyDraft={() => ({ name: '' })}
            draftFromCatalog={(row) => ({ name: row.name })}
            duplicateDraft={(row) => ({ name: `${row.name}-copy` })}
            draftToSaveArgs={(draft) => ({ name: draft.name.trim() })}
            getRowDisplayName={(row) => row.title ?? row.name}
            Editor={() => <text>Editor</text>}
            List={(props) => {
              listApi = props;
              return <text>List</text>;
            }}
          />
        </RuntimeProvider>
      </ThemeProvider>,
      { width: 80, height: 24 },
    );

    try {
      await setup.renderOnce();
      await act(async () => {
        listApi?.onDelete(listApi.rows[0]!);
      });
      await setup.renderOnce();

      const frame = setup.captureCharFrame();
      expect(frame).toContain('Delete theme?');
      expect(frame).toContain('Forest');
      expect(frame).toContain('themes/forest.yaml');

      await clickLabel(setup, 'Delete', { preferButtonRow: true });

      expect(del).toHaveBeenCalledWith({ name: 'forest' });
    } finally {
      setup.renderer.destroy();
    }
  });
});
