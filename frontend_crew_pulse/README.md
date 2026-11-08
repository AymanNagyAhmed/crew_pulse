# frontend_crew_pulse

CrewPulse React + TypeScript SPA (Vite). Talks to **api-gateway** only via `VITE_API_BASE_URL`.

## Prerequisites

- Node **24.22.2** (`source ~/.nvm/nvm.sh && nvm use 24.22.2`)
- Local stack up: `make up` from the repo root (api-gateway on `:3000`)

## Setup

```zsh
cp .env.example .env
npm install
npm run dev
```

Open the URL Vite prints (usually `http://127.0.0.1:5173`).

## Scripts

| Script | Purpose |
|--------|---------|
| `npm run dev` | Vite dev server |
| `npm run build` | Typecheck + production build |
| `npm run preview` | Preview production build |
| `npm run lint` | oxlint |

UI guidance: `.cursor/skills/frontend-ui-design/` and `.cursor/rules/frontend-react.mdc`.
