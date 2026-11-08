function required(name: string, value: string | undefined): string {
  if (!value || value.trim() === '') {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

export type AppEnv = {
  NODE_ENV: string;
  API_GATEWAY_PORT: number;
  DATABASE_URL: string;
  REDIS_URL: string;
  VISION_ENGINE_URL: string;
  /** Comma-separated browser origins; optional */
  CORS_ORIGINS?: string;
};

export function validateEnv(config: Record<string, unknown>): AppEnv {
  const nodeEnv = String(config.NODE_ENV ?? 'development');
  const isTest = nodeEnv === 'test';

  const portRaw = String(config.API_GATEWAY_PORT ?? config.PORT ?? '3000');
  const port = Number(portRaw);
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error(`Invalid API_GATEWAY_PORT: ${portRaw}`);
  }

  const corsRaw = config.CORS_ORIGINS;
  const corsOrigins =
    typeof corsRaw === 'string' && corsRaw.trim() !== ''
      ? corsRaw.trim()
      : undefined;

  if (isTest) {
    return {
      NODE_ENV: nodeEnv,
      API_GATEWAY_PORT: port,
      DATABASE_URL: String(config.DATABASE_URL ?? 'postgresql://test:test@localhost:15434/crewpulse'),
      REDIS_URL: String(config.REDIS_URL ?? 'redis://localhost:16379'),
      VISION_ENGINE_URL: String(
        config.VISION_ENGINE_URL ?? 'http://localhost:8000',
      ),
      ...(corsOrigins !== undefined ? { CORS_ORIGINS: corsOrigins } : {}),
    };
  }

  return {
    NODE_ENV: nodeEnv,
    API_GATEWAY_PORT: port,
    DATABASE_URL: required('DATABASE_URL', config.DATABASE_URL as string | undefined),
    REDIS_URL: required('REDIS_URL', config.REDIS_URL as string | undefined),
    VISION_ENGINE_URL: required(
      'VISION_ENGINE_URL',
      config.VISION_ENGINE_URL as string | undefined,
    ),
    ...(corsOrigins !== undefined ? { CORS_ORIGINS: corsOrigins } : {}),
  };
}
