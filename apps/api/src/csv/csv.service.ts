import { Injectable, Logger, ForbiddenException, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import {
  TenantContext,
  ExportSnapshot,
  ExportDownloadResponse,
  ImportJob,
  CreateImportRequest,
  DeduplicationMode,
} from '@crm/shared-types';
import * as crypto from 'crypto';

@Injectable()
export class CsvService {
  private readonly logger = new Logger(CsvService.name);

  constructor(private readonly prisma: PrismaClient) {}

  // =========================================================================
  // FORMULA NEUTRALIZATION (SPREADSHEET INJECTION MITIGATION)
  // =========================================================================

  /**
   * Neutralize spreadsheet formula injection characters (=, +, -, @, \t, \r)
   * by prefixing with a single apostrophe '
   */
  neutralizeFormula(value: string | null | undefined): string {
    if (value === null || value === undefined) return '';
    const str = String(value);
    if (/^[=+\-@\t\r]/.test(str)) {
      return `'${str}`;
    }
    return str;
  }

  // =========================================================================
  // TWO-PHASE IMMUTABLE SNAPSHOT EXPORT ENGINE
  // =========================================================================

  /**
   * Recheck worker actor authorization directly against PostgreSQL memberships
   */
  async assertExportAuthorization(tenantId: string, actorId: string, dbClient?: any): Promise<void> {
    const client = dbClient || this.prisma;
    let membership: any = null;

    if (client.$queryRawUnsafe) {
      const rows = await client.$queryRawUnsafe(
        `SELECT role, status FROM public.memberships WHERE tenant_id = $1::uuid AND user_id = $2::uuid`,
        tenantId,
        actorId,
      );
      membership = rows[0];
    } else if (client.query) {
      const res = await client.query(
        `SELECT role, status FROM public.memberships WHERE tenant_id = $1::uuid AND user_id = $2::uuid`,
        [tenantId, actorId],
      );
      membership = res.rows[0];
    }

    if (!membership || membership.status !== 'active' || !['owner', 'admin'].includes(membership.role)) {
      // Append security alert audit log
      try {
        const diff = {
          actorId,
          action: 'EXPORT_ATTEMPT_DENIED',
          reason: !membership ? 'No membership' : `Invalid role ${membership.role} or status ${membership.status}`,
        };
        const hash = crypto.createHash('sha256').update(JSON.stringify(diff)).digest('hex');
        const alertSql = `
          INSERT INTO public.audit_logs (id, tenant_id, actor_id, entity_name, entity_id, action, diff, entry_hash)
          VALUES (gen_random_uuid(), $1::uuid, $2::uuid, 'export', gen_random_uuid(), 'SECURITY_ALERT', $3::jsonb, $4)
        `;
        if (client.$queryRawUnsafe) {
          await client.$queryRawUnsafe(alertSql, tenantId, actorId, JSON.stringify(diff), hash);
        } else if (client.query) {
          await client.query(alertSql, [tenantId, actorId, JSON.stringify(diff), hash]);
        }
      } catch (err) {
        this.logger.error(`Failed to write security audit alert: ${(err as Error).message}`);
      }

      throw new ForbiddenException('UNAUTHORIZED_EXPORT_ATTEMPT_ABORTED: Export requires active owner or admin role.');
    }
  }

  /**
   * Create an immutable chunked snapshot export with formula neutralization
   */
  async createExportSnapshot(
    tenantId: string,
    actor: TenantContext,
    entityType: 'contacts' | 'deals',
    dbClient?: any,
  ): Promise<ExportSnapshot> {
    const client = dbClient || this.prisma;

    // 1. Direct PostgreSQL membership authorization recheck
    await this.assertExportAuthorization(tenantId, actor.userId, client);

    // 2. Insert outbox event for tracking
    const outboxId = crypto.randomUUID();
    const outboxKey = `export:${tenantId}:${outboxId}`;
    const insertOutboxSql = `
      INSERT INTO public.outbox_events (id, tenant_id, actor_id, event_type, payload, idempotency_key, status)
      VALUES ($1::uuid, $2::uuid, $3::uuid, $4, $5::jsonb, $6, 'PROCESSING')
    `;
    if (client.$queryRawUnsafe) {
      await client.$queryRawUnsafe(insertOutboxSql, outboxId, tenantId, actor.userId, `export.${entityType}`, JSON.stringify({ entityType }), outboxKey);
    } else if (client.query) {
      await client.query(insertOutboxSql, [outboxId, tenantId, actor.userId, `export.${entityType}`, JSON.stringify({ entityType }), outboxKey]);
    }

    // 3. Query domain rows within active tenant
    let headers: string[] = [];
    let rowsData: any[] = [];

    if (entityType === 'contacts') {
      headers = ['id', 'first_name', 'last_name', 'email', 'phone', 'job_title', 'created_at'];
      const querySql = `SELECT id, first_name, last_name, email, phone, job_title, created_at FROM public.contacts WHERE tenant_id = $1::uuid AND deleted_at IS NULL ORDER BY created_at ASC`;
      if (client.$queryRawUnsafe) {
        rowsData = await client.$queryRawUnsafe(querySql, tenantId);
      } else if (client.query) {
        const res = await client.query(querySql, [tenantId]);
        rowsData = res.rows;
      }
    } else {
      headers = ['id', 'title', 'value', 'currency', 'pipeline_id', 'stage_id', 'created_at'];
      const querySql = `SELECT id, title, value, currency, pipeline_id, stage_id, created_at FROM public.deals WHERE tenant_id = $1::uuid AND deleted_at IS NULL ORDER BY created_at ASC`;
      if (client.$queryRawUnsafe) {
        rowsData = await client.$queryRawUnsafe(querySql, tenantId);
      } else if (client.query) {
        const res = await client.query(querySql, [tenantId]);
        rowsData = res.rows;
      }
    }

    // 4. Construct neutralized CSV lines
    const lines: string[] = [headers.join(',')];
    for (const r of rowsData) {
      const lineCells = headers.map((h) => {
        const rawVal = r[h] !== null && r[h] !== undefined ? String(r[h]) : '';
        const neutralized = this.neutralizeFormula(rawVal);
        // Escape quotes
        return `"${neutralized.replace(/"/g, '""')}"`;
      });
      lines.push(lineCells.join(','));
    }

    const fullCsv = lines.join('\n');
    const fullBuffer = Buffer.from(fullCsv, 'utf8');
    const sha256Checksum = crypto.createHash('sha256').update(fullBuffer).digest('hex');
    const byteLength = fullBuffer.length;

    // 5. Create export_snapshots record
    const snapshotId = crypto.randomUUID();
    const insertSnapshotSql = `
      INSERT INTO public.export_snapshots (id, tenant_id, outbox_id, generation_id, status, total_chunks, sha256_checksum, byte_length)
      VALUES ($1::uuid, $2::uuid, $3::uuid, 1, 'COMPLETED', $4, $5, $6)
      RETURNING *
    `;

    // Split into chunks of 64KB (or 1 chunk if smaller)
    const chunkSize = 64 * 1024;
    const totalChunks = Math.max(1, Math.ceil(fullBuffer.length / chunkSize));

    let createdSnapshot: any = null;
    if (client.$queryRawUnsafe) {
      const res = await client.$queryRawUnsafe(insertSnapshotSql, snapshotId, tenantId, outboxId, totalChunks, sha256Checksum, byteLength);
      createdSnapshot = res[0];
    } else if (client.query) {
      const res = await client.query(insertSnapshotSql, [snapshotId, tenantId, outboxId, totalChunks, sha256Checksum, byteLength]);
      createdSnapshot = res.rows[0];
    }

    // 6. Write chunks to export_snapshot_chunks
    for (let i = 0; i < totalChunks; i++) {
      const start = i * chunkSize;
      const end = Math.min(fullBuffer.length, start + chunkSize);
      const chunkBlob = fullBuffer.subarray(start, end);

      const chunkSql = `
        INSERT INTO public.export_snapshot_chunks (snapshot_id, generation_id, chunk_index, data_blob)
        VALUES ($1::uuid, 1, $2, $3)
      `;
      if (client.$queryRawUnsafe) {
        await client.$queryRawUnsafe(chunkSql, snapshotId, i, chunkBlob);
      } else if (client.query) {
        await client.query(chunkSql, [snapshotId, i, chunkBlob]);
      }
    }

    return {
      id: snapshotId,
      tenantId,
      outboxId,
      generationId: 1,
      workerToken: null,
      status: 'COMPLETED',
      totalChunks,
      sha256Checksum,
      byteLength: byteLength.toString(),
      createdAt: new Date().toISOString(),
    };
  }

  /**
   * Retrieve and assemble export snapshot chunks
   */
  async getExportSnapshot(tenantId: string, snapshotId: string, dbClient?: any): Promise<ExportDownloadResponse> {
    const client = dbClient || this.prisma;
    let snapshot: any = null;

    const findSql = `SELECT * FROM public.export_snapshots WHERE id = $1::uuid AND tenant_id = $2::uuid`;
    if (client.$queryRawUnsafe) {
      const rows = await client.$queryRawUnsafe(findSql, snapshotId, tenantId);
      snapshot = rows[0];
    } else if (client.query) {
      const res = await client.query(findSql, [snapshotId, tenantId]);
      snapshot = res.rows[0];
    }

    if (!snapshot) {
      throw new NotFoundException('Export snapshot not found within tenant context.');
    }

    // Retrieve chunks ordered by chunk_index
    const chunksSql = `SELECT data_blob FROM public.export_snapshot_chunks WHERE snapshot_id = $1::uuid ORDER BY chunk_index ASC`;
    let chunkRows: any[] = [];
    if (client.$queryRawUnsafe) {
      chunkRows = await client.$queryRawUnsafe(chunksSql, snapshotId);
    } else if (client.query) {
      const res = await client.query(chunksSql, [snapshotId]);
      chunkRows = res.rows;
    }

    const buffers = chunkRows.map((c) => Buffer.from(c.data_blob));
    const assembledBuffer = Buffer.concat(buffers);
    const csvContent = assembledBuffer.toString('utf8');

    return {
      id: snapshot.id,
      status: snapshot.status,
      totalChunks: snapshot.total_chunks,
      sha256Checksum: snapshot.sha256_checksum,
      byteLength: snapshot.byte_length.toString(),
      csvContent,
    };
  }

  // =========================================================================
  // CHUNKED RESUMABLE CSV CONTACT IMPORT ENGINE
  // =========================================================================

  /**
   * Parse CSV content into structured rows
   */
  parseCsv(csvData: string): Array<Record<string, string>> {
    const lines = csvData
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter((l) => l.length > 0);
    if (lines.length < 2) return [];

    const headers = lines[0].split(',').map((h) => h.replace(/^["']|["']$/g, '').trim());
    const records: Array<Record<string, string>> = [];

    for (let i = 1; i < lines.length; i++) {
      // Split on commas not enclosed in quotes
      const cells = lines[i].split(/,(?=(?:(?:[^"]*"){2})*[^"]*$)/).map((c) => c.replace(/^["']|["']$/g, '').trim());
      const record: Record<string, string> = {};
      headers.forEach((h, idx) => {
        record[h] = cells[idx] || '';
      });
      records.push(record);
    }

    return records;
  }

  /**
   * Initialize a chunked import job
   */
  async createImportJob(
    tenantId: string,
    actor: TenantContext,
    dto: CreateImportRequest,
    dbClient?: any,
  ): Promise<ImportJob> {
    if (actor.role === 'read_only') {
      throw new ForbiddenException('Read-only users cannot import contacts.');
    }

    const parsed = this.parseCsv(dto.csvData);
    if (parsed.length === 0) {
      throw new BadRequestException('CSV file is empty or missing headers.');
    }

    const client = dbClient || this.prisma;
    const jobId = crypto.randomUUID();
    const mode = dto.deduplicationMode || 'SKIP';

    const insertSql = `
      INSERT INTO public.import_jobs (id, tenant_id, actor_id, entity_name, status, deduplication_mode, total_rows, processed_rows, successful_rows, failed_rows, raw_csv, error_summary)
      VALUES ($1::uuid, $2::uuid, $3::uuid, 'contact', 'PENDING', $4, $5, 0, 0, 0, $6, '[]'::jsonb)
      RETURNING *
    `;

    let job: any = null;
    if (client.$queryRawUnsafe) {
      const rows = await client.$queryRawUnsafe(insertSql, jobId, tenantId, actor.userId, mode, parsed.length, dto.csvData);
      job = rows[0];
    } else if (client.query) {
      const res = await client.query(insertSql, [jobId, tenantId, actor.userId, mode, parsed.length, dto.csvData]);
      job = res.rows[0];
    }

    return this.mapImportJob(job);
  }

  /**
   * Process a chunk of rows with crash resumption guarantee
   */
  async processImportChunk(
    tenantId: string,
    actor: TenantContext,
    jobId: string,
    chunkSize = 100,
    dbClient?: any,
  ): Promise<ImportJob> {
    const client = dbClient || this.prisma;

    // 1. Fetch current job state with lock
    const findSql = `SELECT * FROM public.import_jobs WHERE id = $1::uuid AND tenant_id = $2::uuid FOR UPDATE`;
    let job: any = null;
    if (client.$queryRawUnsafe) {
      const rows = await client.$queryRawUnsafe(findSql, jobId, tenantId);
      job = rows[0];
    } else if (client.query) {
      const res = await client.query(findSql, [jobId, tenantId]);
      job = res.rows[0];
    }

    if (!job) {
      throw new NotFoundException('Import job not found.');
    }

    if (job.status === 'COMPLETED') {
      return this.mapImportJob(job);
    }

    const allRecords = this.parseCsv(job.raw_csv || '');
    const startIdx = job.processed_rows;
    const endIdx = Math.min(allRecords.length, startIdx + chunkSize);

    let newSuccessful = 0;
    let newFailed = 0;
    const newErrors: Array<{ row: number; error: string }> = [];

    // 2. Process slice [startIdx, endIdx)
    for (let i = startIdx; i < endIdx; i++) {
      const row = allRecords[i];
      const rowNum = i + 1;

      const firstName = row.firstName || row.first_name;
      const lastName = row.lastName || row.last_name;
      const email = row.email || null;
      const phone = row.phone || null;
      const jobTitle = row.jobTitle || row.job_title || null;

      if (!firstName || !lastName) {
        newFailed++;
        newErrors.push({ row: rowNum, error: 'firstName and lastName are required' });
        continue;
      }

      try {
        // Deduplication check by email within tenant
        let existingContact: any = null;
        if (email) {
          const checkSql = `SELECT id FROM public.contacts WHERE tenant_id = $1::uuid AND email = $2 AND deleted_at IS NULL`;
          if (client.$queryRawUnsafe) {
            const checkRows = await client.$queryRawUnsafe(checkSql, tenantId, email);
            existingContact = checkRows[0];
          } else if (client.query) {
            const checkRes = await client.query(checkSql, [tenantId, email]);
            existingContact = checkRes.rows[0];
          }
        }

        if (existingContact) {
          if (job.deduplication_mode === 'SKIP') {
            newSuccessful++;
            continue;
          } else if (job.deduplication_mode === 'UPDATE') {
            const updateSql = `
              UPDATE public.contacts
              SET first_name = $3, last_name = $4, phone = COALESCE($5, phone), job_title = COALESCE($6, job_title), updated_at = NOW()
              WHERE id = $1::uuid AND tenant_id = $2::uuid
            `;
            if (client.$queryRawUnsafe) {
              await client.$queryRawUnsafe(updateSql, existingContact.id, tenantId, firstName, lastName, phone, jobTitle);
            } else if (client.query) {
              await client.query(updateSql, [existingContact.id, tenantId, firstName, lastName, phone, jobTitle]);
            }
            newSuccessful++;
            continue;
          }
        }

        // CREATE or CREATE_ALL mode
        const insertContactSql = `
          INSERT INTO public.contacts (id, tenant_id, owner_id, first_name, last_name, email, phone, job_title)
          VALUES (gen_random_uuid(), $1::uuid, $2::uuid, $3, $4, $5, $6, $7)
        `;
        if (client.$queryRawUnsafe) {
          await client.$queryRawUnsafe(insertContactSql, tenantId, actor.userId, firstName, lastName, email, phone, jobTitle);
        } else if (client.query) {
          await client.query(insertContactSql, [tenantId, actor.userId, firstName, lastName, email, phone, jobTitle]);
        }
        newSuccessful++;
      } catch (err: any) {
        newFailed++;
        newErrors.push({ row: rowNum, error: err.message });
      }
    }

    // 3. Update job state atomically
    const nextProcessed = endIdx;
    const isFinished = nextProcessed >= allRecords.length;
    const nextStatus = isFinished ? 'COMPLETED' : 'PROCESSING';
    const existingErrors = typeof job.error_summary === 'string' ? JSON.parse(job.error_summary) : (job.error_summary || []);
    const updatedErrors = [...existingErrors, ...newErrors];

    const updateJobSql = `
      UPDATE public.import_jobs
      SET processed_rows = $3,
          successful_rows = successful_rows + $4,
          failed_rows = failed_rows + $5,
          error_summary = $6::jsonb,
          status = $7,
          updated_at = NOW()
      WHERE id = $1::uuid AND tenant_id = $2::uuid
      RETURNING *
    `;

    let updatedJob: any = null;
    if (client.$queryRawUnsafe) {
      const rows = await client.$queryRawUnsafe(updateJobSql, jobId, tenantId, nextProcessed, newSuccessful, newFailed, JSON.stringify(updatedErrors), nextStatus);
      updatedJob = rows[0];
    } else if (client.query) {
      const res = await client.query(updateJobSql, [jobId, tenantId, nextProcessed, newSuccessful, newFailed, JSON.stringify(updatedErrors), nextStatus]);
      updatedJob = res.rows[0];
    }

    return this.mapImportJob(updatedJob);
  }

  /**
   * Get current import job status
   */
  async getImportJob(tenantId: string, jobId: string, dbClient?: any): Promise<ImportJob> {
    const client = dbClient || this.prisma;
    const findSql = `SELECT * FROM public.import_jobs WHERE id = $1::uuid AND tenant_id = $2::uuid`;
    let job: any = null;

    if (client.$queryRawUnsafe) {
      const rows = await client.$queryRawUnsafe(findSql, jobId, tenantId);
      job = rows[0];
    } else if (client.query) {
      const res = await client.query(findSql, [jobId, tenantId]);
      job = res.rows[0];
    }

    if (!job) {
      throw new NotFoundException('Import job not found.');
    }

    return this.mapImportJob(job);
  }

  private mapImportJob(job: any): ImportJob {
    return {
      id: job.id,
      tenantId: job.tenant_id,
      actorId: job.actor_id,
      entityName: job.entity_name,
      status: job.status,
      deduplicationMode: job.deduplication_mode as DeduplicationMode,
      totalRows: job.total_rows,
      processedRows: job.processed_rows,
      successfulRows: job.successful_rows,
      failedRows: job.failed_rows,
      errorSummary: typeof job.error_summary === 'string' ? JSON.parse(job.error_summary) : (job.error_summary || []),
      createdAt: new Date(job.created_at).toISOString(),
      updatedAt: new Date(job.updated_at).toISOString(),
    };
  }
}
