import { useState } from 'react';
import { useAsync } from '../../hooks/useAsync';
import { usageService } from '../../services/usage.service';
import { ErrorState, LoadingState } from '../ui/Primitives';

const platforms: Record<string, string> = { ANDROID: 'Android', IOS: 'iOS', WEB: 'Веб' };
const browsers: Record<string, string> = { CHROME: 'Chrome', EDGE: 'Edge', FIREFOX: 'Firefox', SAFARI: 'Safari', OPERA: 'Opera', OTHER: 'Другой браузер', NATIVE: 'Приложение', NONE: 'Приложение' };
const time = (ms: number) => {
  if (!Number.isFinite(ms)) return '—';
  if (ms < 60_000) return `${Math.max(0, Math.round(ms / 1000))} с`;
  const minutes = Math.round(ms / 60_000);
  return minutes < 60 ? `${minutes} мин` : `${Math.floor(minutes / 60)} ч ${minutes % 60} мин`;
};
export function UsagePanel({ days }: { days: 7 | 30 }) {
  const [reload, setReload] = useState(0);
  const state = useAsync((signal) => usageService.summary(days, signal), [days, reload]);
  const data = state.data;
  return <section className="card dashboard-panel usage-panel"><div className="card-head"><div><span className="section-label">Последние {days} дней · UTC</span><h2>Время в приложении</h2></div><button className="button secondary" disabled={state.loading} onClick={() => setReload((value) => value + 1)}>Обновить время использования</button></div>
    {state.loading ? <LoadingState /> : state.error || !data ? <ErrorState message={state.error ?? 'Нет данных использования'} /> : <>
      <p className="data-note">Время на переднем плане по клиентам со сборщиком. Параллельные устройства суммируются. История начинается с подключения сбора.</p>
      <div className="usage-platforms">{data.platforms.map((item) => <span key={item.platform}>{platforms[item.platform] ?? item.platform}: {item.available ? 'измеряется' : 'нет измерений'}</span>)}</div>
      {!data.available || !data.totals ? <p className="data-note">Измерений за этот период пока нет. Данные появятся после использования приложения с подключённым сборщиком.</p> : <>
        <div className="usage-summary"><div><small>Измеренные пользователи</small><strong>{data.totals.measuredUsers.toLocaleString('ru-RU')}</strong></div><div><small>Среднее на пользователя за {days} дней</small><strong>{time(data.totals.averageUserMs)}</strong></div><div><small>Всего времени на устройствах</small><strong>{time(data.totals.foregroundMs)}</strong></div></div>
        <div className="table-wrap"><table><caption className="sr-only">Среднее время по платформам и браузерам</caption><thead><tr><th scope="col">Платформа</th><th scope="col">Браузер</th><th scope="col">Пользователи</th><th scope="col" title="Среднее на пользователя за дни, в которых есть измерения">Среднее в активный день</th><th scope="col">Среднее за период</th></tr></thead><tbody>{data.buckets.map((item) => <tr key={`${item.platform}-${item.browser}`}><td>{platforms[item.platform] ?? item.platform}</td><td>{browsers[item.browser] ?? item.browser}</td><td>{item.measuredUsers.toLocaleString('ru-RU')}</td><td>{time(item.averageDailyUserMs)}</td><td>{time(item.averageUserMs)}</td></tr>)}</tbody></table></div>
      </>}
    </>}
  </section>;
}
