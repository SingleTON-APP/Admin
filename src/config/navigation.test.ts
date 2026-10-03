import { describe, expect, it } from 'vitest';
import { isNavigationActive, navigation } from './navigation';

describe('moderation navigation', () => {
  it('opens the actual personal queue and selects exactly one sidebar entry', () => {
    expect(navigation.find((item) => item.title === 'Моя очередь')?.path).toBe('/admin/reports?view=mine');
    for (const search of ['', '?view=mine', '?assignee=me', '?status=IN_REVIEW']) {
      expect(navigation.filter((item) => isNavigationActive(item.path, '/admin/reports', search))).toHaveLength(1);
    }
    expect(isNavigationActive('/admin/reports?view=mine', '/admin/reports', '?status=IN_REVIEW')).toBe(false);
  });
  it('retains the section selection on a details route', () => {
    expect(isNavigationActive('/admin/reports', '/admin/reports/report-1', '')).toBe(true);
    expect(isNavigationActive('/admin', '/admin/reports/report-1', '')).toBe(false);
  });
});
