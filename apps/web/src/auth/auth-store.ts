import { create } from 'zustand';
import { AuthResponse } from '@crm/shared-types';

interface AuthState {
  accessToken: string | null;
  user: AuthResponse['user'] | null;
  organization: AuthResponse['organization'] | null;
  availableOrganizations: AuthResponse['availableOrganizations'];
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;

  setAuthSession: (session: AuthResponse) => void;
  clearAuthSession: () => void;
  setError: (error: string | null) => void;
  setLoading: (loading: boolean) => void;
  switchOrg: (org: AuthResponse['organization'], newAccessToken: string) => void;
}

// In-memory cross-tab communication channel
const authChannel = typeof window !== 'undefined' && 'BroadcastChannel' in window
  ? new BroadcastChannel('crm_auth_concurrency_channel')
  : null;

export const useAuthStore = create<AuthState>((set) => {
  // Listen for session updates from other browser tabs
  if (authChannel) {
    authChannel.onmessage = (event) => {
      const { type, payload } = event.data || {};
      if (type === 'SESSION_UPDATE') {
        set({
          accessToken: payload.accessToken,
          user: payload.user,
          organization: payload.organization,
          availableOrganizations: payload.availableOrganizations,
          isAuthenticated: true,
          error: null,
        });
      } else if (type === 'SESSION_REVOKED') {
        set({
          accessToken: null,
          user: null,
          organization: null,
          availableOrganizations: [],
          isAuthenticated: false,
          error: 'Session ended or revoked in another tab',
        });
      }
    };
  }

  return {
    accessToken: null,
    user: null,
    organization: null,
    availableOrganizations: [],
    isAuthenticated: false,
    isLoading: true,
    error: null,

    setAuthSession: (session: AuthResponse) => {
      set({
        accessToken: session.accessToken,
        user: session.user,
        organization: session.organization,
        availableOrganizations: session.availableOrganizations,
        isAuthenticated: true,
        isLoading: false,
        error: null,
      });

      // Broadcast new session state to other tabs
      authChannel?.postMessage({
        type: 'SESSION_UPDATE',
        payload: session,
      });
    },

    clearAuthSession: () => {
      set({
        accessToken: null,
        user: null,
        organization: null,
        availableOrganizations: [],
        isAuthenticated: false,
        isLoading: false,
        error: null,
      });

      // Broadcast logout to other tabs
      authChannel?.postMessage({ type: 'SESSION_REVOKED' });
    },

    setError: (error: string | null) => set({ error, isLoading: false }),
    setLoading: (isLoading: boolean) => set({ isLoading }),

    switchOrg: (organization, newAccessToken) => {
      set((state) => {
        const updated = {
          ...state,
          organization,
          accessToken: newAccessToken,
        };
        authChannel?.postMessage({
          type: 'SESSION_UPDATE',
          payload: {
            accessToken: newAccessToken,
            user: state.user,
            organization,
            availableOrganizations: state.availableOrganizations,
          },
        });
        return updated;
      });
    },
  };
});

/**
 * Web Locks API Single-Flight Mutex:
 * Coordinates refresh calls across multiple browser tabs so that 5 concurrent tabs
 * only fire 1 network refresh request while the others wait and receive the active token.
 */
export async function singleFlightRefresh(): Promise<AuthResponse | null> {
  const executeRefresh = async (): Promise<AuthResponse | null> => {
    try {
      const res = await fetch('/api/v1/auth/refresh', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include', // Includes HttpOnly cookie
      });

      if (!res.ok) {
        useAuthStore.getState().clearAuthSession();
        return null;
      }

      const data: AuthResponse = await res.json();
      useAuthStore.getState().setAuthSession(data);
      return data;
    } catch {
      useAuthStore.getState().clearAuthSession();
      return null;
    }
  };

  // If navigator.locks is supported, acquire single-flight mutex across tabs
  if (typeof navigator !== 'undefined' && navigator.locks && typeof navigator.locks.request === 'function') {
    return navigator.locks.request('crm_auth_refresh_lock', async () => {
      // Check if another tab just refreshed the in-memory token while we were waiting
      const currentToken = useAuthStore.getState().accessToken;
      if (currentToken) {
        // Already refreshed by prior lock holder
        const state = useAuthStore.getState();
        if (state.user && state.organization) {
          return {
            accessToken: currentToken,
            user: state.user,
            organization: state.organization,
            availableOrganizations: state.availableOrganizations,
          };
        }
      }
      return executeRefresh();
    });
  }

  // Fallback for environments without Web Locks
  return executeRefresh();
}
