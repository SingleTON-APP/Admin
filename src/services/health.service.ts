import { request } from '../api/client';
import type { Dashboard } from '../types/domain';

export const healthService = {
  snapshot: async (signal?: AbortSignal) => {
    const started = performance.now();
    const result = await request<{
      generatedAt: string;
      services: Dashboard['systemStatus'];
    }>('/admin/health', { signal });
    return {
      ...result,
      services: {
        ...result.services,
        api: {
          ...result.services.api,
          latencyMs: Math.round(performance.now() - started),
        },
      },
    };
  },
};
