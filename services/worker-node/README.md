# worker-node

NestJS BullMQ consumer for CrewPulse attendance logs and webhooks.

```zsh
source ~/.nvm/nvm.sh && nvm use 24.22.2
cp .env.example .env
npm ci
npm run start:dev
# health: GET http://localhost:3001/v1/health
```

Queues: `attendance-log`, `webhooks`. Idempotency via Redis `SET NX` (`worker:idempotency:*`).
