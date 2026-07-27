-- Unique partial index: at most one 'open' cash session per device.
-- Same pattern as orders_open_table_unique (one open order per table).
CREATE UNIQUE INDEX IF NOT EXISTS cash_sessions_open_device_unique
  ON cash_sessions (device_id)
  WHERE status = 'open';
