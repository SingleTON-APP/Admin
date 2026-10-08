import { request } from '../api/client';

export interface ServiceHealth {
  status: 'HEALTHY' | 'DEGRADED' | 'DOWN' | 'UNKNOWN';
  latencyMs?: number;
  checkedAt?: string;
  configured?: boolean;
  probe?: string;
  reason?: string;
  primary?: boolean;
}
export type HealthServices = Record<string, ServiceHealth> & {
  api: ServiceHealth;
  database: ServiceHealth;
  posts: ServiceHealth;
};

export const healthService = {
  snapshot: async (
    signal?: AbortSignal,
  ): Promise<{ generatedAt: string; services: HealthServices }> => {
    const started = performance.now();
    const result = await request<{
      generatedAt: string;
      services: HealthServices;
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
