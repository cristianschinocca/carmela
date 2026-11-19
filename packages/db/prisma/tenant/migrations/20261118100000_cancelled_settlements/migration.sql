CREATE TABLE settlement_attempts (
  id UUID PRIMARY KEY,
  table_id UUID NOT NULL,
  status VARCHAR(12) NOT NULL CHECK (status IN ('pending', 'completed', 'cancelled')),
  created_at TIMESTAMPTZ(6) NOT NULL DEFAULT now()
);
