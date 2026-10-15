import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { useAuthStore, singleFlightRefresh } from '../auth-store';
import { AuthResponse } from '@crm/shared-types';

describe('AuthStore & Cross-Tab Concurrency Suite', () => {
  const mockAuthResponse: AuthResponse = {
    accessToken: 'mock_access_token_jwt_123',
    user: {
      id: '018f4a12-0000-7000-8000-000000000001',
      email: 'alex@acme.corp',
      firstName: 'Alex',
      lastName: 'Vance',
    },
    organization: {
      id: '018f4a12-0000-7000-8000-000000000010',
      name: 'Acme Corporation',
      slug: 'acme-corp',
      role: 'owner',
    },
    availableOrganizations: [
      {
        id: '018f4a12-0000-7000-8000-000000000010',
        name: 'Acme Corporation',
        slug: 'acme-corp',
        role: 'owner',
      },
      {
        id: '018f4a12-0000-7000-8000-000000000020',
        name: 'Beta Labs',
        slug: 'beta-labs',
        role: 'member',
      },
    ],
  };

  beforeEach(() => {
    useAuthStore.getState().clearAuthSession();
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('1. Initial State: Unauthenticated and loading state handled properly', () => {
    const state = useAuthStore.getState();
    expect(state.isAuthenticated).toBe(false);
    expect(state.accessToken).toBeNull();
    expect(state.user).toBeNull();
    expect(state.organization).toBeNull();
    expect(state.availableOrganizations).toEqual([]);
  });

  it('2. Session Initialization: setAuthSession populates credentials and sets isAuthenticated', () => {
    useAuthStore.getState().setAuthSession(mockAuthResponse);

    const state = useAuthStore.getState();
    expect(state.isAuthenticated).toBe(true);
    expect(state.accessToken).toBe('mock_access_token_jwt_123');
    expect(state.user?.email).toBe('alex@acme.corp');
    expect(state.organization?.slug).toBe('acme-corp');
    expect(state.availableOrganizations).toHaveLength(2);
  });

  it('3. Session Termination: clearAuthSession purges token and resets authentication flags', () => {
    useAuthStore.getState().setAuthSession(mockAuthResponse);
    expect(useAuthStore.getState().isAuthenticated).toBe(true);

    useAuthStore.getState().clearAuthSession();

    const state = useAuthStore.getState();
    expect(state.isAuthenticated).toBe(false);
    expect(state.accessToken).toBeNull();
    expect(state.user).toBeNull();
    expect(state.organization).toBeNull();
  });

  it('4. Organization Switch: switchOrg updates current tenant context and accessToken', () => {
    useAuthStore.getState().setAuthSession(mockAuthResponse);

    const targetOrg = {
      id: '018f4a12-0000-7000-8000-000000000020',
      name: 'Beta Labs',
      slug: 'beta-labs',
      role: 'member' as const,
    };

    useAuthStore.getState().switchOrg(targetOrg, 'switched_jwt_token_456');

    const state = useAuthStore.getState();
    expect(state.organization?.id).toBe(targetOrg.id);
    expect(state.organization?.name).toBe('Beta Labs');
    expect(state.accessToken).toBe('switched_jwt_token_456');
  });

  it('5. Single-Flight Refresh (Successful): network refresh acquires active session', async () => {
    const refreshedSession: AuthResponse = {
      ...mockAuthResponse,
      accessToken: 'fresh_rotated_jwt_token_789',
    };

    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => refreshedSession,
    });
    vi.stubGlobal('fetch', fetchMock);

    const result = await singleFlightRefresh();

    expect(result).not.toBeNull();
    expect(result?.accessToken).toBe('fresh_rotated_jwt_token_789');
    expect(useAuthStore.getState().accessToken).toBe('fresh_rotated_jwt_token_789');
    expect(useAuthStore.getState().isAuthenticated).toBe(true);
    expect(fetchMock).toHaveBeenCalledWith('/api/v1/auth/refresh', expect.objectContaining({
      method: 'POST',
      credentials: 'include',
    }));
  });

  it('6. Single-Flight Refresh (Session Expired): 401 response clears local session and returns null', async () => {
    useAuthStore.getState().setAuthSession(mockAuthResponse);

    const fetchMock = vi.fn().mockResolvedValue({
      ok: false,
      status: 401,
      json: async () => ({ detail: 'Token family revoked' }),
    });
    vi.stubGlobal('fetch', fetchMock);

    const result = await singleFlightRefresh();

    expect(result).toBeNull();
    expect(useAuthStore.getState().isAuthenticated).toBe(false);
    expect(useAuthStore.getState().accessToken).toBeNull();
  });
});
