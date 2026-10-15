// Core Multi-Tenant CRM Shared Types

export type UserRole = 'owner' | 'admin' | 'member' | 'read_only';
export type MembershipStatus = 'active' | 'suspended' | 'revoked';
export type InvitationStatus = 'pending' | 'accepted' | 'revoked' | 'expired';

export interface TenantContext {
  userId: string;
  tenantId: string;
  role: UserRole;
  sessionVersion?: number;
  email?: string;
  permissions?: string[];
}

export interface User {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  isSuperadmin: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Organization {
  id: string;
  name: string;
  slug: string;
  status: 'active' | 'decommissioned';
  legalHold: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Membership {
  id: string;
  tenantId: string;
  userId: string;
  role: UserRole;
  status: MembershipStatus;
  sessionVersion: number;
  createdAt: string;
  updatedAt: string;
}

export interface Account {
  id: string;
  tenantId: string;
  ownerId: string | null;
  name: string;
  domain: string | null;
  industry: string | null;
  annualRevenue: string | null;
  deletedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface Contact {
  id: string;
  tenantId: string;
  accountId: string | null;
  ownerId: string | null;
  firstName: string;
  lastName: string;
  email: string | null;
  phone: string | null;
  jobTitle: string | null;
  deletedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface Pipeline {
  id: string;
  tenantId: string;
  name: string;
  isDefault: boolean;
  createdAt: string;
}

export interface DealStage {
  id: string;
  tenantId: string;
  pipelineId: string;
  name: string;
  displayOrder: number;
  probabilityPercentage: number;
  isWon: boolean;
  isLost: boolean;
  createdAt: string;
}

export interface Deal {
  id: string;
  tenantId: string;
  title: string;
  value: string;
  currency: string;
  accountId: string | null;
  primaryContactId: string | null;
  pipelineId: string;
  stageId: string;
  ownerId: string | null;
  version: number;
  expectedCloseDate: string | null;
  lostReason: string | null;
  deletedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface Activity {
  id: string;
  tenantId: string;
  type: 'note' | 'task' | 'call' | 'stage_change';
  subject: string;
  body: string | null;
  dueDate: string | null;
  completedAt: string | null;
  dealId: string | null;
  contactId: string | null;
  accountId: string | null;
  createdById: string;
  createdAt: string;
}

export interface TenantQuota {
  tenantId: string;
  metric: 'active_deals' | 'seats';
  currentCount: number;
  maxLimit: number;
  updatedAt: string;
}

export interface OutboxEvent {
  id: string;
  tenantId: string;
  actorId: string | null;
  eventType: string;
  payload: Record<string, unknown>;
  status: 'PENDING' | 'ENQUEUED' | 'PROCESSING' | 'PROCESSED' | 'FAILED' | 'UNKNOWN_OUTCOME';
  claimToken: string | null;
  fenceToken: number;
  claimedAt: string | null;
  idempotencyKey: string;
  createdAt: string;
  updatedAt: string;
}

export interface ApiErrorResponse {
  type: string;
  title: string;
  status: number;
  detail: string;
  instance: string;
  traceId: string;
  errors?: Array<{ field: string; message: string }>;
}

export interface RegisterRequest {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  organizationName: string;
  organizationSlug: string;
}

export interface LoginRequest {
  email: string;
  password: string;
  tenantId?: string;
}

export interface AuthResponse {
  accessToken: string;
  user: {
    id: string;
    email: string;
    firstName: string;
    lastName: string;
  };
  organization: {
    id: string;
    name: string;
    slug: string;
    role: UserRole;
  };
  availableOrganizations: Array<{
    id: string;
    name: string;
    slug: string;
    role: UserRole;
  }>;
}

export interface SwitchOrganizationRequest {
  targetTenantId: string;
}

export interface AcceptInvitationRequest {
  invitationToken: string;
  password?: string;
  firstName?: string;
  lastName?: string;
}

export interface PasswordResetRequest {
  email: string;
}

export interface PasswordResetConfirmRequest {
  resetToken: string;
  newPassword: string;
}

export interface PaginatedResponse<T> {
  data: T[];
  meta: {
    limit: number;
    hasNextPage: boolean;
    nextCursor?: string;
  };
}

export interface CreateAccountRequest {
  name: string;
  domain?: string | null;
  industry?: string | null;
  annualRevenue?: string | null;
  ownerId?: string | null;
}

export interface UpdateAccountRequest {
  name?: string;
  domain?: string | null;
  industry?: string | null;
  annualRevenue?: string | null;
  ownerId?: string | null;
}

export interface CreateContactRequest {
  firstName: string;
  lastName: string;
  email?: string | null;
  phone?: string | null;
  jobTitle?: string | null;
  accountId?: string | null;
  ownerId?: string | null;
}

export interface UpdateContactRequest {
  firstName?: string;
  lastName?: string;
  email?: string | null;
  phone?: string | null;
  jobTitle?: string | null;
  accountId?: string | null;
  ownerId?: string | null;
}

export interface CreateDealRequest {
  title: string;
  value: string;
  currency?: string;
  pipelineId: string;
  stageId: string;
  accountId?: string | null;
  primaryContactId?: string | null;
  ownerId?: string | null;
  expectedCloseDate?: string | null;
}

export interface UpdateDealRequest {
  title?: string;
  value?: string;
  currency?: string;
  accountId?: string | null;
  primaryContactId?: string | null;
  ownerId?: string | null;
  expectedCloseDate?: string | null;
  lostReason?: string | null;
  expectedVersion: number;
}

export interface TransitionDealStageRequest {
  newStageId: string;
  expectedVersion: number;
  lostReason?: string | null;
}

export interface CreateActivityRequest {
  type: 'note' | 'task' | 'call' | 'stage_change';
  subject: string;
  body?: string | null;
  dueDate?: string | null;
  dealId?: string | null;
  contactId?: string | null;
  accountId?: string | null;
}

// ==========================================
// PHASE 3: OUTBOX, AUDIT REDACTION & LEGAL HOLD
// ==========================================

export interface AuditLog {
  id: string;
  tenantId: string;
  actorId: string | null;
  entityName: string;
  entityId: string;
  action: string;
  diff: Record<string, unknown>;
  entryHash: string;
  createdAt: string;
}

export interface AuditAmendment {
  id: string;
  auditLogId: string;
  tenantId: string;
  targetEntityName: string;
  targetEntityId: string;
  originalEntryHash: string;
  amendedContentHash: string;
  ticketId: string;
  keyId: string;
  canonicalPayloadHash: string;
  authorizationSignature: string;
  amendedAt: string;
}

export interface ErasureTicketPayload {
  ticketId: string;
  tenantId: string;
  targetEntityName: string;
  targetEntityId: string;
  keyId: string;
  expiresAt: string;
  canonicalPayloadHash: string;
}

export interface SignedErasureTicket extends ErasureTicketPayload {
  authorizationSignature: string;
}

export interface LawfulErasureRequest {
  ticket: SignedErasureTicket;
  piiFields?: string[];
}

export interface LawfulErasureResponse {
  success: boolean;
  recordsAmended: number;
  amendments: AuditAmendment[];
}

export interface ClaimOutboxResult {
  claimed: OutboxEvent[];
  claimToken: string;
}

export interface CompleteOutboxRequest {
  claimToken: string;
  fenceToken: number;
  outcome?: 'PROCESSED' | 'UNKNOWN_OUTCOME' | 'FAILED';
  errorMessage?: string;
}

export interface SetLegalHoldRequest {
  legalHold: boolean;
}

export interface PartitionPurgeRequest {
  partitionName: string;
  dryRun?: boolean;
}

export interface HeldTenantSliceArchive {
  tenantId: string;
  tenantSlug: string;
  recordCount: number;
  checksumSha256: string;
  archivePath: string;
}

export interface PartitionPurgeResponse {
  success: boolean;
  partitionName: string;
  detached: boolean;
  heldTenantsExtracted: HeldTenantSliceArchive[];
  partitionDropped: boolean;
  failClosedTriggered: boolean;
  reason?: string;
}

// ==========================================
// PHASE 4: CSV ENGINE & FRONTEND ASSEMBLY
// ==========================================

export interface ExportSnapshot {
  id: string;
  tenantId: string;
  outboxId: string;
  generationId: number;
  workerToken: string | null;
  status: 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED';
  totalChunks: number;
  sha256Checksum: string | null;
  byteLength: string;
  createdAt: string;
}

export interface CreateExportRequest {
  entityType: 'contacts' | 'deals';
}

export interface ExportDownloadResponse {
  id: string;
  status: string;
  totalChunks: number;
  sha256Checksum: string | null;
  byteLength: string;
  csvContent?: string;
}

export type DeduplicationMode = 'SKIP' | 'UPDATE' | 'CREATE_ALL';

export interface ImportJob {
  id: string;
  tenantId: string;
  actorId: string;
  entityName: string;
  status: 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED';
  deduplicationMode: DeduplicationMode;
  totalRows: number;
  processedRows: number;
  successfulRows: number;
  failedRows: number;
  errorSummary: Array<{ row: number; error: string }>;
  createdAt: string;
  updatedAt: string;
}

export interface CreateImportRequest {
  entityName?: 'contact';
  deduplicationMode: DeduplicationMode;
  csvData: string;
}

export interface ResumeImportRequest {
  chunkSize?: number;
}

// ==========================================
// PHASE 5: OPERATIONAL HARDENING & PILOT LAUNCH
// ==========================================

export interface SystemHealthResponse {
  status: 'healthy' | 'degraded' | 'unhealthy';
  timestamp: string;
  services: {
    database: { status: 'up' | 'down'; latencyMs: number };
    redis: { status: 'up' | 'down' | 'unconfigured'; latencyMs?: number };
    memory: { rssMb: number; heapUsedMb: number };
  };
  version: string;
  uptimeSeconds: number;
}

export interface BackupDrillResult {
  drillId: string;
  timestamp: string;
  status: 'PASSED' | 'FAILED';
  simulatedTargetTimestamp: string;
  rpoMinutes: number;
  rtoMinutes: number;
  recordCounts: {
    organizations: number;
    users: number;
    accounts: number;
    contacts: number;
    deals: number;
    activities: number;
  };
  integrityCheckPassed: boolean;
  verificationLog: string[];
}

export interface LoadBenchmarkSummary {
  virtualUsers: number;
  totalRequests: number;
  p95LatencyMs: number;
  p99LatencyMs: number;
  errorRatePercent: number;
  sloPassed: boolean;
}

// ==========================================
// TEAM & ORGANIZATION MEMBERSHIP DELIVERABLE
// ==========================================

export interface TeamMember {
  id: string; // membership id
  userId: string;
  email: string;
  firstName: string;
  lastName: string;
  role: UserRole;
  status: 'active' | 'invited' | 'suspended' | 'revoked';
  sessionVersion: number;
  joinedAt: string;
}

export interface OrganizationInvitationItem {
  id: string;
  tenantId: string;
  email: string;
  role: UserRole;
  status: 'pending' | 'accepted' | 'cancelled' | 'expired';
  expiresAt: string;
  createdAt: string;
  invitationToken?: string;
}

export interface CreateInvitationRequest {
  email: string;
  role: 'admin' | 'member' | 'read_only';
}

export interface UpdateMemberRoleRequest {
  role: 'admin' | 'member' | 'read_only';
}






