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
  ATTENDANCE_COOLDOWN_SECONDS: number;
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

  if (isTest) {
    return {
      NODE_ENV: nodeEnv,
      WORKER_NODE_PORT: port,
      REDIS_URL: String(config.REDIS_URL ?? 'redis://localhost:16379'),
      DATABASE_URL: String(
        config.DATABASE_URL ?? 'postgresql://test:test@localhost:15434/crewpulse',
      ),
      ATTENDANCE_COOLDOWN_SECONDS: cooldown,
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
    ATTENDANCE_COOLDOWN_SECONDS: cooldown,
  };
}
