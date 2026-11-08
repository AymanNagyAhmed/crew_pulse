import { describe, expect, it } from 'vitest';
import {
  parseQrTokens,
  parseTokenList,
  verifyAssistedCredential,
} from './assisted-credentials.js';

describe('assisted-credentials', () => {
  it('parses comma-separated tokens', () => {
    expect(parseTokenList(' a, b ,c ')).toEqual(['a', 'b', 'c']);
    expect(parseQrTokens(undefined)).toEqual([]);
  });

  it('accepts matching PIN, QR, and badge', () => {
    expect(
      verifyAssistedCredential({
        method: 'supervisor_pin',
        credential: '1234',
        supervisorPin: '1234',
        qrTokens: [],
        badgeTokens: [],
      }),
    ).toBe(true);
    expect(
      verifyAssistedCredential({
        method: 'qr',
        credential: 'tok-b',
        supervisorPin: 'x',
        qrTokens: ['tok-a', 'tok-b'],
        badgeTokens: [],
      }),
    ).toBe(true);
    expect(
      verifyAssistedCredential({
        method: 'badge',
        credential: 'badge-9',
        supervisorPin: 'x',
        qrTokens: [],
        badgeTokens: ['badge-1', 'badge-9'],
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
        badgeTokens: [],
      }),
    ).toBe(false);
    expect(
      verifyAssistedCredential({
        method: 'badge',
        credential: 'nope',
        supervisorPin: 'x',
        qrTokens: [],
        badgeTokens: ['badge-1'],
      }),
    ).toBe(false);
  });
});
