-- CrewPulse bootstrap (applied once on fresh Postgres volume)
CREATE EXTENSION IF NOT EXISTS vector;
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Schema placeholder; domain tables arrive with api-gateway Prisma/SQL migrations later.
CREATE SCHEMA IF NOT EXISTS crewpulse;

COMMENT ON SCHEMA crewpulse IS 'Application schema for workers, venues, shifts, attendance, embeddings';
