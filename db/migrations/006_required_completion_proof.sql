-- Run once after migration 005. Existing tasks continue to complete without proof.
ALTER TABLE notifications ADD COLUMN requires_completion_proof INTEGER NOT NULL DEFAULT 0
  CHECK (requires_completion_proof IN (0, 1) AND (kind = 'task' OR requires_completion_proof = 0));
