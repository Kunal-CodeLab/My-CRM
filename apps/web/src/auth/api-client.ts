import { useAuthStore, singleFlightRefresh } from './auth-store';
import {
  RegisterRequest,
  LoginRequest,
  SwitchOrganizationRequest,
  AcceptInvitationRequest,
  AuthResponse,
  ApiErrorResponse,
  SystemHealthResponse,
  BackupDrillResult,
  LoadBenchmarkSummary,
  TeamMember,
  OrganizationInvitationItem,
  CreateInvitationRequest,
  UpdateMemberRoleRequest,
} from '@crm/shared-types';

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly problem: ApiErrorResponse
  ) {
    super(problem.detail || 'An error occurred during API request');
    this.name = 'ApiError';
  }
}

export async function apiClient<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const store = useAuthStore.getState();
  const headers = new Headers(options.headers || {});
  headers.set('Content-Type', 'application/json');

  if (store.accessToken) {
    headers.set('Authorization', `Bearer ${store.accessToken}`);
  }

  const response = await fetch(endpoint, {
    ...options,
    headers,
    credentials: 'include', // transmits HttpOnly refresh cookies securely
  });

  // Handle 401: Token expiration with single-flight cross-tab refresh
  if (response.status === 401 && !endpoint.includes('/auth/login') && !endpoint.includes('/auth/refresh')) {
    const refreshed = await singleFlightRefresh();
    if (refreshed?.accessToken) {
      headers.set('Authorization', `Bearer ${refreshed.accessToken}`);
      const retryResponse = await fetch(endpoint, {
        ...options,
        headers,
        credentials: 'include',
      });
      if (!retryResponse.ok) {
        const errorData: ApiErrorResponse = await retryResponse.json();
        throw new ApiError(retryResponse.status, errorData);
      }
      return retryResponse.json();
    }
  }

  if (!response.ok) {
    let errorData: ApiErrorResponse;
    try {
      errorData = await response.json();
    } catch {
      errorData = {
        type: 'https://api.crm.domain/errors/network-error',
        title: 'Network Error',
        status: response.status,
        detail: response.statusText,
        instance: endpoint,
        traceId: 'client_err',
      };
    }
    throw new ApiError(response.status, errorData);
  }

  return response.json();
}

export const authApi = {
  login: async (req: LoginRequest): Promise<AuthResponse> => {
    const data = await apiClient<AuthResponse>('/api/v1/auth/login', {
      method: 'POST',
      body: JSON.stringify(req),
    });
    useAuthStore.getState().setAuthSession(data);
    return data;
  },

  register: async (req: RegisterRequest): Promise<AuthResponse> => {
    const data = await apiClient<AuthResponse>('/api/v1/auth/register', {
      method: 'POST',
      body: JSON.stringify(req),
    });
    useAuthStore.getState().setAuthSession(data);
    return data;
  },

  switchOrganization: async (req: SwitchOrganizationRequest) => {
    const data = await apiClient<{ accessToken: string; organization: AuthResponse['organization'] }>(
      '/api/v1/auth/switch-organization',
      {
        method: 'POST',
        body: JSON.stringify(req),
      }
    );
    useAuthStore.getState().switchOrg(data.organization, data.accessToken);
    return data;
  },

  logout: async () => {
    try {
      await apiClient('/api/v1/auth/logout', { method: 'POST' });
    } finally {
      useAuthStore.getState().clearAuthSession();
    }
  },

  acceptInvitation: async (req: AcceptInvitationRequest) => {
    return apiClient('/api/v1/invitations/accept', {
      method: 'POST',
      body: JSON.stringify(req),
    });
  },
};

