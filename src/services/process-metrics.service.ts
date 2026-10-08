import { request } from '../api/client';

export interface ProcessPoint {
  timestamp: string;
  count: number;
  durationSamples: number;
  errors: number;
  p50Ms: number | null;
  p95Ms: number | null;
  meanMs: number | null;
}
export interface ProcessOperation extends Omit<ProcessPoint, 'timestamp'> {
  id: string;
  source: string;
  availability: 'MEASURED' | 'NO_SAMPLES' | 'NOT_INSTRUMENTED';
  errorRate: number | null;
  ratePerMinute: number;
  series: ProcessPoint[];
}
export interface ProcessSnapshot {
  generatedAt: string;
  startedAt: string;
  operations: ProcessOperation[];
  sources?: {
    auth?: {
      status: string;
      checkedAt: string | null;
      lastSuccessAt: string | null;
      reason?: string;
    };
  };
}
export const processMetricsService = {
  snapshot: (minutes: 15 | 60, signal?: AbortSignal) =>
    request<ProcessSnapshot>(
      `/admin/process-metrics?windowMinutes=${minutes}`,
      { signal },
    ),
};
