CREATE TABLE IF NOT EXISTS receipts (
  id TEXT PRIMARY KEY,
  job_id TEXT REFERENCES jobs(id),
  receipt_type TEXT NOT NULL,
  data JSONB NOT NULL,
  receipt_hash TEXT NOT NULL,
  base_anchor_tx TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_receipts_hash ON receipts(receipt_hash);
