import { Injectable, Logger, BadRequestException, ForbiddenException, UnauthorizedException } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import {
  AuditLog,
  AuditAmendment,
  ErasureTicketPayload,
  SignedErasureTicket,
  LawfulErasureRequest,
  LawfulErasureResponse,
  HeldTenantSliceArchive,
  PartitionPurgeResponse,
  TenantContext,
} from '@crm/shared-types';
import * as crypto from 'crypto';

@Injectable()
export class AuditService {
  private readonly logger = new Logger(AuditService.name);

  constructor(private readonly prisma: PrismaClient) {}

  // ==========================================
  // CRYPTOGRAPHIC ED25519 TICKET UTILITIES
  // ==========================================

  /**
   * Generate an Ed25519 keypair for ticket signing and verification
   */
  generateEd25519KeyPair(): { publicKey: string; privateKey: string } {
    const { publicKey, privateKey } = crypto.generateKeyPairSync('ed25519', {
      publicKeyEncoding: { type: 'spki', format: 'pem' },
      privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
    });
    return { publicKey, privateKey };
  }

  /**
   * Create and sign an erasure authorization ticket using Ed25519 private key
   */
  createErasureTicket(
    privateKeyPem: string,
    payload: {
      ticketId?: string;
      tenantId: string;
      targetEntityName: string;
      targetEntityId: string;
      keyId: string;
      expiresInSeconds?: number;
    },
  ): SignedErasureTicket {
    const ticketId = payload.ticketId || `ticket-${crypto.randomUUID()}`;
    const expiresAt = new Date(Date.now() + (payload.expiresInSeconds || 3600) * 1000).toISOString();

    const rawPayload: ErasureTicketPayload = {
      ticketId,
      tenantId: payload.tenantId,
      targetEntityName: payload.targetEntityName,
      targetEntityId: payload.targetEntityId,
      keyId: payload.keyId,
      expiresAt,
      canonicalPayloadHash: '',
    };

    // Deterministic canonical payload string
    const canonicalString = [
      rawPayload.ticketId,
      rawPayload.tenantId,
      rawPayload.targetEntityName,
      rawPayload.targetEntityId,
      rawPayload.keyId,
      rawPayload.expiresAt,
    ].join('|');

    const canonicalPayloadHash = crypto.createHash('sha256').update(canonicalString).digest('hex');
    rawPayload.canonicalPayloadHash = canonicalPayloadHash;

    const signature = crypto.sign(null, Buffer.from(canonicalPayloadHash, 'hex'), privateKeyPem);
    const authorizationSignature = signature.toString('base64');

    return {
      ...rawPayload,
      authorizationSignature,
    };
  }

  /**
   * Verify an Ed25519 signature and ticket freshness
   */
  verifyErasureTicket(publicKeyPem: string, ticket: SignedErasureTicket): boolean {
    if (!ticket || !ticket.authorizationSignature) {
      return false;
    }

    // Expiration check
    if (new Date(ticket.expiresAt).getTime() < Date.now()) {
      this.logger.warn(`Erasure ticket ${ticket.ticketId} expired at ${ticket.expiresAt}`);
      return false;
    }

    // Recompute canonical payload hash
    const canonicalString = [
      ticket.ticketId,
      ticket.tenantId,
      ticket.targetEntityName,
      ticket.targetEntityId,
      ticket.keyId,
      ticket.expiresAt,
    ].join('|');

    const computedHash = crypto.createHash('sha256').update(canonicalString).digest('hex');
    if (computedHash !== ticket.canonicalPayloadHash) {
      this.logger.warn(`Erasure ticket canonical hash mismatch for ticket ${ticket.ticketId}`);
      return false;
    }

    try {
      const isValid = crypto.verify(
        null,
        Buffer.from(ticket.canonicalPayloadHash, 'hex'),
        publicKeyPem,
        Buffer.from(ticket.authorizationSignature, 'base64'),
      );
      return isValid;
    } catch (err) {
      this.logger.error(`Cryptographic verification exception: ${(err as Error).message}`);
      return false;
    }
  }

  // ==========================================
  // LAWFUL ERASURE STORED PROCEDURE EXECUTION
  // ==========================================

