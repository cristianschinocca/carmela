ALTER TABLE dining_tables ADD COLUMN operator_id UUID REFERENCES employees(id) ON DELETE RESTRICT;
CREATE INDEX dining_tables_operator_id_idx ON dining_tables(operator_id);
ALTER TABLE sales ADD COLUMN operator_id UUID REFERENCES employees(id) ON DELETE RESTRICT, ADD COLUMN operator_name VARCHAR(120);
CREATE INDEX sales_operator_id_idx ON sales(operator_id);
