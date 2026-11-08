import { describe, expect, it } from 'vitest';
import { DomainException } from '../../common/exceptions/domain.exception.js';
import { FACE_EMBEDDING_DIM } from '../database/database.constants.js';
import {
  assertEmbeddingDim,
  l2Normalize,
  toPgVectorLiteral,
} from './embedding.util.js';

function sampleEmbedding(seed = 1): number[] {
  return Array.from({ length: FACE_EMBEDDING_DIM }, (_, i) =>
    Math.sin((i + 1) * seed * 0.017),
  );
}

describe('embedding.util', () => {
  it('rejects wrong dimension', () => {
    expect(() => assertEmbeddingDim([1, 2, 3])).toThrow(DomainException);
  });

  it('l2-normalizes to unit length', () => {
    const n = l2Normalize(sampleEmbedding(2));
    const sumSquares = n.reduce((acc, v) => acc + v * v, 0);
    expect(sumSquares).toBeCloseTo(1, 10);
  });

  it('formats pgvector literal', () => {
    const lit = toPgVectorLiteral(l2Normalize(sampleEmbedding(3)));
    expect(lit.startsWith('[')).toBe(true);
    expect(lit.endsWith(']')).toBe(true);
    expect(lit.split(',').length).toBe(FACE_EMBEDDING_DIM);
  });
});
