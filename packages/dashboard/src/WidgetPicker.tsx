import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { useKeyboard } from '@opentui/react';
import { Modal, useTheme } from '@nightshift/ui';
import type { WidgetDefinition, WidgetRegistry } from './registry.js';

export interface WidgetPickerProps {
  open: boolean;
  registry: WidgetRegistry;
  onClose: () => void;
  /** Called with the chosen widget's type; the picker closes itself first. */
  onPick: (widget: WidgetDefinition) => void;
  /** Overrides the modal's title — "Add a widget" inserts a new one, "Swap
   * widget" replaces the selected one in place; both use this same picker. */
  title?: string;
}

/** True for a key that should be typed into the search rather than acted on. */
function isTypable(key: { name?: string | undefined; ctrl?: boolean; meta?: boolean }): boolean {
  return (
    key.ctrl !== true && key.meta !== true && typeof key.name === 'string' && key.name.length === 1
  );
}

function matches(widget: WidgetDefinition, query: string): boolean {
  if (query === '') return true;
  const haystack = `${widget.type} ${widget.title} ${widget.source ?? 'core'}`.toLowerCase();
  return haystack.includes(query);
}

/**
 * Every widget a plugin has registered, searchable and grouped by who
 * contributed it — what edit mode's "add a widget" opens. It knows nothing
 * about the dashboard it will be inserted into; picking just hands the
 * chosen definition back and lets the caller decide where it goes.
 */
export function WidgetPicker({
  open,
  registry,
  onClose,
  onPick,
  title = 'Add a widget',
}: WidgetPickerProps): ReactNode {
  const theme = useTheme();
  const [query, setQuery] = useState('');
  const [cursor, setCursor] = useState(0);

  const results = useMemo(() => {
    if (!open) return [];
    const needle = query.trim().toLowerCase();
    return registry
      .list()
      .filter((widget) => matches(widget, needle))
      .sort(
        (a, b) => (a.source ?? '').localeCompare(b.source ?? '') || a.type.localeCompare(b.type),
      );
  }, [registry, query, open]);

  useEffect(() => {
    if (open) {
      setQuery('');
      setCursor(0);
    }
  }, [open]);

  useEffect(() => {
    setCursor((current) => Math.min(current, Math.max(0, results.length - 1)));
  }, [results.length]);

  useKeyboard((key) => {
    if (!open) return;

    if (key.name === 'escape') return onClose();
    if (key.name === 'down' || (key.name === 'n' && key.ctrl)) {
      return setCursor((current) => (results.length === 0 ? 0 : (current + 1) % results.length));
    }
    if (key.name === 'up' || (key.name === 'p' && key.ctrl)) {
      return setCursor((current) =>
        results.length === 0 ? 0 : (current - 1 + results.length) % results.length,
      );
    }
    if (key.name === 'backspace') return setQuery((current) => current.slice(0, -1));
    if (key.name === 'return') {
      const widget = results[cursor];
      if (!widget) return;
      onClose();
      onPick(widget);
      return;
    }
    if (isTypable(key)) setQuery((current) => current + key.name);
  });

  if (!open) return null;

  return (
    <Modal title={title} width={72} height={20} hint="↑↓ to move · enter to choose · esc to close">
      <box style={{ flexDirection: 'row', gap: 1, height: 1 }}>
        <text fg={theme.colors.accent}>›</text>
        {query === '' ? (
          <text fg={theme.colors.muted}>Search widgets…</text>
        ) : (
          <text fg={theme.colors.text}>{`${query}▏`}</text>
        )}
      </box>
      <box style={{ height: 1 }} />
      {results.length === 0 ? (
        <text fg={theme.colors.muted}>No widget matches “{query}”.</text>
      ) : (
        results.map((widget, index) => {
          const active = index === cursor;
          return (
            <box
              key={widget.type}
              style={{
                flexDirection: 'column',
                flexShrink: 0,
                ...(active ? { backgroundColor: theme.colors.border } : {}),
              }}
            >
              <box style={{ flexDirection: 'row', gap: 1, height: 1 }}>
                <text fg={active ? theme.colors.accent : theme.colors.muted}>
                  {active ? '▸' : ' '}
                </text>
                <text fg={theme.colors.text}>{widget.title}</text>
                <text fg={theme.colors.muted}>{widget.type}</text>
                <text fg={theme.colors.accentSecondary}>{widget.source ?? 'core'}</text>
              </box>
              {active && widget.description !== undefined && (
                <text fg={theme.colors.muted}>{`  ${widget.description}`}</text>
              )}
            </box>
          );
        })
      )}
    </Modal>
  );
}
