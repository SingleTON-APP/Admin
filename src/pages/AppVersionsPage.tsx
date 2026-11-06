import { useState, type FormEvent } from 'react';
import { PageHeader } from '../components/ui/Primitives';
import { usePolling } from '../hooks/usePolling';
import {
  appVersionsService,
  type AppPlatform,
  type AppVersionPolicy,
  type InstalledVersion,
} from '../services/app-versions.service';
import '../styles/app-versions.css';

const platformName: Record<AppPlatform, string> = {
  ios: 'iPhone (iOS)',
  android: 'Android',
  macos: 'Mac (macOS)',
};
const buildHint: Record<AppPlatform, string> = {
  ios: 'Номер сборки (CFBundleVersion): 4, 5, 6… Название версии на iOS не меняется.',
  android: 'versionCode сборки: 149, 150… (versionName показывается отдельно).',
  macos:
    'Номер сборки Mac (CFBundleVersion) — свой счёт, не как у iPhone: 1, 2, 3…',
};
const storeHint: Record<AppPlatform, string> = {
  ios: 'Ссылка TestFlight (https://testflight.apple.com/join/…) или App Store.',
  android:
    'Ссылка Google Play: https://play.google.com/store/apps/details?id=org.hubnet.android',
  macos:
    'Ссылка TestFlight или Mac App Store (https://apps.apple.com/app/id6826871493).',
};

type Draft = {
  latestBuild: string;
  minBuild: string;
  latestVersion: string;
  storeUrl: string;
  message: string;
};

const toDraft = (p: AppVersionPolicy): Draft => ({
  latestBuild: p.latestBuild?.toString() ?? '',
  minBuild: p.minBuild?.toString() ?? '',
  latestVersion: p.latestVersion ?? '',
  storeUrl: p.storeUrl ?? '',
  message: p.message ?? '',
});

const intOrNull = (v: string) => (v.trim() ? Number(v) : null);

function PolicyCard({
  policy,
  onSaved,
}: {
  policy: AppVersionPolicy;
  onSaved: () => void;
}) {
  const [draft, setDraft] = useState<Draft>(() => toDraft(policy));
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const set = (patch: Partial<Draft>) => setDraft((d) => ({ ...d, ...patch }));

  const latest = intOrNull(draft.latestBuild);
  const min = intOrNull(draft.minBuild);
  const invalid = latest !== null && min !== null && min > latest;

  const save = async (event: FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setStatus(null);
    try {
      await appVersionsService.update(policy.platform, {
        latestBuild: latest,
        minBuild: min,
        latestVersion: draft.latestVersion.trim() || null,
        storeUrl: draft.storeUrl.trim() || null,
        message: draft.message.trim() || null,
      });
      setStatus('Сохранено. Приложения подхватят изменения в течение минуты.');
      onSaved();
    } catch (error) {
      setStatus(
        error instanceof Error ? error.message : 'Не удалось сохранить',
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <form
      className="card app-version-card"
      aria-label={platformName[policy.platform]}
      onSubmit={(event) => void save(event)}
    >
      <h2>{platformName[policy.platform]}</h2>
      <fieldset disabled={busy}>
        <div className="app-version-row">
          <label>
            Последняя сборка
            <input
              type="number"
              min={1}
              step={1}
              value={draft.latestBuild}
              onChange={(e) => set({ latestBuild: e.target.value })}
            />
            <small>
              Ниже — приложение предложит обновиться (можно отложить).
            </small>
          </label>
          <label>
            Минимальная сборка
            <input
              type="number"
              min={1}
              step={1}
              value={draft.minBuild}
              aria-invalid={invalid}
              onChange={(e) => set({ minBuild: e.target.value })}
            />
            <small>Ниже — экран «Обновите приложение», дальше не пустит.</small>
          </label>
        </div>
        <p className="app-version-hint">{buildHint[policy.platform]}</p>
        <label>
          Название версии (для текста)
          <input
            type="text"
            maxLength={32}
            placeholder={policy.platform === 'android' ? '0.1.150' : '1.0 (5)'}
            value={draft.latestVersion}
            onChange={(e) => set({ latestVersion: e.target.value })}
          />
        </label>
        <label>
          Ссылка «Обновить»
          <input
            type="url"
            maxLength={500}
            value={draft.storeUrl}
            onChange={(e) => set({ storeUrl: e.target.value })}
          />
          <small>{storeHint[policy.platform]}</small>
        </label>
        <label>
          Сообщение пользователю (необязательно)
          <textarea
            maxLength={300}
            value={draft.message}
            placeholder="Например: исправлены звонки на заблокированном экране"
            onChange={(e) => set({ message: e.target.value })}
          />
        </label>
        {invalid && (
          <p className="app-version-error" role="alert">
            Минимальная сборка не может быть больше последней.
          </p>
        )}
        <button className="button primary" disabled={busy || invalid}>
          {busy ? 'Сохранение…' : 'Сохранить'}
        </button>
      </fieldset>
      {status && <p role="status">{status}</p>}
      {policy.updatedAt && (
        <p className="app-version-hint">
          Изменено {new Date(policy.updatedAt).toLocaleString('ru-RU')}
        </p>
      )}
    </form>
  );
}

function InstalledTable({ rows }: { rows: InstalledVersion[] }) {
  if (rows.length === 0)
    return (
      <p className="app-version-hint">
        Пока нет данных: версия приходит с устройства при регистрации
        push-уведомлений.
      </p>
    );
  return (
    <table className="app-version-table">
      <thead>
        <tr>
          <th>Платформа</th>
          <th>Версия</th>
          <th>Пользователей</th>
          <th>Устройств</th>
          <th>Последний раз</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((r) => (
          <tr key={`${r.platform}:${r.appVersion ?? '-'}`}>
            <td>{platformName[r.platform]}</td>
            <td>{r.appVersion ?? 'старая сборка (не сообщает версию)'}</td>
            <td>{r.users}</td>
            <td>{r.devices}</td>
            <td>{new Date(r.lastSeen).toLocaleDateString('ru-RU')}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

export function AppVersionsPage() {
  const state = usePolling(appVersionsService.snapshot, 120_000);
  return (
    <>
      <PageHeader
        eyebrow="Обновления"
        title="Версии приложений"
        description="После загрузки новой сборки в TestFlight, App Store или Google Play укажите её номер — приложения предложат обновиться. Минимальная сборка заставляет обновиться всех, кто ниже."
      />
      {state.error && (
        <p className="health-stale" role="alert">
          {state.error}
        </p>
      )}
      {!state.data && state.loading && <p role="status">Загрузка…</p>}
      {state.data && (
        <>
          <div className="app-version-grid">
            {state.data.policies.map((p) => (
              // Новый ключ после сохранения — форма заново берёт значения с сервера.
              <PolicyCard
                key={`${p.platform}:${p.updatedAt ?? ''}`}
                policy={p}
                onSaved={state.refresh}
              />
            ))}
          </div>
          <section className="card app-version-installed">
            <h2>У кого какая версия</h2>
            <p className="app-version-hint">
              По версии, с которой устройство последний раз регистрировалось для
              уведомлений, за 90 дней.
            </p>
            <InstalledTable rows={state.data.installed} />
          </section>
        </>
      )}
    </>
  );
}
