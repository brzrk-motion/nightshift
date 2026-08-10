import type { ReactNode } from 'react';
import { useTheme } from '../app/context.js';
import { distribute } from '../layout.js';
import { truncate } from '../charts.js';

export interface TableColumn<Row> {
  key: string;
  header: string;
  /** Relative width against the other columns. */
  span?: number;
  align?: 'left' | 'right';
  /** Cell text. Defaults to the row's value under `key`. */
  render?: (row: Row) => string;
}

export interface TableProps<Row> {
  columns: readonly TableColumn<Row>[];
  rows: readonly Row[];
  /** Total columns available. Defaults to a sensible dashboard width. */
  width?: number;
  /** Index of the highlighted row. */
  selected?: number;
  onSelect?: (index: number) => void;
  /** Shown in place of the body when there are no rows. */
  empty?: string;
}

function cellText<Row>(column: TableColumn<Row>, row: Row): string {
  if (column.render) return column.render(row);
  const value = (row as Record<string, unknown>)[column.key];
  return value === undefined || value === null ? '' : String(value);
}

function pad(text: string, width: number, align: 'left' | 'right'): string {
  const clipped = truncate(text, width);
  return align === 'right' ? clipped.padStart(width) : clipped.padEnd(width);
}

/**
 * A fixed-column table. Widths are solved once against the space available and
 * cells are clipped to fit, so a long value can never push the columns out of
 * alignment — the thing that makes a terminal table unreadable.
 */
export function Table<Row>({
  columns,
  rows,
  width = 60,
  selected,
  onSelect,
  empty = 'Nothing to show',
}: TableProps<Row>): ReactNode {
  const theme = useTheme();
  const gaps = Math.max(0, columns.length - 1);
  const widths = distribute(
    Math.max(columns.length, width - gaps),
    columns.map((column) => column.span ?? 1),
    3,
  );

  return (
    <box style={{ flexDirection: 'column', flexGrow: 1 }}>
      <box style={{ flexDirection: 'row', gap: 1, height: 1, flexShrink: 0 }}>
        {columns.map((column, index) => (
          <text key={column.key} fg={theme.colors.muted}>
            {pad(column.header, widths[index] ?? 0, column.align ?? 'left')}
          </text>
        ))}
      </box>

      {rows.length === 0 ? (
        <text fg={theme.colors.muted}>{empty}</text>
      ) : (
        rows.map((row, rowIndex) => (
          <box
            key={rowIndex}
            onMouseDown={() => onSelect?.(rowIndex)}
            style={{
              flexDirection: 'row',
              gap: 1,
              height: 1,
              flexShrink: 0,
              ...(rowIndex === selected ? { backgroundColor: theme.colors.border } : {}),
            }}
          >
            {columns.map((column, index) => (
              <text
                key={column.key}
                fg={rowIndex === selected ? theme.colors.accent : theme.colors.text}
              >
                {pad(cellText(column, row), widths[index] ?? 0, column.align ?? 'left')}
              </text>
            ))}
          </box>
        ))
      )}
    </box>
  );
}

export interface ListItem {
  id: string;
  label: string;
  /** A quieter line of detail after the label. */
  detail?: string;
  /** Drawn before the label. Defaults to a bullet. */
  marker?: string;
}

export interface ListProps {
  items: readonly ListItem[];
  selected?: number;
  onSelect?: (index: number, item: ListItem) => void;
  empty?: string;
}

/** A vertical list of labelled items, with an optional selection. */
export function List({
  items,
  selected,
  onSelect,
  empty = 'Nothing here yet',
}: ListProps): ReactNode {
  const theme = useTheme();

  if (items.length === 0) {
    return <text fg={theme.colors.muted}>{empty}</text>;
  }

  return (
    <box style={{ flexDirection: 'column', flexGrow: 1 }}>
      {items.map((item, index) => {
        const active = index === selected;
        return (
          <box
            key={item.id}
            onMouseDown={() => onSelect?.(index, item)}
            style={{ flexDirection: 'row', gap: 1, height: 1, flexShrink: 0 }}
          >
            <text fg={active ? theme.colors.accent : theme.colors.muted}>
              {item.marker ?? (active ? '▸' : '·')}
            </text>
            <text fg={active ? theme.colors.accent : theme.colors.text}>{item.label}</text>
            {item.detail !== undefined && <text fg={theme.colors.muted}>{item.detail}</text>}
          </box>
        );
      })}
    </box>
  );
}
