import { createHash, randomBytes } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { DomainException } from '../../common/exceptions/domain.exception.js';
import { FACE_EMBEDDING_DIM } from '../database/database.constants.js';
import { l2Normalize } from './embedding.util.js';
import {
  decryptEmbedding,
  encryptEmbedding,
  parseTemplateKey,
} from './template-crypto.js';

function sampleEmbedding(seed = 1): number[] {
  return Array.from({ length: FACE_EMBEDDING_DIM }, (_, i) =>
    Math.sin((i + 1) * seed * 0.017),
  );
}

describe('template-crypto', () => {
  const key = randomBytes(32);

  it('round-trips an L2-normalized embedding', () => {
    const embedding = l2Normalize(sampleEmbedding(4));
    const { ciphertext, kid } = encryptEmbedding(embedding, key);
    expect(kid).toBe('v1');
    expect(ciphertext.length).toBeGreaterThan(FACE_EMBEDDING_DIM);
    const restored = decryptEmbedding(ciphertext, key);
    for (let i = 0; i < 8; i++) {
      expect(restored[i]).toBeCloseTo(embedding[i]!, 5);
    }
  });

  it('rejects wrong key material', () => {
    const embedding = l2Normalize(sampleEmbedding(5));
    const { ciphertext } = encryptEmbedding(embedding, key);
    expect(() => decryptEmbedding(ciphertext, randomBytes(32))).toThrow(
      DomainException,
    );
  });

  it('parses base64 keys of 32 bytes', () => {
    const raw = key.toString('base64');
    expect(parseTemplateKey(raw).equals(key)).toBe(true);
    expect(() => parseTemplateKey(undefined)).toThrow(DomainException);
    expect(() =>
      parseTemplateKey(createHash('sha256').digest('hex')),
    ).toThrow(DomainException);
  });
});
