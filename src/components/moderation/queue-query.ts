import type { ReportsQuery } from '../../services/admin.service';
const allowed: Record<string, readonly string[]> = {
  targetType: ['USER', 'MESSAGE', 'CHAT', 'POST', 'COMMENT', 'MEDIA'],
  status: ['OPEN', 'IN_REVIEW', 'RESOLVED', 'REJECTED'],
  priority: ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'],
  view: ['new', 'mine', 'critical', 'unassigned'],
  sort: ['priority', 'age', 'updatedAt'],
  order: ['asc', 'desc'],
  age: ['1', '6', '24'],
};
/** Normalize untrusted URLs before either filters or API requests consume them. */
export function normalizeQueueParams(input: URLSearchParams) {
  const params = new URLSearchParams(input);
  for (const [key, values] of Object.entries(allowed)) {
    const value = params.get(key);
    if (value && values.includes(value)) params.set(key, value);
    else params.delete(key);
  }
  const rawPage = params.get('page');
  const page = Number(rawPage);
  if (
    rawPage &&
    /^\d+$/.test(rawPage) &&
    Number.isSafeInteger(page) &&
    page > 1 &&
    page <= 1_000_000
  )
    params.set('page', String(page));
  else params.delete('page');
  return params;
}
export function queueQuery(params: URLSearchParams): ReportsQuery {
  const normalized = normalizeQueueParams(params);
  const assignee = normalized.get('assignee');
  const view = normalized.get('view') as ReportsQuery['view'];
  return {
    page: Number(normalized.get('page') ?? 1),
    pageSize: 25,
    search: normalized.get('search') || undefined,
    targetType:
      (normalized.get('targetType') as ReportsQuery['targetType']) || undefined,
    status: (normalized.get('status') as ReportsQuery['status']) || undefined,
    priority:
      (normalized.get('priority') as ReportsQuery['priority']) || undefined,
    assigneeId:
      assignee && !['me', 'unassigned'].includes(assignee)
        ? assignee
        : undefined,
    olderThanHours: normalized.has('age')
      ? Number(normalized.get('age'))
      : undefined,
    view:
      view ||
      (assignee === 'me'
        ? 'mine'
        : assignee === 'unassigned'
          ? 'unassigned'
          : undefined),
    sort: (normalized.get('sort') as ReportsQuery['sort']) || 'priority',
    order: (normalized.get('order') as ReportsQuery['order']) || 'desc',
  };
}
