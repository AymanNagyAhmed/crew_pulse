import { randomBytes } from 'node:crypto';
import type { IncomingMessage } from 'node:http';

export function resolveRequestId(req: IncomingMessage): string {
  const header = req.headers['x-request-id'];
  const fromHeader = Array.isArray(header) ? header[0] : header;
  if (fromHeader && fromHeader.trim().length > 0) {
    return fromHeader.trim();
  }
  return `req_${randomBytes(12).toString('hex')}`;
}
