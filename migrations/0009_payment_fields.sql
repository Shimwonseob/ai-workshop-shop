ALTER TABLE orders ADD COLUMN payment_key TEXT;
ALTER TABLE orders ADD COLUMN payment_method TEXT;
ALTER TABLE orders ADD COLUMN paid_at TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS idx_orders_payment_key
  ON orders(payment_key)
  WHERE payment_key IS NOT NULL;
