import { Inject, Injectable } from '@nestjs/common';
import type { Pool, PoolClient } from 'pg';
import { DomainException } from '../../common/exceptions/domain.exception.js';
import {
  DEFAULT_FACE_MODEL_VERSION,
  FACE_EMBEDDING_DIM,
  PG_POOL,
} from '../database/database.constants.js';
import type { EnrollTemplatesDto } from './dto/enroll-templates.dto.js';
import type { EraseBiometricsDto } from './dto/erase-biometrics.dto.js';
import type { RetentionPurgeDto } from './dto/retention-purge.dto.js';
import type { SearchGalleryDto } from './dto/search-gallery.dto.js';
import type { SetRetentionDto } from './dto/set-retention.dto.js';
import type { UpsertRosterDto } from './dto/upsert-roster.dto.js';
import type { UpsertTemplateDto } from './dto/upsert-template.dto.js';
import { cosineSimilarity, l2Normalize } from './embedding.util.js';
import { assertEnrollmentQa } from './enrollment-qa.js';
import { TemplateCryptoService } from './template-crypto.service.js';

export type UpsertTemplateResult = {
  workerId: string;
  modelVersion: string;
  templateVersion: number;
  embeddingDim: number;
  encryptionKid: string;
  created: boolean;
};

export type EnrollTemplatesResult = {
  workerId: string;
  modelVersion: string;
  embeddingDim: number;
  templates: { templateVersion: number; created: boolean }[];
};

export type ListedTemplate = {
  workerId: string;
  modelVersion: string;
  templateVersion: number;
  encryptionKid: string;
  updatedAt: string;
};

export type UpsertRosterResult = {
  venueId: string;
  shiftId: string;
  workerId: string;
  created: boolean;
};

export type GallerySearchHit = {
  workerId: string;
  score: number;
  modelVersion: string;
  templateVersion: number;
};

export type GallerySearchResult = {
  venueId: string;
  shiftId: string;
  modelVersion: string;
  embeddingDim: number;
  /** Ciphertext at rest; roster decrypt + cosine in process (no plaintext HNSW). */
  index: 'encrypted_roster';
  candidates: GallerySearchHit[];
};

export type EraseBiometricsResult = {
  workerId: string;
  templatesRemoved: number;
  rosterRemoved: number;
  erasedAt: string;
  auditId: string;
};

export type SetRetentionResult = {
  workerId: string;
  retentionUntil: string;
};

export type RetentionPurgeResult = {
  asOf: string;
  workersPurged: number;
  templatesRemoved: number;
  items: { workerId: string; templatesRemoved: number; rosterRemoved: number }[];
};

/** Edge roster cache snapshot — ids + template metadata only (no vectors) (C10). */
export type EdgeRosterSnapshot = {
  venueId: string;
  shiftId: string;
  fetchedAt: string;
  workers: {
    workerId: string;
    templateCount: number;
    modelVersions: string[];
  }[];
};

@Injectable()
export class GalleryService {
  constructor(
    @Inject(PG_POOL) private readonly pool: Pool,
    private readonly crypto: TemplateCryptoService,
  ) {}

  async upsertTemplate(dto: UpsertTemplateDto): Promise<UpsertTemplateResult> {
    const normalized = l2Normalize(dto.embedding);
    const templateVersion = dto.templateVersion ?? 1;
    const { ciphertext, kid } = this.crypto.encrypt(normalized);

    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      await client.query(
        `INSERT INTO crewpulse.workers (worker_id, display_name)
         VALUES ($1, $2)
         ON CONFLICT (worker_id) DO UPDATE
           SET display_name = COALESCE(EXCLUDED.display_name, crewpulse.workers.display_name),
               biometrics_erased_at = NULL`,
        [dto.workerId, dto.displayName ?? null],
      );

      const existing = await client.query<{ id: string }>(
        `SELECT id FROM crewpulse.face_templates
         WHERE worker_id = $1 AND model_version = $2 AND template_version = $3`,
        [dto.workerId, dto.modelVersion, templateVersion],
      );

      await client.query(
        `INSERT INTO crewpulse.face_templates
           (worker_id, model_version, template_version, embedding_ciphertext, encryption_kid)
         VALUES ($1, $2, $3, $4, $5)
         ON CONFLICT (worker_id, model_version, template_version) DO UPDATE
           SET embedding_ciphertext = EXCLUDED.embedding_ciphertext,
               encryption_kid = EXCLUDED.encryption_kid,
               updated_at = now()`,
        [dto.workerId, dto.modelVersion, templateVersion, ciphertext, kid],
      );
      await client.query('COMMIT');

      return {
        workerId: dto.workerId,
        modelVersion: dto.modelVersion,
        templateVersion,
        embeddingDim: FACE_EMBEDDING_DIM,
        encryptionKid: kid,
        created: existing.rowCount === 0,
      };
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }

