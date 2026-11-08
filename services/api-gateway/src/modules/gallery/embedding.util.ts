import { DomainException } from '../../common/exceptions/domain.exception.js';
import { FACE_EMBEDDING_DIM } from '../database/database.constants.js';

export function assertEmbeddingDim(embedding: number[]): void {
  if (embedding.length !== FACE_EMBEDDING_DIM) {
    throw new DomainException(
      'INVALID_EMBEDDING_DIM',
      `Embedding must have length ${FACE_EMBEDDING_DIM}`,
      400,
      [
        {
          field: 'embedding',
          issue: `expected ${FACE_EMBEDDING_DIM}, got ${embedding.length}`,
        },
      ],
    );
  }
  if (embedding.some((v) => !Number.isFinite(v))) {
    throw new DomainException(
      'INVALID_EMBEDDING_VALUE',
      'Embedding values must be finite numbers',
      400,
      [{ field: 'embedding', issue: 'contains non-finite value' }],
    );
  }
}

/** L2-normalize so cosine distance via pgvector `<=>` is well-defined. */
export function l2Normalize(embedding: number[]): number[] {
  assertEmbeddingDim(embedding);
  let sumSquares = 0;
  for (const v of embedding) {
    sumSquares += v * v;
  }
  const norm = Math.sqrt(sumSquares);
  if (norm === 0) {
    throw new DomainException(
      'INVALID_EMBEDDING_VALUE',
      'Embedding must be non-zero',
      400,
      [{ field: 'embedding', issue: 'zero vector' }],
    );
  }
  return embedding.map((v) => v / norm);
}

export function toPgVectorLiteral(embedding: number[]): string {
  return `[${embedding.join(',')}]`;
}
