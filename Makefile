# CrewPulse — local orchestration
# Env file: infrastructure/env/.env (copy from .env.example)

COMPOSE_FILE := infrastructure/compose/docker-compose.yml
ENV_FILE := infrastructure/env/.env
ENV_EXAMPLE := infrastructure/env/.env.example

.PHONY: help env up down logs ps dev health

help:
	@echo "CrewPulse targets:"
	@echo "  make env     - create infrastructure/env/.env from example if missing"
	@echo "  make up      - start infra (Compose)"
	@echo "  make down    - stop Compose stack"
	@echo "  make logs    - follow Compose logs"
	@echo "  make ps      - Compose process status"
	@echo "  make health  - check postgres + redis (phase 1)"
	@echo "  make dev     - hint for local service dev (phase 2+)"

env:
	@test -f $(ENV_FILE) || cp $(ENV_EXAMPLE) $(ENV_FILE)
	@echo "Using $(ENV_FILE)"

up: env
	@if [ ! -f $(COMPOSE_FILE) ] || [ ! -s $(COMPOSE_FILE) ]; then \
		echo "Compose file missing or empty — complete plan step 1.1 first."; \
		exit 1; \
	fi
	docker compose --env-file $(ENV_FILE) -f $(COMPOSE_FILE) up -d

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
	echo "infra healthy"

dev:
	@echo "Phase 2+: run services with nvm use 24.22.2"
	@echo "  api-gateway:  cd services/api-gateway && npm run start:dev"
	@echo "  vision-engine: cd services/vision-engine && uvicorn app.main:app --reload --port 8000"
	@echo "  worker-node:  cd services/worker-node && npm run start:dev"
