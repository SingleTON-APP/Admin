import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { appVersionsService } from '../services/app-versions.service';
import { AppVersionsPage } from './AppVersionsPage';

const snapshot = {
  policies: [
    {
      platform: 'ios' as const,
      latestBuild: 5,
      minBuild: 3,
      latestVersion: '1.0 (5)',
      storeUrl: 'https://testflight.apple.com/join/abc',
      message: null,
      updatedAt: '2026-11-02T10:00:00Z',
    },
    {
      platform: 'android' as const,
      latestBuild: null,
      minBuild: null,
      latestVersion: null,
      storeUrl: null,
      message: null,
      updatedAt: null,
    },
  ],
  installed: [
    {
      platform: 'android' as const,
      appVersion: '0.1.149',
      users: 7,
      devices: 8,
      lastSeen: '2026-11-02T09:00:00Z',
    },
  ],
};

const renderPage = () =>
  render(
    <MemoryRouter>
      <AppVersionsPage />
    </MemoryRouter>,
  );

describe('app versions page', () => {
  afterEach(() => vi.restoreAllMocks());

  it('shows both platforms and who runs which version', async () => {
    vi.spyOn(appVersionsService, 'snapshot').mockResolvedValue(snapshot);
    renderPage();
    const ios = await screen.findByRole('form', { name: 'iPhone (iOS)' });
    expect(within(ios).getByDisplayValue('5')).toBeVisible();
    expect(within(ios).getByDisplayValue('1.0 (5)')).toBeVisible();
    expect(screen.getByRole('form', { name: 'Android' })).toBeVisible();
    expect(screen.getByText('0.1.149')).toBeVisible();
  });

  it('blocks a minimum above the latest build', async () => {
    vi.spyOn(appVersionsService, 'snapshot').mockResolvedValue(snapshot);
    renderPage();
    const ios = await screen.findByRole('form', { name: 'iPhone (iOS)' });
    fireEvent.change(within(ios).getByLabelText(/Минимальная сборка/), {
      target: { value: '9' },
    });
    expect(within(ios).getByRole('alert')).toHaveTextContent(
      'Минимальная сборка не может быть больше последней',
    );
    expect(
      within(ios).getByRole('button', { name: 'Сохранить' }),
    ).toBeDisabled();
  });

  it('saves the edited policy, sending empty fields as null', async () => {
    vi.spyOn(appVersionsService, 'snapshot').mockResolvedValue(snapshot);
    const update = vi.spyOn(appVersionsService, 'update').mockResolvedValue({
      platform: 'android',
      latestBuild: 150,
      minBuild: null,
      latestVersion: null,
      storeUrl: null,
      message: null,
      updatedAt: '2026-11-02T11:00:00Z',
    });
    renderPage();
    const android = await screen.findByRole('form', { name: 'Android' });
    fireEvent.change(within(android).getByLabelText(/Последняя сборка/), {
      target: { value: '150' },
    });
    fireEvent.click(within(android).getByRole('button', { name: 'Сохранить' }));
    await waitFor(() =>
      expect(update).toHaveBeenCalledWith('android', {
        latestBuild: 150,
        minBuild: null,
        latestVersion: null,
        storeUrl: null,
        message: null,
      }),
    );
    expect(await within(android).findByRole('status')).toHaveTextContent(
      'Сохранено',
    );
  });
});
