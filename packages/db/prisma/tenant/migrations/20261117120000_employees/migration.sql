CREATE SEQUENCE employee_legacy_id_seq START WITH 1000000000000000;
CREATE TABLE employees (
  id UUID PRIMARY KEY,
  legacy_id BIGINT NOT NULL UNIQUE DEFAULT nextval('employee_legacy_id_seq'::regclass),
  name VARCHAR(120) NOT NULL,
  role VARCHAR(20) NOT NULL CHECK (role IN ('Cajero', 'Mozo', 'Barista', 'Encargado', 'Propietario')),
  active BOOLEAN NOT NULL DEFAULT TRUE,
  pay JSONB,
  pin_hash VARCHAR(200) NOT NULL,
  pin_lookup CHAR(64) UNIQUE,
  deleted_at TIMESTAMPTZ(6),
  version INTEGER NOT NULL DEFAULT 0 CHECK (version >= 0),
  created_at TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ(6) NOT NULL
);
CREATE INDEX employees_active_name_idx ON employees(active, name);
