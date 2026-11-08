export const PG_POOL = Symbol('PG_POOL');

/** Facenet512-compatible length; must match `vector(512)` in migrations. */
export const FACE_EMBEDDING_DIM = 512 as const;

export const DEFAULT_FACE_MODEL_VERSION = 'Facenet512';
