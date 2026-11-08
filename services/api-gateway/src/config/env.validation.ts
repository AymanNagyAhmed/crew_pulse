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
  /** Dev/local supervisor PIN for PPE-assisted check-ins (C5) */
  ASSISTED_SUPERVISOR_PIN?: string;
  /** Comma-separated station QR tokens for assisted check-ins */
  ASSISTED_QR_TOKENS?: string;
  /** Comma-separated badge swipe tokens for non-biometric punches (C7) */
  ASSISTED_BADGE_TOKENS?: string;
  /** Base64 AES-256 key for face template ciphertext at rest (C7) */
  BIOMETRIC_TEMPLATE_KEY?: string;
  /** Reject new check-ins when waiting+delayed >= this (C9) */
  CHECK_IN_QUEUE_MAX_WAITING?: number;
  /** Warn / alert when depth reaches this before shift start (C9) */
  CHECK_IN_QUEUE_WARN_DEPTH?: number;
  /** Target p95 enqueue→decision latency in ms (C9 SLO) */
  CHECK_IN_DECISION_SLO_P95_MS?: number;
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

  const pinRaw = config.ASSISTED_SUPERVISOR_PIN;
  const assistedPin =
    typeof pinRaw === 'string' && pinRaw.trim() !== ''
      ? pinRaw.trim()
      : undefined;
  const qrRaw = config.ASSISTED_QR_TOKENS;
  const assistedQr =
    typeof qrRaw === 'string' && qrRaw.trim() !== '' ? qrRaw.trim() : undefined;
  const badgeRaw = config.ASSISTED_BADGE_TOKENS;
  const assistedBadge =
    typeof badgeRaw === 'string' && badgeRaw.trim() !== ''
      ? badgeRaw.trim()
      : undefined;
  const keyRaw = config.BIOMETRIC_TEMPLATE_KEY;
  const biometricKey =
    typeof keyRaw === 'string' && keyRaw.trim() !== ''
      ? keyRaw.trim()
      : undefined;

  /** Local/dev default — 32 zero bytes base64; never use in production. */
  const defaultBiometricKey =
    'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=';

  const maxWaiting = Number(config.CHECK_IN_QUEUE_MAX_WAITING ?? 200);
  const warnDepth = Number(config.CHECK_IN_QUEUE_WARN_DEPTH ?? 50);
  const sloP95 = Number(config.CHECK_IN_DECISION_SLO_P95_MS ?? 3000);

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
      ASSISTED_SUPERVISOR_PIN: assistedPin ?? 'dev-pin-change-me',
      ASSISTED_QR_TOKENS: assistedQr ?? 'dev-qr-change-me',
      ASSISTED_BADGE_TOKENS: assistedBadge ?? 'dev-badge-change-me',
      BIOMETRIC_TEMPLATE_KEY: biometricKey ?? defaultBiometricKey,
      CHECK_IN_QUEUE_MAX_WAITING: maxWaiting,
      CHECK_IN_QUEUE_WARN_DEPTH: warnDepth,
      CHECK_IN_DECISION_SLO_P95_MS: sloP95,
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
    ASSISTED_SUPERVISOR_PIN: assistedPin ?? 'dev-pin-change-me',
    ASSISTED_QR_TOKENS: assistedQr ?? 'dev-qr-change-me',
    ASSISTED_BADGE_TOKENS: assistedBadge ?? 'dev-badge-change-me',
    BIOMETRIC_TEMPLATE_KEY: biometricKey ?? defaultBiometricKey,
    CHECK_IN_QUEUE_MAX_WAITING: maxWaiting,
    CHECK_IN_QUEUE_WARN_DEPTH: warnDepth,
    CHECK_IN_DECISION_SLO_P95_MS: sloP95,
  };
}
