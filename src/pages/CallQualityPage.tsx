import { useCallback, useState } from 'react';
import { Link } from 'react-router-dom';
import { operationsService } from '../services/operations-v2.service';
import { usePolling } from '../hooks/usePolling';
import { CallQualityPanel } from '../components/dashboard/CallQualityPanel';
import { PageHeader } from '../components/ui/Primitives';
import { CoverageNotice } from './HistoryPage';
import '../styles/operations-v2.css';
export function CallQualityPage() {
  const [range, setRange] = useState('15');
  return (
    <div className="operations-page">
      <PageHeader
        eyebrow="Мониторинг"
        title="Качество звонков"
        description="Фактические WebRTC-наблюдения: RTT, jitter, потери и восстановление."
        actions={
          <Link className="button secondary" to="/admin/monitor">
            Живой экран
          </Link>
        }
      />
      <label>
        Период{' '}
        <select
          aria-label="Период качества звонков"
          value={range}
          onChange={(event) => setRange(event.target.value)}
        >
          <option value="15">15 минут</option>
          <option value="60">60 минут</option>
          <option value="7d">7 дней</option>
          <option value="30d">30 дней</option>
        </select>
      </label>
      <QualityBoard key={range} range={range} />
    </div>
  );
}
function QualityBoard({ range }: { range: string }) {
  const load = useCallback(
    (signal: AbortSignal) =>
      operationsService.quality(
        range.endsWith('d')
          ? { days: range === '7d' ? 7 : 30 }
          : { windowMinutes: range === '60' ? 60 : 15 },
        signal,
      ),
    [range],
  );
  const state = usePolling(load, 30000);
  return (
    <>
      <button
        className="button secondary"
        disabled={state.loading}
        onClick={state.refresh}
      >
        Обновить качество
      </button>
      {state.error && (
        <p role="alert">
          {state.error}{' '}
          {state.data && 'Показаны последние полученные измерения.'}
        </p>
      )}
      {state.data ? (
        <>
          <CoverageNotice coverage={state.data.coverage} />
          <CallQualityPanel data={state.data} />
        </>
      ) : (
        <p>{state.loading ? 'Загрузка качества…' : 'Качество недоступно.'}</p>
      )}
    </>
  );
}
