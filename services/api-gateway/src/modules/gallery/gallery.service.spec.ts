import { ConfigModule } from '@nestjs/config';
import { Test, TestingModule } from '@nestjs/testing';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { FACE_EMBEDDING_DIM } from '../database/database.constants.js';
import { DatabaseModule } from '../database/database.module.js';
import { GalleryModule } from './gallery.module.js';
import { GalleryService } from './gallery.service.js';

const DATABASE_URL =
  process.env.DATABASE_URL ??
  'postgresql://crewpulse:crewpulse_dev_change_me@localhost:15434/crewpulse';

const DEV_KEY = 'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=';

function embeddingFromSeed(seed: number): number[] {
  return Array.from({ length: FACE_EMBEDDING_DIM }, (_, i) =>
    Math.sin((i + 1) * seed * 0.013) + Math.cos((i + 3) * seed * 0.007),
  );
}

describe('GalleryService (encrypted roster search)', () => {
  let moduleRef: TestingModule;
  let gallery: GalleryService;
  const suffix = `${Date.now()}`;
  const venueId = `ven_c7_${suffix}`;
  const shiftId = `shf_c7_${suffix}`;
  const onRoster = `wrk_on_${suffix}`;
  const offRoster = `wrk_off_${suffix}`;
  const distractor = `wrk_dist_${suffix}`;
  const modelVersion = 'Facenet512';

  beforeAll(async () => {
    process.env.NODE_ENV = 'test';
    process.env.DATABASE_URL = DATABASE_URL;
    process.env.REDIS_URL = process.env.REDIS_URL ?? 'redis://localhost:16379';
    process.env.VISION_ENGINE_URL =
      process.env.VISION_ENGINE_URL ?? 'http://localhost:8000';
    process.env.API_GATEWAY_PORT = '3000';
    process.env.BIOMETRIC_TEMPLATE_KEY = DEV_KEY;

    moduleRef = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({ isGlobal: true }),
        DatabaseModule,
        GalleryModule,
      ],
    }).compile();

    gallery = moduleRef.get(GalleryService);
    expect(await gallery.encryptedSchemaReady()).toBe(true);
  }, 30_000);

  afterAll(async () => {
    await moduleRef?.close();
  });

  it('stores ciphertext, scopes search to roster, and never needs plaintext columns', async () => {
    const target = embeddingFromSeed(11);
    const nearProbe = target.map((v, i) => v + (i % 7 === 0 ? 0.02 : 0));

    await gallery.upsertTemplate({
      workerId: onRoster,
      displayName: 'On roster',
      modelVersion,
      embedding: target,
    });
    await gallery.upsertTemplate({
      workerId: offRoster,
      displayName: 'Off roster (same vector family)',
      modelVersion,
      embedding: target.map((v) => v + 0.01),
    });
    await gallery.upsertTemplate({
      workerId: distractor,
      displayName: 'Distractor on roster',
      modelVersion,
      embedding: embeddingFromSeed(99),
    });

    await gallery.upsertRoster({
      venueId,
      venueName: 'C7 test venue',
      shiftId,
      shiftLabel: 'C7 shift',
      workerId: onRoster,
    });
    await gallery.upsertRoster({
      venueId,
      shiftId,
      workerId: distractor,
    });

    const first = await gallery.upsertTemplate({
      workerId: onRoster,
      modelVersion,
      embedding: target,
    });
    expect(first.created).toBe(false);
    expect(first.embeddingDim).toBe(FACE_EMBEDDING_DIM);
    expect(first.encryptionKid).toBe('v1');

    const result = await gallery.search({
      venueId,
      shiftId,
      modelVersion,
      topK: 5,
      embedding: nearProbe,
    });

    expect(result.index).toBe('encrypted_roster');
    expect(result.candidates.length).toBeGreaterThanOrEqual(1);
    expect(result.candidates[0]?.workerId).toBe(onRoster);
    expect(result.candidates.some((c) => c.workerId === offRoster)).toBe(
      false,
    );
    expect(result.candidates.some((c) => c.workerId === distractor)).toBe(
      true,
    );
    expect(result.candidates[0]?.score ?? 0).toBeGreaterThan(0.9);
  });

  it('erases templates with audit and excludes them from search', async () => {
    const workerId = `wrk_erase_${suffix}`;
    await gallery.upsertTemplate({
      workerId,
      modelVersion,
      embedding: embeddingFromSeed(3),
    });
    await gallery.upsertRoster({
      venueId,
      shiftId,
      workerId,
    });

    const erased = await gallery.eraseBiometrics(workerId, {
      requestedBy: 'test',
      reason: 'unit erase',
    });
    expect(erased.templatesRemoved).toBeGreaterThanOrEqual(1);
    expect(erased.auditId).toBeTruthy();

    const listed = await gallery.listTemplates(workerId);
    expect(listed.total).toBe(0);

    const result = await gallery.search({
      venueId,
      shiftId,
      modelVersion,
      embedding: embeddingFromSeed(3),
    });
    expect(result.candidates.some((c) => c.workerId === workerId)).toBe(false);
  });

  it('purges workers past retentionUntil', async () => {
    const workerId = `wrk_ret_${suffix}`;
    await gallery.upsertTemplate({
      workerId,
      modelVersion,
      embedding: embeddingFromSeed(7),
    });
    const past = new Date(Date.now() - 60_000).toISOString();
    await gallery.setRetention(workerId, { retentionUntil: past });
    const purged = await gallery.purgeExpired({ requestedBy: 'test-purge' });
    expect(purged.workersPurged).toBeGreaterThanOrEqual(1);
    expect(purged.items.some((i) => i.workerId === workerId)).toBe(true);
  });
});
