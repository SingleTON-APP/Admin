import type { CallQuality } from '../../services/operations-v2.service';
import { HistoryTrend } from './HistoryTrend';
const value = (number: number | null | undefined, unit = '') =>
  number == null || !Number.isFinite(number)
    ? 'Нет измерений'
    : `${number.toLocaleString('ru-RU', { maximumFractionDigits: 2 })}${unit}`;
export function CallQualityPanel({ data }: { data: CallQuality }) {
  return (
    <>
      <p className="data-note">
        Локальные соединения и транспорты, а не уникальные звонки. Групповой RTT
        относится к пути до SFU; потери взвешены по пакетам. RTT и jitter —
        средние наблюдений, а не p95.
      </p>
      {data.modes.length === 0 && <p>Замеров качества пока нет.</p>}
      <div className="operations-grid">
        {data.modes.map((mode) => (
          <section className="card" key={mode.mode}>
            <h2>
              {mode.mode === 'P2P'
                ? 'Личные звонки · P2P'
                : 'Групповые звонки · SFU'}
            </h2>
            <dl className="quality-metrics">
              {Object.entries({
                RTT: value(mode.rttMs, ' мс'),
                Jitter: value(mode.jitterMs, ' мс'),
                'Потери пакетов': value(mode.packetLossPercent, '%'),
                'Соединение p95': value(mode.connectionP95Ms, ' мс'),
                Наблюдения: value(mode.samples),
                'Подключения / ошибки': `${value(mode.connects)} / ${value(mode.failures)}`,
                'Разрывы / восстановления': `${value(mode.disconnects)} / ${value(mode.recoveries)}`,
                'TURN / прямой путь / неизвестно': `${value(mode.relaySamples)} / ${value(mode.directSamples)} / ${value(mode.unknownRelaySamples)}`,
              }).map(([label, text]) => (
                <div key={label}>
                  <dt>{label}</dt>
                  <dd>{text}</dd>
                </div>
              ))}
            </dl>
            <HistoryTrend
              label="RTT"
              unit="мс"
              points={mode.series.map((point) => ({
                timestamp: point.timestamp,
                value: point.rttMs,
              }))}
            />
            <HistoryTrend
              label="Потери пакетов"
              unit="%"
              points={mode.series.map((point) => ({
                timestamp: point.timestamp,
                value: point.packetLossPercent,
              }))}
            />
            <details>
              <summary>История наблюдений качества</summary>
              <div className="operations-scroll">
                <table>
                  <thead>
                    <tr>
                      <th>Время UTC</th>
                      <th>RTT, мс</th>
                      <th>Jitter, мс</th>
                      <th>Потери, %</th>
                      <th>Замеры</th>
                    </tr>
                  </thead>
                  <tbody>
                    {mode.series.map((point) => (
                      <tr key={point.timestamp}>
                        <th>
                          {new Date(point.timestamp).toLocaleString('ru-RU', {
                            timeZone: 'UTC',
                          })}
                        </th>
                        <td>{value(point.rttMs)}</td>
                        <td>{value(point.jitterMs)}</td>
                        <td>{value(point.packetLossPercent)}</td>
                        <td>{value(point.samples)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </details>
          </section>
        ))}
      </div>
    </>
  );
}
