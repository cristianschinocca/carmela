ALTER TABLE employees ADD COLUMN clocked_in BOOLEAN NOT NULL DEFAULT FALSE, ADD COLUMN clocked_in_at TIMESTAMPTZ(6);
ALTER TABLE employees ADD CONSTRAINT employees_clock_state_check CHECK ((clocked_in AND clocked_in_at IS NOT NULL) OR (NOT clocked_in AND clocked_in_at IS NULL));
CREATE TABLE attendance_operations (
  id UUID PRIMARY KEY,
  status VARCHAR(12) NOT NULL CHECK (status IN ('completed','cancelled')),
  payload_hash VARCHAR(64),
  employee_id UUID REFERENCES employees(id) ON DELETE RESTRICT,
  employee_name VARCHAR(120),
  kind VARCHAR(10) CHECK (kind IN ('Entrada','Salida')),
  occurred_at TIMESTAMPTZ(6),
  actor_id VARCHAR(120) NOT NULL,
  created_at TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CHECK ((status = 'cancelled' AND payload_hash IS NULL AND employee_id IS NULL AND employee_name IS NULL AND kind IS NULL AND occurred_at IS NULL) OR (status = 'completed' AND payload_hash IS NOT NULL AND employee_id IS NOT NULL AND employee_name IS NOT NULL AND kind IS NOT NULL AND occurred_at IS NOT NULL))
);
CREATE INDEX attendance_operations_employee_id_occurred_at_idx ON attendance_operations(employee_id, occurred_at);
CREATE TABLE attendance_guards (
  id CHAR(64) PRIMARY KEY,
  attempts INTEGER NOT NULL DEFAULT 0 CHECK (attempts >= 0),
  window_start TIMESTAMPTZ(6) NOT NULL,
  blocked_until TIMESTAMPTZ(6)
);
