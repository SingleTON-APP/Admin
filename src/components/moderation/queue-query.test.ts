import { describe, expect, it } from 'vitest';
import { normalizeQueueParams, queueQuery } from './queue-query';
describe('untrusted queue URL parameters', () => {
  it.each([
    '0',
    '-1',
    '1.5',
    'Infinity',
    'NaN',
    '1e3',
    '9007199254740992',
    '1000001',
  ])('normalizes invalid page %s before API', (page) => {
    const query = queueQuery(new URLSearchParams({ page }));
    expect(query.page).toBe(1);
  });
  it('removes invalid enum, order and age values', () => {
    const input = new URLSearchParams(
      'targetType=SECRET&status=UNRECOGNIZED&priority=urgent&sort=content&order=sideways&age=Infinity&view=broken',
    );
    expect(normalizeQueueParams(input).toString()).toBe('');
    expect(queueQuery(input)).toMatchObject({
      page: 1,
      sort: 'priority',
      order: 'desc',
      targetType: undefined,
      status: undefined,
      priority: undefined,
      olderThanHours: undefined,
      view: undefined,
    });
  });
  it('preserves valid filter/page/order and legacy mine view', () => {
    const input = new URLSearchParams(
      'page=3&targetType=COMMENT&status=OPEN&priority=HIGH&sort=age&order=asc&age=24&assignee=me&search=report-123',
    );
    expect(queueQuery(input)).toMatchObject({
      page: 3,
      targetType: 'COMMENT',
      status: 'OPEN',
      priority: 'HIGH',
      sort: 'age',
      order: 'asc',
      olderThanHours: 24,
      view: 'mine',
      assigneeId: undefined,
      search: 'report-123',
    });
  });
  it('canonicalizes duplicate parameters and empty defaults', () => {
    expect(
      normalizeQueueParams(
        new URLSearchParams('page=0003&page=0&status=OPEN&status=INVALID'),
      ).toString(),
    ).toBe('page=3&status=OPEN');
    expect(
      normalizeQueueParams(
        new URLSearchParams('page=1&sort=&order='),
      ).toString(),
    ).toBe('');
  });
});
