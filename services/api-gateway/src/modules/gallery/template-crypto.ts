import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';
import { DomainException } from '../../common/exceptions/domain.exception.js';
import { FACE_EMBEDDING_DIM } from '../database/database.constants.js';

const IV_BYTES = 12;
const TAG_BYTES = 16;
const KEY_BYTES = 32;
/** Float32 little-endian payload length for a 512-d template. */
const PAYLOAD_BYTES = FACE_EMBEDDING_DIM * 4;

export const DEFAULT_TEMPLATE_KEY_ID = 'v1';

/**
 * AES-256-GCM blob layout: iv (12) || ciphertext || authTag (16).
 * Plaintext is Float32LE of an L2-normalized embedding.
 */
export function parseTemplateKey(raw: string | undefined): Buffer {
  const value = raw?.trim();
  if (!value) {
    throw new DomainException(
      'BIOMETRIC_KEY_MISSING',
      'BIOMETRIC_TEMPLATE_KEY is required to store face templates',
      500,
    );
  }
  let key: Buffer;
  try {
    key = Buffer.from(value, 'base64');
  } catch {
    throw new DomainException(
      'BIOMETRIC_KEY_INVALID',
      'BIOMETRIC_TEMPLATE_KEY must be base64-encoded',
      500,
    );
  }
  if (key.length !== KEY_BYTES) {
    throw new DomainException(
      'BIOMETRIC_KEY_INVALID',
      `BIOMETRIC_TEMPLATE_KEY must decode to ${KEY_BYTES} bytes`,
      500,
    );
  }
  return key;
}

export function embeddingToFloat32Buffer(embedding: number[]): Buffer {
  const buf = Buffer.allocUnsafe(PAYLOAD_BYTES);
  for (let i = 0; i < FACE_EMBEDDING_DIM; i++) {
    buf.writeFloatLE(embedding[i]!, i * 4);
  }
  return buf;
}

export function float32BufferToEmbedding(buf: Buffer): number[] {
  if (buf.length !== PAYLOAD_BYTES) {
    throw new DomainException(
      'BIOMETRIC_CIPHERTEXT_INVALID',
      'Decrypted template has unexpected length',
      500,
    );
  }
  const out: number[] = new Array(FACE_EMBEDDING_DIM);
  for (let i = 0; i < FACE_EMBEDDING_DIM; i++) {
    out[i] = buf.readFloatLE(i * 4);
  }
  return out;
}

export function encryptEmbedding(
  embedding: number[],
  key: Buffer,
): { ciphertext: Buffer; kid: string } {
  const iv = randomBytes(IV_BYTES);
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  const plaintext = embeddingToFloat32Buffer(embedding);
  const encrypted = Buffer.concat([cipher.update(plaintext), cipher.final()]);
  const tag = cipher.getAuthTag();
  return {
    ciphertext: Buffer.concat([iv, encrypted, tag]),
    kid: DEFAULT_TEMPLATE_KEY_ID,
  };
}

export function decryptEmbedding(ciphertext: Buffer, key: Buffer): number[] {
  if (ciphertext.length < IV_BYTES + TAG_BYTES + 1) {
    throw new DomainException(
      'BIOMETRIC_CIPHERTEXT_INVALID',
      'Template ciphertext is truncated',
      500,
    );
  }
  const iv = ciphertext.subarray(0, IV_BYTES);
  const tag = ciphertext.subarray(ciphertext.length - TAG_BYTES);
  const data = ciphertext.subarray(IV_BYTES, ciphertext.length - TAG_BYTES);
  const decipher = createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(tag);
  let plaintext: Buffer;
  try {
    plaintext = Buffer.concat([decipher.update(data), decipher.final()]);
  } catch {
    throw new DomainException(
      'BIOMETRIC_DECRYPT_FAILED',
      'Could not decrypt face template (wrong key or corrupt ciphertext)',
      500,
    );
  }
  return float32BufferToEmbedding(plaintext);
}