  /**
   * Multi-template enrollment with capture QA. Rejects blurry / extreme-pose
   * frames so one bad hire photo cannot poison 1:N for months.
   */
  async enrollTemplates(dto: EnrollTemplatesDto): Promise<EnrollTemplatesResult> {
    for (const [index, item] of dto.templates.entries()) {
      assertEnrollmentQa(item.captureQa, index);
    }

    const results: { templateVersion: number; created: boolean }[] = [];
    let nextAutoVersion = 1;

    for (const [index, item] of dto.templates.entries()) {
      const templateVersion = item.templateVersion ?? nextAutoVersion;
      const upserted = await this.upsertTemplate({
        workerId: dto.workerId,
        displayName: index === 0 ? dto.displayName : undefined,
        modelVersion: dto.modelVersion,
        templateVersion,
        embedding: item.embedding,
      });
      results.push({
        templateVersion: upserted.templateVersion,
        created: upserted.created,
      });
      nextAutoVersion = Math.max(nextAutoVersion, upserted.templateVersion + 1);
    }

    return {
      workerId: dto.workerId,
      modelVersion: dto.modelVersion,
      embeddingDim: FACE_EMBEDDING_DIM,
      templates: results,
    };
  }

  async listTemplates(
    workerId: string,
    modelVersion?: string,
  ): Promise<{ items: ListedTemplate[]; total: number }> {
    const params: unknown[] = [workerId];
    let sql = `SELECT worker_id, model_version, template_version, encryption_kid, updated_at
               FROM crewpulse.face_templates
               WHERE worker_id = $1`;
    if (modelVersion) {
      params.push(modelVersion);
      sql += ` AND model_version = $2`;
    }
    sql += ` ORDER BY model_version, template_version`;

    const { rows } = await this.pool.query<{
      worker_id: string;
      model_version: string;
      template_version: number;
      encryption_kid: string;
      updated_at: Date;
    }>(sql, params);

    const items = rows.map((row) => ({
      workerId: row.worker_id,
      modelVersion: row.model_version,
      templateVersion: row.template_version,
      encryptionKid: row.encryption_kid,
      updatedAt: new Date(row.updated_at).toISOString(),
    }));
    return { items, total: items.length };
  }

  async upsertRoster(dto: UpsertRosterDto): Promise<UpsertRosterResult> {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      await client.query(
        `INSERT INTO crewpulse.workers (worker_id)
         VALUES ($1)
         ON CONFLICT (worker_id) DO NOTHING`,
        [dto.workerId],
      );
      await client.query(
        `INSERT INTO crewpulse.venues (venue_id, name)
         VALUES ($1, $2)
         ON CONFLICT (venue_id) DO UPDATE
           SET name = COALESCE(EXCLUDED.name, crewpulse.venues.name)`,
        [dto.venueId, dto.venueName ?? null],
      );
      await client.query(
        `INSERT INTO crewpulse.shifts (shift_id, venue_id, label)
         VALUES ($1, $2, $3)
         ON CONFLICT (shift_id) DO UPDATE
           SET venue_id = EXCLUDED.venue_id,
               label = COALESCE(EXCLUDED.label, crewpulse.shifts.label)`,
        [dto.shiftId, dto.venueId, dto.shiftLabel ?? null],
      );

      const existing = await client.query(
        `SELECT 1 FROM crewpulse.shift_roster
         WHERE venue_id = $1 AND shift_id = $2 AND worker_id = $3`,
        [dto.venueId, dto.shiftId, dto.workerId],
      );

      await client.query(
        `INSERT INTO crewpulse.shift_roster (venue_id, shift_id, worker_id)
         VALUES ($1, $2, $3)
         ON CONFLICT DO NOTHING`,
        [dto.venueId, dto.shiftId, dto.workerId],
      );
      await client.query('COMMIT');

      return {
        venueId: dto.venueId,
        shiftId: dto.shiftId,
        workerId: dto.workerId,
        created: existing.rowCount === 0,
      };
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }

