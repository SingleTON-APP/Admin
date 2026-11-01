import { formatBytes } from '../components/dashboard/dashboard-format';
import { PageHeader } from '../components/ui/Primitives';
import { usePolling } from '../hooks/usePolling';
import {
  infrastructureService,
  type InfraDisk,
  type InfraStatus,
} from '../services/infrastructure.service';
import '../styles/server.css';

const statusText: Record<InfraStatus, string> = {
  OK: 'Норма',
  WARNING: 'Внимание',
  CRITICAL: 'Проблема',
  UNKNOWN: 'Нет данных',
};
const tone: Record<InfraStatus, string> = {
  OK: 'success',
  WARNING: 'warning',
  CRITICAL: 'danger',
  UNKNOWN: 'neutral',
};

function InfraBadge({ status }: { status: InfraStatus }) {
  return (
    <span className={`status status-${tone[status]}`}>
      <i />
      {statusText[status]}
    </span>
  );
}

const formatUptime = (seconds: number | null) => {
  if (seconds === null) return '—';
  const days = Math.floor(seconds / 86_400);
  const hours = Math.floor((seconds % 86_400) / 3_600);
  return days > 0 ? `${days} д ${hours} ч` : `${hours} ч`;
};

const num = (value: number | null, suffix = '') =>
  value === null ? '—' : `${value.toLocaleString('ru-RU')}${suffix}`;

function Meter({ percent, status }: { percent: number; status: InfraStatus }) {
  return (
    <div
      className={`server-meter server-meter-${tone[status]}`}
      role="meter"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={percent}
    >
      <span style={{ width: `${Math.min(100, Math.max(0, percent))}%` }} />
    </div>
  );
}

function DiskCard({ disk }: { disk: InfraDisk }) {
  const rows: Array<[string, string, string?]> =
    disk.kind === 'NVME'
      ? [
          [
            'Износ',
            num(disk.percentageUsed, '%'),
            'Израсходованная доля ресурса записи по оценке самого SSD.',
          ],
          [
            'Резерв',
            num(disk.availableSpare, '%'),
            'Запас ячеек на замену изношенным.',
          ],
          ['Ошибки данных', num(disk.mediaErrors)],
          ['Записано', formatBytes(disk.bytesWritten)],
        ]
      : [
          [
            'Переназначенные сектора',
            num(disk.reallocatedSectors),
            'Сектора, которые диск уже заменил резервными. Рост — ранний признак износа.',
          ],
          [
            'Ожидают переназначения',
            num(disk.pendingSectors),
            'Сектора, которые не удалось прочитать. Любое ненулевое значение — тревожный сигнал.',
          ],
          ['Неисправимые', num(disk.offlineUncorrectable)],
          [
            'Ошибки кабеля (CRC)',
            num(disk.crcErrors),
            'Ошибки передачи между диском и контроллером — обычно кабель или порт, а не сам диск.',
          ],
        ];
  return (
    <article className="card server-disk" aria-label={`Диск ${disk.device}`}>
      <header>
        <div>
          <h3>{disk.device}</h3>
          <p>
            {disk.kind === 'NVME' ? 'SSD NVMe' : 'HDD'}
            {disk.model ? ` · ${disk.model}` : ''}
            {disk.serial ? ` · ${disk.serial}` : ''}
          </p>
        </div>
        <InfraBadge status={disk.status} />
      </header>
      {disk.issues.length > 0 && (
        <ul className="server-issues">
          {disk.issues.map((issue) => (
            <li key={issue}>{issue}</li>
          ))}
        </ul>
      )}
      <dl>
        <div>
          <dt>SMART</dt>
          <dd>
            {disk.smartPassed === null
              ? '—'
              : disk.smartPassed
                ? 'Пройден'
                : 'Не пройден'}
          </dd>
        </div>
        <div>
          <dt>Температура</dt>
          <dd>{num(disk.temperatureC, '\u00a0°C')}</dd>
        </div>
        <div>
          <dt>Наработка</dt>
          <dd>
            {disk.powerOnHours === null
              ? '—'
              : `${disk.powerOnHours.toLocaleString('ru-RU')} ч (${(
                  disk.powerOnHours / 8_760
                ).toLocaleString('ru-RU', {
                  minimumFractionDigits: 1,
                  maximumFractionDigits: 1,
                })} г.)`}
          </dd>
        </div>
        <div>
          <dt>Нагрузка</dt>
          <dd>{num(disk.ioUtilPercent, '%')}</dd>
        </div>
        {rows.map(([label, value, hint]) => (
          <div key={label} title={hint}>
            <dt>{label}</dt>
            <dd>{value}</dd>
          </div>
        ))}
      </dl>
    </article>
  );
}

