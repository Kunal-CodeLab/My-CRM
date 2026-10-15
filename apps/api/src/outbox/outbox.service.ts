import { Injectable, Logger, ConflictException } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { OutboxEvent } from '@crm/shared-types';
import * as crypto from 'crypto';

export class StaleWorkerFenceException extends ConflictException {
  constructor(message = 'Outbox event fencing token is obsolete. Lease was reclaimed by another worker.') {
    super(message);
  }
}

@Injectable()
export class OutboxService {
  private readonly logger = new Logger(OutboxService.name);

  constructor(private readonly prisma: PrismaClient) {}

  /**
   * Insert an outbox event within a domain transaction
   */
  async createEvent(
    tenantId: string,
    actorId: string | null,
    eventType: string,
    payload: Record<string, any>,
    idempotencyKey?: string,
    dbClient?: any,
  ): Promise<OutboxEvent> {
    const key = idempotencyKey || `${tenantId}:${eventType}:${crypto.randomUUID()}`;
    const client = dbClient || this.prisma;

    if (client.$queryRawUnsafe) {
      const rows = await client.$queryRawUnsafe(
        `INSERT INTO public.outbox_events (tenant_id, actor_id, event_type, payload, idempotency_key, status)
         VALUES ($1::uuid, $2::uuid, $3, $4::jsonb, $5, 'PENDING')
         RETURNING *`,
        tenantId,
        actorId,
        eventType,
        JSON.stringify(payload),
        key,
      );
      const r = rows[0];
      return this.mapRow(r);
    } else if (client.query) {
      const res = await client.query(
        `INSERT INTO public.outbox_events (tenant_id, actor_id, event_type, payload, idempotency_key, status)
         VALUES ($1::uuid, $2::uuid, $3, $4::jsonb, $5, 'PENDING')
         RETURNING *`,
        [tenantId, actorId, eventType, JSON.stringify(payload), key],
      );
      const r = res.rows[0];
      return this.mapRow(r);
    } else {
      const created = await client.outboxEvent.create({
        data: {
          tenantId,
          actorId,
          eventType,
          payload,
          idempotencyKey: key,
          status: 'PENDING',
        },
      });
      return {
        id: created.id,
        tenantId: created.tenantId,
        actorId: created.actorId,
        eventType: created.eventType,
        payload: created.payload as Record<string, unknown>,
        status: created.status as any,
        claimToken: created.claimToken,
        fenceToken: created.fenceToken,
        claimedAt: created.claimedAt ? created.claimedAt.toISOString() : null,
        idempotencyKey: created.idempotencyKey,
        createdAt: created.createdAt.toISOString(),
        updatedAt: created.updatedAt.toISOString(),
      };
    }
  }

  /**
   * Atomic claim of pending or timed-out outbox events with monotonic fence token
   */
  async claimEvents(limit = 10, workerToken?: string, dbClient?: any): Promise<{ events: OutboxEvent[]; claimToken: string }> {
    const claimToken = workerToken || crypto.randomUUID();
    const client = dbClient || this.prisma;

    const sql = `
      WITH claimable AS (
        SELECT id
        FROM public.outbox_events
        WHERE status = 'PENDING'
           OR (status = 'PROCESSING' AND claimed_at < NOW() - INTERVAL '5 minutes')
        ORDER BY created_at ASC
        LIMIT $1
        FOR UPDATE SKIP LOCKED
      )
      UPDATE public.outbox_events o
      SET
        status = 'PROCESSING',
        claim_token = $2::uuid,
        fence_token = o.fence_token + 1,
        claimed_at = NOW(),
        updated_at = NOW()
      FROM claimable
      WHERE o.id = claimable.id
      RETURNING o.*;
    `;

    let rows: any[] = [];
    if (client.$queryRawUnsafe) {
      rows = await client.$queryRawUnsafe(sql, limit, claimToken);
    } else if (client.query) {
      const res = await client.query(sql, [limit, claimToken]);
      rows = res.rows;
    }

    const events = (rows || []).map((r) => this.mapRow(r));
    return { events, claimToken };
  }

  /**
   * Renew worker heartbeat lease (asserts matching claim_token and fence_token)
   */
  async renewHeartbeat(eventId: string, claimToken: string, fenceToken: number, dbClient?: any): Promise<boolean> {
    const client = dbClient || this.prisma;
    const sql = `
      UPDATE public.outbox_events
      SET claimed_at = NOW(), updated_at = NOW()
      WHERE id = $1::uuid
        AND claim_token = $2::uuid
        AND fence_token = $3
        AND status = 'PROCESSING'
      RETURNING id;
    `;

    let rows: any[] = [];
    if (client.$queryRawUnsafe) {
      rows = await client.$queryRawUnsafe(sql, eventId, claimToken, fenceToken);
    } else if (client.query) {
      const res = await client.query(sql, [eventId, claimToken, fenceToken]);
      rows = res.rows;
    }

    return (rows && rows.length > 0);
  }

