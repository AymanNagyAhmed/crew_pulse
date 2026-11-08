import { timingSafeEqual } from 'node:crypto';

export type AssistedMethod = 'supervisor_pin' | 'qr' | 'badge';

function safeEqual(a: string, b: string): boolean {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  if (left.length !== right.length) {
    return false;
  }
  return timingSafeEqual(left, right);
}

export function parseTokenList(raw: string | undefined): string[] {
  if (!raw?.trim()) {
    return [];
  }
  return raw
    .split(',')
    .map((t) => t.trim())
    .filter((t) => t.length > 0);
}

/** @deprecated Prefer parseTokenList — kept for existing imports. */
export function parseQrTokens(raw: string | undefined): string[] {
  return parseTokenList(raw);
}

export function verifyAssistedCredential(input: {
  method: AssistedMethod;
  credential: string;
  supervisorPin: string;
  qrTokens: string[];
  badgeTokens: string[];
}): boolean {
  const credential = input.credential.trim();
  if (!credential) {
    return false;
  }
  if (input.method === 'supervisor_pin') {
    return safeEqual(credential, input.supervisorPin);
  }
  if (input.method === 'qr') {
    return input.qrTokens.some((token) => safeEqual(credential, token));
  }
  return input.badgeTokens.some((token) => safeEqual(credential, token));
}