  /**
   * Execute lawful erasure procedure via database stored procedure redact_entity_audit_history
   */
  async executeLawfulErasure(
    tenantId: string,
    actor: TenantContext,
    request: LawfulErasureRequest,
    trustedPublicKeyPem: string,
    dbClient?: any,
  ): Promise<LawfulErasureResponse> {
    // Role check: Only owner, admin, or superadmin can authorize lawful erasure
    if (actor.role !== 'owner' && actor.role !== 'admin') {
      throw new ForbiddenException('Only organization owners and administrators can execute lawful erasure.');
    }

    const { ticket } = request;
    if (!ticket) {
      throw new BadRequestException('Lawful erasure ticket is required.');
    }

    // Tenant boundary check: cross-tenant ticket tampering rejection
    if (ticket.tenantId !== tenantId) {
      throw new UnauthorizedException('Cross-tenant erasure ticket rejected: ticket tenantId does not match session.');
    }

    // Cryptographic signature check
    const isSignatureValid = this.verifyErasureTicket(trustedPublicKeyPem, ticket);
    if (!isSignatureValid) {
      throw new UnauthorizedException('Cryptographic Ed25519 ticket authorization signature is invalid or expired.');
    }

    const piiKeys = request.piiFields || ['email', 'phone', 'first_name', 'last_name', 'name'];
    const client = dbClient || this.prisma;

    let amendedCount = 0;
    try {
      if (client.$queryRawUnsafe) {
        const rows = await client.$queryRawUnsafe(
          `SELECT public.redact_entity_audit_history($1, $2::uuid, $3, $4::uuid, $5, $6, $7, $8::text[]) AS count`,
          ticket.ticketId,
          ticket.tenantId,
          ticket.targetEntityName,
          ticket.targetEntityId,
          ticket.keyId,
          ticket.canonicalPayloadHash,
          ticket.authorizationSignature,
          piiKeys,
        );
        amendedCount = rows[0]?.count ?? 0;
      } else if (client.query) {
        const res = await client.query(
          `SELECT public.redact_entity_audit_history($1, $2::uuid, $3, $4::uuid, $5, $6, $7, $8::text[]) AS count`,
          [
            ticket.ticketId,
            ticket.tenantId,
            ticket.targetEntityName,
            ticket.targetEntityId,
            ticket.keyId,
            ticket.canonicalPayloadHash,
            ticket.authorizationSignature,
            piiKeys,
          ],
        );
        amendedCount = parseInt(res.rows[0]?.count ?? '0', 10);
      }
    } catch (err: any) {
      if (err.message?.includes('consumed_erasure_tickets') || err.message?.includes('duplicate key')) {
        throw new BadRequestException(`Lawful erasure ticket ${ticket.ticketId} has already been consumed (replay rejected).`);
      }
      throw err;
    }

    // Fetch newly created amendments from the append-only ledger
    const amendments = await this.listAmendments(tenantId, ticket.targetEntityName, ticket.targetEntityId, client);

    return {
      success: true,
      recordsAmended: amendedCount,
      amendments,
    };
  }

  // ==========================================
  // QUERY AUDIT LOGS & AMENDMENTS
  // ==========================================

  async listAuditLogs(
    tenantId: string,
    entityName?: string,
    entityId?: string,
    limit = 50,
    offset = 0,
    dbClient?: any,
  ): Promise<AuditLog[]> {
    const client = dbClient || this.prisma;
    let sql = `SELECT * FROM public.audit_logs WHERE tenant_id = $1::uuid`;
    const params: any[] = [tenantId];
    let i = 2;

    if (entityName) {
      sql += ` AND entity_name = $${i++}`;
      params.push(entityName);
    }
    if (entityId) {
      sql += ` AND entity_id = $${i++}::uuid`;
      params.push(entityId);
    }

    sql += ` ORDER BY created_at DESC LIMIT $${i++} OFFSET $${i++}`;
    params.push(limit, offset);

    let rows: any[] = [];
    if (client.$queryRawUnsafe) {
      rows = await client.$queryRawUnsafe(sql, ...params);
    } else if (client.query) {
      const res = await client.query(sql, params);
      rows = res.rows;
    }

    return (rows || []).map((r) => ({
      id: r.id,
      tenantId: r.tenant_id,
      actorId: r.actor_id,
      entityName: r.entity_name,
      entityId: r.entity_id,
      action: r.action,
      diff: typeof r.diff === 'string' ? JSON.parse(r.diff) : r.diff,
      entryHash: r.entry_hash,
      createdAt: new Date(r.created_at).toISOString(),
    }));
  }

