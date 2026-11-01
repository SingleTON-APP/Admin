import { render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  infrastructureService,
  type InfrastructureSnapshot,
} from '../services/infrastructure.service';
import { formatBytes } from '../components/dashboard/dashboard-format';
import { ServerPage } from './ServerPage';

const snapshot: InfrastructureSnapshot = {
  generatedAt: '2026-11-01T12:00:00Z',
  status: 'CRITICAL',
  source: { prometheus: 'OK', nodeExporter: true, smartExporter: true },
  host: {
    status: 'OK',
    issues: [],
    cpuPercent: 12.5,
    cpuCores: 8,
    load1: 1.2,
    load5: 1,
    load15: 0.9,
    memoryTotalBytes: 64 * 1024 ** 3,
    memoryAvailableBytes: 32 * 1024 ** 3,
    swapTotalBytes: 1024 ** 3,
    swapFreeBytes: 1024 ** 3,
    uptimeSeconds: 3 * 86_400 + 4 * 3_600,
    cpuTemperatureC: 41,
  },
  filesystems: [
    {
      mountpoint: '/',
      device: '/dev/nvme0n1p2',
      fstype: 'ext4',
      sizeBytes: 100,
      availBytes: 10,
      usedPercent: 90,
      role: 'Система и базы данных (SSD)',
      status: 'WARNING',
      issues: ['Раздел заполнен на 90%'],
    },
  ],
  disks: [
    {
      device: 'sda',
      kind: 'HDD',
      model: 'ST8000NM012A',
      serial: 'WSD1',
      smartPassed: true,
      temperatureC: 30,
      powerOnHours: 8760,
      reallocatedSectors: 0,
      pendingSectors: 2,
      offlineUncorrectable: 0,
      reportedUncorrect: 0,
      crcErrors: 0,
      percentageUsed: null,
      availableSpare: null,
      availableSpareThreshold: null,
      mediaErrors: null,
      criticalWarning: null,
      bytesWritten: null,
      ioUtilPercent: 5,
      status: 'CRITICAL',
      issues: ['Нечитаемые сектора ждут переназначения: 2'],
    },
  ],
  storage: { name: 'S3 (RustFS)', status: 'OK', latencyMs: 3 },
};

describe('server infrastructure page', () => {
  afterEach(() => vi.restoreAllMocks());

  it('shows host tiles, filesystem usage and disk problems', async () => {
    vi.spyOn(infrastructureService, 'snapshot').mockResolvedValue(snapshot);
    render(
      <MemoryRouter>
        <ServerPage />
      </MemoryRouter>,
    );
    const disk = await screen.findByRole('article', { name: 'Диск sda' });
    expect(
      within(disk).getByText('Нечитаемые сектора ждут переназначения: 2'),
    ).toBeVisible();
    expect(within(disk).getByText('Проблема')).toBeVisible();
    expect(within(disk).getByText('8 760 ч (1,0 г.)')).toBeVisible();
    expect(screen.getByText('3 д 4 ч')).toBeVisible();
    expect(screen.getByText('Система и базы данных (SSD)')).toBeVisible();
    expect(screen.getByRole('meter')).toHaveAttribute('aria-valuenow', '90');
    expect(screen.getByText('ответ за 3 мс')).toBeVisible();
  });

  it('explains a Prometheus outage instead of showing empty tables', async () => {
    vi.spyOn(infrastructureService, 'snapshot').mockResolvedValue({
      ...snapshot,
      status: 'UNKNOWN',
      source: {
        prometheus: 'UNAVAILABLE',
        nodeExporter: false,
        smartExporter: false,
        reason: 'HTTP 502',
      },
      host: null,
      filesystems: [],
      disks: [],
    });
    render(
      <MemoryRouter>
        <ServerPage />
      </MemoryRouter>,
    );
    expect(
      await screen.findByText('Prometheus недоступен: HTTP 502'),
    ).toBeVisible();
    expect(screen.queryByRole('heading', { name: 'Диски' })).toBeNull();
  });

  it('formats byte sizes', () => {
    expect(formatBytes(512)).toBe('512 Б');
    expect(formatBytes(7.3 * 1024 ** 4)).toBe('7,3 ТБ');
    expect(formatBytes(null)).toBe('—');
  });
});
