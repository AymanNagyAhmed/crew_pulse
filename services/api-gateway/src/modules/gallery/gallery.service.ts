import { Inject, Injectable } from '@nestjs/common';
import type { Pool, PoolClient } from 'pg';
import {
  DEFAULT_FACE_MODEL_VERSION,
  FACE_EMBEDDING_DIM,
  PG_POOL,
} from '../database/database.constants.js';
import type { EnrollTemplatesDto } from './dto/enroll-templates.dto.js';
import type { SearchGalleryDto } from './dto/search-gallery.dto.js';
import type { UpsertRosterDto } from './dto/upsert-roster.dto.js';
import type { UpsertTemplateDto } from './dto/upsert-template.dto.js';
import { l2Normalize, toPgVectorLiteral } from './embedding.util.js';
import { assertEnrollmentQa } from './enrollment-qa.js';

export type UpsertTemplateResult = {
  workerId: string;
  modelVersion: string;
  templateVersion: number;
  embeddingDim: number;
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
  index: 'hnsw';
  candidates: GallerySearchHit[];
};

@Injectable()
export class GalleryService {
  constructor(@Inject(PG_POOL) private readonly pool: Pool) {}

  async upsertTemplate(dto: UpsertTemplateDto): Promise<UpsertTemplateResult> {
    const normalized = l2Normalize(dto.embedding);
    const templateVersion = dto.templateVersion ?? 1;
    const vectorLiteral = toPgVectorLiteral(normalized);

    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      await client.query(
        `INSERT INTO crewpulse.workers (worker_id, display_name)
         VALUES ($1, $2)
         ON CONFLICT (worker_id) DO UPDATE
           SET display_name = COALESCE(EXCLUDED.display_name, crewpulse.workers.display_name)`,
        [dto.workerId, dto.displayName ?? null],
      );

      const existing = await client.query<{ id: string }>(
        `SELECT id FROM crewpulse.face_templates
         WHERE worker_id = $1 AND model_version = $2 AND template_version = $3`,
        [dto.workerId, dto.modelVersion, templateVersion],
      );

      await client.query(
        `INSERT INTO crewpulse.face_templates
           (worker_id, model_version, template_version, embedding)
         VALUES ($1, $2, $3, $4::vector)
         ON CONFLICT (worker_id, model_version, template_version) DO UPDATE
           SET embedding = EXCLUDED.embedding,
               updated_at = now()`,
        [dto.workerId, dto.modelVersion, templateVersion, vectorLiteral],
      );
      await client.query('COMMIT');

      return {
        workerId: dto.workerId,
        modelVersion: dto.modelVersion,
        templateVersion,
        embeddingDim: FACE_EMBEDDING_DIM,
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
    let sql = `SELECT worker_id, model_version, template_version, updated_at
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
      updated_at: Date;
    }>(sql, params);

    const items = rows.map((row) => ({
      workerId: row.worker_id,
      modelVersion: row.model_version,
      templateVersion: row.template_version,
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

  async search(dto: SearchGalleryDto): Promise<GallerySearchResult> {
    const modelVersion = dto.modelVersion ?? DEFAULT_FACE_MODEL_VERSION;
    const topK = dto.topK ?? 5;
    const probe = toPgVectorLiteral(l2Normalize(dto.embedding));

    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      // Prefer HNSW with filtered iterative scan when the gallery grows.
      await client.query('SET LOCAL hnsw.ef_search = 40');
      await client.query(`SET LOCAL hnsw.iterative_scan = 'relaxed_order'`);

      const { rows } = await client.query<{
        worker_id: string;
        score: string;
        model_version: string;
        template_version: number;
      }>(
        `SELECT
           t.worker_id,
           (1 - (t.embedding <=> $1::vector))::float8 AS score,
           t.model_version,
           t.template_version
         FROM crewpulse.face_templates t
         INNER JOIN crewpulse.shift_roster r
           ON r.worker_id = t.worker_id
          AND r.venue_id = $2
          AND r.shift_id = $3
         WHERE t.model_version = $4
         ORDER BY t.embedding <=> $1::vector
         LIMIT $5`,
        [probe, dto.venueId, dto.shiftId, modelVersion, topK],
      );
      await client.query('COMMIT');

      return {
        venueId: dto.venueId,
        shiftId: dto.shiftId,
        modelVersion,
        embeddingDim: FACE_EMBEDDING_DIM,
        index: 'hnsw',
        candidates: rows.map((row) => ({
          workerId: row.worker_id,
          score: Number(row.score),
          modelVersion: row.model_version,
          templateVersion: row.template_version,
        })),
      };
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }

  /** Test/ops helper: confirm the HNSW index exists. */
  async hnswIndexExists(client?: PoolClient): Promise<boolean> {
    const q = client ?? this.pool;
    const { rows } = await q.query<{ exists: boolean }>(
      `SELECT EXISTS (
         SELECT 1
         FROM pg_indexes
         WHERE schemaname = 'crewpulse'
           AND indexname = 'face_templates_embedding_hnsw'
       ) AS exists`,
    );
    return Boolean(rows[0]?.exists);
  }
}
