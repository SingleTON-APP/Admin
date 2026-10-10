import { ApiError } from '../api/contracts';
import { navigation } from '../config/navigation';
import type { StaffRole } from '../types/domain';
import { adminService } from './admin.service';
import { siteContentService } from './site-content.service';
import { operationsV3Service } from './operations-v3.service';

export interface SearchItem {
  title: string;
  detail: string;
  path: string;
}
export interface SearchGroup {
  label: string;
  items: SearchItem[];
  error?: string;
}

export async function globalSearch(
  query: string,
  role: StaffRole,
  signal: AbortSignal,
): Promise<SearchGroup[]> {
  const manager = role === 'ADMIN' || role === 'FULL_ADMIN';
  const group = async (
    label: string,
    search: () => Promise<SearchItem[]>,
  ): Promise<SearchGroup> => {
    try {
      return { label, items: (await search()).slice(0, 6) };
    } catch (error) {
      if (signal.aborted) throw error;
      return {
        label,
        items: [],
        error:
          error instanceof Error ? error.message : 'Поиск временно недоступен',
      };
    }
  };
  const tasks: Promise<SearchGroup>[] = [
    Promise.resolve({
      label: 'Разделы',
      items: navigation
        .filter(
          (item) =>
            (!item.roles || item.roles.includes(role)) &&
            `${item.title} ${item.group}`
              .toLocaleLowerCase('ru')
              .includes(query.toLocaleLowerCase('ru')),
        )
        .slice(0, 6)
        .map((item) => ({
          title: item.title,
          detail: item.group,
          path: item.path,
        })),
    }),
    group('Пользователи', async () =>
      (
        await adminService.users({
          page: 1,
          pageSize: 6,
          search: query,
          signal,
        })
      ).items.map((item) => ({
        title:
          [item.firstName, item.lastName].filter(Boolean).join(' ') ||
          item.username ||
          item.publicId,
        detail: [
          item.username && '@' + item.username,
          item.email,
          item.publicId,
        ]
          .filter(Boolean)
          .join(' · '),
        path: '/admin/users/' + encodeURIComponent(item.id),
      })),
    ),
    group('Жалобы', async () =>
      (
        await adminService.reports({
          page: 1,
          pageSize: 6,
          search: query,
          signal,
        })
      ).items.map((item) => ({
        title: item.reason || 'Жалоба ' + item.id,
        detail: `${item.targetType} · ${item.status} · ${item.id}`,
        path: '/admin/reports/' + encodeURIComponent(item.id),
      })),
    ),
  ];
  if (manager)
    tasks.push(
      group('Новости', async () =>
        (await siteContentService.list(signal, query)).map((item) => ({
          title: item.title || 'Без заголовка',
          detail: `${item.status === 'DRAFT' ? 'Черновик' : 'Опубликовано'} · ${item.description}`,
          path: '/admin/site/news?article=' + item.id,
        })),
      ),
    );
  if (
    manager &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      query,
    )
  ) {
    tasks.push(
      group('Диагностика', async () => {
        try {
          const trace = await operationsV3Service.diagnostic(query, signal);
          return [
            {
              title: 'Ошибка ' + trace.code,
              detail: trace.occurredAt,
              path:
                '/admin/operations?tab=diagnostics&code=' +
                encodeURIComponent(trace.code),
            },
          ];
        } catch (error) {
          if (error instanceof ApiError && error.status === 404) return [];
          throw error;
        }
      }),
    );
  }
  return Promise.all(tasks);
}
