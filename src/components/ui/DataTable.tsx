import type { KeyboardEvent, ReactNode } from 'react';
import { EmptyState } from './Primitives';

export interface Column<T> {
  key: string; header: string; render: (row: T) => ReactNode; className?: string;
}
export function DataTable<T>({ rows, columns, rowKey, selected, onSelect, onRowClick, rowClassName }: {
  rows: T[]; columns: Column<T>[]; rowKey: (row: T) => string;
  selected?: Set<string>; onSelect?: (id: string) => void; onRowClick?: (row: T) => void;
  rowClassName?: (row: T) => string;
}) {
  if (!rows.length) return <EmptyState />;
  const keyboard = (event: KeyboardEvent<HTMLTableRowElement>, row: T) => {
    if (!onRowClick || (event.key !== 'Enter' && event.key !== ' ')) return;
    event.preventDefault(); onRowClick(row);
  };
  return <div className="table-wrap"><table><thead><tr>
    {onSelect && <th className="check-cell"><span className="sr-only">Выбор</span></th>}
    {columns.map((column) => <th key={column.key} className={column.className} scope="col">{column.header}</th>)}
  </tr></thead><tbody>{rows.map((row) => {
    const key = rowKey(row);
    return <tr key={key} className={`${onRowClick ? 'clickable-row' : ''} ${rowClassName?.(row) ?? ''}`}
      onClick={() => onRowClick?.(row)} onKeyDown={(event) => keyboard(event, row)}
      tabIndex={onRowClick ? 0 : undefined} aria-label={onRowClick ? `Открыть запись ${key}` : undefined}>
      {onSelect && <td className="check-cell"><input aria-label={`Выбрать ${key}`} type="checkbox"
        checked={selected?.has(key)} onChange={() => onSelect(key)} onClick={(event) => event.stopPropagation()} /></td>}
      {columns.map((column) => <td key={column.key} className={column.className}>{column.render(row)}</td>)}
    </tr>;
  })}</tbody></table></div>;
}
