/** Local/dev only — 32 zero bytes; override in real deploys. */
export const DEV_BIOMETRIC_TEMPLATE_KEY =
  'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=';

export default () => ({
  nodeEnv: process.env.NODE_ENV ?? 'development',
  port: Number(process.env.API_GATEWAY_PORT ?? process.env.PORT ?? 3000),
  databaseUrl: process.env.DATABASE_URL,
  redisUrl: process.env.REDIS_URL,
  visionEngineUrl: process.env.VISION_ENGINE_URL,
  ASSISTED_SUPERVISOR_PIN:
    process.env.ASSISTED_SUPERVISOR_PIN ?? 'dev-pin-change-me',
  ASSISTED_QR_TOKENS: process.env.ASSISTED_QR_TOKENS ?? 'dev-qr-change-me',
  ASSISTED_BADGE_TOKENS: process.env.ASSISTED_BADGE_TOKENS ?? 'dev-badge-change-me',
  BIOMETRIC_TEMPLATE_KEY:
    process.env.BIOMETRIC_TEMPLATE_KEY ?? DEV_BIOMETRIC_TEMPLATE_KEY,
  CHECK_IN_QUEUE_MAX_WAITING: Number(
    process.env.CHECK_IN_QUEUE_MAX_WAITING ?? 200,
  ),
  CHECK_IN_QUEUE_WARN_DEPTH: Number(
    process.env.CHECK_IN_QUEUE_WARN_DEPTH ?? 50,
  ),
  CHECK_IN_DECISION_SLO_P95_MS: Number(
    process.env.CHECK_IN_DECISION_SLO_P95_MS ?? 3000,
  ),
  CAPTURE_PAYROLL_ALLOWED_SOURCES:
    process.env.CAPTURE_PAYROLL_ALLOWED_SOURCES ?? 'managed_station',
});
