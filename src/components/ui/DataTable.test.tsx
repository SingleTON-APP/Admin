import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { DataTable } from './DataTable';

describe('table row navigation', () => {
  it('keeps nested controls independent from row navigation', () => {
    const navigate = vi.fn();
    const copy = vi.fn();
    render(
      <DataTable
        rows={[{ id: 'report-1' }]}
        rowKey={(row) => row.id}
        columns={[
          {
            key: 'id',
            header: 'Жалоба',
            render: (row) => (
              <>
                <span>{row.id}</span>
                <button onClick={copy}>Копировать</button>
              </>
            ),
          },
        ]}
        onRowClick={navigate}
      />,
    );
    const button = screen.getByRole('button', { name: 'Копировать' });
    fireEvent.click(button);
    fireEvent.keyDown(button, { key: 'Enter' });
    expect(copy).toHaveBeenCalledTimes(1);
    expect(navigate).not.toHaveBeenCalled();
    fireEvent.click(screen.getByText('report-1'));
    expect(navigate).toHaveBeenCalledTimes(1);
    fireEvent.keyDown(
      screen.getByRole('row', { name: 'Открыть запись report-1' }),
      { key: 'Enter' },
    );
    expect(navigate).toHaveBeenCalledTimes(2);
  });
});
