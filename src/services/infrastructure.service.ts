import { request } from '../api/client';

export type InfraStatus = 'OK' | 'WARNING' | 'CRITICAL' | 'UNKNOWN';

interface Assessment {
  status: InfraStatus;
  issues: string[];
}

export interface InfraDisk extends Assessment {
  device: string;
  kind: 'HDD' | 'NVME';
  model: string | null;
  serial: string | null;
  smartPassed: boolean | null;
  temperatureC: number | null;
  powerOnHours: number | null;
  reallocatedSectors: number | null;
  pendingSectors: number | null;
  offlineUncorrectable: number | null;
  reportedUncorrect: number | null;
  crcErrors: number | null;
  percentageUsed: number | null;
  availableSpare: number | null;
  availableSpareThreshold: number | null;
  mediaErrors: number | null;
  criticalWarning: number | null;
  bytesWritten: number | null;
  ioUtilPercent: number | null;
}

export interface InfraFilesystem extends Assessment {
  mountpoint: string;
  device: string;
  fstype: string;
  sizeBytes: number;
  availBytes: number;
  usedPercent: number;
  role: string;
}

export interface InfraHost extends Assessment {
  cpuPercent: number | null;
  cpuCores: number | null;
  load1: number | null;
  load5: number | null;
  load15: number | null;
  memoryTotalBytes: number | null;
  memoryAvailableBytes: number | null;
  swapTotalBytes: number | null;
  swapFreeBytes: number | null;
  uptimeSeconds: number | null;
  cpuTemperatureC: number | null;
}

export interface InfrastructureSnapshot {
  generatedAt: string;
  status: InfraStatus;
  source: {
    prometheus: 'OK' | 'UNAVAILABLE';
    nodeExporter: boolean;
    smartExporter: boolean;
    reason?: string;
  };
  host: InfraHost | null;
  filesystems: InfraFilesystem[];
  disks: InfraDisk[];
  storage: {
    name: string;
    status: InfraStatus;
    latencyMs: number | null;
    reason?: string;
  };
}

export const infrastructureService = {
  snapshot: (signal?: AbortSignal) =>
    request<InfrastructureSnapshot>('/admin/infrastructure', { signal }),
};
