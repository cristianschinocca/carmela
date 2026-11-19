ALTER TABLE sales ADD COLUMN cash_shift_id UUID REFERENCES cash_shifts(id) ON DELETE RESTRICT;
CREATE INDEX sales_cash_shift_id_payment_idx ON sales(cash_shift_id, payment);
