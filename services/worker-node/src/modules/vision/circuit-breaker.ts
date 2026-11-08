export type CircuitState = 'closed' | 'open' | 'half_open';

/**
 * Consecutive-failure breaker for vision HTTP (C9).
 * Prevents retry stampedes when the dependency is rate-limited or down.
 */
export class CircuitBreaker {
  private failures = 0;
  private openedAtMs: number | null = null;
  private state: CircuitState = 'closed';

  constructor(
    private readonly failureThreshold: number,
    private readonly openMs: number,
    private readonly now: () => number = () => Date.now(),
  ) {}

  getState(): CircuitState {
    this.refresh();
    return this.state;
  }

  snapshot(): { state: CircuitState; failures: number; openMs: number } {
    this.refresh();
    return {
      state: this.state,
      failures: this.failures,
      openMs: this.openMs,
    };
  }

  /** Throws if calls must not proceed. */
  assertAllow(): void {
    this.refresh();
    if (this.state === 'open') {
      throw new CircuitOpenError(this.openMs);
    }
  }

  recordSuccess(): void {
    this.failures = 0;
    this.openedAtMs = null;
    this.state = 'closed';
  }

  recordFailure(opts?: { openImmediately?: boolean }): void {
    this.failures += 1;
    if (
      opts?.openImmediately ||
      this.state === 'half_open' ||
      this.failures >= this.failureThreshold
    ) {
      this.state = 'open';
      this.openedAtMs = this.now();
    }
  }

  private refresh(): void {
    if (this.state !== 'open' || this.openedAtMs === null) {
      return;
    }
    if (this.now() - this.openedAtMs >= this.openMs) {
      this.state = 'half_open';
    }
  }
}

export class CircuitOpenError extends Error {
  readonly code = 'VISION_CIRCUIT_OPEN';

  constructor(readonly openMs: number) {
    super(`vision circuit open; retry after ~${openMs}ms`);
    this.name = 'CircuitOpenError';
  }
}
