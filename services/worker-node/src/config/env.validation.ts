function required(name: string, value: string | undefined): string {
  if (!value || value.trim() === '') {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

export type WorkerEnv = {
  NODE_ENV: string;
  WORKER_NODE_PORT: number;
  REDIS_URL: string;
  DATABASE_URL: string;
  VISION_ENGINE_URL: string;
  ATTENDANCE_COOLDOWN_SECONDS: number;
  VISION_CIRCUIT_FAILURE_THRESHOLD: number;
  VISION_CIRCUIT_OPEN_MS: number;
  CHECK_IN_QUEUE_MAX_WAITING: number;
  CHECK_IN_QUEUE_WARN_DEPTH: number;
};

export function validateEnv(config: Record<string, unknown>): WorkerEnv {
  const nodeEnv = String(config.NODE_ENV ?? 'development');
  const isTest = nodeEnv === 'test';

  const portRaw = String(config.WORKER_NODE_PORT ?? '3001');
  const port = Number(portRaw);
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error(`Invalid WORKER_NODE_PORT: ${portRaw}`);
  }

  const cooldownRaw = String(config.ATTENDANCE_COOLDOWN_SECONDS ?? '60');
  const cooldown = Number(cooldownRaw);
  if (!Number.isInteger(cooldown) || cooldown < 0) {
    throw new Error(`Invalid ATTENDANCE_COOLDOWN_SECONDS: ${cooldownRaw}`);
  }

  const circuitThreshold = Number(
    config.VISION_CIRCUIT_FAILURE_THRESHOLD ?? 5,
  );
  if (!Number.isInteger(circuitThreshold) || circuitThreshold < 1) {
    throw new Error(
      `Invalid VISION_CIRCUIT_FAILURE_THRESHOLD: ${String(config.VISION_CIRCUIT_FAILURE_THRESHOLD)}`,
    );
  }
  const circuitOpenMs = Number(config.VISION_CIRCUIT_OPEN_MS ?? 30_000);
  if (!Number.isInteger(circuitOpenMs) || circuitOpenMs < 100) {
    throw new Error(
      `Invalid VISION_CIRCUIT_OPEN_MS: ${String(config.VISION_CIRCUIT_OPEN_MS)}`,
    );
  }
  const maxWaiting = Number(config.CHECK_IN_QUEUE_MAX_WAITING ?? 200);
  if (!Number.isInteger(maxWaiting) || maxWaiting < 1) {
    throw new Error(
      `Invalid CHECK_IN_QUEUE_MAX_WAITING: ${String(config.CHECK_IN_QUEUE_MAX_WAITING)}`,
    );
  }
  const warnDepth = Number(config.CHECK_IN_QUEUE_WARN_DEPTH ?? 50);
  if (!Number.isInteger(warnDepth) || warnDepth < 0) {
    throw new Error(
      `Invalid CHECK_IN_QUEUE_WARN_DEPTH: ${String(config.CHECK_IN_QUEUE_WARN_DEPTH)}`,
    );
  }

  if (isTest) {
    return {
      NODE_ENV: nodeEnv,
      WORKER_NODE_PORT: port,
      REDIS_URL: String(config.REDIS_URL ?? 'redis://localhost:16379'),
      DATABASE_URL: String(
        config.DATABASE_URL ?? 'postgresql://test:test@localhost:15434/crewpulse',
      ),
      VISION_ENGINE_URL: String(
        config.VISION_ENGINE_URL ?? 'http://localhost:8000',
      ),
      ATTENDANCE_COOLDOWN_SECONDS: cooldown,
      VISION_CIRCUIT_FAILURE_THRESHOLD: circuitThreshold,
      VISION_CIRCUIT_OPEN_MS: circuitOpenMs,
      CHECK_IN_QUEUE_MAX_WAITING: maxWaiting,
      CHECK_IN_QUEUE_WARN_DEPTH: warnDepth,
    };
  }

  return {
    NODE_ENV: nodeEnv,
    WORKER_NODE_PORT: port,
    REDIS_URL: required('REDIS_URL', config.REDIS_URL as string | undefined),
    DATABASE_URL: required(
      'DATABASE_URL',
      config.DATABASE_URL as string | undefined,
    ),
    VISION_ENGINE_URL: required(
      'VISION_ENGINE_URL',
      config.VISION_ENGINE_URL as string | undefined,
    ),
    ATTENDANCE_COOLDOWN_SECONDS: cooldown,
    VISION_CIRCUIT_FAILURE_THRESHOLD: circuitThreshold,
    VISION_CIRCUIT_OPEN_MS: circuitOpenMs,
    CHECK_IN_QUEUE_MAX_WAITING: maxWaiting,
    CHECK_IN_QUEUE_WARN_DEPTH: warnDepth,
  };
}
