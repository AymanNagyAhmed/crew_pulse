# CrewPulse — local orchestration
# Env file: infrastructure/env/.env (copy from .env.example)

COMPOSE_FILE := infrastructure/compose/docker-compose.yml
ENV_FILE := infrastructure/env/.env
ENV_EXAMPLE := infrastructure/env/.env.example

.PHONY: help env up down logs ps build health smoke dev frontend-dev

help:
	@echo "CrewPulse targets:"
	@echo "  make env          - create infrastructure/env/.env from example if missing"
	@echo "  make build        - build api-gateway, vision-engine, worker-node images"
	@echo "  make up           - start infra + services (Compose)"
	@echo "  make down         - stop Compose stack"
	@echo "  make logs         - follow Compose logs"
	@echo "  make ps           - Compose process status"
	@echo "  make health       - check postgres, redis, api-gateway, vision-engine, worker-node"
	@echo "  make smoke        - health + stub vision match + attendance list"
	@echo "  make frontend-dev - run Vite SPA (expects make up + healthy api-gateway)"
	@echo "  make dev          - hint for host-side service dev"

env:
	@test -f $(ENV_FILE) || cp $(ENV_EXAMPLE) $(ENV_FILE)
	@echo "Using $(ENV_FILE)"

build: env
	docker compose --env-file $(ENV_FILE) -f $(COMPOSE_FILE) build api-gateway vision-engine worker-node

up: env
	@if [ ! -f $(COMPOSE_FILE) ] || [ ! -s $(COMPOSE_FILE) ]; then \
		echo "Compose file missing or empty — complete plan step 1.1 first."; \
		exit 1; \
	fi
	docker compose --env-file $(ENV_FILE) -f $(COMPOSE_FILE) up -d --build

down:
	@if [ -f $(COMPOSE_FILE) ]; then \
		docker compose --env-file $(ENV_FILE) -f $(COMPOSE_FILE) down; \
	else \
		echo "No compose file yet."; \
	fi

logs:
	docker compose --env-file $(ENV_FILE) -f $(COMPOSE_FILE) logs -f

ps:
	docker compose --env-file $(ENV_FILE) -f $(COMPOSE_FILE) ps

health: env
	@set -e; \
	. $(ENV_FILE); \
	echo "postgres..."; \
	docker exec crewpulse-postgres pg_isready -U "$${POSTGRES_USER}" -d "$${POSTGRES_DB}" >/dev/null; \
	docker exec crewpulse-postgres psql -U "$${POSTGRES_USER}" -d "$${POSTGRES_DB}" -tAc "SELECT extname FROM pg_extension WHERE extname='vector'" | grep -qx vector; \
	echo "  ok (pg_isready + vector extension)"; \
	echo "redis..."; \
	docker exec crewpulse-redis redis-cli ping | grep -qx PONG; \
	echo "  ok (PONG)"; \
	echo "api-gateway..."; \
	curl -sf "http://127.0.0.1:$${API_GATEWAY_PORT:-3000}/v1/health" | grep -q '"success":true'; \
	echo "  ok (/v1/health)"; \
	echo "vision-engine..."; \
	curl -sf "http://127.0.0.1:$${VISION_ENGINE_PORT:-8000}/health" | grep -q '"status":"ok"'; \
	echo "  ok (/health)"; \
	echo "worker-node..."; \
	curl -sf "http://127.0.0.1:$${WORKER_NODE_PORT:-3001}/v1/health" | grep -q '"success":true'; \
	echo "  ok (/v1/health)"; \
	echo "stack healthy"

smoke: health
	@set -e; \
	. $(ENV_FILE); \
	IMG='iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg=='; \
	echo "vision stub match..."; \
	curl -sf -X POST "http://127.0.0.1:$${VISION_ENGINE_PORT:-8000}/v1/match" \
	  -H 'Content-Type: application/json' \
	  -d "{\"image_base64\":\"$${IMG}\",\"venue_id\":\"ven_smoke\",\"shift_id\":\"shf_smoke\",\"candidate_worker_ids\":[\"wrk_smoke_001\"]}" \
	  | grep -q '"stub":true'; \
	echo "  ok (/v1/match stub)"; \
	echo "attendance list stub..."; \
	curl -sf "http://127.0.0.1:$${API_GATEWAY_PORT:-3000}/v1/attendance" \
	  | grep -q '"success":true'; \
	echo "  ok (/v1/attendance)"; \
	echo "smoke path ok"

frontend-dev:
	@test -d frontend_crew_pulse || { echo "frontend_crew_pulse missing — complete plan step 6.2"; exit 1; }
	@bash -lc 'source ~/.nvm/nvm.sh && nvm use 24.22.2 && \
	  cd frontend_crew_pulse && \
	  test -f .env || cp .env.example .env && \
	  npm install && \
	  npm run dev'

dev:
	@echo "Host-side services (Compose infra only: postgres + redis):"
	@echo "  api-gateway:   cd services/api-gateway && npm run start:dev"
	@echo "  vision-engine: cd services/vision-engine && uvicorn app.main:app --reload --port 8000"
	@echo "  worker-node:   cd services/worker-node && npm run start:dev"
	@echo "  frontend SPA:  make frontend-dev   # after make up && make health"
	@echo "Or full stack: make up && make health"
