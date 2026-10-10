import { siteRequest } from '../api/site-client';
import type {
  SiteMediaUpload,
  SiteNewsDraft,
  SiteNewsItem,
} from '../types/site-content';

function newsForm(
  draft: SiteNewsDraft,
  status?: 'DRAFT' | 'PUBLISHED',
  revision?: number,
  draftKey?: string,
) {
  const body = new FormData();
  body.append('title', draft.title.trim());
  body.append('description', draft.description.trim());
  body.append('content', draft.content);
  body.append('date', draft.date.trim());
  body.append('image', draft.image || '');
  if (status) body.append('status', status);
  if (revision !== undefined) body.append('revision', String(revision));
  if (draftKey) body.append('draftKey', draftKey);
  return body;
}

export const siteContentService = {
  list: (signal?: AbortSignal, search = '') =>
    siteRequest<SiteNewsItem[]>(
      `/admin/news?search=${encodeURIComponent(search)}`,
      { signal },
    ),
  saveDraft: (
    draft: SiteNewsDraft,
    draftKey: string,
    item?: SiteNewsItem | null,
  ) =>
    siteRequest<SiteNewsItem>(item ? `/news/${item.id}` : '/news', {
      method: item ? 'PUT' : 'POST',
      body: newsForm(draft, 'DRAFT', item?.revision, draftKey),
    }),
  create: (draft: SiteNewsDraft) =>
    siteRequest<SiteNewsItem>('/news', {
      method: 'POST',
      body: newsForm(draft),
    }),
  update: (id: number, draft: SiteNewsDraft, revision?: number) =>
    siteRequest<SiteNewsItem>(`/news/${id}`, {
      method: 'PUT',
      body: newsForm(
        draft,
        revision === undefined ? undefined : 'PUBLISHED',
        revision,
      ),
    }),
  remove: (id: number) =>
    siteRequest<void>(`/news/${id}`, { method: 'DELETE' }),
  upload: (file: File) => {
    const body = new FormData();
    body.append('image', file);
    return siteRequest<SiteMediaUpload>('/upload', {
      method: 'POST',
      body,
    });
  },
};
