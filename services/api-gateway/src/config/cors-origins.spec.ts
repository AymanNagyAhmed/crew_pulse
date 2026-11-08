import { describe, expect, it } from 'vitest';
import {
  DEFAULT_DEV_CORS_ORIGINS,
  parseCorsOrigins,
} from './cors-origins.js';

describe('parseCorsOrigins', () => {
  it('returns undefined when unset', () => {
    expect(parseCorsOrigins(undefined)).toBeUndefined();
  });

  it('returns undefined for blank string', () => {
    expect(parseCorsOrigins('  ,  ')).toBeUndefined();
  });

  it('splits and trims a comma-separated list', () => {
    expect(
      parseCorsOrigins(' http://127.0.0.1:5173 ,http://localhost:5173 '),
    ).toEqual(['http://127.0.0.1:5173', 'http://localhost:5173']);
  });

  it('keeps the Vite default list for local SPA smoke', () => {
    expect(DEFAULT_DEV_CORS_ORIGINS).toContain('http://127.0.0.1:5173');
    expect(DEFAULT_DEV_CORS_ORIGINS).toContain('http://localhost:4173');
  });
});
