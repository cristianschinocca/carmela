CREATE TABLE cash_shifts (
 id UUID PRIMARY KEY, opening_amount BIGINT NOT NULL CHECK (opening_amount >= 0),
 opened_at TIMESTAMPTZ(6) NOT NULL DEFAULT now(), opened_by VARCHAR(120) NOT NULL,
 closed_at TIMESTAMPTZ(6), closed_by VARCHAR(120), expected_amount BIGINT, counted_amount BIGINT,
 difference_reason VARCHAR(500), version INTEGER NOT NULL DEFAULT 0,
 CHECK ((closed_at IS NULL AND closed_by IS NULL AND expected_amount IS NULL AND counted_amount IS NULL AND difference_reason IS NULL) OR
        (closed_at IS NOT NULL AND closed_by IS NOT NULL AND expected_amount IS NOT NULL AND counted_amount >= 0))
);
CREATE UNIQUE INDEX cash_single_open_shift ON cash_shifts ((1)) WHERE closed_at IS NULL;
CREATE TABLE cash_movements (
 id UUID PRIMARY KEY, shift_id UUID NOT NULL REFERENCES cash_shifts(id) ON DELETE RESTRICT,
 kind VARCHAR(20) NOT NULL CHECK (kind IN ('proveedor','empleado','gasto','ajuste','retiro')),
 direction VARCHAR(3) NOT NULL CHECK (direction IN ('in','out')),
 amount BIGINT NOT NULL CHECK (amount > 0), payment VARCHAR(20) NOT NULL CHECK (payment IN ('Efectivo','Tarjeta','Transferencia')),
 concept VARCHAR(200) NOT NULL, party VARCHAR(120) NOT NULL, receipt VARCHAR(120) NOT NULL,
 employee_id UUID REFERENCES employees(id) ON DELETE RESTRICT, employee_payment JSONB,
 voided_at TIMESTAMPTZ(6), created_at TIMESTAMPTZ(6) NOT NULL DEFAULT now(), created_by VARCHAR(120) NOT NULL,
 version INTEGER NOT NULL DEFAULT 0,
 CHECK ((kind = 'empleado' AND employee_id IS NOT NULL AND employee_payment IS NOT NULL) OR (kind <> 'empleado' AND employee_id IS NULL AND employee_payment IS NULL)),
 CHECK ((kind = 'ajuste' AND payment = 'Efectivo') OR (kind = 'retiro' AND payment = 'Efectivo' AND direction = 'out') OR (kind NOT IN ('ajuste','retiro') AND direction = 'out'))
);
CREATE INDEX cash_movements_shift_id_created_at_idx ON cash_movements(shift_id, created_at);
CREATE TABLE cash_operations (id UUID PRIMARY KEY, payload_hash CHAR(64) NOT NULL, actor_id VARCHAR(120) NOT NULL, payload JSONB NOT NULL, result JSONB NOT NULL, created_at TIMESTAMPTZ(6) NOT NULL DEFAULT now());
