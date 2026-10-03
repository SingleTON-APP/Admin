import { request } from '../api/client';
export interface UsageSummary {
  available: boolean;
  days: number;
  timezone: 'UTC';
  measurement: 'FOREGROUND_DEVICE_TIME';
  coverage: 'INSTRUMENTED_AUTHENTICATED_CLIENTS_ONLY';
  platforms: Array<{ platform: 'ANDROID' | 'IOS' | 'WEB'; available: boolean }>;
  totals: null | {
    measuredUsers: number;
    foregroundMs: number;
    averageUserMs: number;
  };
  buckets: Array<{
    platform: string;
    browser: string;
    measuredUsers: number;
    foregroundMs: number;
    averageUserMs: number;
    averageDailyUserMs: number;
  }>;
  daily: Array<{
    date: string;
    platform: string;
    browser: string;
    measuredUsers: number;
    foregroundMs: number;
    averageUserMs: number;
  }>;
}
export const usageService = {
  summary: (days: 7 | 30, signal?: AbortSignal) =>
    request<UsageSummary>(`/admin/usage?days=${days}`, { signal }),
};
