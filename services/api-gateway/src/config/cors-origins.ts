/** Default browser origins for local Vite (`npm run dev` / `preview`). */
export const DEFAULT_DEV_CORS_ORIGINS = [
  'http://127.0.0.1:5173',
  'http://localhost:5173',
  'http://127.0.0.1:4173',
  'http://localhost:4173',
] as const;

/**
 * Parse `CORS_ORIGINS` (comma-separated). Empty / unset → `undefined`
 * so callers can apply env-specific defaults.
 */
export function parseCorsOrigins(
  raw: string | undefined,
): string[] | undefined {
  if (raw === undefined) {
    return undefined;
  }
  const list = raw
    .split(',')
    .map((origin) => origin.trim())
    .filter((origin) => origin.length > 0);
  return list.length > 0 ? list : undefined;
}
