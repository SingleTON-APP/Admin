import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { adminService } from './admin.service';
import { siteContentService } from './site-content.service';
import { operationsV3Service } from './operations-v3.service';
import { globalSearch } from './global-search.service';

beforeEach(() => {
  vi.spyOn(adminService, 'users').mockResolvedValue({
    items: [],
    total: 0,
    page: 1,
    limit: 6,
  });
  vi.spyOn(adminService, 'reports').mockResolvedValue({
    items: [],
    total: 0,
    page: 1,
    limit: 6,
    counts: { all: 0, new: 0, mine: 0, critical: 0, unassigned: 0 },
  });
  vi.spyOn(siteContentService, 'list').mockResolvedValue([]);
  vi.spyOn(operationsV3Service, 'diagnostic');
});
afterEach(() => vi.restoreAllMocks());
describe('global search access and failures', () => {
  it('does not query news or diagnostics or expose restricted sections to moderators', async () => {
    const groups = await globalSearch(
      'Новости',
      'MODERATOR',
      new AbortController().signal,
    );
    expect(siteContentService.list).not.toHaveBeenCalled();
    expect(operationsV3Service.diagnostic).not.toHaveBeenCalled();
    expect(groups.some((group) => group.label === 'Новости')).toBe(false);
    expect(
      groups
        .flatMap((group) => group.items)
        .some((item) => item.path === '/admin/site/news'),
    ).toBe(false);
  });
  it('keeps other results when one service fails and forwards cancellation', async () => {
    vi.mocked(adminService.users).mockRejectedValue(
      new Error('Пользователи недоступны'),
    );
    const signal = new AbortController().signal;
    const groups = await globalSearch('Новости', 'ADMIN', signal);
    expect(groups.find((group) => group.label === 'Пользователи')?.error).toBe(
      'Пользователи недоступны',
    );
    expect(
      groups.find((group) => group.label === 'Разделы')?.items[0]?.path,
    ).toBe('/admin/site/news');
    expect(siteContentService.list).toHaveBeenCalledWith(signal, 'Новости');
    expect(adminService.reports).toHaveBeenCalledWith(
      expect.objectContaining({ search: 'Новости', signal }),
    );
  });
});
