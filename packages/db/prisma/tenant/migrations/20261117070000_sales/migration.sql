ALTER TABLE dining_tables ADD COLUMN discount INTEGER NOT NULL DEFAULT 0 CHECK (discount >= 0);
CREATE TABLE sales (
  id UUID PRIMARY KEY,
  table_id UUID NOT NULL,
  table_name VARCHAR(120) NOT NULL,
  payload_hash VARCHAR(64) NOT NULL,
  guests INTEGER NOT NULL CHECK (guests >= 0),
  subtotal BIGINT NOT NULL CHECK (subtotal >= 0),
  discount BIGINT NOT NULL CHECK (discount >= 0 AND discount <= subtotal),
  total BIGINT NOT NULL CHECK (total = subtotal - discount),
  payment VARCHAR(20) NOT NULL CHECK (payment IN ('Efectivo', 'Tarjeta', 'Transferencia')),
  items JSONB NOT NULL,
  created_at TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX sales_created_at_idx ON sales(created_at);
CREATE TABLE ingredient_sale_movements (
  sale_id UUID NOT NULL REFERENCES sales(id) ON DELETE RESTRICT,
  ingredient_id UUID NOT NULL REFERENCES inventory_ingredients(id) ON DELETE RESTRICT,
  quantity DECIMAL(18,6) NOT NULL CHECK (quantity > 0),
  unit VARCHAR(10) NOT NULL CHECK (unit IN ('unidad', 'kg', 'g', 'l', 'ml')),
  PRIMARY KEY (sale_id, ingredient_id)
);
