CREATE TABLE table_account_operations (
  id UUID PRIMARY KEY,
  table_id UUID NOT NULL,
  payload_hash VARCHAR(64) NOT NULL,
  result_version INTEGER NOT NULL CHECK (result_version > 0),
  created_at TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX table_account_operations_table_id_created_at_idx ON table_account_operations(table_id, created_at);
