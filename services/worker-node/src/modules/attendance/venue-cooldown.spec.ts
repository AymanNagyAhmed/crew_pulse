import { describe, expect, it } from 'vitest';
import { resolveVenueCooldownSeconds } from './venue-cooldown.js';

describe('resolveVenueCooldownSeconds', () => {
  it('uses per-venue override when present', () => {
    expect(resolveVenueCooldownSeconds('ven_a', 60, 'ven_a:90,ven_b:30')).toBe(
      90,
    );
    expect(resolveVenueCooldownSeconds('ven_b', 60, 'ven_a:90,ven_b:30')).toBe(
      30,
    );
  });

  it('falls back to global default', () => {
    expect(resolveVenueCooldownSeconds('ven_x', 60, 'ven_a:90')).toBe(60);
    expect(resolveVenueCooldownSeconds('ven_x', 60, undefined)).toBe(60);
  });
});
