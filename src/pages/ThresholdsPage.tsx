import { useState, type FormEvent } from 'react';
import { useAdmin } from '../features/admin-access/AdminContext';
import { useAsync } from '../hooks/useAsync';
import {
  operationsService,
  type Threshold,
} from '../services/operations-v2.service';
import { ErrorState, PageHeader } from '../components/ui/Primitives';
import '../styles/operations-v2.css';
export function ThresholdsPage() {
  const admin = useAdmin();
  const state = useAsync((signal) => operationsService.thresholds(signal), []);
  return (
    <div className="operations-page">
      <PageHeader
        eyebrow="Уведомления"
        title="Пороги процессов"
        description="Изменения применяются на сервере и фиксируются с основанием. Персональное прочтение уведомлений не меняет пороги."
      />
      {state.error && <ErrorState message={state.error} />}
      {state.data ? (
        <ThresholdForm
          initial={state.data.items}
          canEdit={admin.role !== 'MODERATOR'}
        />
      ) : (
        state.loading && <p>Загрузка порогов…</p>
      )}
    </div>
  );
}
function ThresholdForm({
  initial,
  canEdit,
}: {
  initial: Threshold[];
  canEdit: boolean;
}) {
  const [items, setItems] = useState(initial.map((item) => ({ ...item })));
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const update = (index: number, patch: Partial<Threshold>) =>
    setItems((previous) =>
      previous.map((item, i) => (i === index ? { ...item, ...patch } : item)),
    );
  const save = async (event: FormEvent) => {
    event.preventDefault();
    if (busy || !canEdit || reason.trim().length < 10) return;
    setBusy(true);
    setMessage('');
    try {
      const result = await operationsService.saveThresholds(
        items,
        reason.trim(),
      );
      setItems(result.items);
      setReason('');
      setMessage('Пороги сохранены.');
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : 'Не удалось сохранить пороги',
      );
    } finally {
      setBusy(false);
    }
  };
  return (
    <form className="operations-page" onSubmit={(event) => void save(event)}>
      {!canEdit && (
        <p>
          Модератору доступен просмотр. Изменять пороги могут ADMIN и
          FULL_ADMIN.
        </p>
      )}
      <div className="operations-grid">
        {items.map((item, index) => (
          <fieldset
            className="card operations-controls"
            key={item.operationId}
            disabled={busy || !canEdit}
          >
            <legend>{item.operationId}</legend>
            <label>
              <input
                type="checkbox"
                checked={item.enabled}
                onChange={(event) =>
                  update(index, { enabled: event.target.checked })
                }
              />
              Уведомления включены
            </label>
            <div className="threshold-fields">
              <label>
                p95, мс
                <input
                  type="number"
                  required
                  min={1}
                  max={300000}
                  step="any"
                  value={item.p95Ms}
                  onChange={(event) =>
                    update(index, { p95Ms: Number(event.target.value) })
                  }
                />
              </label>
              <label>
                Ошибки, %
                <input
                  type="number"
                  required
                  min={0.1}
                  max={100}
                  step="any"
                  value={Number((item.errorRate * 100).toFixed(6))}
                  onChange={(event) =>
                    update(index, {
                      errorRate: Number(event.target.value) / 100,
                    })
                  }
                />
              </label>
              <label>
                Минимум замеров
                <input
                  type="number"
                  required
                  min={5}
                  step={1}
                  value={item.minSamples}
                  onChange={(event) =>
                    update(index, { minSamples: Number(event.target.value) })
                  }
                />
              </label>
            </div>
          </fieldset>
        ))}
      </div>
      {items.length === 0 && <p>Настраиваемых операций пока нет.</p>}
      {canEdit && (
        <section className="card form-stack">
          <label>
            Основание изменения
            <textarea
              value={reason}
              minLength={10}
              maxLength={1000}
              required
              onChange={(event) => setReason(event.target.value)}
              disabled={busy}
            />
          </label>
          <button
            className="button primary"
            disabled={busy || reason.trim().length < 10 || items.length === 0}
          >
            {busy ? 'Сохранение…' : 'Сохранить пороги'}
          </button>
        </section>
      )}
      {message && <p role="status">{message}</p>}
    </form>
  );
}