  /**
   * Compact roster for edge nodes to cache eligibility locally (C10).
   * Never includes embedding ciphertext or plaintext vectors.
   */
  async listEdgeRoster(
    venueId: string,
    shiftId: string,
  ): Promise<EdgeRosterSnapshot> {
    const { rows } = await this.pool.query<{
      worker_id: string;
      template_count: string;
      model_versions: string[] | null;
    }>(
      `SELECT r.worker_id,
              COUNT(t.template_version)::text AS template_count,
              COALESCE(
                array_agg(DISTINCT t.model_version)
                  FILTER (WHERE t.model_version IS NOT NULL),
                '{}'
              ) AS model_versions
         FROM crewpulse.shift_roster r
         LEFT JOIN crewpulse.face_templates t
           ON t.worker_id = r.worker_id
        WHERE r.venue_id = $1 AND r.shift_id = $2
        GROUP BY r.worker_id
        ORDER BY r.worker_id`,
      [venueId, shiftId],
    );

    return {
      venueId,
      shiftId,
      fetchedAt: new Date().toISOString(),
      workers: rows.map((row) => ({
        workerId: row.worker_id,
        templateCount: Number(row.template_count) || 0,
        modelVersions: row.model_versions ?? [],
      })),
    };
  }

  async search(dto: SearchGalleryDto): Promise<GallerySearchResult> {
    const modelVersion = dto.modelVersion ?? DEFAULT_FACE_MODEL_VERSION;
    const topK = dto.topK ?? 5;
    const probe = l2Normalize(dto.embedding);

    const { rows } = await this.pool.query<{
      worker_id: string;
      model_version: string;
      template_version: number;
      embedding_ciphertext: Buffer;
    }>(
      `SELECT
         t.worker_id,
         t.model_version,
         t.template_version,
         t.embedding_ciphertext
       FROM crewpulse.face_templates t
       INNER JOIN crewpulse.shift_roster r
         ON r.worker_id = t.worker_id
        AND r.venue_id = $1
        AND r.shift_id = $2
       INNER JOIN crewpulse.workers w
         ON w.worker_id = t.worker_id
       WHERE t.model_version = $3
         AND w.biometrics_erased_at IS NULL`,
      [dto.venueId, dto.shiftId, modelVersion],
    );

    const bestByWorker = new Map<string, GallerySearchHit>();
    for (const row of rows) {
      const cipher = Buffer.isBuffer(row.embedding_ciphertext)
        ? row.embedding_ciphertext
        : Buffer.from(row.embedding_ciphertext);
      const template = this.crypto.decrypt(cipher);
      const score = cosineSimilarity(probe, template);
      const prev = bestByWorker.get(row.worker_id);
      if (!prev || score > prev.score) {
        bestByWorker.set(row.worker_id, {
          workerId: row.worker_id,
          score,
          modelVersion: row.model_version,
          templateVersion: row.template_version,
        });
      }
    }

    const candidates = [...bestByWorker.values()]
      .sort((a, b) => b.score - a.score)
      .slice(0, topK);

    return {
      venueId: dto.venueId,
      shiftId: dto.shiftId,
      modelVersion,
      embeddingDim: FACE_EMBEDDING_DIM,
      index: 'encrypted_roster',
      candidates,
    };
  }

  async setRetention(
    workerId: string,
    dto: SetRetentionDto,
  ): Promise<SetRetentionResult> {
    const retentionUntil = new Date(dto.retentionUntil);
    if (Number.isNaN(retentionUntil.getTime())) {
      throw new DomainException(
        'INVALID_RETENTION_UNTIL',
        'retentionUntil must be a valid ISO-8601 timestamp',
        400,
        [{ field: 'retentionUntil', issue: 'invalid ISO-8601' }],
      );
    }

    const result = await this.pool.query(
      `INSERT INTO crewpulse.workers (worker_id, biometric_retention_until)
       VALUES ($1, $2)
       ON CONFLICT (worker_id) DO UPDATE
         SET biometric_retention_until = EXCLUDED.biometric_retention_until
       RETURNING worker_id, biometric_retention_until`,
      [workerId, retentionUntil.toISOString()],
    );

    return {
      workerId: result.rows[0].worker_id as string,
      retentionUntil: new Date(
        result.rows[0].biometric_retention_until as Date,
      ).toISOString(),
    };
  }

