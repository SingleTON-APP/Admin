import { siteRequest } from '../api/site-client';
import type {
  SiteMediaUpload,
  SiteNewsDraft,
  SiteNewsItem,
} from '../types/site-content';

function newsForm(draft: SiteNewsDraft) {
  const body = new FormData();
  body.append('title', draft.title.trim());
  body.append('description', draft.description.trim());
  body.append('content', draft.content);
  body.append('date', draft.date.trim());
  body.append('image', draft.image || '');
  return body;
}

export const siteContentService = {
  list: (signal?: AbortSignal) =>
    siteRequest<SiteNewsItem[]>('/news', { signal }),
  create: (draft: SiteNewsDraft) =>
    siteRequest<SiteNewsItem>('/news', {
      method: 'POST',
      body: newsForm(draft),
    }),
  update: (id: number, draft: SiteNewsDraft) =>
    siteRequest<SiteNewsItem>(`/news/${id}`, {
      method: 'PUT',
      body: newsForm(draft),
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
