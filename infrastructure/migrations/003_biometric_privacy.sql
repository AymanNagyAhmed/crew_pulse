-- C7: encrypt biometric templates at rest; erasure audit + retention markers.
-- Ciphertext cannot use HNSW; roster-scoped search decrypts in api-gateway.
-- Applied on fresh volumes via docker-entrypoint-initdb.d; existing volumes: `make migrate`.

SET search_path TO crewpulse, public;

-- Drop plaintext ANN index + column (cutover: re-enroll templates after migrate).
DROP INDEX IF EXISTS crewpulse.face_templates_embedding_hnsw;

ALTER TABLE crewpulse.face_templates
  ADD COLUMN IF NOT EXISTS embedding_ciphertext bytea,
  ADD COLUMN IF NOT EXISTS encryption_kid text;

-- Wipe any pre-C7 plaintext rows so NOT NULL on ciphertext is safe.
DELETE FROM crewpulse.face_templates
 WHERE embedding_ciphertext IS NULL;

ALTER TABLE crewpulse.face_templates
  DROP COLUMN IF EXISTS embedding;

ALTER TABLE crewpulse.face_templates
  ALTER COLUMN embedding_ciphertext SET NOT NULL,
  ALTER COLUMN encryption_kid SET NOT NULL;

COMMENT ON COLUMN crewpulse.face_templates.embedding_ciphertext IS
  'AES-256-GCM ciphertext (iv||ciphertext||tag); never log or return plaintext vectors';
COMMENT ON COLUMN crewpulse.face_templates.encryption_kid IS
  'Key id for BIOMETRIC_TEMPLATE_KEY rotation (e.g. v1)';

ALTER TABLE crewpulse.workers
  ADD COLUMN IF NOT EXISTS biometric_retention_until timestamptz,
  ADD COLUMN IF NOT EXISTS biometrics_erased_at timestamptz;

COMMENT ON COLUMN crewpulse.workers.biometric_retention_until IS
  'After this instant, retention purge may delete templates (employment/purpose end)';
COMMENT ON COLUMN crewpulse.workers.biometrics_erased_at IS
  'Set when an erase API or retention job removed biometric templates';

CREATE TABLE IF NOT EXISTS crewpulse.biometric_erasure_audit (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  worker_id          text NOT NULL,
  action             text NOT NULL,
  templates_removed  integer NOT NULL DEFAULT 0,
  roster_removed     integer NOT NULL DEFAULT 0,
  requested_by       text,
  reason             text,
  created_at         timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT biometric_erasure_audit_action_chk
    CHECK (action IN ('erase', 'retention_purge'))
);

CREATE INDEX IF NOT EXISTS biometric_erasure_audit_worker_idx
  ON crewpulse.biometric_erasure_audit (worker_id, created_at DESC);

COMMENT ON TABLE crewpulse.biometric_erasure_audit IS
  'Evidence of biometric erasure / retention purge (templates + optional roster)';
