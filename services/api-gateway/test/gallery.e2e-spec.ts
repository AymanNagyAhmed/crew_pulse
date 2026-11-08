import { INestApplication, ValidationPipe } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { Reflector } from '@nestjs/core';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types.js';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { AllExceptionsFilter } from '../src/common/filters/all-exceptions.filter.js';
import { ResponseInterceptor } from '../src/common/interceptors/response.interceptor.js';
import { FACE_EMBEDDING_DIM } from '../src/modules/database/database.constants.js';
import { DatabaseModule } from '../src/modules/database/database.module.js';
import { GalleryModule } from '../src/modules/gallery/gallery.module.js';

const DATABASE_URL =
  process.env.DATABASE_URL ??
  'postgresql://crewpulse:crewpulse_dev_change_me@localhost:15434/crewpulse';

function embeddingFromSeed(seed: number): number[] {
  return Array.from({ length: FACE_EMBEDDING_DIM }, (_, i) =>
    Math.sin((i + 1) * seed * 0.011),
  );
}

describe('Gallery (e2e)', () => {
  let app: INestApplication<App>;
  const suffix = `e2e_${Date.now()}`;
  const venueId = `ven_${suffix}`;
  const shiftId = `shf_${suffix}`;
  const workerId = `wrk_${suffix}`;
  const modelVersion = 'Facenet512';

  beforeAll(async () => {
    process.env.NODE_ENV = 'test';
    process.env.DATABASE_URL = DATABASE_URL;
    process.env.BIOMETRIC_TEMPLATE_KEY =
      process.env.BIOMETRIC_TEMPLATE_KEY ??
      'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=';

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({ isGlobal: true }),
        DatabaseModule,
        GalleryModule,
      ],
    }).compile();

    app = moduleFixture.createNestApplication({ rawBody: true });
    app.setGlobalPrefix('v1');
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );
    app.useGlobalInterceptors(new ResponseInterceptor(app.get(Reflector)));
    app.useGlobalFilters(new AllExceptionsFilter());
    await app.init();
  }, 30_000);

  afterAll(async () => {
    await app?.close();
  });

  it('upserts template + roster then searches without returning vectors', async () => {
    const embedding = embeddingFromSeed(5);

    const templateRes = await request(app.getHttpServer())
      .put('/v1/gallery/templates')
      .send({
        workerId,
        displayName: 'E2E worker',
        modelVersion,
        embedding,
      })
      .expect(200);

    expect(templateRes.body.success).toBe(true);
    expect(templateRes.body.data.workerId).toBe(workerId);
    expect(templateRes.body.data.embeddingDim).toBe(FACE_EMBEDDING_DIM);
    expect(JSON.stringify(templateRes.body)).not.toMatch(/embedding":\[/);

    await request(app.getHttpServer())
      .put('/v1/gallery/roster')
      .send({ venueId, shiftId, workerId })
      .expect(200);

    const searchRes = await request(app.getHttpServer())
      .post('/v1/gallery/search')
      .send({
        venueId,
        shiftId,
        modelVersion,
        topK: 3,
        embedding,
      })
      .expect(200);

    expect(searchRes.body.data.index).toBe('encrypted_roster');
    expect(searchRes.body.data.candidates[0]?.workerId).toBe(workerId);
    expect(JSON.stringify(searchRes.body)).not.toMatch(/"embedding":\[/);

    const eraseRes = await request(app.getHttpServer())
      .delete(`/v1/gallery/workers/${workerId}/biometrics`)
      .send({ requestedBy: 'e2e', reason: 'privacy erase' })
      .expect(200);

    expect(eraseRes.body.data.templatesRemoved).toBeGreaterThanOrEqual(1);
    expect(eraseRes.body.data.auditId).toBeTruthy();
  });
});
