import { describe, expect, it } from 'vitest';
import {
  parseQrTokens,
  verifyAssistedCredential,
} from './assisted-credentials.js';

describe('assisted-credentials', () => {
  it('parses comma-separated QR tokens', () => {
    expect(parseQrTokens(' a, b ,c ')).toEqual(['a', 'b', 'c']);
    expect(parseQrTokens(undefined)).toEqual([]);
  });

  it('accepts matching PIN and QR', () => {
    expect(
      verifyAssistedCredential({
        method: 'supervisor_pin',
        credential: '1234',
        supervisorPin: '1234',
        qrTokens: [],
      }),
    ).toBe(true);
    expect(
      verifyAssistedCredential({
        method: 'qr',
        credential: 'tok-b',
        supervisorPin: 'x',
        qrTokens: ['tok-a', 'tok-b'],
      }),
    ).toBe(true);
  });

  it('rejects mismatches', () => {
    expect(
      verifyAssistedCredential({
        method: 'supervisor_pin',
        credential: '9999',
        supervisorPin: '1234',
        qrTokens: [],
      }),
    ).toBe(false);
  });
});
