import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { apiClient, ApiError, authApi } from '../api-client';
import { useAuthStore } from '../auth-store';
import { AuthResponse } from '@crm/shared-types';

describe('API Client & HTTP Interceptor Suite', () => {
  const mockAuthResponse: AuthResponse = {
    accessToken: 'initial_valid_token_xyz',
    user: {
      id: '018f4a12-0000-7000-8000-000000000001',
      email: 'engineer@crm.corp',
      firstName: 'Sarah',
      lastName: 'Connor',
    },
    organization: {
      id: '018f4a12-0000-7000-8000-000000000010',
      name: 'Cyberdyne Systems',
      slug: 'cyberdyne',
      role: 'admin',
    },
    availableOrganizations: [],
  };

  beforeEach(() => {
    useAuthStore.getState().clearAuthSession();
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('1. Header Injection: Injects Authorization Bearer and JSON headers when authenticated', async () => {
    useAuthStore.getState().setAuthSession(mockAuthResponse);

    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ status: 'healthy' }),
    });
    vi.stubGlobal('fetch', fetchMock);

    const data = await apiClient<{ status: string }>('/api/v1/ops/health');

    expect(data.status).toBe('healthy');
    expect(fetchMock).toHaveBeenCalledTimes(1);

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('/api/v1/ops/health');
    const headers = init.headers as Headers;
    expect(headers.get('Authorization')).toBe('Bearer initial_valid_token_xyz');
    expect(headers.get('Content-Type')).toBe('application/json');
    expect(init.credentials).toBe('include');
  });

  it('2. RFC 7807 Error Handling: Throws structured ApiError with status and problem details', async () => {
    const errorPayload = {
      type: 'https://api.crm.domain/errors/quota-exceeded',
      title: 'Quota Exceeded',
      status: 402,
      detail: 'Free tier quota of 100 deals reached. Upgrade required.',
      instance: '/api/v1/deals',
      traceId: 'trace-err-999',
    };

    const fetchMock = vi.fn().mockResolvedValue({
      ok: false,
      status: 402,
      json: async () => errorPayload,
    });
    vi.stubGlobal('fetch', fetchMock);

    await expect(apiClient('/api/v1/deals')).rejects.toThrow(ApiError);

    try {
      await apiClient('/api/v1/deals');
    } catch (err: any) {
      expect(err).toBeInstanceOf(ApiError);
      expect(err.status).toBe(402);
      expect(err.problem.detail).toBe('Free tier quota of 100 deals reached. Upgrade required.');
      expect(err.problem.traceId).toBe('trace-err-999');
    }
  });

  it('3. 401 Interception & Silent Recovery: Retries request after single-flight refresh succeeds', async () => {
    useAuthStore.getState().setAuthSession(mockAuthResponse);

    const refreshedResponse: AuthResponse = {
      ...mockAuthResponse,
      accessToken: 'refreshed_second_token_abc',
    };

    // First call: 401 Unauthorized
    // Second call (inside singleFlightRefresh): returns 200 OK with refreshed tokens
    // Third call (retry original request): returns 200 OK with data
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        ok: false,
        status: 401,
        json: async () => ({ detail: 'Token expired' }),
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => refreshedResponse,
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ deals: [{ id: 'deal-1', title: 'Big Contract' }] }),
      });

    vi.stubGlobal('fetch', fetchMock);

    const result = await apiClient<{ deals: any[] }>('/api/v1/deals');

    expect(result.deals).toHaveLength(1);
    expect(result.deals[0].title).toBe('Big Contract');
    expect(fetchMock).toHaveBeenCalledTimes(3);

    // Verify retry used the new token
    const retryCall = fetchMock.mock.calls[2];
    const retryHeaders = retryCall[1].headers as Headers;
    expect(retryHeaders.get('Authorization')).toBe('Bearer refreshed_second_token_abc');
  });

  it('4. AuthApi Integration: authApi.login updates store state upon success', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => mockAuthResponse,
    });
    vi.stubGlobal('fetch', fetchMock);

    const response = await authApi.login({
      email: 'engineer@crm.corp',
      password: 'StrongPassword123!',
    });

    expect(response.accessToken).toBe(mockAuthResponse.accessToken);
    expect(useAuthStore.getState().isAuthenticated).toBe(true);
    expect(useAuthStore.getState().user?.email).toBe('engineer@crm.corp');
  });

  it('5. AuthApi Logout: authApi.logout clears session credentials regardless of network response', async () => {
    useAuthStore.getState().setAuthSession(mockAuthResponse);

    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ success: true }),
    });
    vi.stubGlobal('fetch', fetchMock);

    await authApi.logout();

    expect(useAuthStore.getState().isAuthenticated).toBe(false);
    expect(useAuthStore.getState().accessToken).toBeNull();
  });
});