  async eraseBiometrics(
    workerId: string,
    dto: EraseBiometricsDto = {},
  ): Promise<EraseBiometricsResult> {
    const removeFromRosters = dto.removeFromRosters !== false;
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');

      const deletedTemplates = await client.query(
        `DELETE FROM crewpulse.face_templates WHERE worker_id = $1`,
        [workerId],
      );
      let rosterRemoved = 0;
      if (removeFromRosters) {
        const deletedRoster = await client.query(
          `DELETE FROM crewpulse.shift_roster WHERE worker_id = $1`,
          [workerId],
        );
        rosterRemoved = deletedRoster.rowCount ?? 0;
      }

      await client.query(
        `INSERT INTO crewpulse.workers (worker_id, biometrics_erased_at, biometric_retention_until)
         VALUES ($1, now(), NULL)
         ON CONFLICT (worker_id) DO UPDATE
           SET biometrics_erased_at = now(),
               biometric_retention_until = NULL`,
        [workerId],
      );

      const audit = await client.query<{ id: string; created_at: Date }>(
        `INSERT INTO crewpulse.biometric_erasure_audit
           (worker_id, action, templates_removed, roster_removed, requested_by, reason)
         VALUES ($1, 'erase', $2, $3, $4, $5)
         RETURNING id, created_at`,
        [
          workerId,
          deletedTemplates.rowCount ?? 0,
          rosterRemoved,
          dto.requestedBy ?? null,
          dto.reason ?? null,
        ],
      );

      await client.query('COMMIT');
      return {
        workerId,
        templatesRemoved: deletedTemplates.rowCount ?? 0,
        rosterRemoved,
        erasedAt: new Date(audit.rows[0]!.created_at).toISOString(),
        auditId: audit.rows[0]!.id,
      };
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }

  async purgeExpired(dto: RetentionPurgeDto = {}): Promise<RetentionPurgeResult> {
    const asOf = dto.asOf ? new Date(dto.asOf) : new Date();
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      const due = await client.query<{ worker_id: string }>(
        `SELECT worker_id FROM crewpulse.workers
         WHERE biometric_retention_until IS NOT NULL
           AND biometric_retention_until <= $1::timestamptz
           AND biometrics_erased_at IS NULL`,
        [asOf.toISOString()],
      );

      const items: RetentionPurgeResult['items'] = [];
      let templatesRemoved = 0;

      for (const row of due.rows) {
        const erased = await this.eraseBiometricsInTx(client, row.worker_id, {
          requestedBy: dto.requestedBy ?? 'retention_purge',
          reason: 'biometric_retention_until elapsed',
          action: 'retention_purge',
        });
        items.push({
          workerId: row.worker_id,
          templatesRemoved: erased.templatesRemoved,
          rosterRemoved: erased.rosterRemoved,
        });
        templatesRemoved += erased.templatesRemoved;
      }

      await client.query('COMMIT');
      return {
        asOf: asOf.toISOString(),
        workersPurged: items.length,
        templatesRemoved,
        items,
      };
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }

  /** True when ciphertext column exists (C7 schema applied). */
  async encryptedSchemaReady(client?: PoolClient): Promise<boolean> {
    const q = client ?? this.pool;
    const { rows } = await q.query<{ exists: boolean }>(
      `SELECT EXISTS (
         SELECT 1
         FROM information_schema.columns
         WHERE table_schema = 'crewpulse'
           AND table_name = 'face_templates'
           AND column_name = 'embedding_ciphertext'
       ) AS exists`,
    );
    return Boolean(rows[0]?.exists);
  }

  private async eraseBiometricsInTx(
    client: PoolClient,
    workerId: string,
    opts: {
      requestedBy: string;
      reason: string;
      action: 'erase' | 'retention_purge';
    },
  ): Promise<{ templatesRemoved: number; rosterRemoved: number }> {
    const deletedTemplates = await client.query(
      `DELETE FROM crewpulse.face_templates WHERE worker_id = $1`,
      [workerId],
    );
    const deletedRoster = await client.query(
      `DELETE FROM crewpulse.shift_roster WHERE worker_id = $1`,
      [workerId],
    );
    await client.query(
      `UPDATE crewpulse.workers
       SET biometrics_erased_at = now(),
           biometric_retention_until = NULL
       WHERE worker_id = $1`,
      [workerId],
    );
    await client.query(
      `INSERT INTO crewpulse.biometric_erasure_audit
         (worker_id, action, templates_removed, roster_removed, requested_by, reason)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [
        workerId,
        opts.action,
        deletedTemplates.rowCount ?? 0,
        deletedRoster.rowCount ?? 0,
        opts.requestedBy,
        opts.reason,
      ],
    );
    return {
      templatesRemoved: deletedTemplates.rowCount ?? 0,
      rosterRemoved: deletedRoster.rowCount ?? 0,
    };
  }
}
