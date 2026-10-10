export interface SiteNewsItem {
  id: number;
  title: string;
  description: string;
  image: string | null;
  content: string;
  date: string;
  created_at: string;
  updated_at: string;
  status?: 'DRAFT' | 'PUBLISHED';
  revision?: number;
}

export interface SiteNewsDraft {
  title: string;
  description: string;
  image: string | null;
  content: string;
  date: string;
}

export interface SiteMediaUpload {
  imagePath: string;
  filename: string;
}
