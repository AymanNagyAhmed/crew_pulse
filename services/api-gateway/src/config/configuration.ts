export default () => ({
  nodeEnv: process.env.NODE_ENV ?? 'development',
  port: Number(process.env.API_GATEWAY_PORT ?? process.env.PORT ?? 3000),
  databaseUrl: process.env.DATABASE_URL,
  redisUrl: process.env.REDIS_URL,
  visionEngineUrl: process.env.VISION_ENGINE_URL,
});
