import { describe, it, expect, beforeEach } from 'vitest';
import * as crypto from 'crypto';
import { OutboxService, StaleWorkerFenceException } from '../../src/outbox/outbox.service';
import { OutboxRelayWorker } from '../../src/outbox/outbox-relay.worker';
import { AuditService } from '../../src/audit/audit.service';
import { createTestDatabase } from '../phase0/pglite-runner';
import { TenantContext } from '@crm/shared-types';

describe('Phase 3: Outbox Engine, Worker Fencing & Lawful Audit Erasure Suite', () => {
  let db: Awaited<ReturnType<typeof createTestDatabase>>;
  let outboxService: OutboxService;
  let outboxWorker: OutboxRelayWorker;
  let auditService: AuditService;

  let tenantAId: string;
  let tenantBId: string;
  let userAId: string;
  let userBId: string;

  let tenantAContext: TenantContext;
  let tenantBContext: TenantContext;

  beforeEach(async () => {
    db = await createTestDatabase();

    // Instantiate services with db wrapper
    outboxService = new OutboxService(db as any);
    outboxWorker = new OutboxRelayWorker(outboxService);
    auditService = new AuditService(db as any);

    // Seed Organizations
    tenantAId = crypto.randomUUID();
    tenantBId = crypto.randomUUID();

    await db.query(
      `INSERT INTO public.organizations (id, name, slug, legal_hold)
       VALUES ($1, 'Acme Corp', 'acme-corp', FALSE),
              ($2, 'Globex Inc', 'globex-inc', TRUE)`,
      [tenantAId, tenantBId],
    );

    // Seed Users & Memberships
    userAId = crypto.randomUUID();
    userBId = crypto.randomUUID();

    await db.query(
      `INSERT INTO public.users (id, email, password_hash, first_name, last_name)
       VALUES ($1, 'admin.a@acme.com', 'argon_hash', 'Alice', 'Admin'),
              ($2, 'admin.b@globex.com', 'argon_hash', 'Bob', 'Admin')`,
      [userAId, userBId],
    );

    await db.query(
      `INSERT INTO public.memberships (id, tenant_id, user_id, role, status)
       VALUES ($1, $2, $3, 'admin', 'active'),
              ($4, $5, $6, 'admin', 'active')`,
      [crypto.randomUUID(), tenantAId, userAId, crypto.randomUUID(), tenantBId, userBId],
    );

    tenantAContext = {
      userId: userAId,
      email: 'admin.a@acme.com',
      tenantId: tenantAId,
      role: 'admin',
      permissions: ['*'],
    };

    tenantBContext = {
      userId: userBId,
      email: 'admin.b@globex.com',
      tenantId: tenantBId,
      role: 'admin',
      permissions: ['*'],
    };
  });

  // =========================================================================
  // TEST 1: ATOMIC OUTBOX CLAIMING & MONOTONIC FENCING TOKENS
  // =========================================================================
  it('1. Outbox Claiming: Atomic claim increments monotonic fence_token and sets status to PROCESSING', async () => {
    // 1. Create outbox events in PENDING status
    const evt1 = await outboxService.createEvent(
      tenantAId,
      userAId,
      'deal.created',
      { dealId: crypto.randomUUID(), value: 50000 },
      `idem-${crypto.randomUUID()}`,
      db,
    );

    expect(evt1.status).toBe('PENDING');
    expect(evt1.fenceToken).toBe(0);

    // 2. Worker 1 claims events
    const workerToken1 = crypto.randomUUID();
    const claim = await outboxService.claimEvents(5, workerToken1, db);

    expect(claim.events.length).toBeGreaterThanOrEqual(1);
    const claimedEvt = claim.events.find((e) => e.id === evt1.id);
    expect(claimedEvt).toBeDefined();
    expect(claimedEvt!.status).toBe('PROCESSING');
    expect(claimedEvt!.claimToken).toBe(workerToken1);
    expect(claimedEvt!.fenceToken).toBe(1); // Monotonic bump from 0 to 1
  });

  // =========================================================================
  // TEST 2: WORKER FENCING & OBSOLETE LEASE REJECTION (SPLIT-BRAIN DEFENSE)
  // =========================================================================
  it('2. Worker Fencing: Obsolete worker update is rejected when fence_token has progressed', async () => {
    // 1. Create outbox event
    const evt = await outboxService.createEvent(
      tenantAId,
      userAId,
      'deal.stage_changed',
      { dealId: crypto.randomUUID(), newStage: 'closed_won' },
      `idem-${crypto.randomUUID()}`,
      db,
    );

    // 2. Worker 1 claims event (gets fence_token = 1)
    const worker1 = crypto.randomUUID();
    const claim1 = await outboxService.claimEvents(1, worker1, db);
    const claimedByW1 = claim1.events[0];
    expect(claimedByW1.fenceToken).toBe(1);

    // 3. Worker 1 hangs or lease expires. Force lease expiration in DB
    await db.query(
      `UPDATE public.outbox_events SET claimed_at = NOW() - INTERVAL '10 minutes' WHERE id = $1`,
      [evt.id],
    );

    // 4. Worker 2 re-claims the timed-out event (gets fence_token = 2)
    const worker2 = crypto.randomUUID();
    const claim2 = await outboxService.claimEvents(1, worker2, db);
    const claimedByW2 = claim2.events[0];
    expect(claimedByW2.fenceToken).toBe(2);

    // 5. Worker 1 awakens and attempts to complete event using obsolete fence_token = 1
    await expect(
      outboxService.completeEvent(evt.id, worker1, claimedByW1.fenceToken, db),
    ).rejects.toThrow(StaleWorkerFenceException);

    // 6. Worker 2 completes event with valid fence_token = 2
    const success = await outboxService.completeEvent(evt.id, worker2, claimedByW2.fenceToken, db);
    expect(success).toBe(true);

    // Verify final state in database
    const finalRows = await db.query(`SELECT status, fence_token FROM public.outbox_events WHERE id = $1`, [evt.id]);
    expect((finalRows.rows[0] as any).status).toBe('PROCESSED');
    expect((finalRows.rows[0] as any).fence_token).toBe(2);
  });

  // =========================================================================
  // TEST 3: HEARTBEAT LEASE RENEWAL
  // =========================================================================
  it('3. Heartbeat Renewal: Renews lease for active worker and rejects invalid token', async () => {
    const evt = await outboxService.createEvent(
      tenantAId,
      userAId,
      'account.created',
      { accountId: crypto.randomUUID() },
      `idem-${crypto.randomUUID()}`,
      db,
    );

    const workerToken = crypto.randomUUID();
    const claim = await outboxService.claimEvents(1, workerToken, db);
    const claimed = claim.events[0];

    // Valid heartbeat renewal
    const renewed = await outboxService.renewHeartbeat(claimed.id, workerToken, claimed.fenceToken, db);
    expect(renewed).toBe(true);

    // Stale fence token renewal rejects
    const staleRenewed = await outboxService.renewHeartbeat(claimed.id, workerToken, claimed.fenceToken + 99, db);
    expect(staleRenewed).toBe(false);
  });

  // =========================================================================
  // TEST 4: UNKNOWN_OUTCOME DEAD-LETTER TRANSITION ON NON-IDEMPOTENT FAILURE
  // =========================================================================
  it('4. Dead-Letter Handling: Non-idempotent provider failure transitions event to UNKNOWN_OUTCOME', async () => {
    const evt = await outboxService.createEvent(
      tenantAId,
      userAId,
      'external.webhook_dispatch',
      { targetUrl: 'https://external-crm.com/api' },
      `idem-${crypto.randomUUID()}`,
      db,
    );

    const workerToken = crypto.randomUUID();
    const claim = await outboxService.claimEvents(1, workerToken, db);
    const claimed = claim.events[0];

    // Fail with isUnknownOutcome = true
    await outboxService.failEvent(
      claimed.id,
      workerToken,
      claimed.fenceToken,
      true,
      'Connection reset during external payment provider handshake',
      db,
    );

    const res = await db.query(`SELECT status FROM public.outbox_events WHERE id = $1`, [evt.id]);
    expect((res.rows[0] as any).status).toBe('UNKNOWN_OUTCOME');
  });

  // =========================================================================
  // TEST 5: ED25519 CRYPTOGRAPHIC TICKET SIGNING & VERIFICATION
  // =========================================================================
  it('5. Cryptographic Tickets: Signs and verifies Ed25519 tickets and rejects tampered tickets', () => {
    const keyPair = auditService.generateEd25519KeyPair();
    const targetEntityId = crypto.randomUUID();

    const ticket = auditService.createErasureTicket(keyPair.privateKey, {
      tenantId: tenantAId,
      targetEntityName: 'contact',
      targetEntityId,
      keyId: 'ed25519-primary-1',
      expiresInSeconds: 300,
    });

    // 1. Verify valid signature
    const isValid = auditService.verifyErasureTicket(keyPair.publicKey, ticket);
    expect(isValid).toBe(true);

    // 2. Tampered ticket payload is rejected
    const tamperedTicket = { ...ticket, targetEntityName: 'deal' };
    const isTamperedValid = auditService.verifyErasureTicket(keyPair.publicKey, tamperedTicket);
    expect(isTamperedValid).toBe(false);

    // 3. Expired ticket is rejected
    const expiredTicket = {
      ...ticket,
      expiresAt: new Date(Date.now() - 60000).toISOString(),
    };
    const isExpiredValid = auditService.verifyErasureTicket(keyPair.publicKey, expiredTicket);
    expect(isExpiredValid).toBe(false);
  });

  // =========================================================================
  // TEST 6: LAWFUL ERASURE STORED PROCEDURE & AMENDMENTS LEDGER
  // =========================================================================
  it('6. Lawful Erasure: redact_entity_audit_history redacts PII and logs to append-only audit_amendments', async () => {
    const contactId = crypto.randomUUID();
    const keyPair = auditService.generateEd25519KeyPair();

    // 1. Seed audit log with PII in child partition
    const piiDiff = {
      first_name: 'John',
      last_name: 'Doe',
      email: 'john.doe@confidential.com',
      phone: '+1-555-0199',
      stage: 'Prospect',
    };
    const originalHash = crypto.createHash('sha256').update(JSON.stringify(piiDiff)).digest('hex');

    await db.query(
      `INSERT INTO public.audit_logs (id, tenant_id, actor_id, entity_name, entity_id, action, diff, entry_hash, created_at)
       VALUES ($1, $2, $3, 'contact', $4, 'INSERT', $5::jsonb, $6, '2026-10-15 10:00:00+00')`,
      [crypto.randomUUID(), tenantAId, userAId, contactId, JSON.stringify(piiDiff), originalHash],
    );

    // 2. Create signed erasure ticket
    const ticket = auditService.createErasureTicket(keyPair.privateKey, {
      tenantId: tenantAId,
      targetEntityName: 'contact',
      targetEntityId: contactId,
      keyId: 'ed25519-primary-1',
      expiresInSeconds: 3600,
    });

    // 3. Execute lawful erasure
    const erasureResult = await auditService.executeLawfulErasure(
      tenantAId,
      tenantAContext,
      { ticket, piiFields: ['email', 'phone', 'first_name', 'last_name'] },
      keyPair.publicKey,
      db,
    );

    expect(erasureResult.success).toBe(true);
    expect(erasureResult.recordsAmended).toBe(1);
    expect(erasureResult.amendments.length).toBe(1);

    // 4. Verify PII was redacted in audit_logs
    const updatedLogRes = await db.query(
      `SELECT diff FROM public.audit_logs WHERE tenant_id = $1 AND entity_id = $2`,
      [tenantAId, contactId],
    );
    const firstRow: any = updatedLogRes.rows[0];
    const updatedDiff = typeof firstRow.diff === 'string'
      ? JSON.parse(firstRow.diff)
      : firstRow.diff;

    expect(updatedDiff.email).toBe('[REDACTED]');
    expect(updatedDiff.phone).toBe('[REDACTED]');
    expect(updatedDiff.first_name).toBe('[REDACTED]');
    expect(updatedDiff.last_name).toBe('[REDACTED]');
    expect(updatedDiff.stage).toBe('Prospect'); // Non-PII retained

    // 5. Verify immutable amendment recorded in audit_amendments
    const amendment = erasureResult.amendments[0];
    expect(amendment.ticketId).toBe(ticket.ticketId);
    expect(amendment.originalEntryHash).toBe(originalHash);
    expect(amendment.amendedContentHash).toBeDefined();

    // 6. Anti-Replay: Attempt to reuse the consumed ticket throws duplicate error
    await expect(
      auditService.executeLawfulErasure(
        tenantAId,
        tenantAContext,
        { ticket },
        keyPair.publicKey,
        db,
      ),
    ).rejects.toThrow(/already been consumed|replay/i);
  });

  // =========================================================================
  // TEST 7: TENANT ISOLATION ON ERASURE TICKETS
  // =========================================================================
  it('7. Tenant Isolation: Rejects ticket issued for another tenant', async () => {
    const keyPair = auditService.generateEd25519KeyPair();
    const contactId = crypto.randomUUID();

    // Ticket signed for Tenant B
    const ticketB = auditService.createErasureTicket(keyPair.privateKey, {
      tenantId: tenantBId,
      targetEntityName: 'contact',
      targetEntityId: contactId,
      keyId: 'ed25519-primary-1',
    });

    // Attempted submission within Tenant A session
    await expect(
      auditService.executeLawfulErasure(
        tenantAId,
        tenantAContext,
        { ticket: ticketB },
        keyPair.publicKey,
        db,
      ),
    ).rejects.toThrow(/Cross-tenant erasure ticket rejected/);
  });

  // =========================================================================
  // TEST 8: FAIL-CLOSED LEGAL HOLD PARTITION RETENTION & PURGE (AD07)
  // =========================================================================
  it('8. Legal Hold & Partition Purge: Slices for held tenants are safely archived and verified before drop', async () => {
    // 1. Seed audit records in partition audit_logs_y2026m10
    // Tenant A (no legal hold) and Tenant B (legal_hold = TRUE)
    await db.query(
      `INSERT INTO public.audit_logs (id, tenant_id, actor_id, entity_name, entity_id, action, diff, entry_hash, created_at)
       VALUES ($1, $2, $3, 'deal', $4, 'INSERT', '{"title":"Deal A"}'::jsonb, 'hashA', '2026-10-20 12:00:00+00'),
              ($5, $6, $7, 'deal', $8, 'INSERT', '{"title":"Deal B"}'::jsonb, 'hashB', '2026-10-20 12:00:00+00')`,
      [
        crypto.randomUUID(), tenantAId, userAId, crypto.randomUUID(),
        crypto.randomUUID(), tenantBId, userBId, crypto.randomUUID(),
      ],
    );

    // 2. Execute fail-closed purge drill
    const result = await auditService.failClosedPartitionPurge('audit_logs_y2026m10', false, db);

    expect(result.success).toBe(true);
    expect(result.detached).toBe(true);
    expect(result.partitionDropped).toBe(true);
    expect(result.failClosedTriggered).toBe(false);

    // 3. Verify Tenant B (Globex Inc, held) slice was extracted and checksummed
    expect(result.heldTenantsExtracted.length).toBe(1);
    const globexArchive = result.heldTenantsExtracted[0];
    expect(globexArchive.tenantId).toBe(tenantBId);
    expect(globexArchive.tenantSlug).toBe('globex-inc');
    expect(globexArchive.recordCount).toBe(1);
    expect(globexArchive.checksumSha256).toBeDefined();
    expect(globexArchive.archivePath).toContain('globex-inc');
  });
});
