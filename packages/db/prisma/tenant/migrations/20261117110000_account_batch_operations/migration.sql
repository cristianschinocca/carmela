CREATE TABLE account_batch_operations (
  id UUID PRIMARY KEY,
  payload_hash VARCHAR(64) NOT NULL,
  versions JSONB NOT NULL,
  created_at TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
