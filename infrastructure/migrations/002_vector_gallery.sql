-- C4: roster-scoped face gallery + HNSW ANN index (online upserts, no full rebuild).
-- Applied on fresh volumes via docker-entrypoint-initdb.d; existing volumes: `make migrate`.

SET search_path TO crewpulse, public;

CREATE TABLE IF NOT EXISTS crewpulse.workers (
  worker_id   text PRIMARY KEY,
  display_name text,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS crewpulse.venues (
  venue_id    text PRIMARY KEY,
  name        text,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS crewpulse.shifts (
  shift_id    text PRIMARY KEY,
  venue_id    text NOT NULL REFERENCES crewpulse.venues (venue_id) ON DELETE CASCADE,
  label       text,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS shifts_venue_id_idx ON crewpulse.shifts (venue_id);

-- Eligible workers for 1:N at a venue/shift (cuts N and false-match risk).
CREATE TABLE IF NOT EXISTS crewpulse.shift_roster (
  venue_id    text NOT NULL REFERENCES crewpulse.venues (venue_id) ON DELETE CASCADE,
  shift_id    text NOT NULL REFERENCES crewpulse.shifts (shift_id) ON DELETE CASCADE,
  worker_id   text NOT NULL REFERENCES crewpulse.workers (worker_id) ON DELETE CASCADE,
  enrolled_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (venue_id, shift_id, worker_id)
);

CREATE INDEX IF NOT EXISTS shift_roster_shift_idx
  ON crewpulse.shift_roster (venue_id, shift_id);

-- FaceNet-class templates (512-d). Upsert by (worker_id, model_version, template_version).
CREATE TABLE IF NOT EXISTS crewpulse.face_templates (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  worker_id         text NOT NULL REFERENCES crewpulse.workers (worker_id) ON DELETE CASCADE,
  model_version     text NOT NULL,
  template_version  integer NOT NULL DEFAULT 1,
  embedding         vector(512) NOT NULL,
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now(),
  UNIQUE (worker_id, model_version, template_version)
);

CREATE INDEX IF NOT EXISTS face_templates_worker_model_idx
  ON crewpulse.face_templates (worker_id, model_version);

-- HNSW for cosine distance; online inserts update the graph without full rebuild.
CREATE INDEX IF NOT EXISTS face_templates_embedding_hnsw
  ON crewpulse.face_templates
  USING hnsw (embedding vector_cosine_ops)
  WITH (m = 16, ef_construction = 64);

COMMENT ON TABLE crewpulse.face_templates IS
  'Biometric templates for 1:N; never log embedding payloads; search via roster join + HNSW';
COMMENT ON INDEX crewpulse.face_templates_embedding_hnsw IS
  'pgvector HNSW (cosine); pair with shift_roster filters for venue/shift-scoped search';
