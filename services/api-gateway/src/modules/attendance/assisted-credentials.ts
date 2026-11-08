import { timingSafeEqual } from 'node:crypto';

function safeEqual(a: string, b: string): boolean {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  if (left.length !== right.length) {
    return false;
  }
  return timingSafeEqual(left, right);
}

export function parseQrTokens(raw: string | undefined): string[] {
  if (!raw?.trim()) {
    return [];
  }
  return raw
    .split(',')
    .map((t) => t.trim())
    .filter((t) => t.length > 0);
}

export function verifyAssistedCredential(input: {
  method: 'supervisor_pin' | 'qr';
  credential: string;
  supervisorPin: string;
  qrTokens: string[];
}): boolean {
  const credential = input.credential.trim();
  if (!credential) {
    return false;
  }
  if (input.method === 'supervisor_pin') {
    return safeEqual(credential, input.supervisorPin);
  }
  return input.qrTokens.some((token) => safeEqual(credential, token));
}