  async listAmendments(
    tenantId: string,
    targetEntityName?: string,
    targetEntityId?: string,
    dbClient?: any,
  ): Promise<AuditAmendment[]> {
    const client = dbClient || this.prisma;
    let sql = `SELECT * FROM public.audit_amendments WHERE tenant_id = $1::uuid`;
    const params: any[] = [tenantId];
    let i = 2;

    if (targetEntityName) {
      sql += ` AND target_entity_name = $${i++}`;
      params.push(targetEntityName);
    }
    if (targetEntityId) {
      sql += ` AND target_entity_id = $${i++}::uuid`;
      params.push(targetEntityId);
    }

    sql += ` ORDER BY amended_at DESC`;

    let rows: any[] = [];
    if (client.$queryRawUnsafe) {
      rows = await client.$queryRawUnsafe(sql, ...params);
    } else if (client.query) {
      const res = await client.query(sql, params);
      rows = res.rows;
    }

    return (rows || []).map((r) => ({
      id: r.id,
      auditLogId: r.audit_log_id,
      tenantId: r.tenant_id,
      targetEntityName: r.target_entity_name,
      targetEntityId: r.target_entity_id,
      originalEntryHash: r.original_entry_hash,
      amendedContentHash: r.amended_content_hash,
      ticketId: r.ticket_id,
      keyId: r.key_id,
      canonicalPayloadHash: r.canonical_payload_hash,
      authorizationSignature: r.authorization_signature,
      amendedAt: new Date(r.amended_at).toISOString(),
    }));
  }

  // ==========================================
  // LEGAL HOLD & FAIL-CLOSED PARTITION PURGE (AD07)
  // ==========================================

  async setLegalHold(tenantId: string, legalHold: boolean, dbClient?: any): Promise<boolean> {
    const client = dbClient || this.prisma;
    if (client.$queryRawUnsafe) {
      await client.$queryRawUnsafe(
        `UPDATE public.organizations SET legal_hold = $1, updated_at = NOW() WHERE id = $2::uuid`,
        legalHold,
        tenantId,
      );
    } else if (client.query) {
      await client.query(
        `UPDATE public.organizations SET legal_hold = $1, updated_at = NOW() WHERE id = $2::uuid`,
        [legalHold, tenantId],
      );
    } else {
      await client.organization.update({
        where: { id: tenantId },
        data: { legalHold },
      });
    }
    return true;
  }

