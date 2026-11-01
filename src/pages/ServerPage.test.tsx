import { fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { formatBytes } from '../components/dashboard/dashboard-format';
import {
  infrastructureService,
  type InfraDisk,
  type InfrastructureSnapshot,
} from '../services/infrastructure.service';
import { ServerPage } from './ServerPage';

const G = 1024 ** 3;
const T = 1024 ** 4;
const hdd = (
  device: string,
  mount: string,
  over: Partial<InfraDisk> = {},
): InfraDisk => ({
  device,
  kind: 'HDD',
  model: 'ST8000NM012A',
  serial: `S-${device}`,
  smartPassed: true,
  temperatureC: 30,
  powerOnHours: 8760,
  reallocatedSectors: 0,
  pendingSectors: 0,
  offlineUncorrectable: 0,
  reportedUncorrect: 0,
  crcErrors: 0,
  percentageUsed: null,
  availableSpare: null,
  availableSpareThreshold: null,
  mediaErrors: null,
  criticalWarning: null,
  bytesWritten: null,
  capacityBytes: 8_001_563_222_016,
  ioUtilPercent: 5,
  role: 'STORAGE',
  mountpoints: [mount],
  status: 'OK',
  issues: [],
  ...over,
});

const snapshot: InfrastructureSnapshot = {
  generatedAt: '2026-11-01T12:00:00Z',
  status: 'OK',
  source: { prometheus: 'OK', nodeExporter: true, smartExporter: true },
  host: {
    status: 'OK',
    issues: [],
    cpuPercent: 12.5,
    cpuCores: 8,
    load1: 1.2,
    load5: 1,
    load15: 0.9,
    memoryTotalBytes: 64 * G,
    memoryAvailableBytes: 40 * G,
    swapTotalBytes: G,
    swapFreeBytes: 0.01 * G,
    uptimeSeconds: 3 * 86_400 + 4 * 3_600,
    cpuTemperatureC: 41,
  },
  filesystems: [
    {
      mountpoint: '/',
      device: '/dev/nvme0n1p2',
      fstype: 'ext4',
      sizeBytes: 467 * G,
      availBytes: 184 * G,
      usedPercent: 60.6,
      role: 'Система и базы данных (SSD)',
      status: 'OK',
      issues: [],
    },
  ],
  disks: [
    hdd('sdb', '/mnt/minio-d2'),
    hdd('sda', '/mnt/minio-d1'),
    {
      ...hdd('nvme0n1', '/'),
      kind: 'NVME',
      model: 'ARDOR GAMING',
      role: 'SYSTEM',
      capacityBytes: 512_110_190_592,
      percentageUsed: 4,
      reallocatedSectors: null,
      pendingSectors: null,
      offlineUncorrectable: null,
    },
  ],
  storage: {
    name: 'S3 (RustFS)',
    status: 'OK',
    latencyMs: 3,
    capacity: {
      drives: 4,
      parityDrives: 2,
      rawTotalBytes: 29.2 * T,
      rawUsedBytes: 1.4 * T,
      usableTotalBytes: 14.6 * T,
      usableUsedBytes: 0.7 * T,
    },
  },
};

const renderPage = () =>
  render(
    <MemoryRouter>
      <ServerPage />
    </MemoryRouter>,
  );

describe('server infrastructure page', () => {
  afterEach(() => vi.restoreAllMocks());

  it('explains RAM, the system SSD and the file storage in plain words', async () => {
    vi.spyOn(infrastructureService, 'snapshot').mockResolvedValue(snapshot);
    renderPage();
    expect(
      await screen.findByRole('heading', { name: 'Всё в порядке' }),
    ).toBeVisible();

    const ram = screen.getByRole('article', { name: 'Оперативная память' });
    expect(within(ram).getByText(/Это не место для файлов/)).toBeVisible();
    expect(within(ram).getByText(/это нормально/)).toBeVisible();

    const ssd = screen.getByRole('article', { name: 'Системный диск' });
    expect(
      within(ssd).getByRole('heading', { name: 'Системный диск (SSD 512 ГБ)' }),
    ).toBeVisible();
    expect(within(ssd).getByText('Свободно 184 ГБ')).toBeVisible();

    const storage = screen.getByRole('article', { name: 'Хранилище файлов' });
    expect(within(storage).getByText('Свободно ≈ 13,9 ТБ')).toBeVisible();
    expect(within(storage).getByText(/поломку любых 2 дисков/)).toBeVisible();
  });

  it('names disks by role and keeps SMART counters behind "Подробнее"', async () => {
    vi.spyOn(infrastructureService, 'snapshot').mockResolvedValue(snapshot);
    renderPage();
    const names = (await screen.findAllByRole('article'))
      .map((a) => a.getAttribute('aria-label'))
      .filter((n) => n?.startsWith('Системный SSD') || n?.startsWith('Диск'));
    expect(names).toEqual([
      'Системный SSD',
      'Диск хранилища 1',
      'Диск хранилища 2',
    ]);
    const first = screen.getByRole('article', { name: 'Диск хранилища 1' });
    expect(within(first).getByText('HDD · 8 ТБ · ST8000NM012A')).toBeVisible();
    expect(within(first).getByText('Исправен')).toBeVisible();
    expect(
      within(first).getByText('Переназначенные сектора'),
    ).not.toBeVisible();
    fireEvent.click(within(first).getByText('Подробнее'));
    expect(within(first).getByText('Переназначенные сектора')).toBeVisible();
  });

  it('lists problems with the place they come from', async () => {
    vi.spyOn(infrastructureService, 'snapshot').mockResolvedValue({
      ...snapshot,
      status: 'CRITICAL',
      disks: [
        hdd('sda', '/mnt/minio-d1', {
          status: 'CRITICAL',
          pendingSectors: 2,
          issues: ['Нечитаемые сектора ждут переназначения: 2'],
        }),
      ],
    });
    renderPage();
    const verdict = await screen.findByRole('region', { name: 'Итог' });
    expect(
      within(verdict).getByRole('heading', { name: 'Есть проблема' }),
    ).toBeVisible();
    expect(verdict).toHaveTextContent(
      'Диск хранилища 1: Нечитаемые сектора ждут переназначения: 2',
    );
  });

  it('explains a monitoring outage instead of showing empty sections', async () => {
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
      storage: { ...snapshot.storage, capacity: null },
    });
    renderPage();
    expect(
      await screen.findByText(/сбор показателей недоступен \(HTTP 502\)/),
    ).toBeVisible();
    expect(
      screen.queryByRole('heading', { name: 'Физические диски' }),
    ).toBeNull();
  });

  it('shows what changes over time for each disk', async () => {
    const trend = {
      historyDays: 40,
      since: '2026-09-20',
      badSectorsDelta: { day: 0, week: 0, month: 0 },
      crcDeltaWeek: 0,
      temperature: [
        { day: '2026-10-30', max: 29 },
        { day: '2026-10-31', max: 33 },
      ],
      ssdYearsLeft: null,
      ssdForecastBasis: null,
    };
    vi.spyOn(infrastructureService, 'snapshot').mockResolvedValue({
      ...snapshot,
      disks: [
        hdd('sda', '/mnt/minio-d1', { trend }),
        hdd('sdb', '/mnt/minio-d2', {
          trend: { ...trend, badSectorsDelta: { day: 1, week: 4, month: 4 } },
        }),
        {
          ...(snapshot.disks.find((d) => d.role === 'SYSTEM') as InfraDisk),
          trend: {
            ...trend,
            ssdYearsLeft: 51.8,
            ssdForecastBasis: 'LIFETIME',
          },
        },
        hdd('sdc', '/mnt/media-d3', {
          trend: {
            ...trend,
            historyDays: 1,
            since: '2026-11-01',
            badSectorsDelta: { day: null, week: null, month: null },
          },
        }),
      ],
    });
    renderPage();
    const stable = await screen.findByRole('article', {
      name: 'Диск хранилища 2',
    });
    expect(within(stable).getByText('Изменений за месяц нет.')).toBeVisible();
    fireEvent.click(within(stable).getByText('Подробнее'));
    expect(
      within(stable).getByText(
        (_, el) => el?.tagName === 'DD' && el.textContent === '29–33\u00a0°C',
      ),
    ).toBeVisible();
    expect(
      within(
        screen.getByRole('article', { name: 'Диск хранилища 3' }),
      ).queryByText(/Плохих секторов стало больше/),
    ).toBeNull();
    expect(
      within(screen.getByRole('article', { name: 'Системный SSD' })).getByText(
        /Ресурса записи хватит надолго: больше 50 лет/,
      ),
    ).toBeVisible();
    expect(
      within(
        screen.getByRole('article', { name: 'Диск хранилища 1' }),
      ).getByText(/Наблюдение идёт с 1 ноября: .* недельная — через 6 дней/),
    ).toBeVisible();
  });

  it('formats byte sizes', () => {
    expect(formatBytes(512)).toBe('512 Б');
    expect(formatBytes(7.3 * T)).toBe('7,3 ТБ');
    expect(formatBytes(null)).toBe('—');
  });
});