  /**
   * Complete outbox event execution with strict monotonic fencing verification
   */
  async completeEvent(eventId: string, claimToken: string, fenceToken: number, dbClient?: any): Promise<boolean> {
    const client = dbClient || this.prisma;
    const sql = `
      UPDATE public.outbox_events
      SET status = 'PROCESSED', updated_at = NOW()
      WHERE id = $1::uuid
        AND claim_token = $2::uuid
        AND fence_token = $3
        AND status = 'PROCESSING'
      RETURNING id;
    `;

    let rows: any[] = [];
    if (client.$queryRawUnsafe) {
      rows = await client.$queryRawUnsafe(sql, eventId, claimToken, fenceToken);
    } else if (client.query) {
      const res = await client.query(sql, [eventId, claimToken, fenceToken]);
      rows = res.rows;
    }

    if (!rows || rows.length === 0) {
      this.logger.warn(`Failed to complete outbox event ${eventId}: obsolete fence_token ${fenceToken} or invalid claim`);
      throw new StaleWorkerFenceException();
    }

    return true;
  }

  /**
   * Transition outbox event on failure (UNKNOWN_OUTCOME for non-idempotent crash, FAILED otherwise)
   */
  async failEvent(
    eventId: string,
    claimToken: string,
    fenceToken: number,
    isUnknownOutcome = false,
    errorMessage?: string,
    dbClient?: any,
  ): Promise<boolean> {
    const client = dbClient || this.prisma;
    const nextStatus = isUnknownOutcome ? 'UNKNOWN_OUTCOME' : 'FAILED';
    const sql = `
      UPDATE public.outbox_events
      SET status = $4,
          updated_at = NOW()
      WHERE id = $1::uuid
        AND claim_token = $2::uuid
        AND fence_token = $3
      RETURNING id;
    `;

    let rows: any[] = [];
    if (client.$queryRawUnsafe) {
      rows = await client.$queryRawUnsafe(sql, eventId, claimToken, fenceToken, nextStatus);
    } else if (client.query) {
      const res = await client.query(sql, [eventId, claimToken, fenceToken, nextStatus]);
      rows = res.rows;
    }

    if (!rows || rows.length === 0) {
      throw new StaleWorkerFenceException();
    }

    return true;
  }

  /**
   * List outbox events for tenant
   */
  async listEvents(tenantId: string, status?: string, limit = 50, offset = 0, dbClient?: any): Promise<OutboxEvent[]> {
    const client = dbClient || this.prisma;
    let sql = `SELECT * FROM public.outbox_events WHERE tenant_id = $1::uuid`;
    const params: any[] = [tenantId];
    let i = 2;

    if (status) {
      sql += ` AND status = $${i++}`;
      params.push(status);
    }

    sql += ` ORDER BY created_at DESC LIMIT $${i++} OFFSET $${i++}`;
    params.push(limit, offset);

    let rows: any[] = [];
    if (client.$queryRawUnsafe) {
      rows = await client.$queryRawUnsafe(sql, ...params);
    } else if (client.query) {
      const res = await client.query(sql, params);
      rows = res.rows;
    } else {
      const where: any = { tenantId };
      if (status) where.status = status;
      const dbRows = await client.outboxEvent.findMany({
        where,
        take: limit,
        skip: offset,
        orderBy: { createdAt: 'desc' },
      });
      return dbRows.map((r: any) => ({
        id: r.id,
        tenantId: r.tenantId,
        actorId: r.actorId,
        eventType: r.eventType,
        payload: r.payload as Record<string, unknown>,
        status: r.status as any,
        claimToken: r.claimToken,
        fenceToken: r.fenceToken,
        claimedAt: r.claimedAt ? r.claimedAt.toISOString() : null,
        idempotencyKey: r.idempotencyKey,
        createdAt: r.createdAt.toISOString(),
        updatedAt: r.updatedAt.toISOString(),
      }));
    }

    return (rows || []).map((r) => this.mapRow(r));
  }

  private mapRow(r: any): OutboxEvent {
    return {
      id: r.id,
      tenantId: r.tenant_id || r.tenantId,
      actorId: r.actor_id || r.actorId,
      eventType: r.event_type || r.eventType,
      payload: typeof r.payload === 'string' ? JSON.parse(r.payload) : r.payload,
      status: r.status,
      claimToken: r.claim_token || r.claimToken,
      fenceToken: r.fence_token ?? r.fenceToken ?? 0,
      claimedAt: r.claimed_at ? new Date(r.claimed_at).toISOString() : (r.claimedAt ? new Date(r.claimedAt).toISOString() : null),
      idempotencyKey: r.idempotency_key || r.idempotencyKey,
      createdAt: new Date(r.created_at || r.createdAt).toISOString(),
      updatedAt: new Date(r.updated_at || r.updatedAt).toISOString(),
    };
  }
}
