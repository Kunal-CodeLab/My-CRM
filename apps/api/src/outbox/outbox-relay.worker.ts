import { Injectable, Logger, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { OutboxService } from './outbox.service';
import { OutboxEvent } from '@crm/shared-types';
import * as crypto from 'crypto';

export type OutboxHandler = (event: OutboxEvent) => Promise<{ idempotent: boolean }>;

@Injectable()
export class OutboxRelayWorker implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(OutboxRelayWorker.name);
  private isRunning = false;
  private pollTimer: NodeJS.Timeout | null = null;
  private readonly workerToken = crypto.randomUUID();
  private handlers = new Map<string, OutboxHandler>();

  constructor(private readonly outboxService: OutboxService) {
    // Register default handlers for known domain events
    this.registerHandler('deal.created', async () => ({ idempotent: true }));
    this.registerHandler('deal.updated', async () => ({ idempotent: true }));
    this.registerHandler('deal.stage_transitioned', async () => ({ idempotent: true }));
    this.registerHandler('contact.created', async () => ({ idempotent: true }));
    this.registerHandler('account.created', async () => ({ idempotent: true }));
  }

  onModuleInit() {
    this.startWorker();
  }

  onModuleDestroy() {
    this.stopWorker();
  }

  registerHandler(eventType: string, handler: OutboxHandler) {
    this.handlers.set(eventType, handler);
  }

  startWorker() {
    if (this.isRunning) return;
    this.isRunning = true;
    this.logger.log(`Outbox Relay Worker started with workerToken=${this.workerToken}`);
  }

  stopWorker() {
    this.isRunning = false;
    if (this.pollTimer) {
      clearInterval(this.pollTimer);
      this.pollTimer = null;
    }
  }

  /**
   * Process a batch of outbox events atomically
   */
  async processBatch(limit = 10, dbClient?: any): Promise<{ processed: number; failed: number; unknown: number }> {
    const claim = await this.outboxService.claimEvents(limit, this.workerToken, dbClient);
    if (!claim.events || claim.events.length === 0) {
      return { processed: 0, failed: 0, unknown: 0 };
    }

    let processed = 0;
    let failed = 0;
    let unknown = 0;

    for (const event of claim.events) {
      // Setup heartbeat lease renewal timer for long-running jobs (renews every 60 seconds)
      const heartbeatTimer = setInterval(async () => {
        try {
          await this.outboxService.renewHeartbeat(event.id, claim.claimToken, event.fenceToken, dbClient);
        } catch (err) {
          this.logger.warn(`Failed to renew heartbeat for event ${event.id}: ${(err as Error).message}`);
        }
      }, 60000);

      try {
        const handler = this.handlers.get(event.eventType) || (async () => ({ idempotent: true }));
        const outcome = await handler(event);

        // Mark as completed with monotonic fencing assertion
        await this.outboxService.completeEvent(event.id, claim.claimToken, event.fenceToken, dbClient);
        processed++;
      } catch (err: any) {
        this.logger.error(`Error processing outbox event ${event.id}: ${err.message}`);
        // If operation was non-idempotent or unknown, transition to UNKNOWN_OUTCOME
        const isNonIdempotent = err.isNonIdempotent === true || err.message?.includes('UNKNOWN_OUTCOME');
        if (isNonIdempotent) {
          await this.outboxService.failEvent(event.id, claim.claimToken, event.fenceToken, true, err.message, dbClient);
          unknown++;
        } else {
          await this.outboxService.failEvent(event.id, claim.claimToken, event.fenceToken, false, err.message, dbClient);
          failed++;
        }
      } finally {
        clearInterval(heartbeatTimer);
      }
    }

    return { processed, failed, unknown };
  }
}
