export default () => ({
  NODE_ENV: process.env.NODE_ENV,
  WORKER_NODE_PORT: Number(process.env.WORKER_NODE_PORT ?? 3001),
  REDIS_URL: process.env.REDIS_URL,
  DATABASE_URL: process.env.DATABASE_URL,
  ATTENDANCE_COOLDOWN_SECONDS: Number(
    process.env.ATTENDANCE_COOLDOWN_SECONDS ?? 60,
  ),
});