export const crmApi = {
  // Accounts
  listAccounts: async (params?: { limit?: number; cursor?: string; search?: string }) => {
    const qs = new URLSearchParams();
    if (params?.limit) qs.set('limit', params.limit.toString());
    if (params?.cursor) qs.set('cursor', params.cursor);
    if (params?.search) qs.set('q', params.search);
    return apiClient<any>(`/api/v1/accounts${qs.toString() ? `?${qs.toString()}` : ''}`);
  },

  createAccount: async (data: any) => {
    return apiClient<any>('/api/v1/accounts', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  // Contacts
  listContacts: async (params?: { limit?: number; cursor?: string; accountId?: string }) => {
    const qs = new URLSearchParams();
    if (params?.limit) qs.set('limit', params.limit.toString());
    if (params?.cursor) qs.set('cursor', params.cursor);
    if (params?.accountId) qs.set('accountId', params.accountId);
    return apiClient<any>(`/api/v1/contacts${qs.toString() ? `?${qs.toString()}` : ''}`);
  },

  createContact: async (data: any) => {
    return apiClient<any>('/api/v1/contacts', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  // Pipelines
  listPipelines: async () => {
    return apiClient<any[]>('/api/v1/pipelines');
  },

  // Deals
  listDeals: async (params?: { pipelineId?: string; stageId?: string }) => {
    const qs = new URLSearchParams();
    if (params?.pipelineId) qs.set('pipelineId', params.pipelineId);
    if (params?.stageId) qs.set('stageId', params.stageId);
    return apiClient<any[]>(`/api/v1/deals${qs.toString() ? `?${qs.toString()}` : ''}`);
  },

  createDeal: async (data: any) => {
    return apiClient<any>('/api/v1/deals', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  transitionDealStage: async (id: string, data: { newStageId: string; expectedVersion: number; lostReason?: string }) => {
    return apiClient<any>(`/api/v1/deals/${id}/stage`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  },

  // Activities
  listActivities: async (params?: { dealId?: string; contactId?: string; accountId?: string }) => {
    const qs = new URLSearchParams();
    if (params?.dealId) qs.set('dealId', params.dealId);
    if (params?.contactId) qs.set('contactId', params.contactId);
    if (params?.accountId) qs.set('accountId', params.accountId);
    return apiClient<any[]>(`/api/v1/activities${qs.toString() ? `?${qs.toString()}` : ''}`);
  },

  createActivity: async (data: any) => {
    return apiClient<any>('/api/v1/activities', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },
};

export const outboxApi = {
  listEvents: async (status?: string, limit?: number) => {
    const qs = new URLSearchParams();
    if (status) qs.set('status', status);
    if (limit) qs.set('limit', limit.toString());
    return apiClient<any[]>(`/api/v1/crm/outbox${qs.toString() ? `?${qs.toString()}` : ''}`);
  },

  triggerProcessing: async (limit = 10) => {
    return apiClient<{ processed: number; failed: number; unknown: number }>(`/api/v1/crm/outbox/process?limit=${limit}`, {
      method: 'POST',
    });
  },
};

export const auditApi = {
  listLogs: async (params?: { entityName?: string; entityId?: string; limit?: number }) => {
    const qs = new URLSearchParams();
    if (params?.entityName) qs.set('entityName', params.entityName);
    if (params?.entityId) qs.set('entityId', params.entityId);
    if (params?.limit) qs.set('limit', params.limit.toString());
    return apiClient<any[]>(`/api/v1/audit/logs${qs.toString() ? `?${qs.toString()}` : ''}`);
  },

  listAmendments: async (params?: { targetEntityName?: string; targetEntityId?: string }) => {
    const qs = new URLSearchParams();
    if (params?.targetEntityName) qs.set('targetEntityName', params.targetEntityName);
    if (params?.targetEntityId) qs.set('targetEntityId', params.targetEntityId);
    return apiClient<any[]>(`/api/v1/audit/amendments${qs.toString() ? `?${qs.toString()}` : ''}`);
  },

  createSampleTicket: async (data: { targetEntityName: string; targetEntityId: string; expiresInSeconds?: number }) => {
    return apiClient<{ ticket: any; publicKeyPem: string }>('/api/v1/audit/ticket/sample', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  executeLawfulErasure: async (data: { ticket: any; piiFields?: string[]; publicKeyPem?: string }) => {
    return apiClient<any>('/api/v1/audit/lawful-erasure', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  setLegalHold: async (legalHold: boolean) => {
    return apiClient<{ success: boolean; legalHold: boolean }>('/api/v1/audit/legal-hold', {
      method: 'POST',
      body: JSON.stringify({ legalHold }),
    });
  },

  purgePartition: async (partitionName: string, dryRun = true) => {
    return apiClient<any>('/api/v1/audit/partitions/purge', {
      method: 'POST',
      body: JSON.stringify({ partitionName, dryRun }),
    });
  },
};

export const csvApi = {
  exportContacts: async () => {
    return apiClient<any>('/api/v1/exports/contacts', { method: 'POST' });
  },

  exportDeals: async () => {
    return apiClient<any>('/api/v1/exports/deals', { method: 'POST' });
  },

  getExport: async (id: string) => {
    return apiClient<any>(`/api/v1/exports/${id}`);
  },

  createImport: async (data: { deduplicationMode: 'SKIP' | 'UPDATE' | 'CREATE_ALL'; csvData: string }) => {
    return apiClient<any>('/api/v1/imports/contacts', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  processImportChunk: async (id: string, chunkSize = 100) => {
    return apiClient<any>(`/api/v1/imports/${id}/process`, {
      method: 'POST',
      body: JSON.stringify({ chunkSize }),
    });
  },

  getImport: async (id: string) => {
    return apiClient<any>(`/api/v1/imports/${id}`);
  },
};

export const opsApi = {
  getHealth: async () => {
    return apiClient<SystemHealthResponse>('/api/v1/ops/health');
  },

  getHealthz: async () => {
    const res = await fetch('/healthz');
    return res.json();
  },

  getReadyz: async () => {
    const res = await fetch('/readyz');
    return res.json();
  },

  runBackupDrill: async (scenario = 'EPHEMERAL_PITR_RESTORATION') => {
    return apiClient<BackupDrillResult>('/api/v1/ops/backup-drill', {
      method: 'POST',
      body: JSON.stringify({ scenario }),
    });
  },

  runLoadBenchmark: async (virtualUsers = 50) => {
    return apiClient<LoadBenchmarkSummary>('/api/v1/ops/load-benchmark', {
      method: 'POST',
      body: JSON.stringify({ virtualUsers }),
    });
  },
};

export const teamApi = {
  listMembers: async () => {
    return apiClient<TeamMember[]>('/api/v1/team/members');
  },

  inviteMember: async (data: CreateInvitationRequest) => {
    return apiClient<OrganizationInvitationItem>('/api/v1/team/invitations', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  listInvitations: async () => {
    return apiClient<OrganizationInvitationItem[]>('/api/v1/team/invitations');
  },

  cancelInvitation: async (id: string) => {
    return apiClient<{ success: boolean }>(`/api/v1/team/invitations/${id}`, {
      method: 'DELETE',
    });
  },

  updateMemberRole: async (id: string, role: UpdateMemberRoleRequest['role']) => {
    return apiClient<TeamMember>(`/api/v1/team/members/${id}/role`, {
      method: 'PATCH',
      body: JSON.stringify({ role }),
    });
  },

  revokeMember: async (id: string) => {
    return apiClient<{ success: boolean }>(`/api/v1/team/members/${id}`, {
      method: 'DELETE',
    });
  },
};




