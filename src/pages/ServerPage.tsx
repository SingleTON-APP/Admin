import { formatBytes } from '../components/dashboard/dashboard-format';
import { PageHeader, Sparkline } from '../components/ui/Primitives';
import { usePolling } from '../hooks/usePolling';
import {
  infrastructureService,
  type InfraDisk,
  type InfraDiskTrend,
  type InfrastructureSnapshot,
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

const ru = (value: number, digits = 0) =>
  value.toLocaleString('ru-RU', {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
const num = (value: number | null, suffix = '') =>
  value === null ? '—' : `${value.toLocaleString('ru-RU')}${suffix}`;
const percent = (part: number, total: number) =>
  total > 0 ? Math.round((part / total) * 100) : 0;
/** Ёмкость «как на коробке»: производители считают в десятичных ГБ/ТБ. */
const labelCapacity = (bytes: number | null) =>
  bytes === null
    ? ''
    : bytes >= 1e12
      ? `${ru(bytes / 1e12)} ТБ`
      : `${ru(bytes / 1e9)} ГБ`;
const uptimeText = (seconds: number) => {
  const days = Math.floor(seconds / 86_400);
  const hours = Math.floor((seconds % 86_400) / 3_600);
  return days > 0 ? `${days} д ${hours} ч` : `${hours} ч`;
};
const worst = (statuses: InfraStatus[]): InfraStatus =>
  statuses.includes('CRITICAL')
    ? 'CRITICAL'
    : statuses.includes('WARNING')
      ? 'WARNING'
      : statuses.includes('UNKNOWN')
        ? 'UNKNOWN'
        : 'OK';

function InfraBadge({ status }: { status: InfraStatus }) {
  return (
    <span className={`status status-${tone[status]}`}>
      <i />
      {statusText[status]}
    </span>
  );
}

function Meter({
  value,
  status,
  label,
}: {
  value: number;
  status: InfraStatus;
  label: string;
}) {
  const clamped = Math.min(100, Math.max(0, value));
  return (
    <div
      className={`server-meter server-meter-${tone[status]}`}
      role="meter"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={clamped}
    >
      <span style={{ width: `${clamped}%` }} />
    </div>
  );
}

/** Понятные имена: «Системный SSD», «Диск хранилища 1…4». */
function diskNames(disks: InfraDisk[]) {
  const storage = disks
    .filter((d) => d.role === 'STORAGE')
    .sort((a, b) =>
      (a.mountpoints?.[0] ?? a.device).localeCompare(
        b.mountpoints?.[0] ?? b.device,
      ),
    );
  const names = new Map<string, string>();
  for (const d of disks) {
    if (d.role === 'SYSTEM')
      names.set(
        d.device,
        d.kind === 'NVME' ? 'Системный SSD' : 'Системный диск',
      );
    else if (d.role === 'STORAGE')
      names.set(d.device, `Диск хранилища ${storage.indexOf(d) + 1}`);
    else names.set(d.device, `Диск ${d.device}`);
  }
  return names;
}

type Issue = { where: string; text: string };

function collectIssues(
  data: InfrastructureSnapshot,
  names: Map<string, string>,
): Issue[] {
  const issues: Issue[] = [];
  if (data.source.prometheus !== 'OK')
    issues.push({
      where: 'Мониторинг',
      text: `сбор показателей недоступен${data.source.reason ? ` (${data.source.reason})` : ''}`,
    });
  else if (!data.source.smartExporter)
    issues.push({
      where: 'Мониторинг',
      text: 'нет данных о здоровье дисков (SMART)',
    });
  for (const text of data.host?.issues ?? [])
    issues.push({ where: 'Ресурсы', text });
  for (const fs of data.filesystems)
    for (const text of fs.issues)
      issues.push({
        where: fs.mountpoint === '/' ? 'Системный диск' : fs.mountpoint,
        text,
      });
  for (const d of data.disks)
    for (const text of d.issues)
      issues.push({ where: names.get(d.device) ?? d.device, text });
  if (data.storage.status !== 'OK')
    issues.push({
      where: 'Хранилище файлов',
      text: data.storage.reason ?? 'проверка не прошла',
    });
  return issues;
}

function Verdict({
  data,
  names,
}: {
  data: InfrastructureSnapshot;
  names: Map<string, string>;
}) {
  const issues = collectIssues(data, names);
  const ok = data.status === 'OK' && issues.length === 0;
  const healthyDisks = data.disks.filter((d) => d.status === 'OK').length;
  return (
    <section
      className={`card server-verdict server-verdict-${tone[data.status]}`}
      aria-label="Итог"
    >
      <div>
        <h2>
          {ok
            ? 'Всё в порядке'
            : data.status === 'CRITICAL'
              ? 'Есть проблема'
              : data.status === 'UNKNOWN'
                ? 'Часть данных недоступна'
                : 'Требует внимания'}
        </h2>
        {ok ? (
          <p>
            Дисков исправно: {healthyDisks} из {data.disks.length}. Места
            достаточно, хранилище файлов отвечает.
          </p>
        ) : (
          <ul>
            {issues.map((issue) => (
              <li key={`${issue.where}:${issue.text}`}>
                <strong>{issue.where}:</strong> {issue.text}
              </li>
            ))}
          </ul>
        )}
      </div>
      <small>
        Обновлено {new Date(data.generatedAt).toLocaleTimeString('ru-RU')} ·
        каждую минуту
      </small>
    </section>
  );
}

function Space({ data }: { data: InfrastructureSnapshot }) {
  const root = data.filesystems.find((f) => f.mountpoint === '/');
  const systemDisk = data.disks.find((d) => d.role === 'SYSTEM');
  const storageDisk = data.disks.find((d) => d.role === 'STORAGE');
  // Старый бэкенд не отдаёт сводку хранилища — тогда карточки просто нет.
  const cap = data.storage.capacity ?? null;
  const storageUsedPct = cap
    ? percent(cap.usableUsedBytes, cap.usableTotalBytes)
    : 0;
  const storageFsStatus = worst(
    data.filesystems
      .filter((f) => f.mountpoint.startsWith('/mnt/'))
      .map((f) => f.status),
  );
  const storageStatus =
    data.storage.status === 'OK' ? storageFsStatus : data.storage.status;
  if (!root && !cap) return null;
  return (
    <section className="server-section">
      <h2>Место на дисках</h2>
      <div className="server-cards server-cards-2">
        {root && (
          <article className="card server-card" aria-label="Системный диск">
            <header>
              <h3>
                Системный диск
                {systemDisk?.capacityBytes
                  ? ` (SSD ${labelCapacity(systemDisk.capacityBytes)})`
                  : ''}
              </h3>
              <InfraBadge status={root.status} />
            </header>
            <strong className="server-big">
              Свободно {formatBytes(root.availBytes)}
            </strong>
            <Meter
              value={root.usedPercent}
              status={root.status}
              label="Заполнение системного диска"
            />
            <p>
              Занято {formatBytes(root.sizeBytes - root.availBytes)} из{' '}
              {formatBytes(root.sizeBytes)} ({ru(root.usedPercent)}%).
            </p>
            <p className="server-hint">
              Здесь система, Docker и базы данных Хаба и Некста. Если место
              закончится, сервисы перестанут работать; предупреждение придёт при
              85%.
              {systemDisk?.capacityBytes
                ? ` На коробке ${labelCapacity(systemDisk.capacityBytes)} — после разметки и в двоичных единицах системе доступно ${formatBytes(root.sizeBytes)}.`
                : ''}
            </p>
          </article>
        )}
        {cap && (
          <article className="card server-card" aria-label="Хранилище файлов">
            <header>
              <h3>Хранилище файлов</h3>
              <InfraBadge status={storageStatus} />
            </header>
            <strong className="server-big">
              Свободно ≈{' '}
              {formatBytes(cap.usableTotalBytes - cap.usableUsedBytes)}
            </strong>
            <Meter
              value={storageUsedPct}
              status={storageFsStatus}
              label="Заполнение хранилища файлов"
            />
            <p>
              Занято ≈ {formatBytes(cap.usableUsedBytes)} из ≈{' '}
              {formatBytes(cap.usableTotalBytes)} полезного места (
              {storageUsedPct}%).
            </p>
            <p className="server-hint">
              {cap.drives}{' '}
              {cap.drives === 1 ? 'диск' : cap.drives < 5 ? 'диска' : 'дисков'}
              {storageDisk?.capacityBytes
                ? ` по ${labelCapacity(storageDisk.capacityBytes)}`
                : ''}
              .
              {cap.parityDrives > 0
                ? ` Каждый файл хранится с запасом и переживёт поломку любых ${cap.parityDrives} ${cap.parityDrives === 1 ? 'диска' : 'дисков'}, поэтому под файлы доступно ${percent(cap.usableTotalBytes, cap.rawTotalBytes)}% общего объёма.`
                : ' Запаса на поломку диска нет.'}{' '}
              Здесь медиа Хаба и фильмы Некста ({data.storage.name}).
            </p>
            <p className="server-hint">
              {data.storage.status === 'OK'
                ? `Отвечает за ${data.storage.latencyMs ?? '—'} мс.`
                : `Не отвечает: ${data.storage.reason ?? 'проверка не прошла'}.`}
            </p>
          </article>
        )}
      </div>
    </section>
  );
}

function Resources({ data }: { data: InfrastructureSnapshot }) {
  const host = data.host;
  if (!host) return null;
  const memTotal = host.memoryTotalBytes ?? 0;
  const memFree = host.memoryAvailableBytes ?? 0;
  const memUsed = memTotal - memFree;
  const swapUsedPct = host.swapTotalBytes
    ? percent(
        host.swapTotalBytes - (host.swapFreeBytes ?? 0),
        host.swapTotalBytes,
      )
    : null;
  const bootedAt =
    host.uptimeSeconds !== null
      ? new Date(
          new Date(data.generatedAt).getTime() - host.uptimeSeconds * 1000,
        )
      : null;
  return (
    <section className="server-section">
      <h2>Память и процессор</h2>
      <div className="server-cards">
        <article className="card server-card" aria-label="Оперативная память">
          <h3>Оперативная память (RAM)</h3>
          <strong className="server-big">
            Занято {percent(memUsed, memTotal)}%
          </strong>
          <Meter
            value={percent(memUsed, memTotal)}
            status={host.status}
            label="Занято оперативной памяти"
          />
          <p>
            {formatBytes(memUsed)} из {formatBytes(memTotal)}, свободно{' '}
            {formatBytes(memFree)}.
          </p>
          <p className="server-hint">
            Память, в которой работают программы. Это не место для файлов — оно
            в разделе «Место на дисках».
          </p>
          {swapUsedPct !== null && (
            <p className="server-hint">
              Подкачка ({formatBytes(host.swapTotalBytes)} на SSD) занята на{' '}
              {swapUsedPct}%.{' '}
              {percent(memFree, memTotal) >= 20
                ? 'Пока памяти свободно много, это нормально.'
                : 'Памяти мало, подкачка замедляет сервер.'}
            </p>
          )}
        </article>
        <article className="card server-card" aria-label="Процессор">
          <h3>Процессор</h3>
          <strong className="server-big">
            {host.cpuPercent === null
              ? '—'
              : `Загружен на ${Math.round(host.cpuPercent)}%`}
          </strong>
          <Meter
            value={host.cpuPercent ?? 0}
            status={host.status}
            label="Загрузка процессора"
          />
          <p>
            {num(host.cpuCores)} ядер
            {host.cpuTemperatureC !== null &&
              ` · ${ru(host.cpuTemperatureC)}\u00a0°C`}
          </p>
          {host.load5 !== null && host.cpuCores !== null && (
            <p className="server-hint">
              Очередь задач в среднем за 5 минут: {num(host.load5)}.{' '}
              {host.load5 < host.cpuCores
                ? `Пока это меньше числа ядер (${host.cpuCores}), запас есть.`
                : `Это больше числа ядер (${host.cpuCores}): процессор не успевает.`}
            </p>
          )}
        </article>
        <article className="card server-card" aria-label="Время работы">
          <h3>Работает без перезагрузки</h3>
          <strong className="server-big">
            {host.uptimeSeconds === null ? '—' : uptimeText(host.uptimeSeconds)}
          </strong>
          {bootedAt && (
            <p className="server-hint">
              Последний запуск:{' '}
              {bootedAt.toLocaleString('ru-RU', {
                day: 'numeric',
                month: 'long',
                hour: '2-digit',
                minute: '2-digit',
              })}
              .
            </p>
          )}
        </article>
      </div>
    </section>
  );
}

const plural = (n: number, one: string, few: string, many: string) => {
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod10 === 1 && mod100 !== 11) return one;
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return few;
  return many;
};

/** Одна строка «что меняется со временем» для карточки диска. */
function trendSummary(disk: InfraDisk, trend: InfraDiskTrend) {
  if (disk.kind === 'NVME') {
    // Меньше двух лет — это уже предупреждение в списке проблем.
    if (trend.ssdYearsLeft === null || trend.ssdYearsLeft < 2) return null;
    const years = trend.ssdYearsLeft;
    return {
      tone: 'neutral',
      text:
        years >= 20
          ? `Ресурса записи хватит надолго: ${years >= 50 ? 'больше 50 лет' : `около ${ru(years)} лет`} при ${trend.ssdForecastBasis === 'RECENT_WRITES' ? 'нынешней' : 'обычной для него'} нагрузке.`
          : `Ресурса записи хватит примерно на ${ru(years, 1)} г. при ${trend.ssdForecastBasis === 'RECENT_WRITES' ? 'нынешней' : 'обычной для него'} нагрузке.`,
    };
  }
  const { day, week, month } = trend.badSectorsDelta;
  // Рост уже есть в списке проблем карточки — не повторяем.
  if ([day, week, month].some((v) => v !== null && v > 0)) return null;
  const window =
    month !== null
      ? 'за месяц'
      : week !== null
        ? 'за неделю'
        : day !== null
          ? 'за сутки'
          : null;
  if (window) return { tone: 'success', text: `Изменений ${window} нет.` };
  const since = trend.since
    ? new Date(`${trend.since}T00:00:00`).toLocaleDateString('ru-RU', {
        day: 'numeric',
        month: 'long',
      })
    : 'сегодня';
  return {
    tone: 'neutral',
    text: `Наблюдение идёт с ${since}: динамика появится через сутки, недельная — через ${7 - Math.min(6, trend.historyDays)} ${plural(7 - Math.min(6, trend.historyDays), 'день', 'дня', 'дней')}.`,
  };
}

function DiskCard({ disk, name }: { disk: InfraDisk; name: string }) {
  const badSectors =
    (disk.reallocatedSectors ?? 0) +
    (disk.pendingSectors ?? 0) +
    (disk.offlineUncorrectable ?? 0);
  const details: Array<[string, string, string]> =
    disk.kind === 'NVME'
      ? [
          [
            'Износ',
            num(disk.percentageUsed, '%'),
            'Сколько ресурса записи израсходовано по оценке самого SSD. 100% — гарантийный ресурс исчерпан.',
          ],
          [
            'Резерв ячеек',
            num(disk.availableSpare, '%'),
            'Запас ячеек на замену изношенным.',
          ],
          [
            'Ошибки данных',
            num(disk.mediaErrors),
            'Ошибки целостности, которые SSD не смог исправить. Должно быть 0.',
          ],
          [
            'Записано за всё время',
            formatBytes(disk.bytesWritten),
            'Суммарный объём записи — главный фактор износа SSD.',
          ],
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
          [
            'Неисправимые сектора',
            num(disk.offlineUncorrectable),
            'Сектора, данные из которых прочитать не удалось.',
          ],
          [
            'Ошибки кабеля (CRC)',
            num(disk.crcErrors),
            'Сбои передачи между диском и контроллером: обычно кабель или порт, а не сам диск.',
          ],
        ];
  return (
    <article className="card server-disk" aria-label={name}>
      <header>
        <div>
          <h3>{name}</h3>
          <p>
            {[
              disk.kind === 'NVME' ? 'SSD' : 'HDD',
              labelCapacity(disk.capacityBytes),
              disk.model,
            ]
              .filter(Boolean)
              .join(' · ')}
          </p>
        </div>
        <InfraBadge status={disk.status} />
      </header>
      <ul className="server-facts">
        <li>
          <span>Состояние</span>
          <b>
            {disk.smartPassed === null
              ? '—'
              : !disk.smartPassed
                ? 'Неисправен'
                : disk.status === 'OK'
                  ? 'Исправен'
                  : 'Есть замечания'}
          </b>
        </li>
        <li>
          <span>Температура</span>
          <b>{num(disk.temperatureC, '\u00a0°C')}</b>
        </li>
        <li>
          <span>Проработал</span>
          <b>
            {disk.powerOnHours === null
              ? '—'
              : `${ru(disk.powerOnHours / 8_760, 1)} г.`}
          </b>
        </li>
        <li>
          <span>{disk.kind === 'NVME' ? 'Износ' : 'Плохих секторов'}</span>
          <b>
            {disk.kind === 'NVME'
              ? num(disk.percentageUsed, '%')
              : ru(badSectors)}
          </b>
        </li>
      </ul>
      {disk.trend &&
        (() => {
          const summary = trendSummary(disk, disk.trend);
          return summary ? (
            <p className={`server-trend server-trend-${summary.tone}`}>
              {summary.text}
            </p>
          ) : null;
        })()}
      {disk.issues.length > 0 && (
        <ul className="server-issues">
          {disk.issues.map((issue) => (
            <li key={issue}>{issue}</li>
          ))}
        </ul>
      )}
      <details>
        <summary>Подробнее</summary>
        <dl>
          {details.map(([label, value, hint]) => (
            <div key={label}>
              <dt>{label}</dt>
              <dd>{value}</dd>
              <p>{hint}</p>
            </div>
          ))}
          <div>
            <dt>Наработка</dt>
            <dd>{num(disk.powerOnHours, ' ч')}</dd>
            <p>
              Часы во включённом состоянии по счётчику диска. У восстановленных
              дисков его могут обнулять.
            </p>
          </div>
          {disk.trend && disk.trend.temperature.length >= 2 && (
            <div>
              <dt>Температура за 30 дней</dt>
              <dd>
                {ru(Math.min(...disk.trend.temperature.map((t) => t.max)))}–
                {ru(Math.max(...disk.trend.temperature.map((t) => t.max)))}
                {'\u00a0°C'}
              </dd>
              <Sparkline data={disk.trend.temperature.map((t) => t.max)} />
            </div>
          )}
          <div>
            <dt>Загрузка сейчас</dt>
            <dd>{num(disk.ioUtilPercent, '%')}</dd>
            <p>Доля времени, когда диск занят чтением или записью.</p>
          </div>
          <div>
            <dt>Устройство</dt>
            <dd>
              {disk.device}
              {disk.serial ? ` · ${disk.serial}` : ''}
            </dd>
            <p>{disk.mountpoints?.join(', ') || 'Не смонтирован'}</p>
          </div>
        </dl>
      </details>
    </article>
  );
}

export function ServerPage() {
  const state = usePolling(infrastructureService.snapshot, 60_000);
  const data = state.data;
  const names = diskNames(data?.disks ?? []);
  const disks = [...(data?.disks ?? [])].sort(
    (a, b) =>
      Number(b.role === 'SYSTEM') - Number(a.role === 'SYSTEM') ||
      (names.get(a.device) ?? '').localeCompare(
        names.get(b.device) ?? '',
        'ru',
        { numeric: true },
      ),
  );

  return (
    <>
      <PageHeader
        eyebrow="Железо и хранилище"
        title="Сервер"
        description="Здоровье дисков, свободное место, память и процессор. Если что-то пойдёт не так, придёт уведомление."
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
          <Verdict data={data} names={names} />
          <Space data={data} />
          <Resources data={data} />
          {disks.length > 0 && (
            <section className="server-section">
              <h2>Физические диски</h2>
              <div className="server-disks">
                {disks.map((disk) => (
                  <DiskCard
                    key={disk.serial ?? disk.device}
                    disk={disk}
                    name={names.get(disk.device) ?? disk.device}
                  />
                ))}
              </div>
            </section>
          )}
          {data.filesystems.length > 0 && (
            <details className="card server-tech">
              <summary>Технические детали: разделы</summary>
              <table className="server-fs">
                <thead>
                  <tr>
                    <th>Раздел</th>
                    <th>Устройство</th>
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
                      </td>
                      <td>
                        {fs.device} · {fs.fstype}
                      </td>
                      <td>{ru(fs.usedPercent, 1)}%</td>
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
              <p className="server-hint">
                Источник данных: Prometheus (node_exporter и smartctl_exporter).
              </p>
            </details>
          )}
        </>
      )}
    </>
  );
}
