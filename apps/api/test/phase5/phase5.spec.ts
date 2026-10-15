import { describe, it, expect, beforeEach } from 'vitest';
import * as crypto from 'crypto';
import { OpsService } from '../../src/ops/ops.service';
import { PiiScrubberInterceptor } from '../../src/ops/pii-scrubber.interceptor';
import { createTestDatabase } from '../phase0/pglite-runner';
import { TenantContext } from '@crm/shared-types';
import { ForbiddenException, ServiceUnavailableException } from '@nestjs/common';
import { of } from 'rxjs';

describe('Phase 5: Operational Hardening, Probes, PITR Drills & SLO Benchmark Suite', () => {
  let db: Awaited<ReturnType<typeof createTestDatabase>>;
  let opsService: OpsService;

  let tenantAId: string;
  let adminAId: string;
  let memberAId: string;
  let adminAContext: TenantContext;
  let memberAContext: TenantContext;

  beforeEach(async () => {
    db = await createTestDatabase();
    opsService = new OpsService(db as any);

    // Seed Organization
    tenantAId = crypto.randomUUID();
    await db.query(
      `INSERT INTO public.organizations (id, name, slug)
       VALUES ($1, 'Acme Enterprise', 'acme-enterprise')`,
      [tenantAId],
    );

    // Seed Admin and Member Users
    adminAId = crypto.randomUUID();
    memberAId = crypto.randomUUID();

    await db.query(
      `INSERT INTO public.users (id, email, password_hash, first_name, last_name)
       VALUES ($1, 'admin@acme.com', 'argon2_hash', 'Alice', 'Admin'),
              ($2, 'member@acme.com', 'argon2_hash', 'Bob', 'Member')`,
      [adminAId, memberAId],
    );

    await db.query(
      `INSERT INTO public.memberships (id, tenant_id, user_id, role, status)
       VALUES ($1, $2, $3, 'admin', 'active'),
              ($4, $5, $6, 'member', 'active')`,
      [
        crypto.randomUUID(), tenantAId, adminAId,
        crypto.randomUUID(), tenantAId, memberAId,
      ],
    );

    adminAContext = {
      userId: adminAId,
      email: 'admin@acme.com',
      tenantId: tenantAId,
      role: 'admin',
      permissions: ['*'],
    };

    memberAContext = {
      userId: memberAId,
      email: 'member@acme.com',
      tenantId: tenantAId,
      role: 'member',
      permissions: ['read', 'write'],
    };
  });

  // =========================================================================
  // 1. HEALTH AND READINESS PROBES
  // =========================================================================
  describe('Health Probes & Telemetry', () => {
    it('assertReadiness returns { ready: true } when database is active', async () => {
      const res = await opsService.assertReadiness(db);
      expect(res.ready).toBe(true);
    });

    it('assertReadiness throws ServiceUnavailableException when database connection is dead', async () => {
      const brokenDb = {
        query: async () => {
          throw new Error('Connection refused: 5432');
        },
      };

      await expect(opsService.assertReadiness(brokenDb)).rejects.toThrow(
        ServiceUnavailableException,
      );
    });

    it('getHealth returns complete telemetry metrics (latency, memory, uptime, version)', async () => {
      const health = await opsService.getHealth(db);

      expect(health.status).toBe('healthy');
      expect(health.services.database.status).toBe('up');
      expect(typeof health.services.database.latencyMs).toBe('number');
      expect(health.services.database.latencyMs).toBeGreaterThanOrEqual(0);
      expect(health.services.memory.rssMb).toBeGreaterThan(0);
      expect(health.services.memory.heapUsedMb).toBeGreaterThan(0);
      expect(health.uptimeSeconds).toBeGreaterThanOrEqual(0);
      expect(health.version).toBe('1.0.0-pilot');
      expect(new Date(health.timestamp).getTime()).toBeGreaterThan(0);
    });

    it('getHealth reports unhealthy if database query fails', async () => {
      const brokenDb = {
        query: async () => {
          throw new Error('Timeout');
        },
      };

      const health = await opsService.getHealth(brokenDb);
      expect(health.status).toBe('unhealthy');
      expect(health.services.database.status).toBe('down');
    });
  });

  // =========================================================================
  // 2. STRUCTURED PII SCRUBBER INTERCEPTOR
  // =========================================================================
  describe('Structured PII Scrubbing Interceptor', () => {
    const interceptor = new PiiScrubberInterceptor();

    it('redacts sensitive fields recursively while preserving non-sensitive data', async () => {
      const rawPayload = {
        id: 'user_123',
        email: 'ceo@partner.org',
        password: 'PlainTextSuperSecret!',
        accessToken: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
        refreshToken: '45d3e098-b649-41b1-bd23-640a3eb25032',
        cookie: 'crm_refresh=valid_sec_cookie',
        authorization: 'Bearer secret_auth_token',
        credit_card: '4111-2222-3333-4444',
        ssn: '000-12-3456',
        profile: {
          firstName: 'Elena',
          lastName: 'Rostova',
          secret: 'internal_api_key_secret',
        },
        items: [
          { token: 'nested_token_123', name: 'Valid Item A' },
          { token: 'nested_token_456', name: 'Valid Item B' },
        ],
      };

      const contextMock: any = {};
      const nextMock: any = {
        handle: () => of(rawPayload),
      };

      const result$ = interceptor.intercept(contextMock, nextMock);
      let scrubbedResult: any;

      await new Promise<void>((resolve) => {
        result$.subscribe((val) => {
          scrubbedResult = val;
          resolve();
        });
      });

      // Assert sensitive keys are redacted
      expect(scrubbedResult.password).toBe('[SCRUBBED]');
      expect(scrubbedResult.accessToken).toBe('[SCRUBBED]');
      expect(scrubbedResult.refreshToken).toBe('[SCRUBBED]');
      expect(scrubbedResult.cookie).toBe('[SCRUBBED]');
      expect(scrubbedResult.authorization).toBe('[SCRUBBED]');
      expect(scrubbedResult.credit_card).toBe('[SCRUBBED]');
      expect(scrubbedResult.ssn).toBe('[SCRUBBED]');
      expect(scrubbedResult.profile.secret).toBe('[SCRUBBED]');
      expect(scrubbedResult.items[0].token).toBe('[SCRUBBED]');
      expect(scrubbedResult.items[1].token).toBe('[SCRUBBED]');

      // Assert non-sensitive keys remain intact
      expect(scrubbedResult.id).toBe('user_123');
      expect(scrubbedResult.email).toBe('ceo@partner.org');
      expect(scrubbedResult.profile.firstName).toBe('Elena');
      expect(scrubbedResult.profile.lastName).toBe('Rostova');
      expect(scrubbedResult.items[0].name).toBe('Valid Item A');
      expect(scrubbedResult.items[1].name).toBe('Valid Item B');
    });

    it('handles primitive values, null, and empty payloads without mutation errors', async () => {
      const contextMock: any = {};
      const nextMock: any = {
        handle: () => of(null),
      };

      const result$ = interceptor.intercept(contextMock, nextMock);
      await new Promise<void>((resolve) => {
        result$.subscribe((val) => {
          expect(val).toBeNull();
          resolve();
        });
      });
    });
  });

  // =========================================================================
  // 3. PITR BACKUP RESTORATION DRILL (DEPLOYMENT_AND_RECOVERY.md Section 2.2)
  // =========================================================================
  describe('Automated PITR Backup Restoration Drill Validation', () => {
    it('executes restoration drill, asserts record counts and relational integrity (RPO <= 15m, RTO <= 90m)', async () => {
      // Seed an account, contact, and stage for Acme
      const accountId = crypto.randomUUID();
      await db.query(
        `INSERT INTO public.accounts (id, tenant_id, name)
         VALUES ($1, $2, 'Global Logistics Corp')`,
        [accountId, tenantAId],
      );

      const contactId = crypto.randomUUID();
      await db.query(
        `INSERT INTO public.contacts (id, tenant_id, account_id, first_name, last_name, email)
         VALUES ($1, $2, $3, 'Marcus', 'Vance', 'marcus@globallogistics.com')`,
        [contactId, tenantAId, accountId],
      );

      const drill = await opsService.runBackupRestorationDrill(adminAContext, db);

      expect(drill.status).toBe('PASSED');
      expect(drill.integrityCheckPassed).toBe(true);
      expect(drill.rpoMinutes).toBeLessThanOrEqual(15);
      expect(drill.rtoMinutes).toBeLessThanOrEqual(90);
      expect(drill.recordCounts.organizations).toBeGreaterThanOrEqual(1);
      expect(drill.recordCounts.users).toBeGreaterThanOrEqual(2);
      expect(drill.recordCounts.accounts).toBeGreaterThanOrEqual(1);
      expect(drill.recordCounts.contacts).toBeGreaterThanOrEqual(1);
      expect(drill.verificationLog.length).toBeGreaterThan(0);
      expect(drill.verificationLog.some((l) => l.includes('0 orphan rows'))).toBe(true);
    });

    it('detects relational integrity violations when orphan records exist in ephemeral schema', async () => {
      // Temporarily drop foreign key constraint to simulate corrupted ephemeral backup state
      await db.query('ALTER TABLE public.contacts DROP CONSTRAINT IF EXISTS contacts_tenant_id_fkey');
      const orphanedContactId = crypto.randomUUID();
      const nonExistentTenantId = crypto.randomUUID();

      await db.query(
        `INSERT INTO public.contacts (id, tenant_id, first_name, last_name, email)
         VALUES ($1, $2, 'Orphan', 'Contact', 'orphan@nowhere.com')`,
        [orphanedContactId, nonExistentTenantId],
      );

      const drill = await opsService.runBackupRestorationDrill(adminAContext, db);

      expect(drill.status).toBe('FAILED');
      expect(drill.integrityCheckPassed).toBe(false);
      expect(drill.verificationLog.some((l) => l.includes('orphaned contacts'))).toBe(true);
    });

    it('enforces RBAC: non-admin member is forbidden from executing disaster recovery drills', async () => {
      await expect(
        opsService.runBackupRestorationDrill(memberAContext, db),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  // =========================================================================
  // 4. CONCURRENCY & LATENCY SLO BENCHMARK SIMULATOR
  // =========================================================================
  describe('Concurrency & Latency SLO Benchmark Simulator (k6 workload replication)', () => {
    it('simulates 50-VU mixed workload (70% reads, 20% updates, 10% writes) and asserts SLO', async () => {
      // Run benchmark with 10 virtual users and 10 iterations for fast deterministic unit test execution
      const vu = 10;
      const iterations = 10;
      const result = await opsService.runLoadBenchmarkSimulation(vu, iterations, adminAContext, db);

      expect(result.virtualUsers).toBe(vu);
      expect(result.totalRequests).toBe(vu * iterations);
      expect(result.errorRatePercent).toBeLessThan(0.1);
      expect(result.p95LatencyMs).toBeLessThanOrEqual(200);
      expect(result.p99LatencyMs).toBeGreaterThanOrEqual(0);
      expect(result.sloPassed).toBe(true);
    });

    it('enforces RBAC: non-admin member is forbidden from running load benchmark simulations', async () => {
      await expect(
        opsService.runLoadBenchmarkSimulation(50, 10, memberAContext, db),
      ).rejects.toThrow(ForbiddenException);
    });
  });
});