export function ServerPage() {
  const state = usePolling(infrastructureService.snapshot, 60_000);
  const data = state.data;
  const host = data?.host;
  const memUsed =
    host?.memoryTotalBytes && host.memoryAvailableBytes !== null
      ? Math.round(
          (1 - host.memoryAvailableBytes / host.memoryTotalBytes) * 100,
        )
      : null;

  return (
    <>
      <PageHeader
        eyebrow="Железо и хранилище"
        title="Сервер"
        description="Ресурсы, разделы, SMART каждого диска и S3-хранилище. Данные node_exporter и smartctl_exporter через Prometheus, обновление раз в минуту; проблемы попадают в «Уведомления»."
        actions={
          <button
            className="button secondary"
            disabled={state.loading}
            onClick={state.refresh}
          >
            Обновить
          </button>
        }
      />
      {state.error && (
        <p className="health-stale" role="alert">
          {state.error}
          {data ? ' Показан последний полученный снимок.' : ''}
        </p>
      )}
      {!data && state.loading && <p role="status">Сбор показателей…</p>}
      {data && (
        <>
          <section className="card server-summary">
            <InfraBadge status={data.status} />
            <span>
              {data.source.prometheus !== 'OK'
                ? `Prometheus недоступен${data.source.reason ? `: ${data.source.reason}` : ''}`
                : !data.source.smartExporter
                  ? 'Нет данных SMART: smartctl_exporter не отвечает'
                  : `Снимок ${new Date(data.generatedAt).toLocaleTimeString('ru-RU')}`}
            </span>
          </section>

          {host && (
            <section className="server-grid">
              <article className="card server-tile">
                <span>Процессор</span>
                <strong>{num(host.cpuPercent, '%')}</strong>
                <small>
                  нагрузка {num(host.load1)} / {num(host.load5)} /{' '}
                  {num(host.load15)} · ядер {num(host.cpuCores)}
                  {host.cpuTemperatureC !== null &&
                    ` · ${num(host.cpuTemperatureC, '\u00a0°C')}`}
                </small>
              </article>
              <article className="card server-tile">
                <span>Память</span>
                <strong>{memUsed === null ? '—' : `${memUsed}%`}</strong>
                <small>
                  свободно {formatBytes(host.memoryAvailableBytes)} из{' '}
                  {formatBytes(host.memoryTotalBytes)}
                </small>
              </article>
              <article className="card server-tile">
                <span>Своп</span>
                <strong>
                  {host.swapTotalBytes
                    ? `${Math.round(
                        (1 - (host.swapFreeBytes ?? 0) / host.swapTotalBytes) *
                          100,
                      )}%`
                    : '—'}
                </strong>
                <small>из {formatBytes(host.swapTotalBytes)}</small>
              </article>
              <article className="card server-tile">
                <span>Работает без перезагрузки</span>
                <strong>{formatUptime(host.uptimeSeconds)}</strong>
                {host.issues.length > 0 && (
                  <small className="server-tile-issue">
                    {host.issues.join('; ')}
                  </small>
                )}
              </article>
              <article className="card server-tile">
                <span>{data.storage.name}</span>
                <strong>
                  <InfraBadge status={data.storage.status} />
                </strong>
                <small>
                  {data.storage.reason ??
                    (data.storage.latencyMs !== null
                      ? `ответ за ${data.storage.latencyMs} мс`
                      : '')}
                </small>
              </article>
            </section>
          )}

          {data.filesystems.length > 0 && (
            <section className="card server-section">
              <h2>Разделы</h2>
              <table className="server-fs">
                <thead>
                  <tr>
                    <th>Раздел</th>
                    <th>Назначение</th>
                    <th>Заполнено</th>
                    <th>Свободно</th>
                    <th>Состояние</th>
                  </tr>
                </thead>
                <tbody>
                  {data.filesystems.map((fs) => (
                    <tr key={fs.mountpoint}>
                      <td>
                        <code>{fs.mountpoint}</code>
                        <small>
                          {fs.device} · {fs.fstype}
                        </small>
                      </td>
                      <td>{fs.role}</td>
                      <td>
                        <Meter percent={fs.usedPercent} status={fs.status} />
                        <small>{num(fs.usedPercent, '%')}</small>
                      </td>
                      <td>
                        {formatBytes(fs.availBytes)} из{' '}
                        {formatBytes(fs.sizeBytes)}
                      </td>
                      <td>
                        <InfraBadge status={fs.status} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </section>
          )}

          {data.disks.length > 0 && (
            <section className="server-section">
              <h2>Диски</h2>
              <div className="server-disks">
                {data.disks.map((disk) => (
                  <DiskCard key={disk.serial ?? disk.device} disk={disk} />
                ))}
              </div>
            </section>
          )}
        </>
      )}
    </>
  );
}
