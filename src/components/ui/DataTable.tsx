import type { ReactNode } from 'react';
import { EmptyState } from './Primitives';

export interface Column<T> {
  key: string;
  header: string;
  render: (row: T) => ReactNode;
  className?: string;
}

export function DataTable<T>({
  rows,
  columns,
  rowKey,
  selected,
  onSelect,
  onRowClick,
}: {
  rows: T[];
  columns: Column<T>[];
  rowKey: (row: T) => string;
  selected?: Set<string>;
  onSelect?: (id: string) => void;
  onRowClick?: (row: T) => void;
}) {
  if (!rows.length) return <EmptyState />;
  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            {onSelect && (
              <th className="check-cell">
                <span className="sr-only">Выбор</span>
              </th>
            )}
            {columns.map((column) => (
              <th key={column.key} className={column.className}>
                {column.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => {
            const key = rowKey(row);
            return (
              <tr
                key={key}
                className={onRowClick ? 'clickable-row' : ''}
                onClick={() => onRowClick?.(row)}
              >
                {onSelect && (
                  <td className="check-cell">
                    <input
                      aria-label={`Выбрать ${key}`}
                      type="checkbox"
                      checked={selected?.has(key)}
                      onChange={() => onSelect(key)}
                      onClick={(e) => e.stopPropagation()}
                    />
                  </td>
                )}
                {columns.map((column) => (
                  <td key={column.key} className={column.className}>
                    {column.render(row)}
                  </td>
                ))}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