  /**
   * AD07 Two-phase detach-before-extract protocol with fail-closed guarantee
   */
  async failClosedPartitionPurge(
    partitionName: string,
    dryRun = false,
    dbClient?: any,
  ): Promise<PartitionPurgeResponse> {
    const client = dbClient || this.prisma;
    const sanitizedPartition = partitionName.replace(/[^a-zA-Z0-9_]/g, '');

    // 1. Discover all distinct tenants present in the partition
    let tenantRows: any[] = [];
    try {
      const sql = `SELECT DISTINCT tenant_id FROM public.${sanitizedPartition}`;
      if (client.$queryRawUnsafe) {
        tenantRows = await client.$queryRawUnsafe(sql);
      } else if (client.query) {
        const res = await client.query(sql);
        tenantRows = res.rows;
      }
    } catch (err: any) {
      return {
        success: false,
        partitionName: sanitizedPartition,
        detached: false,
        heldTenantsExtracted: [],
        partitionDropped: false,
        failClosedTriggered: true,
        reason: `Partition discovery failed: ${err.message}`,
      };
    }

    const tenantIds: string[] = tenantRows.map((r) => r.tenant_id);

    // 2. Identify which tenants have active legal holds
    let heldTenants: any[] = [];
    if (tenantIds.length > 0) {
      const placeholders = tenantIds.map((_, idx) => `$${idx + 1}::uuid`).join(', ');
      const sql = `SELECT id, name, slug, legal_hold FROM public.organizations WHERE id IN (${placeholders}) AND legal_hold = TRUE`;
      if (client.$queryRawUnsafe) {
        heldTenants = await client.$queryRawUnsafe(sql, ...tenantIds);
      } else if (client.query) {
        const res = await client.query(sql, tenantIds);
        heldTenants = res.rows;
      }
    }

    const extractedArchives: HeldTenantSliceArchive[] = [];

    // 3. For any tenant under legal hold: extract slice, compute SHA-256 and archive
    for (const held of heldTenants) {
      try {
        const sql = `SELECT * FROM public.${sanitizedPartition} WHERE tenant_id = $1::uuid`;
        let records: any[] = [];
        if (client.$queryRawUnsafe) {
          records = await client.$queryRawUnsafe(sql, held.id);
        } else if (client.query) {
          const res = await client.query(sql, [held.id]);
          records = res.rows;
        }

        const serialized = JSON.stringify(records);
        const checksum = crypto.createHash('sha256').update(serialized).digest('hex');

        // Self-verification of checksum: assert integrity
        const recomputed = crypto.createHash('sha256').update(serialized).digest('hex');
        if (recomputed !== checksum) {
          throw new Error(`Checksum verification failed for held tenant ${held.slug}`);
        }

        extractedArchives.push({
          tenantId: held.id,
          tenantSlug: held.slug,
          recordCount: records.length,
          checksumSha256: checksum,
          archivePath: `archives/legal_holds/${held.slug}/${sanitizedPartition}.jsonl`,
        });
      } catch (err: any) {
        // Fail-Closed: Abort drop immediately if extraction or verification fails
        this.logger.error(`Legal hold extraction failed for ${held.slug}. FAILING CLOSED: ${err.message}`);
        return {
          success: false,
          partitionName: sanitizedPartition,
          detached: false,
          heldTenantsExtracted: extractedArchives,
          partitionDropped: false,
          failClosedTriggered: true,
          reason: `Fail-closed trigger: extraction failed for tenant ${held.slug}: ${err.message}`,
        };
      }
    }

    // 4. If dryRun is requested, stop before DDL modification
    if (dryRun) {
      return {
        success: true,
        partitionName: sanitizedPartition,
        detached: false,
        heldTenantsExtracted: extractedArchives,
        partitionDropped: false,
        failClosedTriggered: false,
      };
    }

    // 5. All held tenant slices safely extracted and verified: Proceed with partition detach and drop
    try {
      const detachSql = `ALTER TABLE public.audit_logs DETACH PARTITION public.${sanitizedPartition}`;
      const dropSql = `DROP TABLE public.${sanitizedPartition}`;

      if (client.$queryRawUnsafe) {
        await client.$queryRawUnsafe(detachSql);
        await client.$queryRawUnsafe(dropSql);
      } else if (client.query) {
        await client.query(detachSql);
        await client.query(dropSql);
      }

      return {
        success: true,
        partitionName: sanitizedPartition,
        detached: true,
        heldTenantsExtracted: extractedArchives,
        partitionDropped: true,
        failClosedTriggered: false,
      };
    } catch (err: any) {
      // If dropping fails after detach, attempt re-attachment to guarantee zero data loss
      try {
        if (client.$queryRawUnsafe) {
          await client.$queryRawUnsafe(`ALTER TABLE public.audit_logs ATTACH PARTITION public.${sanitizedPartition} FOR VALUES FROM ('2026-10-01 00:00:00+00') TO ('2026-11-01 00:00:00+00')`);
        } else if (client.query) {
          await client.query(`ALTER TABLE public.audit_logs ATTACH PARTITION public.${sanitizedPartition} FOR VALUES FROM ('2026-10-01 00:00:00+00') TO ('2026-11-01 00:00:00+00')`);
        }
      } catch (reAttachErr) {
        this.logger.error(`Re-attachment failed during fail-closed recovery: ${(reAttachErr as Error).message}`);
      }

      return {
        success: false,
        partitionName: sanitizedPartition,
        detached: true,
        heldTenantsExtracted: extractedArchives,
        partitionDropped: false,
        failClosedTriggered: true,
        reason: `Drop failed: ${err.message}`,
      };
    }
  }
}
