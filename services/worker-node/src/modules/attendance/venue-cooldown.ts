/**
 * Per-venue cooldown seconds (C11). Falls back to the global default.
 * Config form: `ven_a:90,ven_b:45` or plain number via global env.
 */
export function resolveVenueCooldownSeconds(
  venueId: string,
  globalDefault: number,
  byVenueRaw?: string,
): number {
  const raw =
    typeof byVenueRaw === 'string'
      ? byVenueRaw
      : byVenueRaw === undefined || byVenueRaw === null
        ? ''
        : String(byVenueRaw);
  if (!raw.trim()) {
    return globalDefault;
  }
  for (const part of raw.split(',')) {
    const [id, secRaw] = part.split(':').map((s) => s.trim());
    if (!id || secRaw === undefined) {
      continue;
    }
    if (id === venueId) {
      const n = Number(secRaw);
      if (Number.isInteger(n) && n >= 0) {
        return n;
      }
    }
  }
  return globalDefault;
}
