import { ConfigModule } from '@nestjs/config';
import { Test, TestingModule } from '@nestjs/testing';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { DomainException } from '../../common/exceptions/domain.exception.js';
import { FACE_EMBEDDING_DIM } from '../database/database.constants.js';
import { DatabaseModule } from '../database/database.module.js';
import { GalleryModule } from './gallery.module.js';
import { GalleryService } from './gallery.service.js';

const DATABASE_URL =
  process.env.DATABASE_URL ??
  'postgresql://crewpulse:crewpulse_dev_change_me@localhost:15434/crewpulse';

function embeddingFromSeed(seed: number): number[] {
  return Array.from({ length: FACE_EMBEDDING_DIM }, (_, i) =>
    Math.sin((i + 1) * seed * 0.017),
  );
}

describe('Gallery multi-template enrollment (C6)', () => {
  let moduleRef: TestingModule;
  let gallery: GalleryService;
  const suffix = `c6_${Date.now()}`;
  const workerId = `wrk_enroll_${suffix}`;
  const modelVersion = 'Facenet512';

  beforeAll(async () => {
    process.env.NODE_ENV = 'test';
    process.env.DATABASE_URL = DATABASE_URL;

    moduleRef = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({ isGlobal: true }),
        DatabaseModule,
        GalleryModule,
      ],
    }).compile();
    gallery = moduleRef.get(GalleryService);
  }, 30_000);

  afterAll(async () => {
    await moduleRef?.close();
  });

  it('enrolls multiple templates per worker and lists them', async () => {
    const result = await gallery.enrollTemplates({
      workerId,
      displayName: 'C6 multi',
      modelVersion,
      templates: [
        {
          embedding: embeddingFromSeed(1),
          captureQa: {
            blur: 0.1,
            faceSizePx: 160,
            yawDeg: 2,
            pitchDeg: 0,
            detectionScore: 0.97,
          },
        },
        {
          embedding: embeddingFromSeed(2),
          captureQa: {
            blur: 0.12,
            faceSizePx: 150,
            yawDeg: -3,
            pitchDeg: 1,
            detectionScore: 0.95,
          },
        },
      ],
    });

    expect(result.templates).toHaveLength(2);
    expect(result.templates.map((t) => t.templateVersion)).toEqual([1, 2]);
    expect(result.templates.every((t) => t.created)).toBe(true);

    const listed = await gallery.listTemplates(workerId, modelVersion);
    expect(listed.total).toBe(2);
    expect(listed.items.map((i) => i.templateVersion).sort()).toEqual([1, 2]);
  });

  it('rejects blurry enrollment frames before write', async () => {
    await expect(
      gallery.enrollTemplates({
        workerId: `${workerId}_bad`,
        modelVersion,
        templates: [
          {
            embedding: embeddingFromSeed(3),
            captureQa: {
              blur: 0.8,
              faceSizePx: 160,
              yawDeg: 0,
              pitchDeg: 0,
              detectionScore: 0.99,
            },
          },
        ],
      }),
    ).rejects.toBeInstanceOf(DomainException);
  });
});
