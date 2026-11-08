# frontend_crew_pulse

React + TypeScript SPA (Vite) for CrewPulse. Talks to **api-gateway** only via `VITE_API_BASE_URL`.

## Local smoke (against Compose stack)

```zsh
# from repo root — start postgres, redis, api-gateway, vision-engine, worker-node
make up && make health

# Node 24.22.2, then SPA
source ~/.nvm/nvm.sh && nvm use 24.22.2
cd frontend_crew_pulse
cp -n .env.example .env
npm install
npm run dev
```

Or from the repo root: `make frontend-dev` (expects `make up` already healthy).

Open the printed Vite URL (usually `http://127.0.0.1:5173`). The home screen probes `GET {VITE_API_BASE_URL}/v1/health` and should show **api-gateway reachable**.

### Env

| Variable | Example | Notes |
|----------|---------|--------|
| `VITE_API_BASE_URL` | `http://127.0.0.1:3000` | api-gateway published by Compose |

Gateway CORS must allow the Vite origin (Compose defaults include `5173` / `4173`). See `CORS_ORIGINS` in `infrastructure/env/.env.example`.

### Curl fallback

```zsh
curl -s http://127.0.0.1:3000/v1/health
```
