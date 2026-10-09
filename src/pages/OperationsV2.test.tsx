import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AdminContext } from '../features/admin-access/AdminContext';
import { LogoutContext } from '../features/admin-access/LogoutContext';
import {
  operationsService,
  type GroupDetails,
  type Appeal,
} from '../services/operations-v2.service';
import { ApiError } from '../api/contracts';
import { AccessSecurityPage } from './AccessSecurityPage';
import { ThresholdsPage } from './ThresholdsPage';
import { ReportGroupDetailsPage } from './ReportGroupsPage';
import { AppealDetailsPage } from './AppealsPage';
import { HistoryPage } from './HistoryPage';
import type { Report, StaffIdentity } from '../types/domain';

const actor: StaffIdentity = {
  id: 'staff-1',
  publicId: 'staff-1',
  name: 'Root',
  email: '',
  role: 'FULL_ADMIN',
};
function mount(
  element: React.ReactNode,
  path = '/admin/access',
  pattern = '/admin/access',
  logout = vi.fn().mockResolvedValue(undefined),
) {
  return render(
    <AdminContext.Provider value={actor}>
      <LogoutContext.Provider value={logout}>
        <MemoryRouter initialEntries={[path]}>
          <Routes>
            <Route path={pattern} element={element} />
          </Routes>
        </MemoryRouter>
      </LogoutContext.Provider>
    </AdminContext.Provider>,
  );
}
const report = (id: string): Report => ({
  id,
  targetType: 'POST',
  targetId: 'post-1',
  messageId: null,
  chatId: null,
  reason: `Причина ${id}`,
  category: 'SPAM',
  priority: 'HIGH',
  sourceContextId: null,
  status: 'OPEN',
  resolutionReason: null,
  resolvedAt: null,
  createdAt: '2026-10-09T00:00:00Z',
  updatedAt: '2026-10-09T00:00:00Z',
  reporter: null,
  targetUser: null,
  assignee: null,
});
const group: GroupDetails = {
  group: {
    groupKey: 'group-1',
    targetType: 'POST',
    targetId: 'post-1',
    sourceContextId: null,
    count: 2,
    openCount: 2,
    highestPriority: 'HIGH',
    oldestAt: '2026-10-09T00:00:00Z',
    latestAt: '2026-10-09T00:00:00Z',
    sampleReportId: 'report-1',
  },
  reports: [report('report-1'), report('report-2')],
  decisions: [],
};
beforeEach(() => localStorage.clear());
afterEach(() => vi.restoreAllMocks());
describe('operations safety and meaningful controls', () => {
  it('accepts a recovery code to disable TOTP without weakening setup confirmation', async () => {
    vi.spyOn(operationsService, 'sessions').mockResolvedValue({
      items: [],
      totpEnabled: true,
      totpConfigured: true,
    });
    const disable = vi
      .spyOn(operationsService, 'disableTotp')
      .mockResolvedValue({});
    mount(<AccessSecurityPage />);
    const code = await screen.findByLabelText('Код 2FA или резервный код');
    fireEvent.change(screen.getByLabelText('Личный пароль сотрудника'), {
      target: { value: 'personal-password' },
    });
    fireEvent.change(code, {
      target: { value: '12345678-12345678-12345678-12345678' },
    });
    expect(code).not.toHaveAttribute('pattern');
    fireEvent.click(
      screen.getByRole('button', { name: 'Отключить двухфакторную защиту' }),
    );
    await waitFor(() =>
      expect(disable).toHaveBeenCalledWith(
        'personal-password',
        '12345678-12345678-12345678-12345678',
      ),
    );
  });
  it('loads durable incidents independently of failed service history and labels sampled duration', async () => {
    const coverage = {
      from: '2026-10-02T00:00:00Z',
      to: '2026-10-09T00:00:00Z',
      availableFrom: null,
      partial: true,
      storage: 'DATABASE' as const,
      bucket: 'HOUR' as const,
      retentionDays: 30,
      flushIntervalSeconds: 15,
    };
    vi.spyOn(operationsService, 'history').mockResolvedValue({
      coverage,
      operations: [],
    });
    vi.spyOn(operationsService, 'serviceHistory').mockRejectedValue(
      new Error('Источник проверок недоступен'),
    );
    const load = vi.spyOn(operationsService, 'incidents').mockResolvedValue({
      limit: 200,
      generatedAt: coverage.to,
      items: [
        {
          id: 'incident',
          kind: 'SERVICE',
          severity: 'ERROR',
          title: 'Задержка отправки',
          message: 'Превышен порог процесса',
          metadata: { operationId: 'message.client' },
          createdAt: coverage.from,
          updatedAt: coverage.to,
          resolvedAt: null,
          occurrences: 2,
          revision: 2,
          durationSeconds: 3661,
        },
      ],
    });
    mount(<HistoryPage />, '/admin/history', '/admin/history');
    await screen.findByText('Задержка отправки');
    expect(screen.getByText('Продолжается')).toBeVisible();
    expect(screen.getByText('1 ч 1 мин 1 с')).toBeVisible();
    expect(screen.getByText(/это не точное время начала/)).toBeVisible();
    expect(screen.getByRole('alert')).toHaveTextContent(
      'Источник проверок недоступен',
    );
    fireEvent.change(screen.getByRole('combobox', { name: 'Период истории' }), {
      target: { value: '30' },
    });
    await waitFor(() =>
      expect(load).toHaveBeenCalledWith(30, expect.any(AbortSignal)),
    );
  });
  it('sends display percentages as fractions and requires a change reason', async () => {
    const items = [
      {
        operationId: 'message.server',
        enabled: true,
        p95Ms: 100,
        errorRate: 0.05,
        minSamples: 5,
      },
    ];
    vi.spyOn(operationsService, 'thresholds').mockResolvedValue({ items });
    const save = vi
      .spyOn(operationsService, 'saveThresholds')
      .mockResolvedValue({ items });
    mount(<ThresholdsPage />);
    expect(await screen.findByLabelText('Ошибки, %')).toHaveValue(5);
    expect(
      screen.getByRole('button', { name: 'Сохранить пороги' }),
    ).toBeDisabled();
    fireEvent.change(screen.getByLabelText('Ошибки, %'), {
      target: { value: '10' },
    });
    fireEvent.change(screen.getByLabelText('Основание изменения'), {
      target: { value: 'Настройка реального порога' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Сохранить пороги' }));
    await screen.findByText('Пороги сохранены.');
    expect(save).toHaveBeenCalledWith(
      [{ ...items[0], errorRate: 0.1 }],
      'Настройка реального порога',
    );
    expect(screen.getByLabelText('Минимум замеров')).toHaveAttribute(
      'min',
      '5',
    );
  });
  it('does not enable TOTP before confirmation and shows backup codes only in state', async () => {
    vi.spyOn(operationsService, 'sessions').mockResolvedValue({
      items: [],
      totpEnabled: false,
      totpConfigured: true,
    });
    vi.spyOn(operationsService, 'setupTotp').mockResolvedValue({
      secret: 'PRIVATE-SETUP-SECRET',
      otpauthUrl: 'otpauth://totp/example?secret=PRIVATE-SETUP-SECRET',
    });
    const confirm = vi
      .spyOn(operationsService, 'confirmTotp')
      .mockResolvedValue({
        success: true,
        recoveryCodes: ['aaaaaaaa-bbbbbbbb-cccccccc-dddddddd'],
      });
    mount(<AccessSecurityPage />);
    fireEvent.change(await screen.findByLabelText('Личный пароль сотрудника'), {
      target: { value: 'personal-password' },
    });
    fireEvent.click(
      screen.getByRole('button', { name: 'Настроить двухфакторную защиту' }),
    );
    await screen.findByText('PRIVATE-SETUP-SECRET', { exact: true });
    expect(confirm).not.toHaveBeenCalled();
    fireEvent.change(screen.getByLabelText('Код из приложения'), {
      target: { value: '123456' },
    });
    fireEvent.click(
      screen.getByRole('button', { name: 'Подтвердить и включить' }),
    );
    await screen.findByRole('heading', { name: 'Сохраните резервные коды' });
    expect(
      screen.queryByText('PRIVATE-SETUP-SECRET', { exact: true }),
    ).not.toBeInTheDocument();
    expect(
      screen.getByText('aaaaaaaa-bbbbbbbb-cccccccc-dddddddd'),
    ).toBeVisible();
    expect(
      screen.getByRole('button', { name: 'Обновить мои сессии' }),
    ).toBeDisabled();
    expect(localStorage.length).toBe(0);
  });
  it('revokes only the selected opaque session and exits when it is current', async () => {
    vi.spyOn(operationsService, 'sessions').mockResolvedValue({
      totpEnabled: false,
      totpConfigured: false,
      items: [
        {
          id: 'opaque-row-id',
          current: true,
          username: 'root',
          role: 'FULL_ADMIN',
          ip: '127.0.0.1',
          userAgent: 'Example browser',
          createdAt: '2026-10-09T00:00:00Z',
          lastSeenAt: '2026-10-09T00:00:00Z',
          expiresAt: '2026-10-10T00:00:00Z',
        },
      ],
    });
    const revoke = vi
      .spyOn(operationsService, 'revokeSession')
      .mockResolvedValue({});
    const logout = vi.fn().mockResolvedValue(undefined);
    mount(<AccessSecurityPage />, '/admin/access', '/admin/access', logout);
    fireEvent.click(
      await screen.findByRole('button', { name: 'Завершить текущую сессию' }),
    );
    fireEvent.change(screen.getByLabelText('Основание'), {
      target: { value: 'Проверка завершения текущей сессии' },
    });
    fireEvent.click(
      screen.getByRole('button', { name: 'Подтвердить завершение' }),
    );
    await waitFor(() => expect(logout).toHaveBeenCalledWith(true));
    expect(revoke).toHaveBeenCalledWith(
      'opaque-row-id',
      'Проверка завершения текущей сессии',
    );
  });
  it('keeps the exact group snapshot and idempotency key on network retry', async () => {
    vi.spyOn(operationsService, 'group').mockResolvedValue(group);
    const decide = vi
      .spyOn(operationsService, 'decide')
      .mockRejectedValueOnce(new Error('Сеть недоступна'))
      .mockResolvedValue({
        success: true,
        decisionId: 'decision-1',
        reportIds: ['report-1'],
        repeated: true,
      });
    mount(
      <ReportGroupDetailsPage />,
      '/admin/report-groups/group-1',
      '/admin/report-groups/:id',
    );
    fireEvent.click(await screen.findByLabelText('Выбрать жалобу report-1'));
    fireEvent.click(
      screen.getByRole('button', { name: 'Завершить выбранные' }),
    );
    fireEvent.change(screen.getByLabelText('Основание решения'), {
      target: { value: 'Проверены выбранные жалобы' },
    });
    fireEvent.click(
      screen.getByRole('button', { name: 'Подтвердить решение' }),
    );
    await within(screen.getByRole('dialog')).findByText('Сеть недоступна');
    fireEvent.click(
      screen.getByRole('button', { name: 'Подтвердить решение' }),
    );
    await waitFor(() => expect(decide).toHaveBeenCalledTimes(2));
    expect(decide.mock.calls[0]?.[1].reportIds).toEqual(['report-1']);
    expect(decide.mock.calls[1]?.[1].idempotencyKey).toBe(
      decide.mock.calls[0]?.[1].idempotencyKey,
    );
  });
  it('requires a new selection after a group conflict', async () => {
    vi.spyOn(operationsService, 'group').mockResolvedValue(group);
    vi.spyOn(operationsService, 'decide').mockRejectedValue(
      new ApiError(409, 'conflict'),
    );
    mount(
      <ReportGroupDetailsPage />,
      '/admin/report-groups/group-1',
      '/admin/report-groups/:id',
    );
    fireEvent.click(await screen.findByLabelText('Выбрать жалобу report-1'));
    fireEvent.click(
      screen.getByRole('button', { name: 'Завершить выбранные' }),
    );
    fireEvent.change(screen.getByLabelText('Основание решения'), {
      target: { value: 'Проверены выбранные жалобы' },
    });
    fireEvent.click(
      screen.getByRole('button', { name: 'Подтвердить решение' }),
    );
    await screen.findByText(
      'Группа изменилась. Обновите её и выберите жалобы заново.',
    );
    expect(
      screen.getByRole('button', { name: 'Завершить выбранные' }),
    ).toBeDisabled();
  });
  it('does not offer review of a FULL_ADMIN own decision when server denies it', async () => {
    const appeal: Appeal = {
      id: 'appeal-1',
      decisionId: 'decision-1',
      appellant: { id: 'user-1', name: 'Пользователь' },
      party: 'SUBJECT',
      reason: 'Прошу пересмотреть принятое решение',
      status: 'OPEN',
      createdAt: '2026-10-09T00:00:00Z',
      reviewedAt: null,
      reviewReason: null,
      reviewer: null,
      decision: {
        id: 'decision-1',
        action: 'RESOLVE_REPORT',
        reason: 'Исходное решение по жалобам',
        actor: { id: actor.id, name: actor.name },
        createdAt: '2026-10-09T00:00:00Z',
        reportCount: 2,
        targetType: 'POST',
        targetId: 'post-1',
      },
      canReview: false,
    };
    vi.spyOn(operationsService, 'appeal').mockResolvedValue(appeal);
    mount(
      <AppealDetailsPage />,
      '/admin/appeals/appeal-1',
      '/admin/appeals/:id',
    );
    await screen.findByText(appeal.reason);
    expect(
      screen.queryByRole('button', { name: 'Сохранить результат проверки' }),
    ).not.toBeInTheDocument();
    expect(
      screen.getByText(/Требуется другой администратор/),
    ).toBeInTheDocument();
  });
});
