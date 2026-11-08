# worker-node

NestJS BullMQ consumer for CrewPulse attendance logs and webhooks.

```zsh
source ~/.nvm/nvm.sh && nvm use 24.22.2
cp .env.example .env
npm ci
npm run start:dev
# health: GET http://localhost:3001/v1/health
```

Queues: `attendance-check-in`, `attendance-log`, `webhooks`. Idempotency via Redis `SET NX` (`worker:idempotency:*`). Vision HTTP uses a consecutive-failure circuit breaker (C9). Capture history is stored separately from verified attendance. See `infrastructure/docs/async-pipeline-slos.md`.
