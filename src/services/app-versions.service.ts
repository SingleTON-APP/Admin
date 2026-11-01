import { request } from '../api/client';

export type AppPlatform = 'ios' | 'android';

export interface AppVersionPolicy {
  platform: AppPlatform;
  latestBuild: number | null;
  minBuild: number | null;
  latestVersion: string | null;
  storeUrl: string | null;
  message: string | null;
  updatedAt: string | null;
}

export interface InstalledVersion {
  platform: AppPlatform;
  appVersion: string | null;
  users: number;
  devices: number;
  lastSeen: string;
}

export interface AppVersionsSnapshot {
  policies: AppVersionPolicy[];
  installed: InstalledVersion[];
}

export type AppVersionUpdate = Partial<
  Pick<
    AppVersionPolicy,
    'latestBuild' | 'minBuild' | 'latestVersion' | 'storeUrl' | 'message'
  >
>;

export const appVersionsService = {
  snapshot: (signal?: AbortSignal) =>
    request<AppVersionsSnapshot>('/admin/app-versions', { signal }),
  update: (platform: AppPlatform, body: AppVersionUpdate) =>
    request<AppVersionPolicy>(`/admin/app-versions/${platform}`, {
      method: 'PUT',
      body: JSON.stringify(body),
    }),
};
