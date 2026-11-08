export default () => ({
  nodeEnv: process.env.NODE_ENV ?? 'development',
  port: Number(process.env.API_GATEWAY_PORT ?? process.env.PORT ?? 3000),
  databaseUrl: process.env.DATABASE_URL,
  redisUrl: process.env.REDIS_URL,
  visionEngineUrl: process.env.VISION_ENGINE_URL,
  ASSISTED_SUPERVISOR_PIN:
    process.env.ASSISTED_SUPERVISOR_PIN ?? 'dev-pin-change-me',
  ASSISTED_QR_TOKENS: process.env.ASSISTED_QR_TOKENS ?? 'dev-qr-change-me',
});
