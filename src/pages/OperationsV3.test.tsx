import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { AdminContext } from '../features/admin-access/AdminContext';
import {
  operationsV3Service,
  type ActionProposal,
  type IncidentDetails,
} from '../services/operations-v3.service';
import { OperationsPage } from './OperationsPage';
import { UserDossierPage } from './UserDossierPage';
import { DiagnosticsPanel } from '../components/dashboard/DiagnosticsPanel';
import { BulkDecisionPanel } from '../components/moderation/BulkDecisionPanel';
import { ReportDeadline } from '../components/moderation/ReportDeadline';
import { ActionPanel } from '../components/moderation/ActionPanel';
import { adminService } from '../services/admin.service';
import { ApiError } from '../api/contracts';
import type { Report, StaffIdentity } from '../types/domain';

const actor: StaffIdentity = {
  id: 'staff-root',
  publicId: 'root',
  name: 'Root',
  email: '',
  role: 'FULL_ADMIN',
};
function mount(
  element: React.ReactNode,
  path = '/admin/operations',
  pattern = '/admin/operations',
) {
  return render(
    <AdminContext.Provider value={actor}>
      <MemoryRouter initialEntries={[path]}>
        <Routes>
          <Route path={pattern} element={element} />
        </Routes>
      </MemoryRouter>
    </AdminContext.Provider>,
  );
}
const now = '2026-10-10T00:00:00Z';
const report: Report = {
  id: 'report-1',
  targetType: 'USER',
  targetId: 'user-1',
  messageId: null,
  chatId: null,
  reason: 'Нарушение правил',
  category: 'SPAM',
  priority: 'HIGH',
  sourceContextId: null,
  status: 'IN_REVIEW',
  resolutionReason: null,
  resolvedAt: null,
  createdAt: now,
  updatedAt: now,
  reporter: null,
  targetUser: {
    id: 'user-1',
    publicId: 'subject',
    username: 'subject',
    firstName: 'Subject',
    lastName: '',
    avatar: null,
    role: 'USER',
  },
  assignee: actor,
};
const proposal: ActionProposal = {
  id: 'proposal-1',
  action: 'DELETE_USER',
  target: { id: 'user-1', name: 'Subject', publicId: 'subject' },
  reportId: null,
  reason: 'Подтверждённое основание удаления',
  status: 'PENDING',
  revision: 3,
  expiresAt: '2099-01-01T00:00:00Z',
  creator: { id: actor.id, name: actor.name },
  approver: null,
  createdAt: now,
  canApprove: false,
  canExecute: false,
};
afterEach(() => vi.restoreAllMocks());
describe('operations v3 workflows', () => {
  it('does not report unknown backups as healthy or pretend to restore production', async () => {
    vi.spyOn(operationsV3Service, 'backups').mockResolvedValue({
      configured: false,
      status: 'UNKNOWN',
      maxBackupAgeHours: 8,
      maxRestoreAgeDays: 8,
      lastSuccess: null,
      lastRestoreTest: null,
      items: [],
      generatedAt: now,
    });
    mount(<OperationsPage />, '/admin/operations?tab=backups');
    expect(await screen.findByText('Проверка не настроена')).toBeVisible();
    expect(screen.getAllByText('Нет данных')).toHaveLength(2);
    expect(
      screen.queryByText('Подтверждено свежими успешными запусками'),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: /Восстановить/ }),
    ).not.toBeInTheDocument();
  });
  it('records incident changes with the exact version and prevents premature service closure', async () => {
    const incident: IncidentDetails = {
      id: 'incident-1',
      notificationId: 'notification-1',
      title: 'Сбой отправки сообщений',
      severity: 'ERROR',
      source: 'SERVICE',
      status: 'INVESTIGATING',
      ownerId: null,
      ownerName: null,
      affectedFunctions: ['Сообщения'],
      version: 7,
      createdAt: now,
      updatedAt: now,
      resolvedAt: null,
      signalResolved: false,
      occurrences: 3,
      timeline: [
        {
          id: 'event-1',
          actorName: null,
          body: 'Сигнал сервиса получен',
          action: 'SIGNAL',
          createdAt: now,
        },
      ],
    };
    vi.spyOn(operationsV3Service, 'incidents').mockResolvedValue({
      items: [incident],
      generatedAt: now,
    });
    vi.spyOn(operationsV3Service, 'incident').mockResolvedValue(incident);
    const update = vi
      .spyOn(operationsV3Service, 'updateIncident')
      .mockResolvedValue(incident);
    mount(
      <OperationsPage />,
      '/admin/operations?tab=incidents&incident=incident-1',
    );
    await screen.findByText('Сигнал сервиса получен');
    expect(screen.getByRole('option', { name: 'Завершён' })).toBeDisabled();
    fireEvent.change(screen.getByLabelText('Ответственность'), {
      target: { value: 'CLAIM' },
    });
    fireEvent.change(screen.getByLabelText('Запись в хронологию'), {
      target: { value: 'Проверяю обработку на сервере' },
    });
    fireEvent.click(
      screen.getByRole('button', { name: 'Сохранить запись и изменения' }),
    );
    await waitFor(() =>
      expect(update).toHaveBeenCalledWith('incident-1', {
        expectedVersion: 7,
        claim: true,
        note: 'Проверяю обработку на сервере',
      }),
    );
  });
  it('rolls back only an allowed change with the current settings version and audited reason', async () => {
    vi.spyOn(operationsV3Service, 'settings').mockResolvedValue({
      version: 5,
      items: [
        {
          id: 'change-5',
          version: 5,
          actorName: 'Admin',
          reason: 'Уточнены пороги ошибок',
          before: [],
          after: [],
          createdAt: now,
          revertedFrom: null,
          canRollback: true,
        },
        {
          id: 'change-4',
          version: 4,
          actorName: 'Admin',
          reason: 'Старое изменение настроек',
          before: [],
          after: [],
          createdAt: now,
          revertedFrom: null,
          canRollback: false,
        },
      ],
    });
    const rollback = vi
      .spyOn(operationsV3Service, 'rollback')
      .mockResolvedValue({});
    mount(<OperationsPage />, '/admin/operations?tab=settings');
    const buttons = await screen.findAllByRole('button', {
      name: 'Подготовить откат',
    });
    expect(buttons[1]).toBeDisabled();
    fireEvent.click(buttons[0]!);
    fireEvent.change(screen.getByLabelText('Причина отката'), {
      target: { value: 'Возвращаю согласованные прежние пороги' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Подтвердить откат' }));
    await waitFor(() =>
      expect(rollback).toHaveBeenCalledWith(
        'change-5',
        5,
        'Возвращаю согласованные прежние пороги',
      ),
    );
  });
  it('labels incomplete release windows and unknown measurements separately from zero', async () => {
    vi.spyOn(operationsV3Service, 'releases').mockResolvedValue({
      items: [],
      selectedReleaseId: null,
      windowMinutes: 15,
      before: null,
      after: {
        from: now,
        to: now,
        complete: false,
        operations: [
          {
            operationId: 'message.server',
            count: 0,
            errors: 0,
            errorRate: null,
            p95Ms: null,
            meanMs: null,
          },
        ],
        calls: [],
      },
      limitations: ['Недостаточная историческая выборка'],
    });
    mount(<OperationsPage />, '/admin/operations?tab=releases');
    await screen.findByText('Окно покрыто не полностью.');
    expect(screen.getByText('Данных для окна нет.')).toBeVisible();
    expect(screen.getAllByText(/Нет измерений/).length).toBeGreaterThan(0);
    expect(
      screen.getByText(/различия сами по себе не доказывают/),
    ).toBeVisible();
  });
  it('keeps unmeasured process duration unknown and explains absent diagnostics', async () => {
    const code = '12345678-1234-4123-8123-123456789abc';
    vi.spyOn(operationsV3Service, 'diagnostic')
      .mockResolvedValueOnce({
        code,
        occurredAt: now,
        expiresAt: now,
        status: 'CAPTURED',
        retentionDays: 7,
        timeline: [
          {
            stage: 'PROCESS_STAGE',
            service: 'back-hub',
            operation: 'message.persistence',
            durationMs: null,
            failed: true,
            startedAt: now,
            finishedAt: now,
          },
        ],
        coverage: {
          http: 'SERVER_FAILURE_ONLY',
          processStages: 'OBSERVED',
          messageDelivery: 'UNAVAILABLE',
          client: 'REFERENCE_ONLY',
        },
        limitations: [],
      })
      .mockRejectedValueOnce(new ApiError(404, 'Not found'));
    mount(<DiagnosticsPanel />);
    fireEvent.change(screen.getByLabelText('Код ошибки'), {
      target: { value: code },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Найти ошибку' }));
    await screen.findByText(/Длительность не измерена/);
    expect(
      screen.getByText(/Цепочка доставки сообщения недоступна/),
    ).toBeVisible();
    fireEvent.click(screen.getByRole('button', { name: 'Найти ошибку' }));
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'ошибка могла не попасть в ограниченный сбор',
    );
    expect(
      screen.queryByText(/Длительность не измерена/),
    ).not.toBeInTheDocument();
  });
  it('executes the server frozen preview with the same operation key on retry', async () => {
    const preview = vi
      .spyOn(operationsV3Service, 'previewBulk')
      .mockResolvedValue({
        id: 'preview-1',
        reportIds: ['report-1'],
        count: 1,
        affectedUserCount: 1,
        action: 'RESOLVE_REPORT',
        reason: 'Зафиксированное основание',
        expiresAt: '2099-01-01T00:00:00Z',
        status: 'OPEN',
        createdAt: now,
      });
    const execute = vi
      .spyOn(operationsV3Service, 'executeBulk')
      .mockRejectedValueOnce(new Error('Сеть недоступна'))
      .mockResolvedValue({ success: true });
    const onChanged = vi.fn();
    mount(
      <BulkDecisionPanel
        ids={['report-1']}
        onClear={vi.fn()}
        onChanged={onChanged}
      />,
    );
    fireEvent.change(screen.getByLabelText('Внутреннее основание'), {
      target: { value: 'Зафиксированное основание' },
    });
    fireEvent.click(
      screen.getByRole('button', { name: 'Предпросмотр решения' }),
    );
    const dialog = await screen.findByRole('dialog');
    expect(preview).toHaveBeenCalledWith({
      reportIds: ['report-1'],
      action: 'RESOLVE_REPORT',
      reason: 'Зафиксированное основание',
    });
    expect(within(dialog).getByText('report-1')).toBeInTheDocument();
    fireEvent.click(
      within(dialog).getByRole('button', { name: 'Применить к этой выборке' }),
    );
    await within(dialog).findByText('Сеть недоступна');
    fireEvent.click(
      within(dialog).getByRole('button', { name: 'Применить к этой выборке' }),
    );
    await waitFor(() => expect(onChanged).toHaveBeenCalledOnce());
    expect(execute.mock.calls[0]?.[0]).toBe('preview-1');
    expect(execute.mock.calls[1]).toEqual(execute.mock.calls[0]);
  });
  it('respects server denial of root self approval and reconciliation execution', async () => {
    vi.spyOn(operationsV3Service, 'proposals').mockResolvedValue({
      items: [],
      total: 0,
      page: 1,
      limit: 25,
    });
    vi.spyOn(operationsV3Service, 'proposal').mockResolvedValue({
      ...proposal,
      status: 'NEEDS_RECONCILIATION',
    });
    mount(
      <OperationsPage />,
      '/admin/operations?tab=approvals&proposal=proposal-1',
    );
    await screen.findByText(/Внешний результат не подтверждён/);
    expect(
      screen.queryByRole('button', { name: 'Сохранить согласование' }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole('button', {
        name: 'Выполнить согласованное действие',
      }),
    ).not.toBeInTheDocument();
  });
  it('reviews a proposal with the fetched revision rather than executing it immediately', async () => {
    vi.spyOn(operationsV3Service, 'proposals').mockResolvedValue({
      items: [],
      total: 0,
      page: 1,
      limit: 25,
    });
    vi.spyOn(operationsV3Service, 'proposal').mockResolvedValue({
      ...proposal,
      creator: { id: 'another-admin', name: 'Another' },
      canApprove: true,
    });
    const review = vi
      .spyOn(operationsV3Service, 'reviewProposal')
      .mockResolvedValue(proposal);
    const execute = vi.spyOn(operationsV3Service, 'executeProposal');
    mount(
      <OperationsPage />,
      '/admin/operations?tab=approvals&proposal=proposal-1',
    );
    fireEvent.change(
      await screen.findByLabelText('Основание независимой проверки'),
      { target: { value: 'Независимо проверено основание удаления' } },
    );
    fireEvent.click(
      screen.getByRole('button', { name: 'Сохранить согласование' }),
    );
    await waitFor(() =>
      expect(review).toHaveBeenCalledWith(
        'proposal-1',
        'APPROVE',
        3,
        'Независимо проверено основание удаления',
      ),
    );
    expect(execute).not.toHaveBeenCalled();
  });
  it('loads the selected dossier section and labels legacy report links honestly', async () => {
    const dossier = vi
      .spyOn(operationsV3Service, 'dossier')
      .mockResolvedValue({
        user: {
          id: 'user-1',
          publicId: 'subject',
          name: 'Subject',
          role: 'USER',
          createdAt: now,
        },
        counts: {
          reports: 1,
          sanctions: 0,
          decisions: 0,
          appeals: 0,
          audit: 0,
        },
        section: 'reports',
        items: [
          {
            id: 'report-1',
            createdAt: now,
            reason: 'Связанная жалоба',
            relation: 'TARGET',
          },
        ],
        total: 1,
        page: 1,
        limit: 25,
      });
    mount(
      <UserDossierPage />,
      '/admin/users/user-1/dossier',
      '/admin/users/:id/dossier',
    );
    await screen.findByText('Связанная жалоба');
    expect(
      screen.getByText(/историческая привязка субъекта не доказывает/),
    ).toBeVisible();
    fireEvent.click(screen.getByRole('link', { name: 'Санкции (0)' }));
    await waitFor(() =>
      expect(dossier).toHaveBeenCalledWith(
        'user-1',
        'sanctions',
        1,
        expect.any(AbortSignal),
      ),
    );
  });
  it('uses the report revision for deadline updates and preserves conflict explanations', async () => {
    const deadline = vi
      .spyOn(operationsV3Service, 'deadline')
      .mockRejectedValue(new ApiError(409, 'Conflict'));
    mount(<ReportDeadline report={report} onChanged={vi.fn()} />);
    fireEvent.change(screen.getByLabelText('Причина изменения срока'), {
      target: { value: 'Снимаю срок после уточнения задачи' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Сохранить срок' }));
    await screen.findByRole('alert');
    expect(deadline).toHaveBeenCalledWith(
      'report-1',
      null,
      now,
      'Снимаю срок после уточнения задачи',
    );
    expect(screen.getByLabelText('Причина изменения срока')).toHaveValue(
      'Снимаю срок после уточнения задачи',
    );
  });
  it('creates a permanent-ban proposal instead of calling the direct moderation endpoint', async () => {
    const create = vi
      .spyOn(operationsV3Service, 'createProposal')
      .mockRejectedValue(new Error('Проверка заявки'));
    const direct = vi.spyOn(adminService, 'moderateReportTarget');
    mount(
      <ActionPanel
        report={report}
        admin={actor}
        staff={[]}
        onChanged={vi.fn()}
      />,
    );
    fireEvent.click(
      screen.getByRole('button', { name: 'Постоянная блокировка' }),
    );
    fireEvent.change(screen.getByLabelText('Причина'), {
      target: { value: 'Независимо проверяемая постоянная блокировка' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Подтвердить' }));
    await waitFor(() =>
      expect(create).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'PERMANENT_BAN_USER',
          targetUserId: 'user-1',
          reportId: 'report-1',
          reason: 'Независимо проверяемая постоянная блокировка',
        }),
      ),
    );
    expect(direct).not.toHaveBeenCalled();
  });
});
